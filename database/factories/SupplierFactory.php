<?php

namespace Database\Factories;

use App\Models\Supplier;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Supplier>
 */
class SupplierFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => 'Distribuidora '.fake()->unique()->company(),
            'nit' => fake()->numerify('#########'),
            'contact_name' => fake()->name(),
            'phone' => fake()->numerify('7#######'),
            'is_active' => true,
        ];
    }
}
