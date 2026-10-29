<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Support\PermissionCatalog;
use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Datos que reciben TODAS las páginas de React automáticamente.
     * En React se leen con: const { auth, flash } = usePage<SharedData>().props;
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        [$message, $author] = str(Inspiring::quotes()->random())->explode('-');

        return array_merge(parent::share($request), [
            ...parent::share($request),
            'name' => config('app.name'),
            'quote' => ['message' => trim($message), 'author' => trim($author)],
            'auth' => [
                'user' => $request->user(),
                // Lista de permisos del usuario, ej: ['usuarios.ver', 'roles.ver'].
                // El Super Admin recibe todos. En React se consultan con el hook useCan():
                //   const can = useCan();   can('usuarios.crear') → true / false
                'permissions' => fn () => $this->permissions($request->user()),
            ],
            // Mensajes de ->with('success', '...'). React los muestra como avisos (flash-toast.tsx).
            // fn () => hace que se lean solo cuando hacen falta.
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                // Aviso informativo (no es un error): ej. "Abre tu caja antes de vender"
                'info' => fn () => $request->session()->get('info'),
            ],
        ]);
    }

    /**
     * Permisos del usuario logueado (todos si es Super Admin).
     *
     * @return list<string>
     */
    private function permissions(?User $user): array
    {
        if (! $user) {
            return [];
        }

        return $user->isSuperAdmin() ? PermissionCatalog::all() : $user->getAllPermissions()->pluck('name')->values()->all();
    }
}
