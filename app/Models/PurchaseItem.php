<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Ítem de una compra. Cada ítem crea su propio lote.
 */
class PurchaseItem extends Model
{
    use Auditable;

    protected $fillable = [
        'purchase_id', 'product_id', 'product_presentation_id', 'quantity', 'factor', 'units',
        'cost', 'unit_cost', 'subtotal', 'batch_number', 'expires_at', 'batch_id',
    ];

    protected function casts(): array
    {
        return ['expires_at' => 'date', 'cost' => 'decimal:2', 'unit_cost' => 'decimal:4', 'subtotal' => 'decimal:2'];
    }

    public function purchase(): BelongsTo
    {
        return $this->belongsTo(Purchase::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function presentation(): BelongsTo
    {
        return $this->belongsTo(ProductPresentation::class, 'product_presentation_id');
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }
}
