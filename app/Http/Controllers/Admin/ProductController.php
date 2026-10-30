<?php

namespace App\Http\Controllers\Admin;

use App\Exceptions\BusinessException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ProductRequest;
use App\Models\Batch;
use App\Models\Category;
use App\Models\Indication;
use App\Models\Laboratory;
use App\Models\Product;
use App\Models\ProductPresentation;
use App\Models\ProductPriceHistory;
use App\Models\PurchaseItem;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * CATÁLOGO DE PRODUCTOS con sus presentaciones (Unidad, Blíster, Caja…).
 * Permisos: productos.ver · productos.crear · productos.editar · productos.eliminar
 */
class ProductController extends Controller
{
    /**
     * GET /admin/products — lista con búsqueda y filtros, los más nuevos primero.
     * Cada fila trae también lo que muestra su detalle desplegable: stock por sucursal y quién lo registró.
     */
    public function index(Request $request): Response
    {
        $filters = $request->only(['search', 'category', 'laboratory', 'indication', 'status', 'per_page']);

        $products = Product::search($filters['search'] ?? null)
            ->with(['laboratory:id,name', 'category:id,name', 'presentations', 'indications:id,name', 'registeredBy:id,name'])
            ->withSum('batches as stock', 'quantity')
            ->when($filters['category'] ?? null, fn (Builder $q, $id) => $q->where('category_id', $id))
            ->when($filters['laboratory'] ?? null, fn (Builder $q, $id) => $q->where('laboratory_id', $id))
            // Filtro por uso / síntoma (ej: todos los productos para "Dolor de cabeza")
            ->when($filters['indication'] ?? null, fn (Builder $q, $id) => $q->whereHas('indications', fn (Builder $i) => $i->whereKey($id)))
            ->when($filters['status'] ?? null, fn (Builder $q, $s) => $q->where('is_active', $s === 'active'))
            ->orderByDesc('id')
            ->paginate($this->perPage($request))
            ->withQueryString();

        // Stock por sucursal de los productos de esta página (para el detalle de cada fila)
        $branchStock = $this->branchStock($products->getCollection()->modelKeys());
        $products->getCollection()->each(fn (Product $product) => $product->setAttribute('branch_stock', $branchStock->get($product->id, [])));

        return Inertia::render('admin/products/index', [
            'products' => $products,
            'filters' => $filters,
            ...$this->options(),
        ]);
    }

    /**
     * GET /admin/products/{product} — ficha completa del producto: datos, presentaciones, stock por sucursal,
     * últimas compras (para ver el costo y la ganancia), historial de precios y quién lo registró.
     */
    public function show(Product $product): Response
    {
        $product->load(['laboratory:id,name', 'category:id,name', 'presentations', 'indications:id,name', 'registeredBy:id,name']);
        $product->setAttribute('branch_stock', $this->branchStock([$product->id])->get($product->id, []));

        $purchases = PurchaseItem::query()
            ->with(['purchase' => fn ($q) => $q->with('supplier:id,name', 'branch:id,name'), 'presentation' => fn ($q) => $q->withTrashed()])
            ->where('product_id', $product->id)
            ->whereHas('purchase', fn (Builder $q) => $q->where('status', 'registrada'))
            ->latest('id')
            ->limit(10)
            ->get()
            ->map(fn (PurchaseItem $item) => [
                'id' => $item->id,
                'purchase_id' => $item->purchase_id,
                'purchased_at' => $item->purchase->purchased_at->toDateString(),
                'invoice_number' => $item->purchase->invoice_number,
                'supplier' => $item->purchase->supplier?->name,
                'branch' => $item->purchase->branch?->name,
                'presentation' => $item->presentation?->name,
                'quantity' => $item->quantity,
                'cost' => (float) $item->cost,
                'unit_cost' => (float) $item->unit_cost,
                'batch_number' => $item->batch_number,
                'expires_at' => $item->expires_at?->toDateString(),
            ]);

        // Cambios de precio, el más reciente primero (solo historial: las ventas guardan sus propios montos)
        $priceHistory = ProductPriceHistory::with('registeredBy:id,name')
            ->where('product_id', $product->id)
            ->latest('id')
            ->limit(50)
            ->get()
            ->map(fn (ProductPriceHistory $change) => [
                'id' => $change->id,
                'changed_at' => $change->created_at->toIso8601String(),
                'presentation' => $change->presentation_name,
                'old_price' => $change->old_price !== null ? (float) $change->old_price : null,
                'new_price' => $change->new_price !== null ? (float) $change->new_price : null,
                'source' => $change->source,
                'user' => $change->registeredBy?->name,
                'role' => $change->registerRole,
            ]);

        return Inertia::render('admin/products/show', ['product' => $product, 'purchases' => $purchases, 'priceHistory' => $priceHistory]);
    }

    public function create(): Response
    {
        return Inertia::render('admin/products/form', ['product' => null, ...$this->options()]);
    }

    public function store(ProductRequest $request): RedirectResponse
    {
        $product = DB::transaction(function () use ($request) {
            $product = Product::create($this->productData($request));
            $this->syncPresentations($product, $request->validated('presentations'));
            $product->indications()->sync(Indication::idsFor($request->validated('indications', [])));

            return $product;
        });

        return to_route('admin.products.index')->with('success', "Producto {$product->name} creado.");
    }

    public function edit(Product $product): Response
    {
        $product->load('presentations', 'indications:id,name');

        return Inertia::render('admin/products/form', [
            'product' => [
                ...$product->toArray(),
                // El formulario escribe los usos como texto
                'indication_names' => $product->indications->pluck('name'),
            ],
            ...$this->options(),
        ]);
    }

    public function update(ProductRequest $request, Product $product): RedirectResponse
    {
        DB::transaction(function () use ($request, $product) {
            $product->update($this->productData($request));
            $this->syncPresentations($product, $request->validated('presentations'));
            $product->indications()->sync(Indication::idsFor($request->validated('indications', [])));
        });

        return to_route('admin.products.index')->with('success', "Producto {$product->name} actualizado.");
    }

    public function destroy(Product $product): RedirectResponse
    {
        if (Batch::where('product_id', $product->id)->where('quantity', '>', 0)->exists()) {
            throw new BusinessException("No se puede eliminar {$product->name}: todavía tiene stock. Puedes desactivarlo.");
        }

        $product->delete();

        return back()->with('success', "Producto {$product->name} eliminado.");
    }

    /**
     * GET /admin/products/search?q=&branch_id= — buscador de compras (JSON).
     * Devuelve una fila por presentación que se compra, con el stock del producto en la sucursal pedida.
     */
    public function lookup(Request $request): JsonResponse
    {
        $branchId = $request->integer('branch_id') ?: null;

        $products = Product::where('is_active', true)->search($request->query('q'))
            ->with(['presentations' => fn ($q) => $q->purchasable()])
            ->when($branchId, fn (Builder $q) => $q->withSum(['batches as stock' => fn ($b) => $b->where('branch_id', $branchId)], 'quantity'))
            ->orderBy('name')
            ->limit(15)
            ->get();

        return response()->json($products->flatMap(fn (Product $p) => $p->presentations->map(fn ($pres) => [
            'product_id' => $p->id,
            'product_name' => $p->fullName(),
            'generic_name' => $p->generic_name,
            'base_unit' => $p->base_unit,
            'presentation_id' => $pres->id,
            'presentation_name' => $pres->name,
            'factor' => $pres->factor,
            'sale_price' => $pres->sale_price,
            'stock' => (int) ($p->stock ?? 0),
        ]))->values());
    }

    /**
     * Datos del producto para guardar. Si el nombre genérico ya lo usa otro producto (sin importar mayúsculas),
     * se guarda escrito igual que ese: así "PARACETAMOL" y "paracetamol" quedan como el mismo genérico.
     *
     * @return array<string, mixed>
     */
    private function productData(ProductRequest $request): array
    {
        $generic = trim(preg_replace('/\s+/', ' ', (string) $request->validated('generic_name')));
        $existing = $generic === '' ? null : Product::withTrashed()
            ->whereRaw('LOWER(generic_name) = ?', [mb_strtolower($generic)])
            ->value('generic_name');

        return [
            ...$request->safe()->except(['presentations', 'indications', 'generic_name']),
            'generic_name' => $generic === '' ? null : ($existing ?? mb_strtoupper(mb_substr($generic, 0, 1)).mb_substr($generic, 1)),
        ];
    }

    /**
     * Crea, actualiza o elimina (lógicamente) las presentaciones según lo que vino del formulario.
     * Van en orden: cada fila contiene a una anterior (parent_index), así el factor se calcula de adentro hacia afuera.
     *
     * @param  list<array{id?: ?int, parent_index?: ?int, package?: ?string, contains?: ?int, sale_price?: float|string|null, is_sellable: bool, is_purchasable: bool, barcode?: ?string}>  $rows
     */
    private function syncPresentations(Product $product, array $rows): void
    {
        /** @var array<int, ProductPresentation> $saved */
        $saved = [];

        // validated() puede devolver las filas desordenadas: van por su índice del formulario
        ksort($rows);

        foreach (array_values($rows) as $i => $row) {
            $parent = $i === 0 ? null : $saved[(int) $row['parent_index']];
            $data = [
                ...ProductPresentation::arrange(
                    $parent,
                    $parent ? (int) $row['contains'] : null,
                    $parent ? $row['package'] : $product->base_unit,
                    $product->base_unit,
                ),
                'parent_id' => $parent?->id,
                'sale_price' => $row['sale_price'] ?? null,
                'is_sellable' => $row['is_sellable'],
                'is_purchasable' => $row['is_purchasable'],
                'barcode' => $row['barcode'] ?? null,
            ];
            $presentation = ! empty($row['id']) ? $product->presentations()->find($row['id']) : null;

            if ($presentation) {
                $presentation->update($data);
            } else {
                $presentation = $product->presentations()->create($data);
            }
            $saved[$i] = $presentation;
        }

        $product->presentations()->whereNotIn('id', collect($saved)->pluck('id'))->get()->each->delete();
    }

    /**
     * Stock con lotes > 0, agrupado por producto y sucursal: unidades, cantidad de lotes y el vencimiento más próximo.
     *
     * @param  array<int, int>  $productIds
     * @return Collection<int, list<array{branch_id: int, branch: ?string, stock: int, batches: int, next_expiry: ?string}>>
     */
    private function branchStock(array $productIds): Collection
    {
        return Batch::query()
            ->whereIn('product_id', $productIds)
            ->where('quantity', '>', 0)
            ->selectRaw('product_id, branch_id, SUM(quantity) as stock, COUNT(*) as batches, MIN(expires_at) as next_expiry')
            ->groupBy('product_id', 'branch_id')
            ->with('branch:id,name')
            ->get()
            ->groupBy('product_id')
            ->map(fn (Collection $rows) => $rows->map(fn (Batch $row) => [
                'branch_id' => $row->branch_id,
                'branch' => $row->branch?->name,
                'stock' => (int) $row->stock,
                'batches' => (int) $row->batches,
                'next_expiry' => $row->next_expiry ? Carbon::parse($row->next_expiry)->toDateString() : null,
            ])->sortBy('branch')->values()->all());
    }

    /** @return array<string, mixed> Listas para los selectores del formulario y los filtros. */
    private function options(): array
    {
        return [
            'categories' => Category::orderBy('name')->get(['id', 'name']),
            'laboratories' => Laboratory::orderBy('name')->get(['id', 'name']),
            // Genéricos ya usados (se sugieren al escribir el nombre genérico)
            'genericNames' => Product::whereNotNull('generic_name')->distinct()->orderBy('generic_name')->pluck('generic_name'),
            'indications' => Indication::orderBy('name')->get(['id', 'name']),
        ];
    }
}
