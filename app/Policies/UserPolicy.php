<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Reglas de PERMISOS sobre usuarios: ¿quién puede ver, crear, editar, activar o eliminar a quién?
 *
 * Laravel la conecta sola con el modelo User (por el nombre: User → UserPolicy).
 * Se usa así:  $request->user()->can('delete', $user)   o   Gate::inspect('delete', $user)
 *
 * Cada método revisa dos cosas:
 *   1. Que el rol tenga el permiso del catálogo (config/roles.php), ej: "usuarios.eliminar".
 *   2. Reglas de seguridad que valen para todos, incluso el Super Admin:
 *      - nadie puede desactivarse ni eliminarse a sí mismo;
 *      - solo un Super Admin puede tocar la cuenta de otro Super Admin.
 *
 * $actor = el usuario que está haciendo la acción (el logueado).
 * $user  = el usuario sobre el que se hace la acción.
 */
class UserPolicy
{
    /** Ver el listado de usuarios. */
    public function viewAny(User $actor): bool
    {
        return $actor->can('usuarios.ver');
    }

    /** Crear usuarios desde el panel. */
    public function create(User $actor): bool
    {
        return $actor->can('usuarios.crear');
    }

    /** Editar un usuario (las reglas sobre el propio rol están en UpdateUserRequest). */
    public function update(User $actor, User $user): Response
    {
        return $this->protectSuperAdmin($actor, $user) ?? $this->allowIf($actor->can('usuarios.editar'));
    }

    /** Activar / desactivar una cuenta. Usa el permiso de editar. */
    public function toggle(User $actor, User $user): Response
    {
        if ($actor->is($user)) {
            return Response::deny('No puedes desactivar tu propia cuenta.');
        }

        return $this->protectSuperAdmin($actor, $user) ?? $this->allowIf($actor->can('usuarios.editar'));
    }

    /** Eliminar un usuario. */
    public function delete(User $actor, User $user): Response
    {
        if ($actor->is($user)) {
            return Response::deny('No puedes eliminar tu propia cuenta desde aquí.');
        }

        return $this->protectSuperAdmin($actor, $user) ?? $this->allowIf($actor->can('usuarios.eliminar'));
    }

    /** Solo un Super Admin puede modificar a otro Super Admin. null = no aplica, seguir revisando. */
    private function protectSuperAdmin(User $actor, User $user): ?Response
    {
        if ($user->isSuperAdmin() && ! $actor->isSuperAdmin()) {
            return Response::deny('Solo un Super Admin puede modificar esta cuenta.');
        }

        return null;
    }

    private function allowIf(bool $allowed): Response
    {
        return $allowed ? Response::allow() : Response::deny('No tienes permiso para esta acción.');
    }
}
