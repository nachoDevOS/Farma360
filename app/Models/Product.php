<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Producto del catálogo. El stock se cuenta en "unidad base" (base_unit) y se vende por presentaciones.
 */
class Product extends Model
{
    use Auditable, HasFactory;

    protected $fillable = [
        'name', 'generic_name', 'concentration', 'pharmaceutical_form', 'description', 'laboratory_id', 'category_id',
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

    /** Usos / síntomas: para qué sirve ("Dolor de cabeza", "Fiebre"…). */
    public function indications(): BelongsToMany
    {
        return $this->belongsToMany(Indication::class)->orderBy('name');
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

    /**
     * BUSCADOR DE PRODUCTOS (catálogo, punto de venta, inventario, compras…).
     * Encuentra por nombre comercial, nombre genérico, código de barras del producto o de una
     * presentación, uso / síntoma ("dolor de cabeza") o el texto de para qué sirve.
     * Uso: Product::search($texto)->get()
     */
    public function scopeSearch(Builder $query, ?string $term): void
    {
        $term = trim((string) $term);
        if ($term === '') {
            return;
        }

        $query->where(fn (Builder $w) => $w
            ->where('name', 'like', "%{$term}%")
            ->orWhere('generic_name', 'like', "%{$term}%")
            ->orWhere('barcode', $term)
            ->orWhere('description', 'like', "%{$term}%")
            ->orWhereHas('presentations', fn (Builder $p) => $p->where('barcode', $term))
            ->orWhereHas('indications', fn (Builder $i) => $i->where('name', 'like', "%{$term}%")));
    }

    /** Nombre para mostrar: "Panadol 500 mg Tableta". */
    public function fullName(): string
    {
        return trim(implode(' ', array_filter([$this->name, $this->concentration, $this->pharmaceutical_form])));
    }
}
