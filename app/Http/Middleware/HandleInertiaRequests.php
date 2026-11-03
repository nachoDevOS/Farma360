<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\CashService;
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
            // Dirección pública del bucket S3 (AWS_URL): las imágenes se muestran como aws_url/ruta (ver lib/storage.ts)
            'aws_url' => config('filesystems.disks.s3.url'),
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
            // Turno de caja abierto del usuario, para el botón flotante "Mi caja" (cash-widget.tsx). null = no tiene.
            'cash' => fn () => $this->openCash($request->user()),
        ]);
    }

    /**
     * Turno de caja abierto del usuario con su resumen de dinero (null si no tiene o no puede operar caja).
     * Si config('farmacia.show_expected_cash') es false, el efectivo esperado no se envía (cierre ciego).
     *
     * @return array{id: int, register: string, branch: string, opened_at: string, show_expected: bool,
     *     summary: array<string, mixed>, payment_methods: array<string, string>}|null
     */
    private function openCash(?User $user): ?array
    {
        if (! $user || ! $user->can('caja.operar')) {
            return null;
        }

        $cash = app(CashService::class);
        $session = $cash->currentSession($user)?->load('cashRegister:id,name', 'branch:id,name');
        if (! $session) {
            return null;
        }

        $showExpected = (bool) config('farmacia.show_expected_cash');
        $summary = $cash->summary($session);
        if (! $showExpected) {
            $summary['expected'] = null;
        }

        return [
            'id' => $session->id,
            'register' => $session->cashRegister->name,
            'branch' => $session->branch->name,
            'opened_at' => $session->opened_at->toIso8601String(),
            'show_expected' => $showExpected,
            'summary' => $summary,
            'payment_methods' => config('farmacia.payment_methods'),
        ];
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
