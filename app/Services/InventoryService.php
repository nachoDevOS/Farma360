<?php

namespace App\Services;

use App\Exceptions\BusinessException;
use App\Models\Batch;
use App\Models\Product;
use App\Models\StockMovement;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

/**
 * INVENTARIO: la ÚNICA forma de cambiar el stock.
 * Cada entrada o salida cambia la cantidad del lote y deja su movimiento en el kardex (stock_movements).
 * Llamarlo siempre dentro de DB::transaction() (lo hacen los otros servicios).
 */
class InventoryService
{
    /** Stock de un producto en una sucursal (suma de sus lotes, vencidos incluidos). */
    public function stock(int $productId, int $branchId): int
    {
        return (int) Batch::where('product_id', $productId)->where('branch_id', $branchId)->sum('quantity');
    }

    /** Stock que se puede vender (lotes sin vencer). */
    public function sellableStock(int $productId, int $branchId): int
    {
        return (int) Batch::where('product_id', $productId)->where('branch_id', $branchId)->sellable()->sum('quantity');
    }

    /**
     * Crea un lote vacío (sin stock). Después se le suma con increase().
     *
     * @param  array{product_id: int, branch_id: int, batch_number: string, expires_at: mixed, unit_cost: float|string}  $data
     */
    public function createBatch(array $data): Batch
    {
        return Batch::create($data + ['quantity' => 0]);
    }

    /** ENTRADA: suma unidades base al lote. */
    public function increase(Batch $batch, int $units, string $type, ?Model $reference = null, ?string $note = null): StockMovement
    {
        if ($units <= 0) {
            throw new BusinessException('La cantidad debe ser mayor a cero.');
        }

        $batch = $this->lock($batch);
        $batch->increment('quantity', $units);

        return $this->record($batch, $units, $type, $reference, $note);
    }

    /** SALIDA: resta unidades base del lote. Falla si el lote no tiene suficiente. */
    public function decrease(Batch $batch, int $units, string $type, ?Model $reference = null, ?string $note = null): StockMovement
    {
        if ($units <= 0) {
            throw new BusinessException('La cantidad debe ser mayor a cero.');
        }

        $batch = $this->lock($batch);

        if ($batch->quantity < $units) {
            throw new BusinessException("Stock insuficiente en el lote {$batch->batch_number}: hay {$batch->quantity} y se piden {$units}.");
        }

        $batch->decrement('quantity', $units);

        return $this->record($batch, -$units, $type, $reference, $note);
    }

    /**
     * FEFO (First Expired, First Out): de qué lotes sacar $units unidades, empezando por el que vence primero.
     * No cambia el stock, solo decide. Los lotes vencidos nunca se usan.
     * $reserved = unidades de cada lote ya tomadas por otra línea de la misma operación [batch_id => unidades].
     *
     * @param  array<int, int>  $reserved
     * @return Collection<int, array{batch: Batch, units: int}>
     */
    public function allocate(int $productId, int $branchId, int $units, array &$reserved = []): Collection
    {
        $batches = Batch::with('activePromotion')
            ->where('product_id', $productId)
            ->where('branch_id', $branchId)
            ->sellable()
            ->orderBy('expires_at')
            ->orderBy('id')
            ->get()
            ->each(fn (Batch $batch) => $batch->quantity -= $reserved[$batch->id] ?? 0);

        $available = $batches->sum('quantity');
        if ($available < $units) {
            $name = Product::find($productId)?->name ?? 'el producto';
            throw new BusinessException("Stock insuficiente de {$name}: hay {$available} y se piden {$units}.");
        }

        $allocation = collect();
        $pending = $units;

        foreach ($batches as $batch) {
            if ($pending === 0) {
                break;
            }
            $take = min($pending, $batch->quantity);
            if ($take <= 0) {
                continue;
            }
            $allocation->push(['batch' => $batch, 'units' => $take]);
            $reserved[$batch->id] = ($reserved[$batch->id] ?? 0) + $take;
            $pending -= $take;
        }

        return $allocation;
    }

    /** Vuelve a leer el lote bloqueándolo: dos ventas al mismo tiempo no pueden sacar el mismo stock. */
    private function lock(Batch $batch): Batch
    {
        return Batch::whereKey($batch->getKey())->lockForUpdate()->firstOrFail();
    }

    private function record(Batch $batch, int $quantity, string $type, ?Model $reference, ?string $note): StockMovement
    {
        return StockMovement::create([
            'product_id' => $batch->product_id,
            'branch_id' => $batch->branch_id,
            'batch_id' => $batch->id,
            'type' => $type,
            'quantity' => $quantity,
            'unit_cost' => $batch->unit_cost,
            'balance' => $this->stock($batch->product_id, $batch->branch_id),
            'reference_type' => $reference?->getMorphClass(),
            'reference_id' => $reference?->getKey(),
            'note' => $note,
        ]);
    }
}
