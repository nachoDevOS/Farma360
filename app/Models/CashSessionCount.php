<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Una línea del corte de billetes: cuántos billetes/monedas de un valor se contaron (al abrir o al cerrar).
 */
class CashSessionCount extends Model
{
    use Auditable;

    protected $fillable = ['cash_session_id', 'moment', 'denomination_id', 'value', 'quantity', 'subtotal'];

    protected function casts(): array
    {
        return ['value' => 'decimal:2', 'quantity' => 'integer', 'subtotal' => 'decimal:2'];
    }

    public function denomination(): BelongsTo
    {
        return $this->belongsTo(Denomination::class);
    }
}
