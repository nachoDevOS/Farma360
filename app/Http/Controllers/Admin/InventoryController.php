<?php

namespace App\Http\Controllers\Admin;

use App\Exceptions\BusinessException;
use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Branch;
use App\Models\Product;
use App\Models\ProductPresentation;
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
            // Presentaciones: para mostrar el stock desglosado (2 cajas + 8 blísteres + 7 tabletas)
            ->with('presentations:id,product_id,package,name,factor')
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

    /** GET /admin/inventory/{product}?branch= — lotes del producto, su kardex y la historia del stock (gráficos) en la sucursal. */
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
            'history' => $this->stockHistory($product->id, $branchId),
        ]);
    }

    /**
     * Historia diaria del stock en la sucursal (para los gráficos de la ficha de inventario), sacada del kardex:
     * saldo al cierre de cada día y lo que entró / salió ese día, por tipo de movimiento.
     *
     * @return list<array{date: string, balance: int, in: int, out: int, types: array<string, int>}>
     */
    private function stockHistory(int $productId, int $branchId, int $days = 90): array
    {
        $from = today()->subDays($days - 1);
        $movements = StockMovement::where('product_id', $productId)->where('branch_id', $branchId);

        // Saldo con el que empieza el período: el del último movimiento anterior
        $balance = (int) ((clone $movements)->where('created_at', '<', $from)->latest('id')->value('balance') ?? 0);
        $byDay = (clone $movements)->where('created_at', '>=', $from)->orderBy('id')
            ->get(['type', 'quantity', 'balance', 'created_at'])
            ->groupBy(fn (StockMovement $m) => $m->created_at->toDateString());

        $history = [];
        for ($day = $from->copy(); $day->lte(today()); $day->addDay()) {
            $moves = $byDay->get($day->toDateString(), collect());
            if ($moves->isNotEmpty()) {
                $balance = (int) $moves->last()->balance;
            }
            $history[] = [
                'date' => $day->toDateString(),
                'balance' => $balance,
                'in' => (int) $moves->where('quantity', '>', 0)->sum('quantity'),
                'out' => (int) -$moves->where('quantity', '<', 0)->sum('quantity'),
                'types' => $moves->groupBy('type')->map(fn ($group) => (int) $group->sum('quantity'))->all(),
            ];
        }

        return $history;
    }

    /**
     * POST /admin/inventory/adjust — ajuste manual.
     *   mode=new     → inventario inicial / ingreso sin compra: crea un lote (lote y motivo opcionales). Se carga como en una compra, por
     *                  presentaciones (varias líneas: 1 Caja x100 + 5 Blíster x10 = 150 tabletas) y el costo de
     *                  compra de UNA presentación (Bs 40 por caja → Bs 0,40 c/tableta)
     *   mode=in      → suma a un lote existente (en unidades base)
     *   mode=out     → resta de un lote (faltante, error de conteo)
     *   mode=writeoff→ baja por vencimiento o daño
     */
    public function adjust(Request $request): RedirectResponse
    {
        $allowed = $request->user()->allowedBranchIds();
        // Presentaciones del mismo producto (para las líneas y para el costo del ingreso sin compra)
        $ownPresentation = Rule::exists('product_presentations', 'id')->where('product_id', $request->input('product_id'))->whereNull('deleted_at');
        $data = $request->validate([
            'mode' => ['required', Rule::in(['new', 'in', 'out', 'writeoff'])],
            'quantity' => ['required_unless:mode,new', 'nullable', 'integer', 'min:1'],
            // En el ingreso sin compra el motivo y el lote son opcionales; en salidas, bajas y entradas a un lote el motivo es obligatorio
            'note' => ['required_unless:mode,new', 'nullable', 'string', 'max:255'],
            'batch_id' => ['required_unless:mode,new', 'nullable', 'integer'],
            'product_id' => ['required_if:mode,new', 'nullable', Rule::exists('products', 'id')->whereNull('deleted_at')],
            'branch_id' => ['required_if:mode,new', 'nullable', Rule::in($allowed)],
            'batch_number' => ['nullable', 'string', 'max:50'],
            'expires_at' => ['required_if:mode,new', 'nullable', 'date'],
            // Solo en mode=new: líneas por presentación y costo de compra de una presentación
            'items' => ['required_if:mode,new', 'nullable', 'array', 'min:1'],
            'items.*.product_presentation_id' => ['required', 'distinct', $ownPresentation],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'cost' => ['required_if:mode,new', 'nullable', 'numeric', 'min:0'],
            'cost_presentation_id' => ['required_if:mode,new', 'nullable', $ownPresentation],
        ], [
            'required_if' => 'El campo :attribute es obligatorio.',
            'required_unless' => 'El campo :attribute es obligatorio.',
            'items.*.product_presentation_id.distinct' => 'Esa presentación ya está en otra línea.',
        ], [
            'quantity' => 'cantidad', 'note' => 'motivo', 'batch_number' => 'lote', 'expires_at' => 'vencimiento',
            'items' => 'presentaciones', 'items.*.product_presentation_id' => 'presentación', 'items.*.quantity' => 'cantidad',
            'cost' => 'costo de compra', 'cost_presentation_id' => 'presentación del costo',
        ]);

        DB::transaction(function () use ($data, $allowed) {
            if ($data['mode'] === 'new') {
                // Se convierte a unidades base, igual que en una compra
                $factors = ProductPresentation::whereIn('id', [...array_column($data['items'], 'product_presentation_id'), $data['cost_presentation_id']])
                    ->pluck('factor', 'id');
                $units = collect($data['items'])->sum(fn (array $item) => $item['quantity'] * $factors[$item['product_presentation_id']]);

                $batch = $this->inventory->createBatch([
                    'product_id' => $data['product_id'],
                    'branch_id' => $data['branch_id'],
                    'batch_number' => $data['batch_number'] ?? 'SL',
                    'expires_at' => $data['expires_at'],
                    'unit_cost' => round((float) $data['cost'] / $factors[$data['cost_presentation_id']], 4),
                ]);
                // Sin número de lote: "SL-000123" (sin lote + su ID), así cada lote se sigue distinguiendo
                if (blank($data['batch_number'] ?? null)) {
                    $batch->update(['batch_number' => 'SL-'.str_pad((string) $batch->id, 6, '0', STR_PAD_LEFT)]);
                }
                $this->inventory->increase($batch, $units, 'ajuste_entrada', null, $data['note'] ?? 'Ingreso sin compra');

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
