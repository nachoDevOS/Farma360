<?php

namespace App\Http\Controllers\Admin;

use App\Models\Laboratory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\Rule;

/** Laboratorios fabricantes de los productos. */
class LaboratoryController extends ResourceController
{
    protected function model(): string
    {
        return Laboratory::class;
    }

    protected function meta(): array
    {
        return [
            'title' => 'Laboratorios',
            'singular' => 'Laboratorio',
            'description' => 'Laboratorios fabricantes de los productos.',
            'route' => 'admin.laboratories',
            'permission' => 'productos',
        ];
    }

    protected function query(): Builder
    {
        return Laboratory::withCount('products');
    }

    protected function fields(): array
    {
        return [
            ['name' => 'name', 'label' => 'Nombre', 'type' => 'text'],
            ['name' => 'country', 'label' => 'País', 'type' => 'text'],
        ];
    }

    protected function columns(): array
    {
        return [
            ['key' => 'name', 'label' => 'Nombre'],
            ['key' => 'country', 'label' => 'País'],
            ['key' => 'products_count', 'label' => 'Productos'],
        ];
    }

    protected function rules(?Model $model): array
    {
        return [
            'name' => ['required', 'string', 'max:255', Rule::unique('laboratories')->ignore($model)],
            'country' => ['nullable', 'string', 'max:60'],
        ];
    }

    protected function deleteBlocker(Model $model): ?string
    {
        return $model->products()->exists() ? "No se puede eliminar: hay productos con {$model->name}." : null;
    }
}
