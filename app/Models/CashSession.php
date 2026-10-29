<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * TURNO DE CAJA: desde la apertura (con conteo de billetes) hasta el cierre (arqueo).
 * La lógica está en App\Services\CashService.
 */
class CashSession extends Model
{
    use Auditable;

    public const OPEN = 'abierta';

    public const PENDING = 'pendiente';

    public const CLOSED = 'cerrada';

    protected $fillable = ['cash_register_id', 'branch_id', 'user_id', 'opened_at', 'opening_amount', 'status'];

    protected function casts(): array
    {
        return [
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'opening_amount' => 'decimal:2',
            'expected_amount' => 'decimal:2',
            'counted_amount' => 'decimal:2',
            'difference' => 'decimal:2',
        ];
    }

    public function cashRegister(): BelongsTo
    {
        return $this->belongsTo(CashRegister::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewUser_id')->withTrashed();
    }

    public function counts(): HasMany
    {
        return $this->hasMany(CashSessionCount::class);
    }

    public function movements(): HasMany
    {
        return $this->hasMany(CashMovement::class);
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    public function isOpen(): bool
    {
        return $this->status === self::OPEN;
    }
}
