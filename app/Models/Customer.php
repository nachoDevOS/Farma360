<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Cliente (datos para el comprobante: nombre y CI/NIT).
 */
class Customer extends Model
{
    use Auditable, HasFactory;

    protected $fillable = ['name', 'document_type', 'document_number', 'phone', 'email'];

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }
}
