<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Purchase;
use App\Models\Supplier;
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

    public function index(Request $request): Response
    {
        $filters = $request->only(['search', 'branch', 'status', 'per_page']);
        $branches = $request->user()->allowedBranchIds();

        $purchases = Purchase::with('branch:id,name', 'supplier:id,name')
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
        ]);
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

    public function show(Request $request, Purchase $purchase): Response
    {
        abort_unless(in_array($purchase->branch_id, $request->user()->allowedBranchIds()), 403);

        return Inertia::render('admin/purchases/show', [
            'purchase' => $purchase->load([
                'branch:id,name', 'supplier:id,name,nit', 'registeredBy:id,name', 'cancelledBy:id,name',
                'items.product:id,name,concentration,pharmaceutical_form', 'items.presentation' => fn ($q) => $q->withTrashed(),
            ]),
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
