<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Un cambio del precio de venta de una presentación: de cuánto a cuánto, cuándo y quién (registerUser_id).
 * Solo historial: las ventas guardan sus propios montos. Se crea solo desde ProductPresentation::booted().
 */
class ProductPriceHistory extends Model
{
    use Auditable;

    public const SOURCE_CREATION = 'creacion';

    public const SOURCE_EDIT = 'edicion';

    protected $fillable = ['product_id', 'product_presentation_id', 'presentation_name', 'old_price', 'new_price', 'source'];

    protected function casts(): array
    {
        return ['old_price' => 'decimal:2', 'new_price' => 'decimal:2'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function presentation(): BelongsTo
    {
        return $this->belongsTo(ProductPresentation::class, 'product_presentation_id')->withTrashed();
    }
}
