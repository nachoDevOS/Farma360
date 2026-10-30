<?php

namespace App\Http\Requests\Admin;

use App\Models\ProductPresentation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Validación del formulario de producto (crear y editar) con sus presentaciones.
 *
 * Presentaciones por niveles: la fila 0 es la unidad base (sin parent_index; su empaque es base_unit).
 * Las demás dicen qué contienen: parent_index = fila de adentro (siempre una anterior) y contains = cuántas trae.
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

        // Unidad base y empaques siempre con la primera letra en mayúscula: "caja" → "Caja"
        if (is_string($this->input('base_unit'))) {
            $this->merge(['base_unit' => Str::ucfirst(trim($this->input('base_unit')))]);
        }

        if (is_array($this->input('presentations'))) {
            $this->merge(['presentations' => array_map(fn ($row) => is_array($row) ? [
                ...$row,
                'package' => is_string($row['package'] ?? null) ? Str::ucfirst(trim($row['package'])) : ($row['package'] ?? null),
                'is_sellable' => filter_var($row['is_sellable'] ?? false, FILTER_VALIDATE_BOOLEAN),
                'is_purchasable' => filter_var($row['is_purchasable'] ?? false, FILTER_VALIDATE_BOOLEAN),
            ] : $row, $this->input('presentations'))]);
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
            // Nombre genérico (la sustancia: Paracetamol). Texto libre; se sugieren los ya usados en otros productos.
            'generic_name' => ['nullable', 'string', 'max:255'],
            'concentration' => ['nullable', 'string', 'max:60'],
            'pharmaceutical_form' => ['nullable', 'string', 'max:60'],
            // Para qué sirve, en palabras (también se busca por este texto)
            'description' => ['nullable', 'string', 'max:2000'],
            // Usos / síntomas: "Dolor de cabeza", "Fiebre"… (los que no existen se crean al guardar)
            'indications' => ['array', 'max:20'],
            'indications.*' => ['string', 'max:80'],
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
            'presentations.0.parent_index' => ['prohibited'],
            'presentations.*.parent_index' => ['nullable', 'integer', 'min:0'],
            'presentations.*.package' => ['nullable', 'string', 'max:30'],
            'presentations.*.contains' => ['nullable', 'integer', 'min:2'],
            'presentations.*.sale_price' => ['nullable', 'required_if_accepted:presentations.*.is_sellable', 'numeric', 'min:0'],
            'presentations.*.is_sellable' => ['boolean'],
            'presentations.*.is_purchasable' => ['boolean'],
            'presentations.*.barcode' => ['nullable', 'string', 'max:50', 'distinct'],
        ];
    }

    /**
     * Reglas extra: cada empaque dice qué contiene, no se repite la cantidad de unidades, al menos una se vende
     * y una se compra, y el código de barras de cada presentación no puede estar en otra.
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                $presentations = collect($this->input('presentations', []));
                $factors = [];
                // Nombres de lo que hay dentro de cada fila (ella incluida): un empaque no puede llamarse igual
                $inside = [0 => [(string) $this->input('base_unit')]];

                foreach ($presentations->values() as $i => $p) {
                    if ($i === 0) {
                        $factors[0] = 1;

                        continue;
                    }
                    $parent = $p['parent_index'] ?? null;
                    if (blank($p['package'] ?? null)) {
                        $validator->errors()->add("presentations.{$i}.package", 'Indica el tipo de empaque.');
                    }
                    if (blank($p['contains'] ?? null)) {
                        $validator->errors()->add("presentations.{$i}.contains", 'Indica cuántas trae.');
                    }
                    if (! is_numeric($parent) || (int) $parent >= $i || ! isset($factors[(int) $parent])) {
                        $validator->errors()->add("presentations.{$i}.parent_index", 'Indica qué contiene este empaque.');

                        continue;
                    }
                    $factors[$i] = $factors[(int) $parent] * max(1, (int) ($p['contains'] ?? 1));

                    $package = (string) ($p['package'] ?? '');
                    $repeated = collect($inside[(int) $parent])->first(fn ($name) => ProductPresentation::sameName($package, $name));
                    if ($repeated !== null) {
                        $validator->errors()->add("presentations.{$i}.package", "No puede llamarse igual que lo que contiene ({$repeated}). Ej: Caja, Paquete.");
                    }
                    $inside[$i] = [...$inside[(int) $parent], $package];
                }

                if (collect($factors)->duplicates()->isNotEmpty()) {
                    $validator->errors()->add('presentations', 'Dos presentaciones no pueden tener la misma cantidad de unidades.');
                }
                if ($presentations->isNotEmpty() && ! $presentations->contains('is_sellable', true)) {
                    $validator->errors()->add('presentations', 'Marca al menos una presentación que se vende.');
                }
                if ($presentations->isNotEmpty() && ! $presentations->contains('is_purchasable', true)) {
                    $validator->errors()->add('presentations', 'Marca al menos una presentación que se compra.');
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
            'generic_name' => 'nombre genérico',
            'description' => 'para qué sirve',
            'indications' => 'usos',
            'indications.*' => 'uso',
            'base_unit' => 'unidad base',
            'min_stock' => 'stock mínimo',
            'presentations' => 'presentaciones',
            'presentations.*.package' => 'empaque',
            'presentations.*.contains' => 'cantidad que trae',
            'presentations.*.sale_price' => 'precio',
            'presentations.*.barcode' => 'código de barras',
        ];
    }
}
