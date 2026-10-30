<?php

namespace Tests\Feature\Pharmacy;

use App\Models\Batch;
use App\Models\Branch;
use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\Denomination;
use App\Models\Product;
use App\Models\User;
use App\Services\CashService;
use App\Services\InventoryService;

/**
 * Atajos para armar escenarios de farmacia en las pruebas.
 */
trait PharmacyHelpers
{
    protected function branch(array $attributes = []): Branch
    {
        return Branch::factory()->create($attributes);
    }

    /** Producto con presentaciones unidad base (factor 1) y Caja x100. */
    protected function product(float $unitPrice = 1.0, array $attributes = []): Product
    {
        return Product::factory()->withPresentations($unitPrice)->create($attributes)->load('presentations');
    }

    /** Lote con stock (entra al kardex como ajuste de entrada). */
    protected function batch(Product $product, Branch $branch, int $quantity, string $expires = '+1 year', float $unitCost = 0.5, ?string $number = null): Batch
    {
        $inventory = app(InventoryService::class);
        $batch = $inventory->createBatch([
            'product_id' => $product->id,
            'branch_id' => $branch->id,
            'batch_number' => $number ?? 'L-'.fake()->unique()->numerify('####'),
            'expires_at' => now()->modify($expires)->toDateString(),
            'unit_cost' => $unitCost,
        ]);
        if ($quantity > 0) {
            $inventory->increase($batch, $quantity, 'ajuste_entrada', null, 'Prueba');
        }

        return $batch->fresh();
    }

    protected function userWithRole(string $role, ?Branch $branch = null): User
    {
        return User::factory()->withRole($role)->create(['branch_id' => $branch?->id]);
    }

    /** Abre un turno de caja para el usuario con un fondo de $amount en billetes de 100 (y 10 si hace falta). */
    protected function openCash(User $user, Branch $branch, int $hundreds = 1): CashSession
    {
        $register = CashRegister::factory()->create(['branch_id' => $branch->id]);

        return app(CashService::class)->open($register, $user, [$this->denomination(100)->id => $hundreds]);
    }

    protected function denomination(float $value): Denomination
    {
        return Denomination::where('value', $value)->firstOrFail();
    }

    /** Presentación por cantidad de unidades base: 1 (la unidad) o 100 (la caja). */
    protected function presentation(Product $product, int $factor = 1)
    {
        return $product->presentations->firstWhere('factor', $factor);
    }
}
