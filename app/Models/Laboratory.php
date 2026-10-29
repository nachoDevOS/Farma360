<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Laboratorio fabricante.
 */
class Laboratory extends Model
{
    use Auditable;

    protected $fillable = ['name', 'country'];

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }
}
