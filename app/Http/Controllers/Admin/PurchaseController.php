<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Services\BatchHistory;
use App\Services\PurchaseService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * COMPRAS: ingreso de mercadería. Cada ítem crea un lote (número + vencimiento + costo).
 * Permisos: compras.ver · compras.crear · compras.anular
 */
class PurchaseController extends Controller
{
    public function __construct(private PurchaseService $purchases) {}

    /**
     * GET /admin/purchases?branch=&status=&search= — compras de las sucursales permitidas, la más reciente primero.
     * Cada fila trae sus ítems para el detalle desplegable (con cuánto queda de cada lote) y arriba van los números
     * del mes (de la sucursal elegida o de todas): comprado contra el mes anterior, cantidad, proveedor principal y anuladas.
     */
    public function index(Request $request): Response
    {
        $filters = $request->only(['search', 'branch', 'status', 'per_page']);
        $branches = $request->user()->allowedBranchIds();
        // Asignado a una sucursal: siempre la suya
        if ($request->user()->branch_id !== null) {
            $filters['branch'] = (string) $request->user()->branch_id;
        }

        $purchases = Purchase::with([
            'branch:id,name', 'supplier:id,name',
            'items' => fn ($q) => $q->with([
                'product:id,name,concentration,base_unit',
                'presentation' => fn ($p) => $p->withTrashed()->select('id', 'name'),
                'batch:id,quantity',
            ]),
        ])
            ->withCount('items')
            ->whereIn('branch_id', $branches)
            ->when($filters['search'] ?? null, fn (Builder $q, $s) => $q->where(fn (Builder $w) => $w
                ->where('number', 'like', "%{$s}%")
                ->orWhere('invoice_number', 'like', "%{$s}%")
                ->orWhereHas('supplier', fn (Builder $sup) => $sup->where('name', 'like', "%{$s}%"))))
            ->when($filters['branch'] ?? null, fn (Builder $q, $b) => $q->where('branch_id', $b))
            ->when($filters['status'] ?? null, fn (Builder $q, $s) => $q->where('status', $s))
            ->latest('purchased_at')
            ->latest('id')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return Inertia::render('admin/purchases/index', [
            'purchases' => $purchases,
            'filters' => $filters,
            'branches' => Branch::whereIn('id', $branches)->orderBy('name')->get(['id', 'name']),
            'canSeeAllBranches' => $request->user()->branch_id === null,
            'month' => $this->monthSummary($branches, $filters['branch'] ?? null),
        ]);
    }

    /**
     * Números del mes en curso (por fecha de compra): lo comprado (sin las anuladas) contra el mes anterior, cuántas
     * compras, el proveedor al que más se le compró y cuántas se anularon.
     *
     * @param  list<int>  $branches
     * @return array{total: float, previous: float, count: int, cancelled: int, top_supplier: ?array{name: string, total: float}}
     */
    private function monthSummary(array $branches, ?string $branch): array
    {
        $scope = fn () => Purchase::whereIn('branch_id', $branches)->when($branch, fn (Builder $q) => $q->where('branch_id', $branch));
        $start = today()->startOfMonth();
        $registered = fn () => $scope()->where('status', 'registrada');
        $top = $registered()->where('purchased_at', '>=', $start)
            ->groupBy('supplier_id')
            ->selectRaw('supplier_id, SUM(total) as total')
            ->orderByDesc('total')
            ->with('supplier:id,name')
            ->first();

        return [
            'total' => round((float) $registered()->where('purchased_at', '>=', $start)->sum('total'), 2),
            'previous' => round((float) $registered()->whereBetween('purchased_at', [$start->copy()->subMonth(), $start->copy()->subDay()])->sum('total'), 2),
            'count' => $registered()->where('purchased_at', '>=', $start)->count(),
            'cancelled' => $scope()->where('status', 'anulada')->where('purchased_at', '>=', $start)->count(),
            'top_supplier' => $top ? ['name' => $top->supplier?->name ?? '—', 'total' => round((float) $top->total, 2)] : null,
        ];
    }

    public function create(Request $request): Response
    {
        return Inertia::render('admin/purchases/create', [
            'branches' => Branch::whereIn('id', $request->user()->allowedBranchIds())->orderBy('name')->get(['id', 'name']),
            'suppliers' => Supplier::where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'branch_id' => ['required', Rule::in($request->user()->allowedBranchIds())],
            'supplier_id' => ['required', Rule::exists('suppliers', 'id')->whereNull('deleted_at')],
            'invoice_number' => ['nullable', 'string', 'max:50'],
            'purchased_at' => ['required', 'date', 'before_or_equal:today'],
            'note' => ['nullable', 'string', 'max:255'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_presentation_id' => ['required', Rule::exists('product_presentations', 'id')->whereNull('deleted_at')->where('is_purchasable', true)],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.cost' => ['required', 'numeric', 'min:0'],
            'items.*.batch_number' => ['required', 'string', 'max:50'],
            'items.*.expires_at' => ['required', 'date', 'after:today'],
        ], [], [
            'branch_id' => 'sucursal',
            'supplier_id' => 'proveedor',
            'purchased_at' => 'fecha de compra',
            'items' => 'productos',
            'items.*.quantity' => 'cantidad',
            'items.*.cost' => 'costo',
            'items.*.batch_number' => 'lote',
            'items.*.expires_at' => 'vencimiento',
        ]);

        $purchase = $this->purchases->create($data);

        return to_route('admin.purchases.show', $purchase)->with('success', "Compra {$purchase->number} registrada. El stock ya está disponible.");
    }

    /**
     * GET /admin/purchases/{purchase} — ficha de la compra. Cada ítem trae además:
     *   remaining           lo que queda hoy en su lote (cuánto de lo comprado sigue en stock)
     *   previous_unit_cost  costo por unidad base en la compra anterior del mismo producto (para ver si subió)
     *   sale_unit_price     precio de venta de una unidad base (presentación más chica que se vende), para la ganancia
     * lots: los lotes de la compra con su registro completo (solo con inventario.ver).
     */
    public function show(Request $request, Purchase $purchase, BatchHistory $batchHistory): Response
    {
        abort_unless(in_array($purchase->branch_id, $request->user()->allowedBranchIds()), 403);

        $purchase->load([
            'branch:id,name', 'supplier:id,name,nit,phone', 'registeredBy:id,name', 'cancelledBy:id,name',
            'items.product:id,name,concentration,pharmaceutical_form,base_unit', 'items.product.presentations',
            'items.presentation' => fn ($q) => $q->withTrashed(), 'items.batch:id,quantity',
        ]);
        $purchase->items->each(function (PurchaseItem $item) use ($purchase) {
            $previous = PurchaseItem::query()
                ->join('purchases', 'purchases.id', '=', 'purchase_items.purchase_id')
                ->where('purchase_items.product_id', $item->product_id)
                ->where('purchases.status', 'registrada')
                ->whereNull('purchases.deleted_at')
                ->where('purchase_items.purchase_id', '!=', $purchase->id)
                ->where(fn (Builder $q) => $q->where('purchases.purchased_at', '<', $purchase->purchased_at)
                    ->orWhere(fn (Builder $q) => $q->where('purchases.purchased_at', $purchase->purchased_at)->where('purchases.id', '<', $purchase->id)))
                ->orderByDesc('purchases.purchased_at')
                ->orderByDesc('purchases.id')
                ->value('purchase_items.unit_cost');
            $smallest = $item->product->presentations->first(fn ($p) => $p->is_sellable && $p->sale_price);
            $item->setAttribute('remaining', (int) ($item->batch?->quantity ?? 0));
            $item->setAttribute('previous_unit_cost', $previous !== null ? (float) $previous : null);
            $item->setAttribute('sale_unit_price', $smallest ? round((float) $smallest->sale_price / $smallest->factor, 4) : null);
        });

        return Inertia::render('admin/purchases/show', [
            'purchase' => $purchase,
            'lots' => $request->user()->can('inventario.ver') ? $batchHistory->forBatches($purchase->items->pluck('batch_id')->filter()->values()->all()) : [],
            'movementTypes' => StockMovement::TYPES,
        ]);
    }

    public function cancel(Request $request, Purchase $purchase): RedirectResponse
    {
        abort_unless(in_array($purchase->branch_id, $request->user()->allowedBranchIds()), 403);
        $data = $request->validate(['reason' => ['required', 'string', 'max:255']], [], ['reason' => 'motivo']);

        $this->purchases->cancel($purchase, $data['reason'], $request->user());

        return back()->with('success', "Compra {$purchase->number} anulada. El stock se descontó.");
    }
}
