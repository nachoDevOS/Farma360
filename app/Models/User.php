<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Support\PermissionCatalog;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
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
 */
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasRoles, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        // Campos agregados para el panel (ver migración add_admin_fields_to_users_table)
        'is_active',
        'last_login_at',
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
        ];
    }

    /** Nombre del rol del usuario (ej: "Supervisor"), o null si no tiene. Se lee como $user->role. */
    protected function role(): Attribute
    {
        return Attribute::get(fn () => $this->roles->first()?->name);
    }

    /** ¿Es Super Admin? Tiene todos los permisos y solo otro Super Admin puede tocar su cuenta. */
    public function isSuperAdmin(): bool
    {
        return $this->hasRole(PermissionCatalog::superAdmin());
    }
}
