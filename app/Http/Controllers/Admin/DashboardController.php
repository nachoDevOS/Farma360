<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

/**
 * Controlador del Dashboard.
 * Tiene un solo método (__invoke), por eso en la ruta se usa así: Route::get(..., DashboardController::class)
 */
class DashboardController extends Controller
{
    /**
     * GET /dashboard — Calcula las métricas de usuarios y abre la página del dashboard.
     * Cada clave del array de Inertia::render() llega como "prop" a resources/js/pages/admin/dashboard.tsx
     */
    public function __invoke(Request $request): Response
    {
        // 1. Usuarios nuevos este mes vs. el mes anterior (para calcular el % de crecimiento)
        $startOfMonth = now()->startOfMonth();
        $startOfLastMonth = now()->subMonthNoOverflow()->startOfMonth();

        $newThisMonth = User::where('created_at', '>=', $startOfMonth)->count();
        $newLastMonth = User::whereBetween('created_at', [$startOfLastMonth, $startOfMonth])->count();

        // 2. Fechas de registro de los últimos 12 meses, agrupadas por "año-mes" (ej: "2026-10" => 6).
        // Se cuenta en PHP (countBy) para que funcione igual en SQLite, MySQL o PostgreSQL.
        $registrations = User::where('created_at', '>=', now()->subMonths(11)->startOfMonth())
            ->pluck('created_at')
            ->countBy(fn (Carbon $date) => $date->format('Y-m'));

        // Armamos los 12 meses aunque alguno tenga 0 registros, así el gráfico no tiene huecos.
        $monthly = collect(range(11, 0))->map(function (int $ago) use ($registrations) {
            $month = now()->subMonthsNoOverflow($ago);

            return [
                'month' => ucfirst($month->locale('es')->translatedFormat('M')),
                'total' => $registrations->get($month->format('Y-m'), 0),
            ];
        })->values();

        // 3. Enviamos todo a React. 'admin/dashboard' = resources/js/pages/admin/dashboard.tsx
        return Inertia::render('admin/dashboard', [
            'stats' => [
                'total' => User::count(),
                'active' => User::where('is_active', true)->count(),
                'verified' => User::whereNotNull('email_verified_at')->count(),
                'newThisMonth' => $newThisMonth,
                // null = no hay datos del mes anterior para comparar
                'growth' => $newLastMonth > 0
                    ? round((($newThisMonth - $newLastMonth) / $newLastMonth) * 100, 1)
                    : null,
                'onlineToday' => User::where('last_login_at', '>=', now()->startOfDay())->count(),
            ],
            'monthly' => $monthly,
            // Cuántas cuentas hay de cada rol (gráfico de anillo), de mayor a menor
            'roles' => Role::withCount('users')->orderByDesc('users_count')->get()
                ->map(fn (Role $role) => ['role' => $role->name, 'total' => $role->users_count]),
            // Solo pedimos las columnas necesarias: nunca enviar datos sensibles (como la contraseña) al navegador.
            // with('roles') trae el rol de cada uno en una sola consulta.
            'recentUsers' => User::with('roles')->latest()->take(6)->get(['id', 'name', 'email', 'is_active', 'created_at']),
            // Últimas 6 acciones de la auditoría (solo quien tiene el permiso auditoria.ver; los demás reciben una lista vacía)
            'recentActivity' => $request->user()->can('auditoria.ver')
                ? ActivityLog::with('causer:id,name', 'causer.roles')->latest('created_at')->latest('id')->take(6)->get()
                : [],
        ]);
    }
}
