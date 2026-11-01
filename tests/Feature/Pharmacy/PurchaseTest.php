<?php

namespace Tests\Feature\Pharmacy;

use App\Models\Laboratory;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\Supplier;
use App\Services\InventoryService;
use App\Services\PurchaseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * COMPRAS: cada ítem crea un lote con su vencimiento y costo; anular devuelve el stock.
 */
class PurchaseTest extends TestCase
{
    use PharmacyHelpers, RefreshDatabase;

    private function payload(int $branchId, int $presentationId, array $item = []): array
    {
        return [
            'branch_id' => $branchId,
            'supplier_id' => Supplier::factory()->create()->id,
            'invoice_number' => 'F-123',
            'purchased_at' => today()->toDateString(),
            'items' => [array_merge([
                'product_presentation_id' => $presentationId,
                'quantity' => 2,
                'cost' => 50,
                'batch_number' => 'AB-1',
                'expires_at' => today()->addYear()->toDateString(),
            ], $item)],
        ];
    }

    public function test_a_purchase_creates_batches_converting_boxes_to_base_units()
    {
        $branch = $this->branch();
        $product = $this->product();
        $admin = $this->userWithRole('Administrador');

        $this->actingAs($admin)
            ->post('/admin/purchases', $this->payload($branch->id, $this->presentation($product, 100)->id))
            ->assertRedirect();

        $purchase = Purchase::firstOrFail();
        $this->assertSame('C-'.str_pad((string) $purchase->id, 6, '0', STR_PAD_LEFT), $purchase->number);
        $this->assertEquals(100, $purchase->total);
        $batch = $product->batches()->firstOrFail();
        // 2 cajas x 100 = 200 tabletas, costo 50 / 100 = 0.50 por tableta
        $this->assertSame(200, $batch->quantity);
        $this->assertEquals(0.5, $batch->unit_cost);
        $this->assertSame('AB-1', $batch->batch_number);
        $this->assertDatabaseHas('stock_movements', ['batch_id' => $batch->id, 'type' => 'compra', 'quantity' => 200]);
        $this->assertSame($admin->id, $purchase->registerUser_id);
    }

    public function test_the_same_presentation_cannot_be_added_twice_to_a_purchase()
    {
        $branch = $this->branch();
        $presentationId = $this->presentation($this->product())->id;
        $payload = $this->payload($branch->id, $presentationId);
        $payload['items'][] = $payload['items'][0];

        $this->actingAs($this->userWithRole('Administrador'))
            ->post('/admin/purchases', $payload)
            ->assertSessionHasErrors('items.1.product_presentation_id');

        $this->assertSame(0, Purchase::count());
    }

    public function test_purchase_cost_accepts_up_to_five_decimals()
    {
        $branch = $this->branch();
        $presentationId = $this->presentation($this->product(), 100)->id;
        $admin = $this->userWithRole('Administrador');

        $this->actingAs($admin)
            ->post('/admin/purchases', $this->payload($branch->id, $presentationId, ['cost' => '5.123456']))
            ->assertSessionHasErrors('items.0.cost');

        $this->actingAs($admin)
            ->post('/admin/purchases', $this->payload($branch->id, $presentationId, ['cost' => '5.65512']))
            ->assertRedirect();

        $this->assertSame('5.65512', PurchaseItem::firstOrFail()->cost);
    }

    public function test_batch_number_and_expiry_are_optional_and_such_batches_are_sold_last()
    {
        $branch = $this->branch();
        $product = $this->product();
        $admin = $this->userWithRole('Administrador');

        $this->actingAs($admin)
            ->post('/admin/purchases', $this->payload($branch->id, $this->presentation($product)->id, ['batch_number' => '', 'expires_at' => '']))
            ->assertSessionHasNoErrors()
            ->assertRedirect();

        $withoutExpiry = $product->batches()->firstOrFail();
        $this->assertSame(PurchaseService::WITHOUT_BATCH, $withoutExpiry->batch_number);
        $this->assertNull($withoutExpiry->expires_at);
        $this->assertNull(PurchaseItem::firstOrFail()->expires_at);
        $this->assertFalse($withoutExpiry->isExpired());

        // Otro lote que sí vence: al vender sale primero; el que no tiene vencimiento queda al final
        $expiring = $this->batch($product, $branch, 5, '+2 months');
        $allocation = app(InventoryService::class)->allocate($product->id, $branch->id, 6);

        $this->assertSame([$expiring->id, $withoutExpiry->id], $allocation->map(fn ($a) => $a['batch']->id)->all());
    }

    public function test_expired_products_cannot_be_purchased()
    {
        $branch = $this->branch();
        $product = $this->product();

        $this->actingAs($this->userWithRole('Administrador'))
            ->post('/admin/purchases', $this->payload($branch->id, $this->presentation($product)->id, ['expires_at' => today()->toDateString()]))
            ->assertSessionHasErrors('items.0.expires_at');

        $this->assertSame(0, Purchase::count());
    }

    public function test_cancelling_a_purchase_removes_its_stock()
    {
        $branch = $this->branch();
        $product = $this->product();
        $admin = $this->userWithRole('Administrador');
        $this->actingAs($admin)->post('/admin/purchases', $this->payload($branch->id, $this->presentation($product)->id));
        $purchase = Purchase::firstOrFail();

        $this->actingAs($admin)->post("/admin/purchases/{$purchase->id}/cancel", ['reason' => 'Factura equivocada'])->assertSessionHas('success');

        $purchase->refresh();
        $this->assertSame('anulada', $purchase->status);
        $this->assertSame($admin->id, $purchase->cancelUser_id);
        $this->assertSame(0, app(InventoryService::class)->stock($product->id, $branch->id));
        // Nada se borra: la compra sigue en la base de datos
        $this->assertNotSoftDeleted($purchase);
    }

    public function test_a_purchase_whose_stock_was_already_used_cannot_be_cancelled()
    {
        $branch = $this->branch();
        $product = $this->product();
        $admin = $this->userWithRole('Administrador');
        $this->actingAs($admin)->post('/admin/purchases', $this->payload($branch->id, $this->presentation($product)->id));
        $purchase = Purchase::firstOrFail();
        app(InventoryService::class)->decrease($purchase->items()->first()->batch, 1, 'venta');

        $this->actingAs($admin)->post("/admin/purchases/{$purchase->id}/cancel", ['reason' => 'x'])->assertSessionHas('error');

        $this->assertSame('registrada', $purchase->fresh()->status);
    }

    public function test_users_can_only_buy_for_their_branch()
    {
        $mine = $this->branch();
        $other = $this->branch();
        $product = $this->product();
        $almacenero = $this->userWithRole('Almacenero', $mine);

        $this->actingAs($almacenero)
            ->post('/admin/purchases', $this->payload($other->id, $this->presentation($product)->id))
            ->assertSessionHasErrors('branch_id');
    }

    public function test_cashiers_cannot_register_purchases()
    {
        $this->actingAs($this->userWithRole('Cajero'))->get('/admin/purchases/create')->assertForbidden();
    }

    public function test_purchase_list_shows_the_month_numbers_and_what_is_left_of_each_item()
    {
        $central = $this->branch(['name' => 'Central']);
        $north = $this->branch(['name' => 'Norte']);
        $product = $this->product();
        $admin = $this->userWithRole('Administrador');
        $box = $this->presentation($product, 100)->id;
        $this->actingAs($admin)->post('/admin/purchases', ['supplier_id' => Supplier::factory()->create(['name' => 'Inti'])->id] + $this->payload($central->id, $box, ['cost' => 40]));
        $this->actingAs($admin)->post('/admin/purchases', $this->payload($north->id, $box, ['cost' => 10]));

        $this->actingAs($admin)->get('/admin/purchases')
            ->assertInertia(fn ($page) => $page
                // 2 cajas × Bs 40 + 2 cajas × Bs 10
                ->where('month.total', 100)
                ->where('month.count', 2)
                ->where('month.top_supplier.name', 'Inti')
                ->where('canSeeAllBranches', true)
                ->where('purchases.data.0.items.0.batch.quantity', 200));

        // Asignado a Central: la lista y los números son solo de su sucursal
        $this->actingAs($this->userWithRole('Administrador', $central))->get("/admin/purchases?branch={$north->id}")
            ->assertInertia(fn ($page) => $page
                ->has('purchases.data', 1)
                ->where('purchases.data.0.branch.name', 'Central')
                ->where('month.total', 80)
                ->where('canSeeAllBranches', false));
    }

    public function test_purchase_page_shows_unit_cost_margin_and_its_lots()
    {
        $branch = $this->branch();
        $laboratory = Laboratory::create(['name' => 'Farmacéutica del Oriente']);
        $product = $this->product(1.0, ['generic_name' => 'Loratadina', 'laboratory_id' => $laboratory->id]);
        $admin = $this->userWithRole('Administrador');
        $box = $this->presentation($product, 100)->id;
        $this->actingAs($admin)->post('/admin/purchases', $this->payload($branch->id, $box, ['cost' => 40, 'batch_number' => 'L-1']));
        $this->actingAs($admin)->post('/admin/purchases', $this->payload($branch->id, $box, ['cost' => 50, 'batch_number' => 'L-2']));
        $second = Purchase::latest('id')->firstOrFail();

        $this->actingAs($admin)->get("/admin/purchases/{$second->id}")
            ->assertInertia(fn ($page) => $page
                ->component('admin/purchases/show')
                ->where('purchase.items.0.unit_cost', '0.5000')
                ->where('purchase.items.0.product.generic_name', 'Loratadina')
                ->where('purchase.items.0.product.laboratory.name', 'Farmacéutica del Oriente')
                // Se vende a Bs 1 la tableta
                ->where('purchase.items.0.sale_unit_price', 1)
                ->where('purchase.items.0.remaining', 200)
                ->has('lots', 1)
                ->where('lots.0.batch_number', 'L-2')
                ->where('lots.0.origin.kind', 'compra')
                ->has('movementTypes'));
    }
}
