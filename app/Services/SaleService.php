<?php

namespace App\Services;

use App\Exceptions\BusinessException;
use App\Models\CashSession;
use App\Models\Customer;
use App\Models\ProductPresentation;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * PUNTO DE VENTA.
 *
 * Por cada producto del carrito:
 *   1. Pasa la cantidad a unidades base (2 blísters x10 = 20 tabletas).
 *   2. Elige los lotes con FEFO: primero el que vence antes (InventoryService::allocate). Nunca lotes vencidos.
 *   3. Si el lote tiene promoción por vencimiento, cobra su precio con descuento.
 *   4. Si las unidades salen de 2 lotes, se guardan 2 ítems (cada uno con su precio y su costo).
 * Los pagos pueden combinarse (efectivo + QR). El cambio solo se da en efectivo.
 */
class SaleService
{
    public function __construct(private InventoryService $inventory, private CashService $cash) {}

    /**
     * @param  array{items: list<array{product_presentation_id: int, quantity: int}>,
     *     payments: list<array{method: string, amount: float|string, reference?: ?string}>,
     *     customer_id?: ?int, customer_name?: ?string, customer_document?: ?string,
     *     prescription_number?: ?string, prescription_doctor?: ?string}  $data
     */
    public function create(CashSession $session, User $user, array $data): Sale
    {
        if ($session->user_id !== $user->id) {
            throw new BusinessException('Solo puedes vender en tu propio turno de caja.');
        }
        $this->cash->ensureOpen($session);

        return DB::transaction(function () use ($session, $data) {
            // 1-3. Armar las líneas (todavía sin tocar el stock)
            $lines = [];
            $reserved = [];
            $needsPrescription = false;

            foreach ($data['items'] as $row) {
                $presentation = ProductPresentation::with('product')->findOrFail($row['product_presentation_id']);
                $product = $presentation->product;

                if (! $product->is_active) {
                    throw new BusinessException("{$product->name} está desactivado.");
                }
                $needsPrescription = $needsPrescription || $product->is_controlled;

                $units = (int) $row['quantity'] * $presentation->factor;
                $unitPrice = (float) $presentation->sale_price / $presentation->factor;

                foreach ($this->inventory->allocate($product->id, $session->branch_id, $units, $reserved) as $allocation) {
                    $batch = $allocation['batch'];
                    $discount = (float) ($batch->activePromotion?->discount_percent ?? 0);

                    $lines[] = [
                        'product_id' => $product->id,
                        'product_presentation_id' => $presentation->id,
                        'batch' => $batch,
                        'units' => $allocation['units'],
                        'factor' => $presentation->factor,
                        'list_price' => $presentation->sale_price,
                        'discount_percent' => $discount,
                        'subtotal' => round($unitPrice * $allocation['units'] * (1 - $discount / 100), 2),
                        'unit_cost' => $batch->unit_cost,
                    ];
                }
            }

            if ($lines === []) {
                throw new BusinessException('Agrega al menos un producto.');
            }
            if ($needsPrescription && (blank($data['prescription_number'] ?? null) || blank($data['prescription_doctor'] ?? null))) {
                throw new BusinessException('Hay un medicamento controlado: registra el número de receta y el médico.');
            }

            $total = round(array_sum(array_column($lines, 'subtotal')), 2);

            // Pagos
            $payments = collect($data['payments'] ?? [])
                ->map(fn ($p) => ['method' => $p['method'], 'amount' => round((float) $p['amount'], 2), 'reference' => $p['reference'] ?? null])
                ->filter(fn ($p) => $p['amount'] > 0)
                ->values();
            $paid = round($payments->sum('amount'), 2);
            $cash = round($payments->where('method', 'efectivo')->sum('amount'), 2);
            $nonCash = round($paid - $cash, 2);

            if ($paid < $total) {
                throw new BusinessException('El pago no alcanza: faltan '.number_format($total - $paid, 2).'.');
            }
            if ($nonCash > $total) {
                throw new BusinessException('Los pagos con QR, tarjeta o transferencia no pueden superar el total.');
            }
            $change = round($paid - $total, 2);

            // Cliente
            $customer = isset($data['customer_id']) ? Customer::find($data['customer_id']) : null;

            $sale = Sale::create([
                'branch_id' => $session->branch_id,
                'cash_session_id' => $session->id,
                'customer_id' => $customer?->id,
                'customer_name' => $customer?->name ?? (($data['customer_name'] ?? '') ?: 'S/N'),
                'customer_document' => $customer?->document_number ?? ($data['customer_document'] ?? null),
                'total' => $total,
                'cash_received' => $cash,
                'change' => $change,
                'prescription_number' => $data['prescription_number'] ?? null,
                'prescription_doctor' => $data['prescription_doctor'] ?? null,
                'status' => 'completada',
            ]);

            // 4. Sacar el stock y guardar los ítems
            foreach ($lines as $line) {
                $this->inventory->decrease($line['batch'], $line['units'], 'venta', $sale);
                $sale->items()->create(['batch_id' => $line['batch']->id] + collect($line)->except('batch')->all());
            }

            // Se guarda lo que realmente quedó en caja: el efectivo menos el cambio
            foreach ($payments as $payment) {
                if ($payment['method'] === 'efectivo') {
                    $payment['amount'] = round($payment['amount'] - $change, 2);
                }
                if ($payment['amount'] > 0) {
                    $sale->payments()->create($payment);
                }
            }

            return $sale;
        });
    }

    /** Anula la venta: el stock vuelve a los mismos lotes. Solo mientras su turno de caja siga abierto. */
    public function cancel(Sale $sale, string $reason, User $user): Sale
    {
        return DB::transaction(function () use ($sale, $reason, $user) {
            $sale = Sale::with('items.batch', 'cashSession')->whereKey($sale->id)->lockForUpdate()->firstOrFail();

            if ($sale->status !== 'completada') {
                throw new BusinessException("La venta {$sale->number} ya está anulada.");
            }
            if (! $sale->cashSession->isOpen()) {
                throw new BusinessException('No se puede anular: el turno de caja de esta venta ya se cerró.');
            }

            foreach ($sale->items as $item) {
                $this->inventory->increase($item->batch, $item->units, 'anulacion_venta', $sale, $reason);
            }

            $sale->forceFill([
                'status' => 'anulada',
                'cancelled_at' => now(),
                'cancelUser_id' => $user->id,
                'cancel_reason' => $reason,
            ])->save();

            return $sale;
        });
    }
}
