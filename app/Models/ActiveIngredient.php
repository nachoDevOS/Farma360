<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Principio activo / genérico (ej: Paracetamol). Sirve para buscar equivalentes.
 */
class ActiveIngredient extends Model
{
    use Auditable;

    protected $fillable = ['name'];

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }
}
