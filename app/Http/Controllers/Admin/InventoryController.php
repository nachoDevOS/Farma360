<?php

namespace App\Http\Controllers\Admin;

use App\Exceptions\BusinessException;
use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Branch;
use App\Models\Product;
use App\Models\StockMovement;
use App\Services\InventoryService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * INVENTARIO: stock por sucursal, lotes, kardex y ajustes.
 * Permisos: inventario.ver · inventario.ajustar (inventario inicial, correcciones y bajas)
 */
class InventoryController extends Controller
{
    public function __construct(private InventoryService $inventory) {}

    /** GET /admin/inventory — stock de cada producto en la sucursal elegida. */
    public function index(Request $request): Response
    {
        $branches = Branch::whereIn('id', $request->user()->allowedBranchIds())->orderBy('name')->get(['id', 'name']);
        $branchId = (int) ($request->input('branch') ?: $request->user()->branch_id ?: $branches->first()?->id);
        abort_unless($branches->contains('id', $branchId) || $branches->isEmpty(), 403);

        $filters = $request->only(['search', 'alert', 'per_page']) + ['branch' => (string) $branchId];
        $alertDays = (int) config('farmacia.expiry_alert_days');
        $search = trim((string) ($filters['search'] ?? ''));

        $products = Product::query()
            ->withSum(['batches as stock' => fn ($q) => $q->where('branch_id', $branchId)], 'quantity')
            ->withSum(['batches as stock_value' => fn ($q) => $q->where('branch_id', $branchId)], DB::raw('quantity * unit_cost'))
            ->withMin(['batches as next_expiry' => fn ($q) => $q->where('branch_id', $branchId)->where('quantity', '>', 0)], 'expires_at')
            ->search($search)
            ->when(($filters['alert'] ?? null) === 'low', fn (Builder $q) => $q->whereRaw(
                '(select coalesce(sum(quantity), 0) from batches where batches.product_id = products.id and batches.branch_id = ? and batches.deleted_at is null) <= products.min_stock',
                [$branchId],
            ))
            ->when(($filters['alert'] ?? null) === 'expiring', fn (Builder $q) => $q->whereHas('batches', fn (Builder $b) => $b
                ->where('branch_id', $branchId)->where('quantity', '>', 0)
                ->whereDate('expires_at', '>=', today())->whereDate('expires_at', '<=', today()->addDays($alertDays))))
            ->when(($filters['alert'] ?? null) === 'expired', fn (Builder $q) => $q->whereHas('batches', fn (Builder $b) => $b
                ->where('branch_id', $branchId)->where('quantity', '>', 0)->whereDate('expires_at', '<', today())))
            ->orderBy('name')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return Inertia::render('admin/inventory/index', [
            'products' => $products,
            'filters' => $filters,
            'branches' => $branches,
            'alertDays' => $alertDays,
            'totals' => [
                'value' => round((float) Batch::where('branch_id', $branchId)->sum(DB::raw('quantity * unit_cost')), 2),
                'expiring' => Batch::where('branch_id', $branchId)->where('quantity', '>', 0)
                    ->whereDate('expires_at', '>=', today())->whereDate('expires_at', '<=', today()->addDays($alertDays))->count(),
                'expired' => Batch::where('branch_id', $branchId)->where('quantity', '>', 0)->whereDate('expires_at', '<', today())->count(),
            ],
        ]);
    }

    /** GET /admin/inventory/{product}?branch= — lotes del producto y su kardex en la sucursal. */
    public function show(Request $request, Product $product): Response
    {
        $branches = Branch::whereIn('id', $request->user()->allowedBranchIds())->orderBy('name')->get(['id', 'name']);
        $branchId = (int) ($request->input('branch') ?: $request->user()->branch_id ?: $branches->first()?->id);
        abort_unless($branches->contains('id', $branchId), 403);

        return Inertia::render('admin/inventory/show', [
            'product' => $product->load('presentations', 'laboratory:id,name'),
            'branches' => $branches,
            'branchId' => $branchId,
            'stock' => $this->inventory->stock($product->id, $branchId),
            'batches' => Batch::with('activePromotion')
                ->where('product_id', $product->id)->where('branch_id', $branchId)
                ->where(fn ($q) => $q->where('quantity', '>', 0)->orWhere('updated_at', '>=', now()->subDays(30)))
                ->orderBy('expires_at')->get(),
            'movements' => StockMovement::with('batch:id,batch_number', 'registeredBy:id,name')
                ->where('product_id', $product->id)->where('branch_id', $branchId)
                ->latest('id')
                ->paginate(15)
                ->withQueryString(),
            'movementTypes' => StockMovement::TYPES,
        ]);
    }

    /**
     * POST /admin/inventory/adjust — ajuste manual.
     *   mode=new     → inventario inicial / ingreso sin compra: crea un lote
     *   mode=in      → suma a un lote existente
     *   mode=out     → resta de un lote (faltante, error de conteo)
     *   mode=writeoff→ baja por vencimiento o daño
     */
    public function adjust(Request $request): RedirectResponse
    {
        $allowed = $request->user()->allowedBranchIds();
        $data = $request->validate([
            'mode' => ['required', Rule::in(['new', 'in', 'out', 'writeoff'])],
            'quantity' => ['required', 'integer', 'min:1'],
            'note' => ['required', 'string', 'max:255'],
            'batch_id' => ['required_unless:mode,new', 'nullable', 'integer'],
            'product_id' => ['required_if:mode,new', 'nullable', Rule::exists('products', 'id')->whereNull('deleted_at')],
            'branch_id' => ['required_if:mode,new', 'nullable', Rule::in($allowed)],
            'batch_number' => ['required_if:mode,new', 'nullable', 'string', 'max:50'],
            'expires_at' => ['required_if:mode,new', 'nullable', 'date'],
            'unit_cost' => ['required_if:mode,new', 'nullable', 'numeric', 'min:0'],
        ], [], ['quantity' => 'cantidad', 'note' => 'motivo', 'batch_number' => 'lote', 'expires_at' => 'vencimiento', 'unit_cost' => 'costo unitario']);

        DB::transaction(function () use ($data, $allowed) {
            if ($data['mode'] === 'new') {
                $batch = $this->inventory->createBatch([
                    'product_id' => $data['product_id'],
                    'branch_id' => $data['branch_id'],
                    'batch_number' => $data['batch_number'],
                    'expires_at' => $data['expires_at'],
                    'unit_cost' => round((float) $data['unit_cost'], 4),
                ]);
                $this->inventory->increase($batch, $data['quantity'], 'ajuste_entrada', null, $data['note']);

                return;
            }

            $batch = Batch::findOrFail($data['batch_id']);
            if (! in_array($batch->branch_id, $allowed)) {
                throw new BusinessException('Ese lote no es de tu sucursal.');
            }

            match ($data['mode']) {
                'in' => $this->inventory->increase($batch, $data['quantity'], 'ajuste_entrada', null, $data['note']),
                'out' => $this->inventory->decrease($batch, $data['quantity'], 'ajuste_salida', null, $data['note']),
                'writeoff' => $this->inventory->decrease($batch, $data['quantity'], 'baja', null, $data['note']),
            };
        });

        return back()->with('success', 'Ajuste registrado en el kardex.');
    }

    /** GET /admin/inventory/batches?branch_id=&q= — lotes con stock de una sucursal (JSON, para transferencias). */
    public function batches(Request $request): JsonResponse
    {
        $branchId = $request->integer('branch_id');
        abort_unless(in_array($branchId, $request->user()->allowedBranchIds()), 403);
        $search = trim((string) $request->query('q'));

        return response()->json(
            Batch::with('product:id,name,concentration,pharmaceutical_form,base_unit')
                ->where('branch_id', $branchId)
                ->where('quantity', '>', 0)
                ->when($search !== '', fn (Builder $q) => $q->whereHas('product', fn (Builder $p) => $p
                    ->where('name', 'like', "%{$search}%")->orWhere('barcode', $search)))
                ->orderBy('expires_at')
                ->limit(20)
                ->get()
                ->map(fn (Batch $b) => [
                    'id' => $b->id,
                    'product_name' => $b->product->fullName(),
                    'base_unit' => $b->product->base_unit,
                    'batch_number' => $b->batch_number,
                    'expires_at' => $b->expires_at->toDateString(),
                    'quantity' => $b->quantity,
                    'expired' => $b->isExpired(),
                ]),
        );
    }
}
