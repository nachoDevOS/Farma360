<?php

namespace App\Http\Requests\Admin;

use App\Models\ProductPresentation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Validación del formulario de producto (crear y editar) con sus presentaciones.
 */
class ProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can($this->route('product') ? 'productos.editar' : 'productos.crear');
    }

    protected function prepareForValidation(): void
    {
        foreach (['requires_prescription', 'is_controlled', 'is_active'] as $flag) {
            $this->merge([$flag => $this->boolean($flag)]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $productId = $this->route('product')?->id;

        return [
            'name' => ['required', 'string', 'max:255'],
            'active_ingredient_id' => ['nullable', Rule::exists('active_ingredients', 'id')->whereNull('deleted_at')],
            'concentration' => ['nullable', 'string', 'max:60'],
            'pharmaceutical_form' => ['nullable', 'string', 'max:60'],
            'laboratory_id' => ['nullable', Rule::exists('laboratories', 'id')->whereNull('deleted_at')],
            'category_id' => ['nullable', Rule::exists('categories', 'id')->whereNull('deleted_at')],
            'barcode' => ['nullable', 'string', 'max:50', Rule::unique('products')->ignore($productId)],
            'health_registry' => ['nullable', 'string', 'max:60'],
            'base_unit' => ['required', 'string', 'max:30'],
            'requires_prescription' => ['boolean'],
            'is_controlled' => ['boolean'],
            'min_stock' => ['required', 'integer', 'min:0'],
            'is_active' => ['boolean'],
            'presentations' => ['required', 'array', 'min:1'],
            'presentations.*.id' => ['nullable', 'integer'],
            'presentations.*.name' => ['required', 'string', 'max:60'],
            'presentations.*.factor' => ['required', 'integer', 'min:1'],
            'presentations.*.sale_price' => ['required', 'numeric', 'min:0'],
            'presentations.*.barcode' => ['nullable', 'string', 'max:50', 'distinct'],
        ];
    }

    /** Reglas extra: no repetir factores, y el código de barras de cada presentación no puede estar en otra. */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                $presentations = collect($this->input('presentations', []));

                if ($presentations->pluck('factor')->duplicates()->isNotEmpty()) {
                    $validator->errors()->add('presentations', 'Dos presentaciones no pueden tener la misma cantidad de unidades.');
                }

                $ownIds = $presentations->pluck('id')->filter()->all();
                foreach ($presentations as $i => $p) {
                    // withTrashed: un código de una presentación eliminada sigue ocupado en la base de datos
                    if (! empty($p['barcode']) && ProductPresentation::withTrashed()->where('barcode', $p['barcode'])->whereNotIn('id', $ownIds)->exists()) {
                        $validator->errors()->add("presentations.{$i}.barcode", 'Ese código de barras ya lo usa otra presentación.');
                    }
                }
            },
        ];
    }

    public function attributes(): array
    {
        return [
            'name' => 'nombre comercial',
            'base_unit' => 'unidad base',
            'min_stock' => 'stock mínimo',
            'presentations' => 'presentaciones',
            'presentations.*.name' => 'nombre de la presentación',
            'presentations.*.factor' => 'unidades',
            'presentations.*.sale_price' => 'precio',
            'presentations.*.barcode' => 'código de barras',
        ];
    }
}
