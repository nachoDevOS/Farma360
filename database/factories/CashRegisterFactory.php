<?php

namespace Database\Factories;

use App\Models\Branch;
use App\Models\CashRegister;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CashRegister>
 */
class CashRegisterFactory extends Factory
{
    public function definition(): array
    {
        return [
            'branch_id' => Branch::factory(),
            'name' => 'Caja '.fake()->unique()->numberBetween(1, 999),
            'is_active' => true,
        ];
    }
}
