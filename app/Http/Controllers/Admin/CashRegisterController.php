<?php

namespace App\Http\Controllers\Admin;

use App\Models\Branch;
use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\Sale;
use App\Services\CashService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Cajas físicas / puntos de venta de cada sucursal. */
class CashRegisterController extends ResourceController
{
    protected function model(): string
    {
        return CashRegister::class;
    }

    protected function meta(): array
    {
        return [
            'title' => 'Cajas',
            'singular' => 'Caja',
            'description' => 'Puntos de venta de cada sucursal. Cada caja tiene como mucho un turno abierto a la vez.',
            'route' => 'admin.cash-registers',
            'permission' => 'caja',
            'showRoute' => 'admin.cash-registers.show',
        ];
    }

    /** GET /admin/cash-registers/{id} — una caja: su turno abierto, sus números y su historial de turnos. */
    public function show(Request $request, CashRegister $cashRegister, CashService $cash): Response
    {
        abort_unless(in_array($cashRegister->branch_id, $request->user()->allowedBranchIds()), 403);

        $filters = $request->only(['status', 'per_page']);
        $completedSales = ['sales as sales_count' => fn (Builder $q) => $q->where('status', 'completada')];
        $sessions = fn () => $cashRegister->sessions()->with('user:id,name');

        $current = $sessions()->where('status', CashSession::OPEN)->latest('opened_at')->first();
        $summary = $current ? $cash->summary($current) : null;
        // Cierre ciego: su propio cajero no ve cuánto debería dar
        if ($summary && $current->user_id === $request->user()->id && ! config('farmacia.show_expected_cash')) {
            $summary['expected'] = null;
        }

        return Inertia::render('admin/cash/register', [
            'register' => $cashRegister->load('branch:id,name')->only(['id', 'name', 'is_active', 'branch']),
            'current' => $current,
            'summary' => $summary,
            'stats' => [
                'sessions' => $cashRegister->sessions()->count(),
                'month_sales' => (float) Sale::where('status', 'completada')
                    ->whereRelation('cashSession', 'cash_register_id', $cashRegister->id)
                    ->whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()])
                    ->sum('total'),
                'pending' => $cashRegister->sessions()->where('status', CashSession::PENDING)->count(),
                'difference' => (float) $cashRegister->sessions()->whereNotNull('difference')->sum('difference'),
            ],
            'sessions' => $sessions()
                ->withCount($completedSales)
                ->withSum(['sales as sales_total' => fn (Builder $q) => $q->where('status', 'completada')], 'total')
                ->when($filters['status'] ?? null, fn (Builder $q, $status) => $q->where('status', $status))
                ->latest('opened_at')
                ->paginate($this->perPage($request))
                ->withQueryString(),
            'filters' => $filters,
            'paymentMethods' => config('farmacia.payment_methods'),
        ]);
    }

    protected function query(): Builder
    {
        return CashRegister::whereIn('branch_id', auth()->user()->allowedBranchIds())
            ->with(['branch:id,name', 'openSession.user:id,name']);
    }

    /** Disponible, aperturada (con un cajero trabajando) o desactivada. */
    protected function present(Model $row): Model
    {
        return $row->setAttribute('availability', match (true) {
            $row->openSession !== null => 'aperturada',
            $row->is_active => 'disponible',
            default => 'desactivada',
        });
    }

    /** Siguen a la sucursal del filtro. Clic en uno: filtra la lista por ese estado. */
    protected function stats(): array
    {
        $registers = CashRegister::whereIn('branch_id', auth()->user()->allowedBranchIds())
            ->when(request()->integer('branch'), fn (Builder $q, int $branch) => $q->where('branch_id', $branch));
        $active = (clone $registers)->where('is_active', true)->count();
        $open = (clone $registers)->whereHas('openSession')->count();

        return [
            ['label' => 'Cajas', 'value' => $registers->count(), 'icon' => 'registers', 'filter' => ['status' => '']],
            ['label' => 'Aperturadas', 'value' => $open, 'icon' => 'open', 'tone' => 'blue', 'filter' => ['status' => 'aperturada']],
            ['label' => 'Disponibles', 'value' => max(0, $active - $open), 'icon' => 'free', 'tone' => 'green', 'filter' => ['status' => 'disponible']],
        ];
    }

    /** Por sucursal (si tiene más de una) y por estado. */
    protected function selectFilters(): array
    {
        $branches = Branch::whereIn('id', auth()->user()->allowedBranchIds())->orderBy('name')->get(['id', 'name']);

        return [
            ...($branches->count() > 1 ? [['name' => 'branch', 'allLabel' => 'Todas las sucursales', 'options' => $branches->all()]] : []),
            [
                'name' => 'status',
                'allLabel' => 'Todos los estados',
                'options' => [
                    ['id' => 'disponible', 'name' => 'Disponible'],
                    ['id' => 'aperturada', 'name' => 'Aperturada'],
                    ['id' => 'desactivada', 'name' => 'Desactivada'],
                ],
            ],
        ];
    }

    protected function applySelectFilters(Builder $query, array $filters): Builder
    {
        return $query
            ->when($filters['branch'] ?? null, fn (Builder $q, $branch) => $q->where('branch_id', $branch))
            ->when($filters['status'] ?? null, fn (Builder $q, string $status) => match ($status) {
                'aperturada' => $q->whereHas('openSession'),
                'disponible' => $q->where('is_active', true)->whereDoesntHave('openSession'),
                'desactivada' => $q->where('is_active', false)->whereDoesntHave('openSession'),
                default => $q,
            });
    }

    protected function applyOrder(Builder $query): Builder
    {
        return $query->orderBy('branch_id')->orderBy('name');
    }

    protected function fields(): array
    {
        return [
            [
                'name' => 'branch_id', 'label' => 'Sucursal', 'type' => 'select',
                'options' => Branch::orderBy('name')->get(['id', 'name'])->map(fn ($b) => ['value' => $b->id, 'label' => $b->name])->all(),
            ],
            ['name' => 'name', 'label' => 'Nombre', 'type' => 'text', 'placeholder' => 'Caja 1'],
            ['name' => 'is_active', 'label' => 'Activa', 'type' => 'checkbox', 'default' => true],
        ];
    }

    protected function columns(): array
    {
        return [
            ['key' => 'name', 'label' => 'Caja', 'type' => 'title', 'hint' => 'branch.name'],
            ['key' => 'availability', 'label' => 'Estado', 'type' => 'docStatus'],
            ['key' => 'open_session.user.name', 'label' => 'Cajero', 'type' => 'person', 'live' => ['availability', 'aperturada']],
        ];
    }

    protected function rules(?Model $model): array
    {
        return [
            'branch_id' => ['required', Rule::exists('branches', 'id')->whereNull('deleted_at')],
            'name' => ['required', 'string', 'max:60'],
            'is_active' => ['boolean'],
        ];
    }

    protected function deleteBlocker(Model $model): ?string
    {
        return CashSession::where('cash_register_id', $model->id)->where('status', CashSession::OPEN)->exists()
            ? "No se puede eliminar: {$model->name} tiene un turno abierto."
            : null;
    }
}
