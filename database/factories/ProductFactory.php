<?php

namespace Database\Factories;

use App\Models\Product;
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
            'base_unit' => 'tableta',
            'min_stock' => 0,
            'is_active' => true,
        ];
    }

    /**
     * Presentaciones típicas: Unidad (factor 1) y Caja x$box, con el precio de la unidad.
     *   Product::factory()->withPresentations(unitPrice: 1.5, box: 100)->create()
     */
    public function withPresentations(float $unitPrice = 1.0, int $box = 100): static
    {
        return $this->afterCreating(function (Product $product) use ($unitPrice, $box) {
            $product->presentations()->create(['name' => 'Unidad', 'factor' => 1, 'sale_price' => $unitPrice]);
            $product->presentations()->create(['name' => "Caja x{$box}", 'factor' => $box, 'sale_price' => round($unitPrice * $box * 0.9, 2)]);
        });
    }

    public function controlled(): static
    {
        return $this->state(['is_controlled' => true, 'requires_prescription' => true]);
    }
}
