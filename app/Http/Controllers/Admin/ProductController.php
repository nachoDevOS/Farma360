<?php

namespace App\Http\Controllers\Admin;

use App\Exceptions\BusinessException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ProductRequest;
use App\Models\ActiveIngredient;
use App\Models\Batch;
use App\Models\Category;
use App\Models\Laboratory;
use App\Models\Product;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * CATÁLOGO DE PRODUCTOS con sus presentaciones (Unidad, Blíster, Caja…).
 * Permisos: productos.ver · productos.crear · productos.editar · productos.eliminar
 */
class ProductController extends Controller
{
    /** GET /admin/products — lista con búsqueda y filtros. */
    public function index(Request $request): Response
    {
        $filters = $request->only(['search', 'category', 'laboratory', 'status', 'per_page']);

        $products = $this->search(Product::query(), $filters['search'] ?? null)
            ->with(['activeIngredient:id,name', 'laboratory:id,name', 'category:id,name', 'presentations'])
            ->withSum('batches as stock', 'quantity')
            ->when($filters['category'] ?? null, fn (Builder $q, $id) => $q->where('category_id', $id))
            ->when($filters['laboratory'] ?? null, fn (Builder $q, $id) => $q->where('laboratory_id', $id))
            ->when($filters['status'] ?? null, fn (Builder $q, $s) => $q->where('is_active', $s === 'active'))
            ->orderBy('name')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return Inertia::render('admin/products/index', [
            'products' => $products,
            'filters' => $filters,
            ...$this->options(),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('admin/products/form', ['product' => null, ...$this->options()]);
    }

    public function store(ProductRequest $request): RedirectResponse
    {
        $product = DB::transaction(function () use ($request) {
            $product = Product::create($request->safe()->except('presentations'));
            $this->syncPresentations($product, $request->validated('presentations'));

            return $product;
        });

        return to_route('admin.products.index')->with('success', "Producto {$product->name} creado.");
    }

    public function edit(Product $product): Response
    {
        return Inertia::render('admin/products/form', ['product' => $product->load('presentations'), ...$this->options()]);
    }

    public function update(ProductRequest $request, Product $product): RedirectResponse
    {
        DB::transaction(function () use ($request, $product) {
            $product->update($request->safe()->except('presentations'));
            $this->syncPresentations($product, $request->validated('presentations'));
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
     * GET /admin/products/search?q=&branch_id= — buscador para compras, transferencias e inventario (JSON).
     * Devuelve una fila por presentación, con el stock del producto en la sucursal pedida.
     */
    public function lookup(Request $request): JsonResponse
    {
        $branchId = $request->integer('branch_id') ?: null;

        $products = $this->search(Product::where('is_active', true), $request->query('q'))
            ->with('presentations', 'activeIngredient:id,name')
            ->when($branchId, fn (Builder $q) => $q->withSum(['batches as stock' => fn ($b) => $b->where('branch_id', $branchId)], 'quantity'))
            ->orderBy('name')
            ->limit(15)
            ->get();

        return response()->json($products->flatMap(fn (Product $p) => $p->presentations->map(fn ($pres) => [
            'product_id' => $p->id,
            'product_name' => $p->fullName(),
            'active_ingredient' => $p->activeIngredient?->name,
            'base_unit' => $p->base_unit,
            'presentation_id' => $pres->id,
            'presentation_name' => $pres->name,
            'factor' => $pres->factor,
            'sale_price' => $pres->sale_price,
            'stock' => (int) ($p->stock ?? 0),
        ]))->values());
    }

    /** Búsqueda por nombre, código de barras (producto o presentación) o principio activo. */
    private function search(Builder $query, ?string $search): Builder
    {
        $search = trim((string) $search);

        return $query->when($search !== '', fn (Builder $q) => $q->where(fn (Builder $w) => $w
            ->where('name', 'like', "%{$search}%")
            ->orWhere('barcode', $search)
            ->orWhereHas('presentations', fn (Builder $p) => $p->where('barcode', $search))
            ->orWhereHas('activeIngredient', fn (Builder $a) => $a->where('name', 'like', "%{$search}%"))));
    }

    /**
     * Crea, actualiza o elimina (lógicamente) las presentaciones según lo que vino del formulario.
     *
     * @param  list<array{id?: ?int, name: string, factor: int, sale_price: float|string, barcode?: ?string}>  $rows
     */
    private function syncPresentations(Product $product, array $rows): void
    {
        $keep = [];

        foreach ($rows as $row) {
            $data = collect($row)->only(['name', 'factor', 'sale_price', 'barcode'])->all();
            $presentation = ! empty($row['id']) ? $product->presentations()->find($row['id']) : null;

            if ($presentation) {
                $presentation->update($data);
            } else {
                $presentation = $product->presentations()->create($data);
            }
            $keep[] = $presentation->id;
        }

        $product->presentations()->whereNotIn('id', $keep)->get()->each->delete();
    }

    /** @return array<string, mixed> Listas para los selectores del formulario y los filtros. */
    private function options(): array
    {
        return [
            'categories' => Category::orderBy('name')->get(['id', 'name']),
            'laboratories' => Laboratory::orderBy('name')->get(['id', 'name']),
            'activeIngredients' => ActiveIngredient::orderBy('name')->get(['id', 'name']),
        ];
    }
}
