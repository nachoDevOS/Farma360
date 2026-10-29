<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Sucursal (farmacia o almacén). Todo el stock, las cajas y las ventas pertenecen a una.
 */
class Branch extends Model
{
    use Auditable, HasFactory;

    protected $fillable = ['code', 'name', 'address', 'phone', 'is_warehouse', 'is_active'];

    protected function casts(): array
    {
        return ['is_warehouse' => 'boolean', 'is_active' => 'boolean'];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function batches(): HasMany
    {
        return $this->hasMany(Batch::class);
    }

    public function cashRegisters(): HasMany
    {
        return $this->hasMany(CashRegister::class);
    }
}
