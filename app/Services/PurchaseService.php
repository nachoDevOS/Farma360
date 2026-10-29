<?php

namespace App\Services;

use App\Exceptions\BusinessException;
use App\Models\ProductPresentation;
use App\Models\Purchase;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * COMPRAS: registrar la mercadería que llega (cada ítem crea un lote) y anular.
 */
class PurchaseService
{
    public function __construct(private InventoryService $inventory) {}

    /**
     * @param  array{branch_id: int, supplier_id: int, invoice_number?: ?string, purchased_at: string, note?: ?string,
     *     items: list<array{product_presentation_id: int, quantity: int, cost: float|string, batch_number: string, expires_at: string}>}  $data
     */
    public function create(array $data): Purchase
    {
        return DB::transaction(function () use ($data) {
            $purchase = Purchase::create([
                'branch_id' => $data['branch_id'],
                'supplier_id' => $data['supplier_id'],
                'invoice_number' => $data['invoice_number'] ?? null,
                'purchased_at' => $data['purchased_at'],
                'note' => $data['note'] ?? null,
                'total' => 0,
            ]);

            $total = 0;

            foreach ($data['items'] as $row) {
                $presentation = ProductPresentation::findOrFail($row['product_presentation_id']);
                $quantity = (int) $row['quantity'];
                $cost = round((float) $row['cost'], 2);
                $units = $quantity * $presentation->factor;
                $unitCost = round($cost / $presentation->factor, 4);
                $subtotal = round($quantity * $cost, 2);

                $batch = $this->inventory->createBatch([
                    'product_id' => $presentation->product_id,
                    'branch_id' => $purchase->branch_id,
                    'batch_number' => $row['batch_number'],
                    'expires_at' => $row['expires_at'],
                    'unit_cost' => $unitCost,
                ]);

                $this->inventory->increase($batch, $units, 'compra', $purchase);

                $purchase->items()->create([
                    'product_id' => $presentation->product_id,
                    'product_presentation_id' => $presentation->id,
                    'quantity' => $quantity,
                    'factor' => $presentation->factor,
                    'units' => $units,
                    'cost' => $cost,
                    'unit_cost' => $unitCost,
                    'subtotal' => $subtotal,
                    'batch_number' => $row['batch_number'],
                    'expires_at' => $row['expires_at'],
                    'batch_id' => $batch->id,
                ]);

                $total += $subtotal;
            }

            $purchase->update(['total' => round($total, 2)]);

            return $purchase;
        });
    }

    /**
     * Anula la compra: saca del stock lo que entró. Solo si sus lotes todavía tienen esas unidades
     * (si ya se vendió o transfirió parte, primero hay que anular esas operaciones).
     */
    public function cancel(Purchase $purchase, string $reason, User $user): Purchase
    {
        return DB::transaction(function () use ($purchase, $reason, $user) {
            $purchase = Purchase::whereKey($purchase->id)->lockForUpdate()->firstOrFail();

            if ($purchase->status !== 'registrada') {
                throw new BusinessException('Esta compra ya está anulada.');
            }

            foreach ($purchase->items()->with('batch')->get() as $item) {
                if ($item->batch->quantity < $item->units) {
                    throw new BusinessException("No se puede anular: del lote {$item->batch_number} ya se usaron unidades (ventas o transferencias).");
                }
                $this->inventory->decrease($item->batch, $item->units, 'anulacion_compra', $purchase, $reason);
            }

            $purchase->forceFill([
                'status' => 'anulada',
                'cancelled_at' => now(),
                'cancelUser_id' => $user->id,
                'cancel_reason' => $reason,
            ])->save();

            return $purchase;
        });
    }
}
