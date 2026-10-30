<?php

namespace Tests\Feature\Pharmacy;

use App\Exceptions\BusinessException;
use App\Models\StockMovement;
use App\Services\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * INVENTARIO: lotes, FEFO, kardex y ajustes.
 */
class InventoryTest extends TestCase
{
    use PharmacyHelpers, RefreshDatabase;

    private InventoryService $inventory;

    protected function setUp(): void
    {
        parent::setUp();
        $this->inventory = app(InventoryService::class);
    }

    public function test_fefo_takes_the_batch_that_expires_first_and_skips_expired_ones()
    {
        $branch = $this->branch();
        $product = $this->product();
        $late = $this->batch($product, $branch, 50, '+1 year');
        $soon = $this->batch($product, $branch, 30, '+2 months');
        $this->batch($product, $branch, 100, '-1 day'); // vencido: nunca se vende

        $allocation = $this->inventory->allocate($product->id, $branch->id, 40);

        $this->assertSame([$soon->id, $late->id], $allocation->pluck('batch.id')->all());
        $this->assertSame([30, 10], $allocation->pluck('units')->all());
    }

    public function test_allocation_fails_when_there_is_not_enough_sellable_stock()
    {
        $branch = $this->branch();
        $product = $this->product();
        $this->batch($product, $branch, 5);
        $this->batch($product, $branch, 100, '-1 day');

        $this->expectException(BusinessException::class);
        $this->inventory->allocate($product->id, $branch->id, 6);
    }

    public function test_reserved_units_are_not_allocated_twice()
    {
        $branch = $this->branch();
        $product = $this->product();
        $this->batch($product, $branch, 10);
        $reserved = [];

        $this->inventory->allocate($product->id, $branch->id, 8, $reserved);

        $this->expectException(BusinessException::class);
        $this->inventory->allocate($product->id, $branch->id, 3, $reserved);
    }

    public function test_every_change_leaves_a_kardex_movement_with_the_running_balance()
    {
        $branch = $this->branch();
        $product = $this->product();
        $batch = $this->batch($product, $branch, 20);

        $this->inventory->decrease($batch, 5, 'venta');
        $this->inventory->increase($batch, 2, 'anulacion_venta');

        $this->assertSame(17, $this->inventory->stock($product->id, $branch->id));
        $this->assertSame([20, -5, 2], StockMovement::orderBy('id')->pluck('quantity')->all());
        $this->assertSame([20, 15, 17], StockMovement::orderBy('id')->pluck('balance')->all());
    }

    public function test_a_batch_cannot_go_below_zero()
    {
        $batch = $this->batch($this->product(), $this->branch(), 3);

        $this->expectException(BusinessException::class);
        $this->inventory->decrease($batch, 4, 'ajuste_salida');
    }

    public function test_initial_stock_and_write_offs_are_registered_from_the_screen()
    {
        $branch = $this->branch();
        $product = $this->product();
        $admin = $this->userWithRole('Administrador');

        // 1 Caja x100 + 30 tabletas sueltas, a Bs 40 la caja → 130 tabletas a Bs 0,40 c/u (por presentaciones, como una compra)
        $box = $this->presentation($product, 100)->id;
        $this->actingAs($admin)->post('/admin/inventory/adjust', [
            'mode' => 'new', 'product_id' => $product->id, 'branch_id' => $branch->id,
            'items' => [['product_presentation_id' => $box, 'quantity' => 1], ['product_presentation_id' => $this->presentation($product)->id, 'quantity' => 30]],
            'cost' => 40, 'cost_presentation_id' => $box,
            'batch_number' => 'INI-1', 'expires_at' => now()->addYear()->toDateString(), 'note' => 'Inventario inicial',
        ])->assertSessionHas('success');

        $batch = $product->batches()->first();
        $this->assertSame(130, $batch->quantity);
        $this->assertEquals(0.4, $batch->unit_cost);
        $this->assertSame(1, $product->batches()->count());
        $this->actingAs($admin)->post('/admin/inventory/adjust', [
            'mode' => 'writeoff', 'batch_id' => $batch->id, 'quantity' => 10, 'note' => 'Cajas mojadas',
        ])->assertSessionHas('success');

        $this->assertSame(120, $batch->fresh()->quantity);
        $this->assertDatabaseHas('stock_movements', ['batch_id' => $batch->id, 'type' => 'baja', 'quantity' => -10, 'note' => 'Cajas mojadas']);
    }

    public function test_initial_stock_only_accepts_presentations_of_the_same_product()
    {
        $branch = $this->branch();
        $product = $this->product();
        $other = $this->product();

        $this->actingAs($this->userWithRole('Administrador'))->post('/admin/inventory/adjust', [
            'mode' => 'new', 'product_id' => $product->id, 'branch_id' => $branch->id,
            'items' => [['product_presentation_id' => $this->presentation($other)->id, 'quantity' => 1]],
            'cost' => 1, 'cost_presentation_id' => $this->presentation($product)->id,
            'batch_number' => 'X', 'expires_at' => now()->addYear()->toDateString(), 'note' => 'x',
        ])->assertSessionHasErrors('items.0.product_presentation_id');

        $this->assertSame(0, $product->batches()->count());
    }

    public function test_initial_stock_rejects_fractions_and_repeated_presentations()
    {
        $product = $this->product();
        $unit = $this->presentation($product)->id;
        $post = fn (array $items) => $this->actingAs($this->userWithRole('Administrador'))->post('/admin/inventory/adjust', [
            'mode' => 'new', 'product_id' => $product->id, 'branch_id' => $this->branch()->id, 'items' => $items,
            'cost' => 1, 'cost_presentation_id' => $unit, 'batch_number' => 'X', 'expires_at' => now()->addYear()->toDateString(), 'note' => 'x',
        ]);

        $post([['product_presentation_id' => $unit, 'quantity' => 1.5]])->assertSessionHasErrors('items.0.quantity');
        $post([['product_presentation_id' => $unit, 'quantity' => 1], ['product_presentation_id' => $unit, 'quantity' => 2]])
            ->assertSessionHasErrors('items.1.product_presentation_id');
        $this->assertSame(0, $product->batches()->count());
    }

    public function test_initial_stock_without_lot_or_reason_gets_a_generated_lot()
    {
        $product = $this->product();
        $unit = $this->presentation($product)->id;
        $admin = $this->userWithRole('Administrador');

        $this->actingAs($admin)->post('/admin/inventory/adjust', [
            'mode' => 'new', 'product_id' => $product->id, 'branch_id' => $this->branch()->id,
            'items' => [['product_presentation_id' => $unit, 'quantity' => 5]], 'cost' => 1, 'cost_presentation_id' => $unit,
            'expires_at' => now()->addYear()->toDateString(),
        ])->assertSessionHas('success');

        $batch = $product->batches()->firstOrFail();
        $this->assertSame('SL-'.str_pad((string) $batch->id, 6, '0', STR_PAD_LEFT), $batch->batch_number);
        $this->assertDatabaseHas('stock_movements', ['batch_id' => $batch->id, 'note' => 'Ingreso sin compra']);

        // En una salida el motivo sigue siendo obligatorio
        $this->actingAs($admin)->post('/admin/inventory/adjust', ['mode' => 'out', 'batch_id' => $batch->id, 'quantity' => 1])
            ->assertSessionHasErrors(['note' => 'El campo motivo es obligatorio.']);
    }

    public function test_inventory_page_sends_the_daily_stock_history_for_the_charts()
    {
        $branch = $this->branch();
        $product = $this->product();
        $admin = $this->userWithRole('Administrador');
        $inventory = app(InventoryService::class);

        // Hace 100 días entraron 50 (queda fuera del período, pero es el saldo inicial)
        $this->travel(-100)->days();
        $batch = $this->batch($product, $branch, 50);
        $this->travelBack();
        // Hace 3 días entran 30 y salen 5
        $this->travel(-3)->days();
        $inventory->increase($batch, 30, 'ajuste_entrada', null, 'x');
        $inventory->decrease($batch, 5, 'baja', null, 'x');
        $this->travelBack();

        $this->actingAs($admin)->get("/admin/inventory/{$product->id}?branch={$branch->id}")
            ->assertInertia(fn ($page) => $page
                ->has('history', 90)
                ->where('history.0.balance', 50)
                ->where('history.86.balance', 75)
                ->where('history.86.in', 30)
                ->where('history.86.out', 5)
                ->where('history.86.types', ['ajuste_entrada' => 30, 'baja' => -5])
                ->where('history.89.balance', 75)
                ->where('history.89.in', 0));
    }

    public function test_users_only_adjust_batches_of_their_branch()
    {
        $mine = $this->branch();
        $other = $this->branch();
        $batch = $this->batch($this->product(), $other, 10);
        $regente = $this->userWithRole('Regente', $mine);

        $this->actingAs($regente)->post('/admin/inventory/adjust', [
            'mode' => 'out', 'batch_id' => $batch->id, 'quantity' => 1, 'note' => 'x',
        ])->assertSessionHas('error');

        $this->assertSame(10, $batch->fresh()->quantity);
    }

    public function test_inventory_screens_show_stock_by_branch()
    {
        $branch = $this->branch();
        $product = $this->product();
        $this->batch($product, $branch, 40, '+1 month', 0.5);
        $admin = $this->userWithRole('Administrador');

        $this->actingAs($admin)->get("/admin/inventory?branch={$branch->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('admin/inventory/index')
                // MySQL devuelve las sumas como texto ('40'): se compara como número
                ->where('products.data.0.stock', fn ($stock) => (int) $stock === 40)
                ->where('totals.value', 20)
                ->where('totals.expiring', 1));

        $this->actingAs($admin)->get("/admin/inventory/{$product->id}?branch={$branch->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('admin/inventory/show')->where('stock', 40)->has('batches', 1)->has('movements.data', 1));
    }
}
