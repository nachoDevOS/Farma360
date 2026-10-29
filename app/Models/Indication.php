<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Uso / síntoma de un producto (para qué sirve: "Dolor de cabeza", "Fiebre"…).
 * Sirve para buscar y filtrar productos rápido en el catálogo y en el punto de venta.
 */
class Indication extends Model
{
    // REGLA DEL SISTEMA: eliminación lógica + quién registró / quién eliminó
    use Auditable;

    protected $fillable = ['name'];

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class);
    }

    /**
     * Ids de los usos con esos nombres; crea los que no existen (sin distinguir mayúsculas).
     * Si un uso estaba eliminado y se vuelve a escribir, se recupera.
     *
     * @param  list<string>  $names
     * @return list<int>
     */
    public static function idsFor(array $names): array
    {
        $ids = [];
        foreach ($names as $name) {
            $name = mb_substr(trim(preg_replace('/\s+/', ' ', $name)), 0, 80);
            if ($name === '') {
                continue;
            }

            $indication = static::withTrashed()->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->first()
                ?? static::create(['name' => mb_strtoupper(mb_substr($name, 0, 1)).mb_substr($name, 1)]);
            if ($indication->trashed()) {
                $indication->restore();
            }
            $ids[] = $indication->id;
        }

        return array_values(array_unique($ids));
    }
}
