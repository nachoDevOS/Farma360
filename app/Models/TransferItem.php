<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Ítem de una transferencia: cuántas unidades base de qué lote.
 */
class TransferItem extends Model
{
    use Auditable;

    protected $fillable = ['transfer_id', 'product_id', 'batch_id', 'destination_batch_id', 'batch_number', 'expires_at', 'unit_cost', 'quantity'];

    protected function casts(): array
    {
        return ['expires_at' => 'date', 'unit_cost' => 'decimal:4', 'quantity' => 'integer'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }
}
