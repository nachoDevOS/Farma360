<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * LOTE: el stock real vive aquí, en unidades base y en una sucursal.
 *   received_quantity = lo que ENTRÓ al lote (compra, ingreso sin compra, transferencia recibida). Las ventas no lo tocan.
 *   stock             = lo que QUEDA ahora.
 * Nunca se cambian directo: se usa App\Services\InventoryService (deja el movimiento en el kardex).
 */
class Batch extends Model
{
    use Auditable;

    protected $fillable = ['product_id', 'branch_id', 'batch_number', 'expires_at', 'received_quantity', 'stock', 'unit_cost'];

    protected function casts(): array
    {
        return ['expires_at' => 'date', 'received_quantity' => 'integer', 'stock' => 'integer', 'unit_cost' => 'decimal:4'];
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

    /** Lotes que se pueden vender: con stock y sin vencer (los que no tienen vencimiento nunca vencen). */
    public function scopeSellable(Builder $query): void
    {
        $query->where('stock', '>', 0)
            ->where(fn (Builder $q) => $q->whereNull('expires_at')->orWhereDate('expires_at', '>=', today()));
    }

    /** FEFO: primero el que vence antes; los lotes sin vencimiento van al final. */
    public function scopeOrderByExpiry(Builder $query): void
    {
        $query->orderByRaw('expires_at IS NULL')->orderBy('expires_at');
    }

    public function isExpired(): bool
    {
        return $this->expires_at?->lt(today()) ?? false;
    }

    /** Días que faltan para vencer (negativo = ya venció; null = el lote no tiene vencimiento). */
    public function daysToExpire(): ?int
    {
        return $this->expires_at ? (int) today()->diffInDays($this->expires_at, false) : null;
    }
}
