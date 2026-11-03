<?php

namespace App\Services;

use App\Models\Batch;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\StockMovement;
use App\Models\Transfer;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Collection;

/**
 * REGISTRO DE CADA LOTE: de dónde vino, la cuenta (recibido + ventas, transferencias, ajustes, bajas = stock de hoy) y sus
 * últimos movimientos con el saldo del lote. Lo usan la pestaña "Lotes" del inventario (InventoryController@show) y la
 * pestaña "Stock por sucursal" de la ficha del producto (ProductController@show). Pantalla: inventory/batch-detail.tsx.
 */
class BatchHistory
{
    /** Movimientos que se muestran en el detalle de cada lote (los más recientes). */
    public const MOVEMENTS = 15;

    /**
     * Lotes del producto en las sucursales pedidas (con stock; con $withRecentlyEmpty también los que se vaciaron en los
     * últimos 30 días), el que vence primero adelante, cada uno con su registro completo:
     *   origin    de dónde vino (compra, ingreso sin compra, transferencia recibida): fecha, documento, quién
     *   summary   por grupo, lo que salió o volvió después de recibirlo: ventas, transferencias enviadas, ajustes y
     *             bajas (con signo). received_quantity + todo = stock de hoy. Las recepciones (compra, ingreso sin
     *             compra, transferencia recibida) y su anulación ya están en received_quantity: no van en el resumen.
     *   movements los últimos 15 movimientos del lote, con el saldo DEL LOTE después de cada uno
     *
     * @param  list<int>  $branchIds
     * @return list<array<string, mixed>>
     */
    public function for(int $productId, array $branchIds, bool $withRecentlyEmpty = true): array
    {
        return $this->describe(Batch::with(['activePromotion', 'registeredBy:id,name'])
            ->where('product_id', $productId)->whereIn('branch_id', $branchIds)
            ->where(fn ($q) => $q->where('stock', '>', 0)->when($withRecentlyEmpty, fn ($q) => $q->orWhere('updated_at', '>=', now()->subDays(30))))
            ->orderByExpiry()
            ->get());
    }

    /**
     * Los lotes pedidos (aunque estén vacíos), en ese orden, con su registro completo. Ej: los lotes de una compra.
     *
     * @param  list<int>  $batchIds
     * @return list<array<string, mixed>>
     */
    public function forBatches(array $batchIds): array
    {
        $batches = Batch::with(['activePromotion', 'registeredBy:id,name'])->whereIn('id', $batchIds)->get()->keyBy('id');

        return $this->describe(collect($batchIds)->map(fn (int $id) => $batches->get($id))->filter()->values());
    }

    /**
     * @param  Collection<int, Batch>  $batches
     * @return list<array<string, mixed>>
     */
    private function describe(Collection $batches): array
    {
        if ($batches->isEmpty()) {
            return [];
        }
        $ids = $batches->pluck('id')->all();
        $withReference = fn (Builder $q) => $q->with([
            'registeredBy:id,name',
            'reference' => fn (MorphTo $morph) => $morph->morphWith([
                Purchase::class => ['supplier:id,name'],
                Transfer::class => ['fromBranch:id,name', 'toBranch:id,name'],
            ]),
        ]);

        // Primer movimiento de cada lote = cómo entró
        $firsts = StockMovement::query()->tap($withReference)
            ->whereIn('id', StockMovement::whereIn('batch_id', $ids)->groupBy('batch_id')->selectRaw('MIN(id)'))
            ->get()
            ->keyBy('batch_id');
        // Totales por lote y tipo (todo el historial, sin traer cada venta)
        $totals = StockMovement::whereIn('batch_id', $ids)
            ->groupBy('batch_id', 'type')
            ->selectRaw('batch_id, type, SUM(quantity) as total, COUNT(*) as count')
            ->get()
            ->groupBy('batch_id');

        return $batches->map(function (Batch $batch) use ($firsts, $totals, $withReference) {
            $first = $firsts->get($batch->id);
            $byType = $totals->get($batch->id, collect())->keyBy('type');
            $sumOf = fn (array $types) => (int) collect($types)->sum(fn (string $type) => (int) ($byType->get($type)?->total ?? 0));
            $countOf = fn (array $types) => (int) collect($types)->sum(fn (string $type) => (int) ($byType->get($type)?->count ?? 0));
            $group = fn (string $key, string $label, array $types) => [
                'key' => $key,
                'label' => $label,
                'units' => $sumOf($types),
                'count' => $countOf($types),
            ];

            // Últimos movimientos, con el saldo del lote: se reconstruye hacia atrás desde el stock de hoy
            $balance = $batch->stock;
            $movements = StockMovement::query()->tap($withReference)
                ->where('batch_id', $batch->id)
                ->latest('id')
                ->limit(self::MOVEMENTS)
                ->get()
                ->map(function (StockMovement $movement) use (&$balance) {
                    $row = [...$this->movementRow($movement), 'batch_balance' => $balance];
                    $balance -= $movement->quantity;

                    return $row;
                });

            return [
                ...$batch->toArray(),
                'days_left' => $batch->daysToExpire(),
                'origin' => $first ? [
                    'kind' => match ($first->type) {
                        'compra' => 'compra',
                        'transferencia_entrada' => 'transferencia',
                        'ingreso' => 'ingreso',
                        default => 'otro',
                    },
                    ...$this->movementRow($first),
                ] : null,
                'summary' => array_values(array_filter([
                    $group('ventas', 'Vendido', ['venta', 'anulacion_venta']),
                    $group('transferencias', 'Transferencias enviadas', ['transferencia_salida', 'anulacion_transferencia']),
                    $group('ajustes', 'Ajustes', ['ajuste_entrada', 'ajuste_salida']),
                    $group('bajas', 'Bajas (vencido / dañado)', ['baja']),
                ], fn (array $row) => $row['count'] > 0)),
                'movements_count' => $countOf(array_keys(StockMovement::TYPES)),
                'movements' => $movements,
            ];
        })->all();
    }

    /**
     * Un movimiento para la pantalla, con su documento (compra, venta o transferencia) si tiene.
     *
     * @return array{id: int, date: string, type: string, quantity: int, note: ?string, user: ?string, role: ?string, document: ?array{kind: string, id: int, label: string}}
     */
    public function movementRow(StockMovement $movement): array
    {
        $reference = $movement->reference;

        return [
            'id' => $movement->id,
            'date' => $movement->created_at->toIso8601String(),
            'type' => $movement->type,
            'quantity' => $movement->quantity,
            'note' => $movement->note,
            'user' => $movement->registeredBy?->name,
            'role' => $movement->registerRole,
            'document' => match (true) {
                $reference instanceof Purchase => [
                    'kind' => 'compra',
                    'id' => $reference->id,
                    'label' => collect([
                        'Compra '.($reference->number ?? "#{$reference->id}"),
                        $reference->invoice_number ? "factura {$reference->invoice_number}" : null,
                        $reference->supplier?->name,
                    ])->filter()->implode(' · '),
                ],
                $reference instanceof Sale => ['kind' => 'venta', 'id' => $reference->id, 'label' => 'Venta '.($reference->number ?? "#{$reference->id}")],
                $reference instanceof Transfer => [
                    'kind' => 'transferencia',
                    'id' => $reference->id,
                    'label' => 'Transferencia '.($reference->number ?? "#{$reference->id}").' · '.$reference->fromBranch?->name.' → '.$reference->toBranch?->name,
                ],
                default => null,
            },
        ];
    }
}
