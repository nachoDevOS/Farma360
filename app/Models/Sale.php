<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\HasDocumentNumber;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Venta. No se elimina: se ANULA (App\Services\SaleService::cancel) y el stock vuelve a sus lotes.
 */
class Sale extends Model
{
    use Auditable, HasDocumentNumber;

    public const PREFIX = 'V';

    protected $fillable = [
        'branch_id', 'cash_session_id', 'customer_id', 'customer_name', 'customer_document', 'total',
        'cash_received', 'change', 'prescription_number', 'prescription_doctor', 'status',
    ];

    protected function casts(): array
    {
        return ['total' => 'decimal:2', 'cash_received' => 'decimal:2', 'change' => 'decimal:2', 'cancelled_at' => 'datetime'];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function cashSession(): BelongsTo
    {
        return $this->belongsTo(CashSession::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(SalePayment::class);
    }

    public function cancelledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelUser_id')->withTrashed();
    }
}
