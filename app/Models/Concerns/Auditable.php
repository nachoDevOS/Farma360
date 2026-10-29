<?php

namespace App\Models\Concerns;

use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use LogicException;

/**
 * REGLA DEL SISTEMA: en Farma360 NADA se borra de la base de datos. Todo es ELIMINACIÓN LÓGICA.
 *
 * Todo modelo del sistema usa este trait. Las columnas las crea $table->auditable() en la migración
 * (ver AppServiceProvider::registerAuditableColumns):
 *
 *   registerUser_id  → id del usuario que creó el registro (null = sistema / seeder / autoregistro)
 *   registerRole     → rol que tenía ese usuario al crearlo
 *   deleteUser_id    → id del usuario que lo eliminó
 *   deleteRole       → rol que tenía ese usuario al eliminarlo
 *   deleted_at       → fecha de eliminación (null = registro vigente)
 *
 * Uso normal, sin hacer nada extra:
 *   Producto::create([...])      → llena registerUser_id y registerRole con el usuario logueado
 *   $producto->delete()          → NO borra: llena deleted_at, deleteUser_id y deleteRole
 *   $producto->restore()         → lo recupera y limpia deleteUser_id y deleteRole
 *   Producto::all()              → solo trae los vigentes (los eliminados se ocultan solos)
 *   Producto::withTrashed()      → trae también los eliminados · onlyTrashed() → solo los eliminados
 *   $producto->forceDelete()     → PROHIBIDO: lanza una excepción
 *
 * IMPORTANTE: eliminar siempre registro por registro ($modelo->delete()). Un borrado masivo
 * (Producto::where(...)->delete()) también es lógico, pero NO guarda quién lo eliminó.
 * Nunca usar DB::table(...)->delete() ni SQL DELETE: eso sí borra de verdad.
 */
trait Auditable
{
    use SoftDeletes;

    public static function bootAuditable(): void
    {
        // Al CREAR: quién lo registró y con qué rol (si se crea desde un seeder o comando, queda null)
        static::creating(function (self $model) {
            if ($user = auth()->user()) {
                $model->registerUser_id ??= $user->getKey();
                $model->registerRole ??= $user->role;
            }
        });

        // Al RESTAURAR: deja de estar eliminado, así que se limpia quién lo eliminó
        static::restoring(function (self $model) {
            $model->deleteUser_id = null;
            $model->deleteRole = null;
        });

        // Borrado físico prohibido en todo el sistema
        static::forceDeleting(function (self $model) {
            throw new LogicException('Farma360 no permite borrar registros de la base de datos ('.$model::class.'). Usa delete(): la eliminación es lógica.');
        });
    }

    /**
     * Reemplaza el borrado lógico de Laravel (SoftDeletes::runSoftDelete) para guardar,
     * en la MISMA consulta que deleted_at, quién eliminó el registro y con qué rol.
     */
    protected function runSoftDelete(): void
    {
        $query = $this->setKeysForSaveQuery($this->newModelQuery());

        $time = $this->freshTimestamp();
        $user = auth()->user();

        $columns = [
            $this->getDeletedAtColumn() => $this->fromDateTime($time),
            'deleteUser_id' => $user?->getKey(),
            'deleteRole' => $user?->role,
        ];

        $this->{$this->getDeletedAtColumn()} = $time;
        $this->deleteUser_id = $columns['deleteUser_id'];
        $this->deleteRole = $columns['deleteRole'];

        if ($this->usesTimestamps() && ! is_null($this->getUpdatedAtColumn())) {
            $this->{$this->getUpdatedAtColumn()} = $time;

            $columns[$this->getUpdatedAtColumn()] = $this->fromDateTime($time);
        }

        $query->update($columns);

        $this->syncOriginalAttributes(array_keys($columns));

        $this->fireModelEvent('trashed', false);
    }

    /** Usuario que registró este dato (incluye usuarios eliminados, para no perder la historia). */
    public function registeredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registerUser_id')->withTrashed();
    }

    /** Usuario que eliminó este dato. */
    public function deletedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'deleteUser_id')->withTrashed();
    }
}
