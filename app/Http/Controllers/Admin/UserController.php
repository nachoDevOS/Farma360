<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Models\Branch;
use App\Models\Role;
use App\Models\User;
use App\Support\PermissionCatalog;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * CRUD de usuarios del panel. Cada ruta pide su permiso (ver routes/admin.php):
 *   usuarios.ver · usuarios.crear · usuarios.editar · usuarios.eliminar
 *
 * - La VALIDACIÓN está en app/Http/Requests/Admin/ (StoreUserRequest, UpdateUserRequest).
 * - Los PERMISOS están en app/Policies/UserPolicy.php.
 * - El ROL de cada usuario lo maneja spatie/laravel-permission ($user->syncRoles([...])).
 */
class UserController extends Controller
{
    /** Columnas por las que se puede ordenar (seguridad: nadie puede inyectar otra columna en orderBy). */
    private const SORTABLE = ['name', 'email', 'created_at', 'last_login_at'];

    /**
     * GET /admin/users — Lista de usuarios con búsqueda, filtros, orden y paginación.
     * Abre la página resources/js/pages/admin/users/index.tsx
     */
    public function index(Request $request): Response
    {
        $filters = $this->filters($request);

        return Inertia::render('admin/users/index', [
            // PAGINACIÓN DEL LADO DEL SERVIDOR: la base de datos devuelve solo la página pedida
            // (10 por defecto, o lo que elija el usuario en "Mostrar N registros").
            // withQueryString() mantiene los filtros al cambiar de página.
            'users' => $this->filteredQuery($filters)->paginate($this->perPage($request))->withQueryString(),
            'filters' => $filters,
            // Nombres de todos los roles, para el filtro (ej: ['Administrador', 'Operador', ...])
            'roles' => Role::orderBy('name')->pluck('name'),
            // Sucursales para el formulario (a cuál pertenece el usuario)
            'branches' => Branch::orderBy('name')->get(['id', 'name']),
            // Roles que este usuario puede asignar en el formulario: el Super Admin solo lo puede dar otro Super Admin
            'assignableRoles' => Role::orderBy('name')
                ->when(! $request->user()->isSuperAdmin(), fn (Builder $q) => $q->where('name', '!=', PermissionCatalog::superAdmin()))
                ->pluck('name'),
        ]);
    }

    /**
     * POST /admin/users — Crea un usuario desde el modal "Nuevo usuario".
     * Cuando entra aquí, StoreUserRequest YA validó los datos y revisó el permiso.
     */
    public function store(StoreUserRequest $request): RedirectResponse
    {
        $data = $request->validated();

        // La contraseña se encripta sola (cast 'hashed' en el modelo User). Lo marcamos verificado porque lo crea un admin.
        $user = User::create(collect($data)->except(['role', 'avatar', 'remove_avatar'])->all() + [
            'email_verified_at' => now(),
            // Foto de perfil en S3 (StorageController)
            'avatar' => $this->storeImage($request, 'avatar', 'users'),
        ]);
        // El rol se guarda en las tablas de Spatie (no es una columna de users)
        $user->assignRole($data['role']);

        // back() = volver a la misma página. 'success' se muestra como aviso verde (components/shared/flash-toast.tsx)
        return back()->with('success', "Usuario {$user->name} creado correctamente.");
    }

    /**
     * PUT /admin/users/{user} — Actualiza un usuario existente.
     * {user} en la ruta = Laravel busca el usuario por id automáticamente (route model binding).
     */
    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        $data = $request->validated();

        // Contraseña vacía = no cambiarla
        if (empty($data['password'])) {
            unset($data['password']);
        }

        $user->update(collect($data)->except(['role', 'avatar', 'remove_avatar'])->all() + [
            'avatar' => $this->storeImage($request, 'avatar', 'users', $user->avatar),
        ]);
        // syncRoles reemplaza el rol anterior: cada usuario tiene uno solo
        $user->syncRoles([$data['role']]);

        return back()->with('success', "Usuario {$user->name} actualizado.");
    }

    /**
     * PATCH /admin/users/{user}/toggle — Activa o desactiva una cuenta.
     */
    public function toggle(User $user): RedirectResponse
    {
        // Gate::inspect pregunta a UserPolicy@toggle y nos da el motivo si no está permitido
        $permission = Gate::inspect('toggle', $user);
        if ($permission->denied()) {
            return back()->with('error', $permission->message());
        }

        // Invierte el estado: activo → inactivo, inactivo → activo
        $user->update(['is_active' => ! $user->is_active]);

        return back()->with('success', $user->is_active ? "{$user->name} fue activado." : "{$user->name} fue desactivado.");
    }

    /**
     * DELETE /admin/users/{user} — Elimina un usuario.
     */
    public function destroy(User $user): RedirectResponse
    {
        $permission = Gate::inspect('delete', $user);
        if ($permission->denied()) {
            return back()->with('error', $permission->message());
        }

        // Eliminación LÓGICA (regla del sistema): no se borra, se marca deleted_at y quién lo eliminó
        $user->delete();

        return back()->with('success', "Usuario {$user->name} eliminado.");
    }

    /**
     * Lee los filtros de la URL: ?search=ana&role=Supervisor&status=active&sort=name&direction=asc&per_page=25
     *
     * @return array<string, string>
     */
    private function filters(Request $request): array
    {
        return $request->only(['search', 'role', 'status', 'sort', 'direction', 'per_page']);
    }

    /**
     * Arma la consulta de usuarios aplicando los filtros. La usa index().
     *
     * @param  array<string, string>  $filters
     */
    private function filteredQuery(array $filters): Builder
    {
        $sort = in_array($filters['sort'] ?? null, self::SORTABLE) ? $filters['sort'] : 'created_at';
        $direction = ($filters['direction'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

        return User::query()
            // with('roles') = trae los roles en una sola consulta (sin esto, haría una consulta por cada usuario)
            ->with('roles', 'branch:id,name')
            // ->when() aplica el filtro SOLO si ese valor vino en la URL
            ->when($filters['search'] ?? null, function (Builder $query, string $search) {
                $query->where(fn (Builder $q) => $q
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%"));
            })
            // Usuarios que tienen ese rol (whereHas no falla si alguien escribe un rol que no existe en la URL)
            ->when($filters['role'] ?? null, fn (Builder $query, string $role) => $query->whereHas('roles', fn (Builder $q) => $q->where('name', $role)))
            ->when($filters['status'] ?? null, fn (Builder $query, string $status) => $query->where('is_active', $status === 'active'))
            ->orderBy($sort, $direction);
    }
}
