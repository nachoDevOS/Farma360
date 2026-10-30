<?php

namespace App\Http\Controllers\Admin;

use App\Exceptions\BusinessException;
use App\Http\Controllers\Controller;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * CRUD GENÉRICO para catálogos simples (sucursales, proveedores, clientes, categorías, cajas…).
 *
 * Cada catálogo es una clase chica que hereda de esta y dice:
 *   - model()   → el modelo (ej: Supplier::class)
 *   - meta()    → títulos, nombre de ruta y permiso
 *   - fields()  → campos del formulario (React los dibuja solo)
 *   - columns() → columnas de la tabla
 *   - rules()   → validación
 * Todas usan la misma página de React: resources/js/pages/admin/resources/index.tsx
 *
 * Rutas (ver routes/admin.php → Route::resourcePage):
 *   GET    /admin/{ruta}        index   (permiso modulo.ver)
 *   POST   /admin/{ruta}        store   (modulo.crear)
 *   PUT    /admin/{ruta}/{id}   update  (modulo.editar)
 *   DELETE /admin/{ruta}/{id}   destroy (modulo.eliminar) → eliminación lógica
 */
abstract class ResourceController extends Controller
{
    /** @return class-string<Model> */
    abstract protected function model(): string;

    /** @return array{title: string, singular: string, description: string, route: string, permission: string} */
    abstract protected function meta(): array;

    /**
     * Campos del formulario. type: text | number | email | select | checkbox | image
     * image: se sube un archivo y lo guarda StorageController en S3 (.avif) dentro de "folder"; en la columna queda la ruta.
     *   Sus reglas van en rules() como cualquier campo ('image' => [...], 'remove_image' => ['nullable', 'boolean']).
     *
     * @return list<array{name: string, label: string, type: string, options?: list<array{value: string|int, label: string}>, placeholder?: string, default?: mixed, folder?: string}>
     */
    abstract protected function fields(): array;

    /**
     * Columnas de la tabla. type: text | boolean | status | money | image (miniatura de la ruta guardada en S3)
     *
     * @return list<array{key: string, label: string, type?: string}>
     */
    abstract protected function columns(): array;

    /** @return array<string, mixed> */
    abstract protected function rules(?Model $model): array;

    /** Columnas donde busca el buscador. */
    protected function searchable(): array
    {
        return ['name'];
    }

    /** Consulta base (agregar with() o withCount() si hace falta). */
    protected function query(): Builder
    {
        return $this->model()::query();
    }

    /** Orden de la lista. */
    protected function applyOrder(Builder $query): Builder
    {
        return $query->orderBy('name');
    }

    /** Motivo por el que no se puede eliminar (null = sí se puede). */
    protected function deleteBlocker(Model $model): ?string
    {
        return null;
    }

    /** Texto que identifica al registro en los avisos (ej: el nombre). */
    protected function label(Model $model): string
    {
        return (string) $model->getAttribute('name');
    }

    public function index(Request $request): Response
    {
        $filters = $request->only(['search', 'per_page']);

        $rows = $this->applyOrder($this->query())
            ->when($filters['search'] ?? null, function (Builder $query, string $search) {
                $query->where(fn (Builder $q) => collect($this->searchable())->each(fn (string $column) => $q->orWhere($column, 'like', "%{$search}%")));
            })
            ->paginate($this->perPage($request))
            ->withQueryString();

        return Inertia::render('admin/resources/index', [
            'resource' => $this->meta() + ['fields' => $this->fields(), 'columns' => $this->columns()],
            'rows' => $rows,
            'filters' => $filters,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $model = $this->model()::create($this->validated($request, null));

        return back()->with('success', "{$this->meta()['singular']} {$this->label($model)} creado.");
    }

    public function update(Request $request, int $id): RedirectResponse
    {
        $model = $this->model()::findOrFail($id);
        $model->update($this->validated($request, $model));

        return back()->with('success', "{$this->meta()['singular']} {$this->label($model)} actualizado.");
    }

    public function destroy(int $id): RedirectResponse
    {
        $model = $this->model()::findOrFail($id);

        if ($reason = $this->deleteBlocker($model)) {
            throw new BusinessException($reason);
        }

        // Eliminación LÓGICA (regla del sistema)
        $model->delete();

        return back()->with('success', "{$this->meta()['singular']} {$this->label($model)} eliminado.");
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, ?Model $model): array
    {
        // Las casillas que no se marcan no llegan: las ponemos en false
        foreach ($this->fields() as $field) {
            if ($field['type'] === 'checkbox') {
                $request->merge([$field['name'] => $request->boolean($field['name'])]);
            }
        }

        $attributes = collect($this->fields())->mapWithKeys(fn (array $f) => [$f['name'] => mb_strtolower($f['label'])])->all();
        $data = $request->validate($this->rules($model), [], $attributes);

        // Imágenes: se suben a S3 y en la columna queda la ruta (o null si se quitó, o la que tenía si no se tocó)
        foreach ($this->fields() as $field) {
            if ($field['type'] === 'image') {
                $data[$field['name']] = $this->storeImage($request, $field['name'], $field['folder'] ?? 'images', $model?->getAttribute($field['name']));
                unset($data["remove_{$field['name']}"]);
            }
        }

        return $data;
    }
}
