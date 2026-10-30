<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * Forma de vender / comprar un producto, armada por niveles:
 *   Tableta (unidad base, factor 1) → Blíster contiene 10 tabletas (factor 10) → Caja contiene 10 blísteres (factor 100).
 * El factor y el nombre los calcula el sistema con arrange(); el usuario solo dice qué contiene cada empaque.
 */
class ProductPresentation extends Model
{
    use Auditable;

    protected $fillable = [
        'product_id', 'parent_id', 'package', 'contains', 'name', 'factor', 'sale_price', 'is_sellable', 'is_purchasable', 'barcode',
    ];

    protected function casts(): array
    {
        return [
            'factor' => 'integer',
            'contains' => 'integer',
            'sale_price' => 'decimal:2',
            'is_sellable' => 'boolean',
            'is_purchasable' => 'boolean',
        ];
    }

    /**
     * HISTORIAL DE PRECIOS: guarda una fila al crear la presentación con precio y cada vez que su precio
     * de venta cambia (venga de donde venga). Solo para consultar; no afecta las ventas.
     */
    protected static function booted(): void
    {
        static::created(function (self $presentation) {
            if ($presentation->sale_price !== null) {
                $presentation->recordPrice(null, ProductPriceHistory::SOURCE_CREATION);
            }
        });

        static::updated(function (self $presentation) {
            if ($presentation->wasChanged('sale_price')) {
                $presentation->recordPrice($presentation->getOriginal('sale_price'), ProductPriceHistory::SOURCE_EDIT);
            }
        });
    }

    private function recordPrice(?string $oldPrice, string $source): void
    {
        ProductPriceHistory::create([
            'product_id' => $this->product_id,
            'product_presentation_id' => $this->id,
            'presentation_name' => $this->name,
            'old_price' => $oldPrice,
            'new_price' => $this->sale_price,
            'source' => $source,
        ]);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** Cambios de su precio de venta. */
    public function priceHistories(): HasMany
    {
        return $this->hasMany(ProductPriceHistory::class);
    }

    /** Presentación que contiene (la Caja contiene Blísteres). Null = unidad base. */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id')->withTrashed();
    }

    /** Solo las que aparecen en el punto de venta. */
    public function scopeSellable(Builder $query): void
    {
        $query->where('is_sellable', true);
    }

    /** Solo las que aparecen al registrar compras. */
    public function scopePurchasable(Builder $query): void
    {
        $query->where('is_purchasable', true);
    }

    /**
     * Calcula factor y nombre a partir del nivel de adentro.
     *   Unidad base:            arrange(null, null, 'tableta', 'tableta')        → "Tableta", factor 1
     *   Blíster con 10 tabletas: arrange($tableta, 10, 'Blíster', 'tableta')     → "Blíster x10", factor 10
     *   Caja con 10 blísteres:   arrange($blister, 10, 'Caja', 'tableta')        → "Caja x10 blísteres (100 tabletas)", factor 100
     *
     * @return array{package: string, contains: ?int, factor: int, name: string}
     */
    public static function arrange(?self $parent, ?int $contains, string $package, string $baseUnit): array
    {
        $package = trim($package);

        if ($parent === null) {
            return ['package' => $package, 'contains' => null, 'factor' => 1, 'name' => self::capitalize($package)];
        }

        $factor = $parent->factor * $contains;
        $name = self::capitalize($package)." x{$contains}";
        if ($parent->parent_id !== null) {
            $name .= ' '.self::plural($parent->package)." ({$factor} ".self::plural($baseUnit).')';
        }

        return ['package' => $package, 'contains' => $contains, 'factor' => $factor, 'name' => mb_substr($name, 0, 100)];
    }

    /** Plural simple en español: tableta → tabletas, blíster → blísteres, unidad → unidades. */
    public static function plural(string $word): string
    {
        $word = mb_strtolower(trim($word));

        return match (true) {
            $word === '' => $word,
            (bool) preg_match('/[aeiouáéó]$/u', $word) => $word.'s',
            str_ends_with($word, 'z') => mb_substr($word, 0, -1).'ces',
            default => $word.'es',
        };
    }

    /** ¿Es el mismo nombre de empaque? Sin importar mayúsculas, tildes ni plural: "Frasco" = "frascos". */
    public static function sameName(string $a, string $b): bool
    {
        $a = Str::lower(Str::ascii(trim($a)));
        $b = Str::lower(Str::ascii(trim($b)));

        return $a !== '' && ($a === $b || self::plural($a) === $b || $a === self::plural($b));
    }

    private static function capitalize(string $word): string
    {
        return mb_strtoupper(mb_substr($word, 0, 1)).mb_substr($word, 1);
    }
}
