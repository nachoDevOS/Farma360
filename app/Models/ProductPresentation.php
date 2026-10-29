<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Forma de vender un producto: Unidad (factor 1), Blíster x10 (factor 10), Caja x100 (factor 100).
 */
class ProductPresentation extends Model
{
    use Auditable;

    protected $fillable = ['product_id', 'name', 'factor', 'sale_price', 'barcode'];

    protected function casts(): array
    {
        return ['factor' => 'integer', 'sale_price' => 'decimal:2'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
