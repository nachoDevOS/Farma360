<?php

namespace App\Http\Controllers\Admin;

use App\Models\ActiveIngredient;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\Rule;

/** Principios activos / genéricos (ej: Paracetamol). Sirven para buscar productos equivalentes. */
class ActiveIngredientController extends ResourceController
{
    protected function model(): string
    {
        return ActiveIngredient::class;
    }

    protected function meta(): array
    {
        return [
            'title' => 'Principios activos',
            'singular' => 'Principio activo',
            'description' => 'Principios activos / genéricos (ej: Paracetamol). Sirven para buscar productos equivalentes.',
            'route' => 'admin.active-ingredients',
            'permission' => 'productos',
        ];
    }

    protected function query(): Builder
    {
        return ActiveIngredient::withCount('products');
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
            'name' => ['required', 'string', 'max:255', Rule::unique('active_ingredients')->ignore($model)],
        ];
    }

    protected function deleteBlocker(Model $model): ?string
    {
        return $model->products()->exists() ? "No se puede eliminar: hay productos con {$model->name}." : null;
    }
}
