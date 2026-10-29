<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\RoleRequest;
use App\Models\ActivityLog;
use App\Support\PermissionCatalog;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

/**
 * ROLES Y PERMISOS: crear roles y elegir qué puede hacer cada uno.
 *
 * - Cada ruta pide su permiso (roles.ver, roles.crear, roles.editar, roles.eliminar) en routes/admin.php.
 * - Los permisos posibles salen del catálogo config/roles.php (PermissionCatalog).
 * - El rol Super Admin no se puede editar ni eliminar: siempre tiene todo.
 * - Cada cambio queda en la AUDITORÍA.
 */
class RoleController extends Controller
{
    /**
     * GET /admin/roles — Lista de roles con cuántos usuarios y permisos tiene cada uno.
     * Abre resources/js/pages/admin/roles/index.tsx
     */
    public function index(): Response
    {
        $total = count(PermissionCatalog::all());

        $roles = Role::withCount(['users', 'permissions'])
            ->orderBy('name')
            ->get()
            ->map(fn (Role $role) => [
                'id' => $role->id,
                'name' => $role->name,
                'users_count' => $role->users_count,
                // El Super Admin tiene todos aunque no estén marcados en la base de datos
                'permissions_count' => $this->isSuperAdmin($role) ? $total : $role->permissions_count,
                'is_super_admin' => $this->isSuperAdmin($role),
            ])
            // Super Admin siempre primero
            ->sortByDesc('is_super_admin')
            ->values();

        return Inertia::render('admin/roles/index', [
            'roles' => $roles,
            'totalPermissions' => $total,
        ]);
    }

    /**
     * GET /admin/roles/create — Formulario vacío.
     * Abre resources/js/pages/admin/roles/form.tsx (la misma página sirve para crear y editar)
     */
    public function create(): Response
    {
        return Inertia::render('admin/roles/form', [
            'role' => null,
            'catalog' => PermissionCatalog::matrix(),
        ]);
    }

    /**
     * POST /admin/roles — Guarda un rol nuevo con sus permisos.
     */
    public function store(RoleRequest $request): RedirectResponse
    {
        $data = $request->validated();

        $role = Role::create(['name' => $data['name'], 'guard_name' => 'web']);
        $role->syncPermissions($data['permissions'] ?? []);

        ActivityLog::record('role.created', "Creó el rol {$role->name}", properties: ['permissions' => $data['permissions'] ?? []]);

        return to_route('admin.roles.index')->with('success', "Rol {$role->name} creado.");
    }

    /**
     * GET /admin/roles/{role}/edit — Formulario con los permisos actuales del rol marcados.
     */
    public function edit(Role $role): Response|RedirectResponse
    {
        if ($this->isSuperAdmin($role)) {
            return to_route('admin.roles.index')->with('error', 'El rol Super Admin no se puede editar: siempre tiene todos los permisos.');
        }

        return Inertia::render('admin/roles/form', [
            'role' => [
                'id' => $role->id,
                'name' => $role->name,
                'permissions' => $role->permissions->pluck('name'),
                'users_count' => $role->users()->count(),
            ],
            'catalog' => PermissionCatalog::matrix(),
        ]);
    }

    /**
     * PUT /admin/roles/{role} — Cambia el nombre y los permisos.
     * En la auditoría se guarda qué permisos se agregaron y cuáles se quitaron.
     */
    public function update(RoleRequest $request, Role $role): RedirectResponse
    {
        if ($this->isSuperAdmin($role)) {
            return back()->with('error', 'El rol Super Admin no se puede editar.');
        }

        $data = $request->validated();
        $before = $role->permissions->pluck('name');
        $after = collect($data['permissions'] ?? []);

        $role->update(['name' => $data['name']]);
        $role->syncPermissions($after->all());

        ActivityLog::record('role.updated', "Editó el rol {$role->name}", properties: [
            'added' => $after->diff($before)->values(),
            'removed' => $before->diff($after)->values(),
        ]);

        return to_route('admin.roles.index')->with('success', "Rol {$role->name} actualizado.");
    }

    /**
     * DELETE /admin/roles/{role} — Elimina un rol. No se puede si tiene usuarios o si es el Super Admin.
     */
    public function destroy(Role $role): RedirectResponse
    {
        if ($this->isSuperAdmin($role)) {
            return back()->with('error', 'El rol Super Admin no se puede eliminar.');
        }

        $users = $role->users()->count();
        if ($users > 0) {
            return back()->with('error', "No se puede eliminar: {$users} ".($users === 1 ? 'usuario tiene' : 'usuarios tienen').' este rol. Cámbiales el rol primero.');
        }

        ActivityLog::record('role.deleted', "Eliminó el rol {$role->name}");
        $role->delete();

        return back()->with('success', "Rol {$role->name} eliminado.");
    }

    private function isSuperAdmin(Role $role): bool
    {
        return $role->name === PermissionCatalog::superAdmin();
    }
}
