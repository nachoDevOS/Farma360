<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\HasDocumentNumber;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Compra a un proveedor. No se elimina: se ANULA (App\Services\PurchaseService::cancel).
 */
class Purchase extends Model
{
    use Auditable, HasDocumentNumber;

    public const PREFIX = 'C';

    protected $fillable = ['branch_id', 'supplier_id', 'invoice_number', 'purchased_at', 'total', 'status', 'note'];

    protected function casts(): array
    {
        return ['purchased_at' => 'date', 'total' => 'decimal:2', 'cancelled_at' => 'datetime'];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseItem::class);
    }

    public function cancelledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelUser_id')->withTrashed();
    }
}
