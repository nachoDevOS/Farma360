<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Models\Concerns\Auditable;
use App\Support\PermissionCatalog;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;

/**
 * Modelo de usuario (tabla "users").
 * Campos del panel: is_active y last_login_at.
 *
 * ROLES Y PERMISOS (paquete spatie/laravel-permission, trait HasRoles):
 *   $user->assignRole('Supervisor')     → le asigna un rol
 *   $user->syncRoles(['Operador'])      → reemplaza su rol (cada usuario tiene UNO solo)
 *   $user->can('usuarios.editar')       → ¿tiene ese permiso? (el Super Admin siempre sí)
 *   $user->role                         → nombre de su rol, ej: "Supervisor" (se envía a React)
 * El catálogo de permisos está en config/roles.php.
 *
 * ELIMINACIÓN LÓGICA (trait Auditable): $user->delete() no lo borra, solo lo marca con deleted_at.
 * Un usuario eliminado no puede iniciar sesión y su email sigue ocupado (no se puede volver a registrar).
 */
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use Auditable, HasFactory, HasRoles, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        // Foto de perfil: ruta del .avif en S3 (StorageController)
        'avatar',
        // Campos del panel (ver migración create_users_table)
        'is_active',
        'last_login_at',
        // Sucursal donde trabaja (null = todas)
        'branch_id',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        // La relación completa de roles no se envía a React; se envía solo el nombre (campo "role")
        'roles',
    ];

    /**
     * Campos calculados que se agregan al convertir el usuario a JSON (lo que recibe React).
     *
     * @var list<string>
     */
    protected $appends = ['role'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            // Convierte 0/1 de la base de datos en true/false
            'is_active' => 'boolean',
            'last_login_at' => 'datetime',
            'branch_id' => 'integer',
        ];
    }

    /** Nombre del rol del usuario (ej: "Supervisor"), o null si no tiene. Se lee como $user->role. */
    protected function role(): Attribute
    {
        return Attribute::get(fn () => $this->roles->first()?->name);
    }

    /** Sucursal donde trabaja. null = puede operar en todas. */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * Ids de las sucursales donde puede operar: la suya, o todas las activas si no tiene una asignada.
     *
     * @return list<int>
     */
    public function allowedBranchIds(): array
    {
        return $this->branch_id ? [$this->branch_id] : Branch::where('is_active', true)->pluck('id')->all();
    }

    /** ¿Es Super Admin? Tiene todos los permisos y solo otro Super Admin puede tocar su cuenta. */
    public function isSuperAdmin(): bool
    {
        return $this->hasRole(PermissionCatalog::superAdmin());
    }
}
