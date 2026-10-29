<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * KARDEX: un movimiento de stock. Nunca se edita; cada entrada o salida es una fila nueva.
 */
class StockMovement extends Model
{
    use Auditable;

    /** Tipos de movimiento y su nombre en pantalla. */
    public const TYPES = [
        'compra' => 'Compra',
        'venta' => 'Venta',
        'ajuste_entrada' => 'Ajuste (entrada)',
        'ajuste_salida' => 'Ajuste (salida)',
        'baja' => 'Baja (vencido / dañado)',
        'transferencia_salida' => 'Transferencia enviada',
        'transferencia_entrada' => 'Transferencia recibida',
        'anulacion_compra' => 'Anulación de compra',
        'anulacion_venta' => 'Anulación de venta',
        'anulacion_transferencia' => 'Anulación de transferencia',
    ];

    protected $fillable = ['product_id', 'branch_id', 'batch_id', 'type', 'quantity', 'unit_cost', 'balance', 'reference_type', 'reference_id', 'note'];

    protected function casts(): array
    {
        return ['quantity' => 'integer', 'balance' => 'integer', 'unit_cost' => 'decimal:4'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function reference(): MorphTo
    {
        return $this->morphTo();
    }
}
