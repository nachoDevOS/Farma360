<?php

namespace App\Http\Controllers\Admin;

use App\Models\Batch;
use App\Models\Branch;
use App\Models\CashSession;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\Rule;

/** Sucursales (farmacias y almacenes). */
class BranchController extends ResourceController
{
    protected function model(): string
    {
        return Branch::class;
    }

    protected function meta(): array
    {
        return [
            'title' => 'Sucursales',
            'singular' => 'Sucursal',
            'description' => 'Farmacias y almacenes de la empresa. El stock, las cajas y las ventas pertenecen a una sucursal.',
            'route' => 'admin.branches',
            'permission' => 'sucursales',
        ];
    }

    protected function fields(): array
    {
        return [
            ['name' => 'code', 'label' => 'Código', 'type' => 'text', 'placeholder' => 'SUC-01'],
            ['name' => 'name', 'label' => 'Nombre', 'type' => 'text', 'placeholder' => 'Farmacia Central'],
            ['name' => 'address', 'label' => 'Dirección', 'type' => 'text'],
            ['name' => 'phone', 'label' => 'Teléfono', 'type' => 'text'],
            ['name' => 'is_warehouse', 'label' => 'Es almacén central', 'type' => 'checkbox', 'default' => false],
            ['name' => 'is_active', 'label' => 'Activa', 'type' => 'checkbox', 'default' => true],
        ];
    }

    protected function columns(): array
    {
        return [
            ['key' => 'code', 'label' => 'Código'],
            ['key' => 'name', 'label' => 'Nombre'],
            ['key' => 'address', 'label' => 'Dirección'],
            ['key' => 'phone', 'label' => 'Teléfono'],
            ['key' => 'is_warehouse', 'label' => 'Almacén', 'type' => 'boolean'],
            ['key' => 'is_active', 'label' => 'Estado', 'type' => 'status'],
        ];
    }

    protected function searchable(): array
    {
        return ['name', 'code', 'address'];
    }

    protected function rules(?Model $model): array
    {
        return [
            'code' => ['required', 'string', 'max:20', Rule::unique('branches')->ignore($model)],
            'name' => ['required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'is_warehouse' => ['boolean'],
            'is_active' => ['boolean'],
        ];
    }

    protected function deleteBlocker(Model $model): ?string
    {
        if (Batch::where('branch_id', $model->id)->where('quantity', '>', 0)->exists()) {
            return "No se puede eliminar: {$model->name} todavía tiene stock. Transfiérelo o dalo de baja primero.";
        }
        if (CashSession::where('branch_id', $model->id)->where('status', CashSession::OPEN)->exists()) {
            return "No se puede eliminar: {$model->name} tiene cajas abiertas.";
        }

        return null;
    }
}
