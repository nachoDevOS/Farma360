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

    /**
     * Id del principio activo con ese nombre; lo crea si no existe (sin distinguir mayúsculas).
     * Si estaba eliminado y se vuelve a escribir, se recupera. Nombre vacío = null.
     */
    public static function idFor(?string $name): ?int
    {
        $name = trim(preg_replace('/\s+/', ' ', (string) $name));
        if ($name === '') {
            return null;
        }

        $ingredient = static::withTrashed()->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->first()
            ?? static::create(['name' => mb_strtoupper(mb_substr($name, 0, 1)).mb_substr($name, 1)]);
        if ($ingredient->trashed()) {
            $ingredient->restore();
        }

        return $ingredient->id;
    }
}
