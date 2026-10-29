<?php

namespace App\Http\Controllers\Admin;

use App\Models\Branch;
use App\Models\CashRegister;
use App\Models\CashSession;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\Rule;

/** Cajas físicas / puntos de venta de cada sucursal. */
class CashRegisterController extends ResourceController
{
    protected function model(): string
    {
        return CashRegister::class;
    }

    protected function meta(): array
    {
        return [
            'title' => 'Cajas',
            'singular' => 'Caja',
            'description' => 'Puntos de venta de cada sucursal. Cada caja tiene como mucho un turno abierto a la vez.',
            'route' => 'admin.cash-registers',
            'permission' => 'caja',
        ];
    }

    protected function query(): Builder
    {
        return CashRegister::with('branch:id,name');
    }

    protected function applyOrder(Builder $query): Builder
    {
        return $query->orderBy('branch_id')->orderBy('name');
    }

    protected function fields(): array
    {
        return [
            [
                'name' => 'branch_id', 'label' => 'Sucursal', 'type' => 'select',
                'options' => Branch::orderBy('name')->get(['id', 'name'])->map(fn ($b) => ['value' => $b->id, 'label' => $b->name])->all(),
            ],
            ['name' => 'name', 'label' => 'Nombre', 'type' => 'text', 'placeholder' => 'Caja 1'],
            ['name' => 'is_active', 'label' => 'Activa', 'type' => 'checkbox', 'default' => true],
        ];
    }

    protected function columns(): array
    {
        return [
            ['key' => 'branch.name', 'label' => 'Sucursal'],
            ['key' => 'name', 'label' => 'Caja'],
            ['key' => 'is_active', 'label' => 'Estado', 'type' => 'status'],
        ];
    }

    protected function rules(?Model $model): array
    {
        return [
            'branch_id' => ['required', Rule::exists('branches', 'id')->whereNull('deleted_at')],
            'name' => ['required', 'string', 'max:60'],
            'is_active' => ['boolean'],
        ];
    }

    protected function deleteBlocker(Model $model): ?string
    {
        return CashSession::where('cash_register_id', $model->id)->where('status', CashSession::OPEN)->exists()
            ? "No se puede eliminar: {$model->name} tiene un turno abierto."
            : null;
    }
}
