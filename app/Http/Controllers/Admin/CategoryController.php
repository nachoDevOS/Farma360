<?php

namespace App\Http\Controllers\Admin;

use App\Models\Category;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\Rule;

/** Categorías para agrupar productos (ej: Analgésicos, Antibióticos). */
class CategoryController extends ResourceController
{
    protected function model(): string
    {
        return Category::class;
    }

    protected function meta(): array
    {
        return [
            'title' => 'Categorías',
            'singular' => 'Categoría',
            'description' => 'Categorías para agrupar productos (ej: Analgésicos, Antibióticos).',
            'route' => 'admin.categories',
            'permission' => 'productos',
        ];
    }

    protected function query(): Builder
    {
        return Category::withCount('products');
    }

    protected function fields(): array
    {
        return [
            ['name' => 'name', 'label' => 'Nombre', 'type' => 'text'],
        ];
    }

    protected function columns(): array
    {
        return [
            ['key' => 'name', 'label' => 'Nombre'],
            ['key' => 'products_count', 'label' => 'Productos'],
        ];
    }

    protected function rules(?Model $model): array
    {
        return [
            'name' => ['required', 'string', 'max:255', Rule::unique('categories')->ignore($model)],
        ];
    }

    protected function deleteBlocker(Model $model): ?string
    {
        return $model->products()->exists() ? "No se puede eliminar: hay productos con {$model->name}." : null;
    }
}
