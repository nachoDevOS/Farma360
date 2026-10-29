<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Un registro de AUDITORÍA (tabla "activity_logs"): quién hizo qué, cuándo y desde dónde.
 *
 * Para registrar una acción desde cualquier parte del sistema:
 *     ActivityLog::record('user.created', "Creó al usuario {$user->name}", $user);
 */
class ActivityLog extends Model
{
    /** La tabla solo tiene created_at (los registros de auditoría nunca se editan). */
    public const UPDATED_AT = null;

    /**
     * Grupos de acciones, para el filtro de la pantalla de Auditoría.
     * La clave es el prefijo de "action" (auth.login → auth).
     */
    public const GROUPS = [
        'auth' => 'Accesos',
        'user' => 'Usuarios',
        'role' => 'Roles y permisos',
        'profile' => 'Perfil',
    ];

    protected $fillable = [
        'user_id',
        'action',
        'description',
        'subject_type',
        'subject_id',
        'properties',
        'ip_address',
        'user_agent',
    ];

    protected function casts(): array
    {
        return [
            // Guarda el array como JSON y lo devuelve como array
            'properties' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /** El usuario que hizo la acción ("causante"). */
    public function causer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** El registro sobre el que se hizo la acción (puede ser cualquier modelo). */
    public function subject(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * Atajo para guardar una acción. Toma solo el usuario logueado, la IP y el navegador.
     *
     * @param  string  $action  Tipo, formato "grupo.accion" (ej: user.deleted)
     * @param  string  $description  Texto legible para la pantalla de Auditoría
     * @param  Model|null  $subject  Registro afectado (opcional)
     * @param  array<string, mixed>  $properties  Datos extra (opcional)
     * @param  User|null  $causer  Quién lo hizo; por defecto el usuario logueado
     */
    public static function record(string $action, string $description, ?Model $subject = null, array $properties = [], ?User $causer = null): self
    {
        $request = request();

        return static::create([
            'user_id' => ($causer ?? $request->user())?->id,
            'action' => $action,
            'description' => $description,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject?->getKey(),
            'properties' => $properties ?: null,
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 255),
        ]);
    }
}
