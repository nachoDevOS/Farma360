<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;

/**
 * Billete o moneda que se cuenta en el corte de caja.
 */
class Denomination extends Model
{
    use Auditable;

    protected $fillable = ['value', 'type', 'is_active'];

    protected function casts(): array
    {
        return ['value' => 'decimal:2', 'is_active' => 'boolean'];
    }
}
