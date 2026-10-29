<?php

namespace Database\Factories;

use App\Models\Branch;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Branch>
 */
class BranchFactory extends Factory
{
    public function definition(): array
    {
        return [
            'code' => 'SUC-'.fake()->unique()->numerify('###'),
            'name' => 'Farmacia '.fake()->unique()->lastName(),
            'address' => fake()->streetAddress(),
            'phone' => fake()->numerify('7#######'),
            'is_warehouse' => false,
            'is_active' => true,
        ];
    }
}
