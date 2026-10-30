<?php

namespace App\Services;

use App\Models\Batch;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\StockMovement;
use App\Models\Transfer;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * REGISTRO DE CADA LOTE: de dónde vino, la cuenta (entró + ventas, transferencias, ajustes, bajas = queda hoy) y sus
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
     *   summary   cuánto entró al principio y, por grupo, lo que se movió después: ventas, transferencias, ajustes,
     *             bajas y anulación de compra (con signo). entrada + todo = stock de hoy.
     *   movements los últimos 15 movimientos del lote, con el saldo DEL LOTE después de cada uno
     *
     * @param  list<int>  $branchIds
     * @return list<array<string, mixed>>
     */
    public function for(int $productId, array $branchIds, bool $withRecentlyEmpty = true): array
    {
        $batches = Batch::with(['activePromotion', 'registeredBy:id,name'])
            ->where('product_id', $productId)->whereIn('branch_id', $branchIds)
            ->where(fn ($q) => $q->where('quantity', '>', 0)->when($withRecentlyEmpty, fn ($q) => $q->orWhere('updated_at', '>=', now()->subDays(30))))
            ->orderBy('expires_at')
            ->get();
        if ($batches->isEmpty()) {
            return [];
        }
        $ids = $batches->modelKeys();
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
            $initial = $first && $first->quantity > 0 ? $first->quantity : 0;
            // Lo que entró al principio no cuenta como ajuste ni como transferencia
            $firstType = $first?->type;
            $group = fn (string $key, string $label, array $types) => [
                'key' => $key,
                'label' => $label,
                'units' => $sumOf($types) - ($first && in_array($firstType, $types, true) ? $initial : 0),
                'count' => $countOf($types) - ($first && in_array($firstType, $types, true) ? 1 : 0),
            ];

            // Últimos movimientos, con el saldo del lote: se reconstruye hacia atrás desde el stock de hoy
            $balance = $batch->quantity;
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
                        'ajuste_entrada' => 'ingreso',
                        default => 'otro',
                    },
                    ...$this->movementRow($first),
                ] : null,
                'initial' => $initial,
                'summary' => array_values(array_filter([
                    $group('ventas', 'Vendido', ['venta', 'anulacion_venta']),
                    $group('transferencias', 'Transferencias', ['transferencia_salida', 'transferencia_entrada', 'anulacion_transferencia']),
                    $group('ajustes', 'Ajustes', ['ajuste_entrada', 'ajuste_salida']),
                    $group('bajas', 'Bajas (vencido / dañado)', ['baja']),
                    $group('anulacion_compra', 'Anulación de compra', ['anulacion_compra']),
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
