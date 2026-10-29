<?php

namespace App\Http\Controllers\Admin;

use App\Models\Supplier;
use Illuminate\Database\Eloquent\Model;

/** Proveedores: distribuidoras y laboratorios a los que se compra. */
class SupplierController extends ResourceController
{
    protected function model(): string
    {
        return Supplier::class;
    }

    protected function meta(): array
    {
        return [
            'title' => 'Proveedores',
            'singular' => 'Proveedor',
            'description' => 'Distribuidoras y laboratorios a los que se compra mercadería.',
            'route' => 'admin.suppliers',
            'permission' => 'proveedores',
        ];
    }

    protected function fields(): array
    {
        return [
            ['name' => 'name', 'label' => 'Razón social', 'type' => 'text'],
            ['name' => 'nit', 'label' => 'NIT', 'type' => 'text'],
            ['name' => 'contact_name', 'label' => 'Contacto', 'type' => 'text'],
            ['name' => 'phone', 'label' => 'Teléfono', 'type' => 'text'],
            ['name' => 'email', 'label' => 'Correo', 'type' => 'email'],
            ['name' => 'address', 'label' => 'Dirección', 'type' => 'text'],
            ['name' => 'is_active', 'label' => 'Activo', 'type' => 'checkbox', 'default' => true],
        ];
    }

    protected function columns(): array
    {
        return [
            ['key' => 'name', 'label' => 'Razón social'],
            ['key' => 'nit', 'label' => 'NIT'],
            ['key' => 'contact_name', 'label' => 'Contacto'],
            ['key' => 'phone', 'label' => 'Teléfono'],
            ['key' => 'is_active', 'label' => 'Estado', 'type' => 'status'],
        ];
    }

    protected function searchable(): array
    {
        return ['name', 'nit', 'contact_name'];
    }

    protected function rules(?Model $model): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'nit' => ['nullable', 'string', 'max:30'],
            'contact_name' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
        ];
    }
}
