<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Producto del catálogo. El stock se cuenta en "unidad base" (base_unit) y se vende por presentaciones.
 */
class Product extends Model
{
    use Auditable, HasFactory;

    protected $fillable = [
        'name', 'active_ingredient_id', 'concentration', 'pharmaceutical_form', 'laboratory_id', 'category_id',
        'barcode', 'health_registry', 'base_unit', 'requires_prescription', 'is_controlled', 'min_stock', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'requires_prescription' => 'boolean',
            'is_controlled' => 'boolean',
            'is_active' => 'boolean',
            'min_stock' => 'integer',
        ];
    }

    public function activeIngredient(): BelongsTo
    {
        return $this->belongsTo(ActiveIngredient::class);
    }

    public function laboratory(): BelongsTo
    {
        return $this->belongsTo(Laboratory::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function presentations(): HasMany
    {
        return $this->hasMany(ProductPresentation::class)->orderBy('factor');
    }

    public function batches(): HasMany
    {
        return $this->hasMany(Batch::class);
    }

    /** Nombre para mostrar: "Panadol 500 mg Tableta". */
    public function fullName(): string
    {
        return trim(implode(' ', array_filter([$this->name, $this->concentration, $this->pharmaceutical_form])));
    }
}
