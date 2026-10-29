<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Ítem de una venta. Hay uno por cada lote usado (si 1 caja salió de 2 lotes, son 2 ítems).
 */
class SaleItem extends Model
{
    use Auditable;

    protected $fillable = [
        'sale_id', 'product_id', 'product_presentation_id', 'batch_id', 'units', 'factor',
        'list_price', 'discount_percent', 'subtotal', 'unit_cost',
    ];

    protected function casts(): array
    {
        return [
            'units' => 'integer',
            'factor' => 'integer',
            'list_price' => 'decimal:2',
            'discount_percent' => 'decimal:2',
            'subtotal' => 'decimal:2',
            'unit_cost' => 'decimal:4',
        ];
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
