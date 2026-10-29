<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Descuento por vencimiento aplicado a un lote. registerUser_id = quién lo aprobó.
 */
class BatchPromotion extends Model
{
    use Auditable;

    protected $fillable = ['batch_id', 'discount_percent', 'source', 'is_active', 'below_cost'];

    protected function casts(): array
    {
        return ['discount_percent' => 'decimal:2', 'is_active' => 'boolean', 'below_cost' => 'boolean'];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }
}
