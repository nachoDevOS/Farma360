<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * LOTE: el stock real vive aquí. quantity = unidades base disponibles en esa sucursal.
 * Nunca se cambia quantity directo: se usa App\Services\InventoryService (deja el movimiento en el kardex).
 */
class Batch extends Model
{
    use Auditable;

    protected $fillable = ['product_id', 'branch_id', 'batch_number', 'expires_at', 'quantity', 'unit_cost'];

    protected function casts(): array
    {
        return ['expires_at' => 'date', 'quantity' => 'integer', 'unit_cost' => 'decimal:4'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function movements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    /** Promoción por vencimiento vigente (como mucho una). */
    public function activePromotion(): HasOne
    {
        return $this->hasOne(BatchPromotion::class)->where('is_active', true)->latestOfMany();
    }

    /** Lotes que se pueden vender: con stock y sin vencer. */
    public function scopeSellable(Builder $query): void
    {
        $query->where('quantity', '>', 0)->whereDate('expires_at', '>=', today());
    }

    public function isExpired(): bool
    {
        return $this->expires_at->lt(today());
    }

    /** Días que faltan para vencer (negativo = ya venció). */
    public function daysToExpire(): int
    {
        return (int) today()->diffInDays($this->expires_at, false);
    }
}
