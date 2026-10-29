<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\HasDocumentNumber;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Transferencia entre sucursales: enviada → recibida (o anulada mientras no se recibió).
 */
class Transfer extends Model
{
    use Auditable, HasDocumentNumber;

    public const PREFIX = 'T';

    protected $fillable = ['from_branch_id', 'to_branch_id', 'status', 'note'];

    protected function casts(): array
    {
        return ['received_at' => 'datetime', 'cancelled_at' => 'datetime'];
    }

    public function fromBranch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'from_branch_id');
    }

    public function toBranch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'to_branch_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(TransferItem::class);
    }

    public function receivedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'receiveUser_id')->withTrashed();
    }

    public function cancelledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelUser_id')->withTrashed();
    }
}
