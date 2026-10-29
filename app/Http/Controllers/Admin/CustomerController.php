<?php

namespace App\Http\Controllers\Admin;

use App\Models\Customer;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Clientes: nombre y CI/NIT para el comprobante. */
class CustomerController extends ResourceController
{
    public const DOCUMENT_TYPES = ['CI', 'NIT', 'PAS'];

    protected function model(): string
    {
        return Customer::class;
    }

    protected function meta(): array
    {
        return [
            'title' => 'Clientes',
            'singular' => 'Cliente',
            'description' => 'Datos de los clientes para los comprobantes de venta.',
            'route' => 'admin.customers',
            'permission' => 'clientes',
        ];
    }

    protected function fields(): array
    {
        return [
            ['name' => 'name', 'label' => 'Nombre / Razón social', 'type' => 'text'],
            [
                'name' => 'document_type', 'label' => 'Tipo de documento', 'type' => 'select', 'default' => 'CI',
                'options' => collect(self::DOCUMENT_TYPES)->map(fn ($t) => ['value' => $t, 'label' => $t])->all(),
            ],
            ['name' => 'document_number', 'label' => 'Número de documento', 'type' => 'text'],
            ['name' => 'phone', 'label' => 'Teléfono', 'type' => 'text'],
            ['name' => 'email', 'label' => 'Correo', 'type' => 'email'],
        ];
    }

    protected function columns(): array
    {
        return [
            ['key' => 'name', 'label' => 'Nombre'],
            ['key' => 'document_type', 'label' => 'Doc.'],
            ['key' => 'document_number', 'label' => 'Número'],
            ['key' => 'phone', 'label' => 'Teléfono'],
        ];
    }

    protected function searchable(): array
    {
        return ['name', 'document_number'];
    }

    protected function rules(?Model $model): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'document_type' => ['required', Rule::in(self::DOCUMENT_TYPES)],
            'document_number' => ['nullable', 'string', 'max:30'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
        ];
    }

    /** GET /admin/customers/search?q= — buscador del punto de venta (JSON). */
    public function search(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q'));

        return response()->json(
            Customer::query()
                ->when($q !== '', fn ($query) => $query->where(fn ($w) => $w->where('name', 'like', "%{$q}%")->orWhere('document_number', 'like', "{$q}%")))
                ->orderBy('name')
                ->limit(10)
                ->get(['id', 'name', 'document_type', 'document_number']),
        );
    }
}
