<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Descuento por vencimiento aplicado a un lote. registerUser_id = quién lo aprobó.
 * Sin presentaciones, discount_percent vale para todo el lote. Con presentaciones, solo esas tienen descuento y cada una
 * lleva su % en el pivote (ej: blíster 10%, caja 20%, tableta nada); discount_percent guarda el más alto.
 */
class BatchPromotion extends Model
{
    use Auditable;

    protected $fillable = ['batch_id', 'discount_percent', 'source', 'is_active', 'below_cost'];

    /** Siempre se muestra a qué presentaciones aplica. */
    protected $with = ['presentations:id,name'];

    protected function casts(): array
    {
        return ['discount_percent' => 'decimal:2', 'is_active' => 'boolean', 'below_cost' => 'boolean'];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function presentations(): BelongsToMany
    {
        return $this->belongsToMany(ProductPresentation::class, 'batch_promotion_presentation')->withPivot('discount_percent')->withTrashed();
    }

    /** Descuento en % al vender esa presentación. 0 = no tiene. */
    public function discountFor(ProductPresentation $presentation): float
    {
        if ($this->presentations->isEmpty()) {
            return (float) $this->discount_percent;
        }

        return (float) ($this->presentations->firstWhere('id', $presentation->id)?->pivot->discount_percent ?? 0);
    }
}
