<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Caja física / punto de venta de una sucursal (ej: "Caja 1"). No tiene usuario fijo: la usa el cajero que abre un turno en ella.
 */
class CashRegister extends Model
{
    use Auditable, HasFactory;

    protected $fillable = ['branch_id', 'name', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(CashSession::class);
    }

    /** El turno abierto ahora (como mucho uno): dice quién tiene la caja. */
    public function openSession(): HasOne
    {
        return $this->hasOne(CashSession::class)->where('status', CashSession::OPEN)->latestOfMany('opened_at');
    }
}
