<?php

namespace App\Http\Controllers\Admin;

use App\Models\Denomination;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\Rule;

/** Billetes y monedas que se cuentan en el corte de caja. */
class DenominationController extends ResourceController
{
    protected function model(): string
    {
        return Denomination::class;
    }

    protected function meta(): array
    {
        return [
            'title' => 'Billetes y monedas',
            'singular' => 'Denominación',
            'description' => 'Valores que se cuentan al abrir y cerrar la caja (corte de billetes).',
            'route' => 'admin.denominations',
            'permission' => 'caja',
        ];
    }

    protected function applyOrder(Builder $query): Builder
    {
        return $query->orderByDesc('value');
    }

    protected function searchable(): array
    {
        return ['type'];
    }

    protected function fields(): array
    {
        return [
            ['name' => 'value', 'label' => 'Valor', 'type' => 'number'],
            [
                'name' => 'type', 'label' => 'Tipo', 'type' => 'select', 'default' => 'billete',
                'options' => [['value' => 'billete', 'label' => 'Billete'], ['value' => 'moneda', 'label' => 'Moneda']],
            ],
            ['name' => 'is_active', 'label' => 'Activa', 'type' => 'checkbox', 'default' => true],
        ];
    }

    protected function columns(): array
    {
        return [
            ['key' => 'value', 'label' => 'Valor', 'type' => 'money'],
            ['key' => 'type', 'label' => 'Tipo'],
            ['key' => 'is_active', 'label' => 'Estado', 'type' => 'status'],
        ];
    }

    protected function rules(?Model $model): array
    {
        return [
            'value' => ['required', 'numeric', 'min:0.01', Rule::unique('denominations')->ignore($model)],
            'type' => ['required', Rule::in(['billete', 'moneda'])],
            'is_active' => ['boolean'],
        ];
    }

    protected function label(Model $model): string
    {
        return number_format((float) $model->value, 2);
    }
}
