<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;

/**
 * Pago de una venta (una venta puede pagarse con varias formas: efectivo + QR).
 */
class SalePayment extends Model
{
    use Auditable;

    protected $fillable = ['sale_id', 'method', 'amount', 'reference'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2'];
    }
}
