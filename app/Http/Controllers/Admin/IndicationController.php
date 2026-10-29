<?php

namespace App\Http\Controllers\Admin;

use App\Models\Indication;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\Rule;

/**
 * Usos / síntomas (para qué sirve un producto: "Dolor de cabeza", "Fiebre"…).
 * También se crean solos al escribirlos en el formulario de producto; aquí se corrigen o eliminan.
 */
class IndicationController extends ResourceController
{
    protected function model(): string
    {
        return Indication::class;
    }

    protected function meta(): array
    {
        return [
            'title' => 'Usos y síntomas',
            'singular' => 'Uso',
            'description' => 'Para qué sirve cada producto (ej: Dolor de cabeza, Fiebre). Sirven para buscar y filtrar rápido.',
            'route' => 'admin.indications',
            'permission' => 'productos',
        ];
    }

    protected function query(): Builder
    {
        return Indication::withCount('products');
    }

    protected function fields(): array
    {
        return [
            ['name' => 'name', 'label' => 'Nombre', 'type' => 'text', 'placeholder' => 'Dolor de cabeza'],
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
            'name' => ['required', 'string', 'max:80', Rule::unique('indications')->ignore($model)],
        ];
    }
}
