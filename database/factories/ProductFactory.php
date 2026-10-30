<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\ProductPresentation;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => ucfirst(fake()->unique()->word()).'gen',
            'concentration' => fake()->randomElement(['500 mg', '250 mg', '1 g', '120 mg/5 ml']),
            'pharmaceutical_form' => 'Tableta',
            'base_unit' => 'Tableta',
            'min_stock' => 0,
            'is_active' => true,
        ];
    }

    /**
     * Presentaciones típicas: la unidad base (factor 1) y Caja x$box, con el precio de la unidad.
     * Las dos se venden y se compran.
     *   Product::factory()->withPresentations(unitPrice: 1.5, box: 100)->create()
     */
    public function withPresentations(float $unitPrice = 1.0, int $box = 100): static
    {
        return $this->afterCreating(function (Product $product) use ($unitPrice, $box) {
            $unit = $product->presentations()->create([
                ...ProductPresentation::arrange(null, null, $product->base_unit, $product->base_unit),
                'sale_price' => $unitPrice,
            ]);
            $product->presentations()->create([
                ...ProductPresentation::arrange($unit, $box, 'Caja', $product->base_unit),
                'parent_id' => $unit->id,
                'sale_price' => round($unitPrice * $box * 0.9, 2),
            ]);
        });
    }

    public function controlled(): static
    {
        return $this->state(['is_controlled' => true, 'requires_prescription' => true]);
    }
}
