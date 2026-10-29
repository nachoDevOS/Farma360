<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;

/**
 * Entrada o salida de efectivo de la caja que no es una venta.
 */
class CashMovement extends Model
{
    use Auditable;

    public const TYPES = [
        'ingreso' => 'Ingreso',
        'egreso' => 'Egreso',
        'retiro' => 'Retiro parcial',
    ];

    protected $fillable = ['cash_session_id', 'type', 'amount', 'reason'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2'];
    }
}
