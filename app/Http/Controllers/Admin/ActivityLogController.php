<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Pantalla de AUDITORÍA: historial de todo lo que pasó en el sistema (permiso auditoria.ver).
 */
class ActivityLogController extends Controller
{
    /**
     * GET /admin/activity — Historial con búsqueda, filtro por tipo y paginación.
     * Abre la página resources/js/pages/admin/activity/index.tsx
     */
    public function index(Request $request): Response
    {
        $filters = $request->only(['search', 'group', 'per_page']);

        $logs = ActivityLog::query()
            // with('causer') = trae el usuario de cada registro en UNA sola consulta (evita el problema "N+1")
            ->with('causer:id,name,email', 'causer.roles')
            ->when($filters['search'] ?? null, function (Builder $query, string $search) {
                $query->where(fn (Builder $q) => $q
                    ->where('description', 'like', "%{$search}%")
                    ->orWhere('ip_address', 'like', "%{$search}%")
                    ->orWhereHas('causer', fn (Builder $u) => $u->where('name', 'like', "%{$search}%")));
            })
            // group "user" → acciones que empiezan con "user." (user.created, user.deleted…)
            ->when($filters['group'] ?? null, fn (Builder $query, string $group) => $query->where('action', 'like', "{$group}.%"))
            ->latest('created_at')
            ->latest('id')
            // Paginación del lado del servidor: 15 por defecto, o lo elegido en "Mostrar N registros"
            ->paginate($this->perPage($request, 15))
            ->withQueryString();

        return Inertia::render('admin/activity/index', [
            'logs' => $logs,
            'filters' => $filters,
            'groups' => ActivityLog::GROUPS,
        ]);
    }
}
