<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;

/**
 * Regla automática: si a un lote le faltan days_before días o menos para vencer, se sugiere discount_percent de descuento.
 */
class ExpiryPromotionRule extends Model
{
    use Auditable;

    protected $fillable = ['days_before', 'discount_percent', 'is_active'];

    protected function casts(): array
    {
        return ['days_before' => 'integer', 'discount_percent' => 'decimal:2', 'is_active' => 'boolean'];
    }
}
