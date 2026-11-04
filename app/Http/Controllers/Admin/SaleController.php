<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Branch;
use App\Models\Product;
use App\Models\ProductPresentation;
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

        $sales = Sale::with($this->detailRelations())
            ->whereIn('branch_id', $allowed)
            ->when($filters['search'] ?? null, fn (Builder $q, $s) => $q->where(fn (Builder $w) => $w
                ->where('number', 'like', "%{$s}%")
                ->orWhere('customer_name', 'like', "%{$s}%")
                ->orWhere('customer_document', 'like', "{$s}%")))
            ->when($filters['branch'] ?? null, fn (Builder $q, $b) => $q->where('branch_id', $b))
            ->when(
                $filters['status'] ?? null,
                fn (Builder $q, $s) => $q->where('status', $s),
                fn (Builder $q) => $q->where('status', '!=', 'anulada'),
            )
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
            'discountLimit' => (float) config('farmacia.discount_limit'),
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
            ->with(['presentations', 'indications:id,name', 'laboratory:id,name', 'category:id,name'])
            ->orderBy('name')
            ->limit(20)
            ->get();

        // Lotes vendibles de esos productos en la sucursal (FEFO)
        $batches = Batch::with('activePromotion')
            ->whereIn('product_id', $products->pluck('id'))
            ->where('branch_id', $session->branch_id)
            ->sellable()
            ->orderByExpiry()
            ->get()
            ->groupBy('product_id');

        return response()->json($products->flatMap(function (Product $p) use ($batches, $search) {
            $productBatches = $batches->get($p->id, collect());
            $first = $productBatches->first();

            // Si escanearon el código de una presentación (ej: la caja), va primero: Enter agrega esa
            return $p->presentations->where('is_sellable', true)
                ->sortByDesc(fn (ProductPresentation $pres) => $pres->barcode !== null && $pres->barcode === $search)
                ->values()
                ->map(fn ($pres) => [
                    'product_id' => $p->id,
                    'product_name' => $p->fullName(),
                    'commercial_name' => $p->name,
                    'concentration' => $p->concentration,
                    'image' => $p->image,
                    'laboratory' => $p->laboratory?->name,
                    'generic_name' => $p->generic_name,
                    'pharmaceutical_form' => $p->pharmaceutical_form,
                    'category' => $p->category?->name,
                    'barcode' => $pres->barcode ?? $p->barcode,
                    'indications' => $p->indications->pluck('name'),
                    'requires_prescription' => $p->requires_prescription,
                    'is_controlled' => $p->is_controlled,
                    'presentation_id' => $pres->id,
                    'presentation_name' => $pres->name,
                    // Escanearon el código de ESTA presentación: se agrega directo, sin preguntar cuántas
                    'scanned' => $pres->barcode !== null && $pres->barcode === $search,
                    'package' => mb_strtolower($pres->package ?: $p->base_unit),
                    // Nivel por nivel: cada caja contiene 3 blísteres, cada blíster contiene 10 tabletas
                    'breakdown' => $pres->breakdown($p->presentations),
                    'factor' => $pres->factor,
                    'sale_price' => (float) $pres->sale_price,
                    'stock_units' => (int) $productBatches->sum('stock'),
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
            // Descuento general en Bs (SaleService revisa permiso, tope y costo)
            'discount' => ['nullable', 'numeric', 'min:0'],
            'discount_reason' => ['nullable', 'string', 'max:100', Rule::requiredIf(fn () => (float) $request->input('discount') > 0)],
        ], [], ['items' => 'productos', 'items.*.quantity' => 'cantidad', 'payments' => 'pagos', 'payments.*.amount' => 'monto', 'discount' => 'descuento', 'discount_reason' => 'motivo del descuento']);

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
                ...$this->detailRelations(),
                'customer' => fn ($q) => $q->withTrashed()->select('id', 'document_type', 'phone', 'email'),
            ]),
            'paymentMethods' => config('farmacia.payment_methods'),
        ]);
    }

    /**
     * Lo que muestra una venta: su página, el ticket y el detalle desplegable de la lista.
     *
     * @return array<int|string, string|\Closure>
     */
    private function detailRelations(): array
    {
        return [
            'branch:id,name,address,phone', 'registeredBy:id,name', 'cancelledBy:id,name', 'payments',
            'cashSession:id,status,cash_register_id', 'cashSession.cashRegister' => fn ($q) => $q->withTrashed()->select('id', 'name'),
            'items.product:id,name,generic_name,concentration,pharmaceutical_form,image,laboratory_id', 'items.product.laboratory:id,name',
            'items.product.presentations' => fn ($q) => $q->withTrashed(),
            'items.batch:id,batch_number,expires_at',
            'items.presentation' => fn ($q) => $q->withTrashed(),
        ];
    }

    public function cancel(Request $request, Sale $sale): RedirectResponse
    {
        abort_unless(in_array($sale->branch_id, $request->user()->allowedBranchIds()), 403);
        $data = $request->validate(['reason' => ['required', 'string', 'max:255']], [], ['reason' => 'motivo']);

        $this->sales->cancel($sale, $data['reason'], $request->user());

        return back()->with('success', "Venta {$sale->number} anulada. El stock volvió a sus lotes.");
    }
}
