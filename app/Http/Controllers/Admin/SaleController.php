<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Branch;
use App\Models\Product;
use App\Models\Sale;
use App\Services\CashService;
use App\Services\SaleService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * VENTAS y PUNTO DE VENTA.
 * Permisos: ventas.ver · ventas.crear (necesita caja abierta) · ventas.anular
 */
class SaleController extends Controller
{
    public function __construct(private SaleService $sales, private CashService $cash) {}

    public function index(Request $request): Response
    {
        $filters = $request->only(['search', 'branch', 'status', 'from', 'to', 'per_page']);
        $allowed = $request->user()->allowedBranchIds();

        $sales = Sale::with('branch:id,name', 'registeredBy:id,name', 'payments:id,sale_id,method,amount')
            ->whereIn('branch_id', $allowed)
            ->when($filters['search'] ?? null, fn (Builder $q, $s) => $q->where(fn (Builder $w) => $w
                ->where('number', 'like', "%{$s}%")
                ->orWhere('customer_name', 'like', "%{$s}%")
                ->orWhere('customer_document', 'like', "{$s}%")))
            ->when($filters['branch'] ?? null, fn (Builder $q, $b) => $q->where('branch_id', $b))
            ->when($filters['status'] ?? null, fn (Builder $q, $s) => $q->where('status', $s))
            ->when($filters['from'] ?? null, fn (Builder $q, $d) => $q->whereDate('created_at', '>=', $d))
            ->when($filters['to'] ?? null, fn (Builder $q, $d) => $q->whereDate('created_at', '<=', $d))
            ->latest('id')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return Inertia::render('admin/sales/index', [
            'sales' => $sales,
            'filters' => $filters,
            'branches' => Branch::whereIn('id', $allowed)->orderBy('name')->get(['id', 'name']),
            'paymentMethods' => config('farmacia.payment_methods'),
        ]);
    }

    /** GET /admin/pos — pantalla de venta. Sin caja abierta manda a abrirla. */
    public function pos(Request $request): Response|RedirectResponse
    {
        $session = $this->cash->currentSession($request->user());
        if (! $session) {
            return to_route('admin.cash.index')->with('info', 'Para vender, primero abre tu caja.');
        }

        return Inertia::render('admin/sales/pos', [
            'session' => $session->load('cashRegister:id,name', 'branch:id,name'),
            'paymentMethods' => config('farmacia.payment_methods'),
        ]);
    }

    /**
     * GET /admin/pos/search?q= — productos para el punto de venta (JSON).
     * Por presentación: precio normal, stock vendible en la sucursal de mi caja y la promoción del lote que sale primero.
     */
    public function search(Request $request): JsonResponse
    {
        $session = $this->cash->currentSession($request->user());
        abort_unless($session, 403);
        $search = trim((string) $request->query('q'));
        if ($search === '') {
            return response()->json([]);
        }

        // Busca también por uso / síntoma: "dolor de cabeza" trae todo lo que sirve para eso
        $products = Product::where('is_active', true)
            ->search($search)
            ->with(['presentations' => fn ($q) => $q->sellable(), 'indications:id,name'])
            ->orderBy('name')
            ->limit(20)
            ->get();

        // Lotes vendibles de esos productos en la sucursal (FEFO)
        $batches = Batch::with('activePromotion')
            ->whereIn('product_id', $products->pluck('id'))
            ->where('branch_id', $session->branch_id)
            ->sellable()
            ->orderBy('expires_at')
            ->get()
            ->groupBy('product_id');

        return response()->json($products->flatMap(function (Product $p) use ($batches) {
            $productBatches = $batches->get($p->id, collect());
            $first = $productBatches->first();

            return $p->presentations->map(fn ($pres) => [
                'product_id' => $p->id,
                'product_name' => $p->fullName(),
                'generic_name' => $p->generic_name,
                'indications' => $p->indications->pluck('name'),
                'requires_prescription' => $p->requires_prescription,
                'is_controlled' => $p->is_controlled,
                'presentation_id' => $pres->id,
                'presentation_name' => $pres->name,
                'factor' => $pres->factor,
                'sale_price' => (float) $pres->sale_price,
                'stock_units' => (int) $productBatches->sum('quantity'),
                'next_expiry' => $first?->expires_at?->toDateString(),
                'promo_discount' => $first?->activePromotion ? (float) $first->activePromotion->discount_percent : null,
            ]);
        })->values());
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_presentation_id' => ['required', Rule::exists('product_presentations', 'id')->whereNull('deleted_at')->where('is_sellable', true)],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'payments' => ['required', 'array', 'min:1'],
            'payments.*.method' => ['required', Rule::in(array_keys(config('farmacia.payment_methods')))],
            'payments.*.amount' => ['required', 'numeric', 'min:0'],
            'payments.*.reference' => ['nullable', 'string', 'max:60'],
            'customer_id' => ['nullable', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'customer_document' => ['nullable', 'string', 'max:30'],
            'prescription_number' => ['nullable', 'string', 'max:50'],
            'prescription_doctor' => ['nullable', 'string', 'max:255'],
        ], [], ['items' => 'productos', 'items.*.quantity' => 'cantidad', 'payments' => 'pagos', 'payments.*.amount' => 'monto']);

        $session = $this->cash->currentSession($request->user());
        if (! $session) {
            return to_route('admin.cash.index')->with('info', 'Para vender, primero abre tu caja.');
        }

        $sale = $this->sales->create($session, $request->user(), $data);

        return to_route('admin.sales.show', $sale)->with('success', "Venta {$sale->number} registrada. Cambio: ".number_format((float) $sale->change, 2));
    }

    public function show(Request $request, Sale $sale): Response
    {
        abort_unless(in_array($sale->branch_id, $request->user()->allowedBranchIds()), 403);

        return Inertia::render('admin/sales/show', [
            'sale' => $sale->load([
                'branch:id,name,address,phone', 'registeredBy:id,name', 'cancelledBy:id,name', 'payments', 'cashSession:id,status',
                'items.product:id,name,concentration,pharmaceutical_form', 'items.batch:id,batch_number,expires_at',
                'items.presentation' => fn ($q) => $q->withTrashed(),
            ]),
            'paymentMethods' => config('farmacia.payment_methods'),
        ]);
    }

    public function cancel(Request $request, Sale $sale): RedirectResponse
    {
        abort_unless(in_array($sale->branch_id, $request->user()->allowedBranchIds()), 403);
        $data = $request->validate(['reason' => ['required', 'string', 'max:255']], [], ['reason' => 'motivo']);

        $this->sales->cancel($sale, $data['reason'], $request->user());

        return back()->with('success', "Venta {$sale->number} anulada. El stock volvió a sus lotes.");
    }
}
