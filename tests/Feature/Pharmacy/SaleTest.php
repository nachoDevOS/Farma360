<?php

namespace Tests\Feature\Pharmacy;

use App\Models\Indication;
use App\Models\ProductPresentation;
use App\Models\Sale;
use App\Services\CashService;
use App\Services\InventoryService;
use App\Services\PromotionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * PUNTO DE VENTA: FEFO, promociones por vencimiento, pagos, recetas y anulación.
 */
class SaleTest extends TestCase
{
    use PharmacyHelpers, RefreshDatabase;

    private function sell($user, array $items, array $payments, array $extra = [])
    {
        return $this->actingAs($user)->post('/admin/sales', ['items' => $items, 'payments' => $payments] + $extra);
    }

    public function test_a_sale_uses_fefo_and_splits_the_line_by_batch()
    {
        $branch = $this->branch();
        $product = $this->product(1.0);
        $soon = $this->batch($product, $branch, 3, '+6 months', 0.4);
        $late = $this->batch($product, $branch, 10, '+1 year', 0.5);
        $cashier = $this->userWithRole('Cajero', $branch);
        $this->openCash($cashier, $branch);

        $this->sell($cashier, [['product_presentation_id' => $this->presentation($product)->id, 'quantity' => 5]], [['method' => 'efectivo', 'amount' => 10]])
            ->assertRedirect();

        $sale = Sale::with('items')->firstOrFail();
        $this->assertSame('V-'.str_pad((string) $sale->id, 6, '0', STR_PAD_LEFT), $sale->number);
        $this->assertEquals(5, $sale->total);
        $this->assertEquals(5, $sale->change);
        // 3 del lote que vence primero, 2 del siguiente
        $this->assertSame([[$soon->id, 3], [$late->id, 2]], $sale->items->map(fn ($i) => [$i->batch_id, $i->units])->all());
        $this->assertSame(0, $soon->fresh()->stock);
        $this->assertSame(8, $late->fresh()->stock);
        // Lo guardado en caja es el efectivo menos el cambio
        $this->assertDatabaseHas('sale_payments', ['sale_id' => $sale->id, 'method' => 'efectivo', 'amount' => 5]);
    }

    public function test_the_sales_list_brings_what_the_detail_and_the_printed_receipt_need()
    {
        $branch = $this->branch();
        $product = $this->product(1.0);
        $batch = $this->batch($product, $branch, 10);
        $cashier = $this->userWithRole('Cajero', $branch);
        $this->openCash($cashier, $branch);

        $this->sell($cashier, [['product_presentation_id' => $this->presentation($product)->id, 'quantity' => 4]], [
            ['method' => 'qr', 'amount' => 3, 'reference' => 'OP-77'],
            ['method' => 'efectivo', 'amount' => 1],
        ]);

        $this->actingAs($cashier)->get('/admin/sales')
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/sales/index')
                ->where('sales.data.0.items.0.batch.batch_number', $batch->batch_number)
                ->where('sales.data.0.items.0.product.name', $product->name)
                ->has('sales.data.0.items.0.presentation.name')
                ->has('sales.data.0.branch.address')
                ->has('sales.data.0.cash_session.cash_register.name')
                ->where('sales.data.0.cash_session.status', 'abierta')
                ->where('sales.data.0.payments.0.reference', 'OP-77'));
    }

    public function test_the_sale_page_says_who_sold_it_and_in_which_cash_register()
    {
        $branch = $this->branch();
        $product = $this->product(1.0);
        $this->batch($product, $branch, 10);
        $cashier = $this->userWithRole('Cajero', $branch);
        $session = $this->openCash($cashier, $branch);

        $this->sell($cashier, [['product_presentation_id' => $this->presentation($product)->id, 'quantity' => 1]], [['method' => 'efectivo', 'amount' => 5]]);

        $this->actingAs($cashier)->get('/admin/sales/'.Sale::firstOrFail()->id)
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/sales/show')
                ->where('sale.registered_by.name', $cashier->name)
                ->where('sale.registerRole', 'Cajero')
                ->where('sale.cash_session.cash_register.name', $session->cashRegister->name)
                ->has('sale.items.0.product.image')
                ->has('sale.items.0.product.generic_name'));
    }

    public function test_the_promotion_of_the_batch_lowers_the_price()
    {
        $branch = $this->branch();
        $product = $this->product(2.0);
        $batch = $this->batch($product, $branch, 10, '+40 days', 0.5);
        $cashier = $this->userWithRole('Cajero', $branch);
        app(PromotionService::class)->apply($batch, 25, $this->userWithRole('Administrador'));
        $this->openCash($cashier, $branch);

        $this->sell($cashier, [['product_presentation_id' => $this->presentation($product)->id, 'quantity' => 4]], [['method' => 'qr', 'amount' => 6]]);

        $sale = Sale::with('items')->firstOrFail();
        // 4 x 2.00 = 8.00 con 25% = 6.00
        $this->assertEquals(6, $sale->total);
        $item = $sale->items->first();
        $this->assertEquals(25, $item->discount_percent);
        $this->assertEquals([8, 2, 6], [$item->subtotal, $item->discount_amount, $item->total]);
        $this->assertEquals([6, 0], [$sale->subtotal, $sale->discount]);
    }

    public function test_a_promotion_on_the_box_does_not_lower_the_other_presentations_of_the_batch()
    {
        $branch = $this->branch();
        $product = $this->product(1.0);
        $batch = $this->batch($product, $branch, 300, '+20 days');
        $unit = $this->presentation($product);
        $box = $this->presentation($product, 100);
        app(PromotionService::class)->apply($batch, 10, $this->userWithRole('Administrador'), 'manual', [$box->id => 10]);
        $cashier = $this->userWithRole('Cajero', $branch);
        $this->openCash($cashier, $branch);

        $this->sell($cashier, [
            ['product_presentation_id' => $unit->id, 'quantity' => 4],
            ['product_presentation_id' => $box->id, 'quantity' => 1],
        ], [['method' => 'qr', 'amount' => 85]]);

        $sale = Sale::with('items')->firstOrFail();
        $items = $sale->items->keyBy('product_presentation_id');
        $this->assertEquals([0, 4], [$items[$unit->id]->discount_percent, $items[$unit->id]->total]);
        // Caja a 90.00 con 10% = 81.00
        $this->assertEquals([10, 81], [$items[$box->id]->discount_percent, $items[$box->id]->total]);
        $this->assertEquals(85, $sale->total);
    }

    public function test_blister_and_box_are_charged_with_their_own_percent_and_the_unit_without_discount()
    {
        $branch = $this->branch();
        $product = $this->product(1.0);
        $unit = $this->presentation($product);
        $blister = $product->presentations()->create([
            ...ProductPresentation::arrange($unit, 10, 'Blíster', $product->base_unit),
            'parent_id' => $unit->id,
            'sale_price' => 10,
        ]);
        $box = $this->presentation($product, 100);
        $batch = $this->batch($product, $branch, 300, '+20 days');
        app(PromotionService::class)->apply($batch, 0, $this->userWithRole('Administrador'), 'manual', [$blister->id => 10, $box->id => 20]);
        $cashier = $this->userWithRole('Cajero', $branch);
        $this->openCash($cashier, $branch);

        $this->sell($cashier, [
            ['product_presentation_id' => $unit->id, 'quantity' => 2],
            ['product_presentation_id' => $blister->id, 'quantity' => 1],
            ['product_presentation_id' => $box->id, 'quantity' => 1],
        ], [['method' => 'qr', 'amount' => 83]]);

        $sale = Sale::with('items')->firstOrFail();
        $items = $sale->items->keyBy('product_presentation_id');
        $this->assertEquals([0, 2], [$items[$unit->id]->discount_percent, $items[$unit->id]->total]);
        $this->assertEquals([10, 9], [$items[$blister->id]->discount_percent, $items[$blister->id]->total]);
        // Caja a 90.00 con 20% = 72.00
        $this->assertEquals([20, 72], [$items[$box->id]->discount_percent, $items[$box->id]->total]);
        $this->assertEquals(83, $sale->total);
        $this->assertSame(188, $batch->fresh()->stock);
    }

    public function test_pos_search_shows_the_promotion_only_on_its_presentation()
    {
        $branch = $this->branch();
        $product = $this->product(1.0, ['name' => 'Paracetamolix']);
        $batch = $this->batch($product, $branch, 300, '+20 days');
        $box = $this->presentation($product, 100);
        app(PromotionService::class)->apply($batch, 0, $this->userWithRole('Administrador'), 'manual', [$box->id => 30]);
        $cashier = $this->userWithRole('Cajero', $branch);
        $this->openCash($cashier, $branch);

        $results = $this->actingAs($cashier)->getJson('/admin/pos/search?q=Paracet')->assertOk()->collect()->keyBy('presentation_id');

        $this->assertEquals(30, $results[$box->id]['promo_discount']);
        $this->assertNull($results[$this->presentation($product)->id]['promo_discount']);
    }

    public function test_only_the_units_of_the_batch_on_promotion_get_the_discount_in_percent_and_in_bs()
    {
        $branch = $this->branch();
        $product = $this->product(1.0);
        $promo = $this->batch($product, $branch, 4, '+40 days', 0.4);
        $normal = $this->batch($product, $branch, 50, '+1 year', 0.4);
        app(PromotionService::class)->apply($promo, 25, $this->userWithRole('Administrador'));
        $cashier = $this->userWithRole('Cajero', $branch);
        $this->openCash($cashier, $branch);

        // 9 tabletas: las 4 del lote en promoción con −25% y las otras 5 del siguiente a precio normal
        $this->sell($cashier, [['product_presentation_id' => $this->presentation($product)->id, 'quantity' => 9]], [['method' => 'qr', 'amount' => 8]])
            ->assertRedirect();

        $sale = Sale::with('items')->firstOrFail();
        $this->assertSame(
            [
                [$promo->id, 4, '4.00', '25.00', '1.00', '3.00'],
                [$normal->id, 5, '5.00', '0.00', '0.00', '5.00'],
            ],
            $sale->items->map(fn ($i) => [$i->batch_id, $i->units, $i->subtotal, $i->discount_percent, $i->discount_amount, $i->total])->all(),
        );
        // El subtotal de la venta ya trae la promoción; sin descuento general
        $this->assertSame(['8.00', '0.00', '8.00'], [$sale->subtotal, $sale->discount, $sale->total]);
    }

    public function test_a_general_discount_lowers_the_total_like_an_invoice()
    {
        $branch = $this->branch();
        $product = $this->product(1.0);
        $promo = $this->batch($product, $branch, 4, '+40 days', 0.4);
        $this->batch($product, $branch, 50, '+1 year', 0.4);
        $admin = $this->userWithRole('Administrador', $branch);
        app(PromotionService::class)->apply($promo, 25, $admin);
        $this->openCash($admin, $branch);

        // 9 tabletas: 3.00 (4 con −25%) + 5.00 = subtotal 8.00; Bs 1 de descuento general por redondeo
        $this->sell($admin, [['product_presentation_id' => $this->presentation($product)->id, 'quantity' => 9]], [['method' => 'qr', 'amount' => 7]], [
            'discount' => 1,
            'discount_reason' => 'Redondeo',
        ])->assertRedirect();

        $sale = Sale::with('items')->firstOrFail();
        $this->assertSame(['8.00', '1.00', 'Redondeo', '7.00'], [$sale->subtotal, $sale->discount, $sale->discount_reason, $sale->total]);
        // Cada ítem guarda solo su propio descuento (la promoción); el general queda en la venta
        $this->assertSame(['1.00', '0.00'], $sale->items->pluck('discount_amount')->all());

        // Reportes: ingresos y producto ya sin el descuento general (repartido al calcular); cuánto, por qué y quién
        $this->actingAs($admin)->get('/admin/reports')->assertInertia(fn ($page) => $page
            ->where('summary.revenue', 7)
            ->where('summary.general_discount', 1)
            ->where('topProducts.0.revenue', 7)
            ->where('discountByReason.0', ['name' => 'Redondeo', 'count' => 1, 'total' => 1])
            ->where('discountBySeller.0.name', $admin->name));
    }

    public function test_a_general_discount_needs_the_permission_a_reason_stays_within_the_limit_and_above_the_cost()
    {
        $branch = $this->branch();
        $product = $this->product(10.0);
        $this->batch($product, $branch, 10, '+1 year', 9.0);
        $cashier = $this->userWithRole('Cajero', $branch);
        $this->openCash($cashier, $branch);
        $item = [['product_presentation_id' => $this->presentation($product)->id, 'quantity' => 1]];
        $sell = fn (float $discount, array $extra = ['discount_reason' => 'Cortesía']) => $this->sell(
            $cashier, $item, [['method' => 'qr', 'amount' => 10 - $discount]], ['discount' => $discount] + $extra,
        );

        // El Cajero no tiene ventas.descontar
        $sell(0.5)->assertSessionHas('error', 'No tienes permiso para dar descuentos.');

        $cashier->givePermissionTo('ventas.descontar');
        // Sin motivo no pasa la validación
        $sell(0.5, [])->assertSessionHasErrors('discount_reason');
        // Tope 20%: Bs 2.50 de Bs 10 es 25%
        $sell(2.5)->assertSessionHas('error', fn (string $error) => str_contains($error, 'no puede pasar del 20%'));
        // Bs 2 deja la venta en 8, debajo del costo (9): necesita promociones.aprobar
        $sell(2)->assertSessionHas('error', fn (string $error) => str_contains($error, 'por debajo del costo'));
        $this->assertSame(0, Sale::count());

        $sell(0.5)->assertRedirect();
        $this->assertDatabaseHas('sales', ['subtotal' => 10, 'discount' => 0.5, 'discount_reason' => 'Cortesía', 'total' => 9.5]);
    }

    public function test_boxes_and_units_of_the_same_product_share_the_stock()
    {
        $branch = $this->branch();
        $product = $this->product(1.0);
        $this->batch($product, $branch, 105);
        $cashier = $this->userWithRole('Cajero', $branch);
        $this->openCash($cashier, $branch);

        // 1 caja (100) + 6 unidades = 106 > 105
        $this->sell($cashier, [
            ['product_presentation_id' => $this->presentation($product, 100)->id, 'quantity' => 1],
            ['product_presentation_id' => $this->presentation($product)->id, 'quantity' => 6],
        ], [['method' => 'efectivo', 'amount' => 200]])->assertSessionHas('error');

        $this->assertSame(0, Sale::count());
        $this->assertSame(105, app(InventoryService::class)->stock($product->id, $branch->id));
    }

    public function test_payments_must_cover_the_total_and_only_cash_gives_change()
    {
        $branch = $this->branch();
        $product = $this->product(10.0);
        $this->batch($product, $branch, 10);
        $cashier = $this->userWithRole('Cajero', $branch);
        $this->openCash($cashier, $branch);
        $item = [['product_presentation_id' => $this->presentation($product)->id, 'quantity' => 1]];

        $this->sell($cashier, $item, [['method' => 'efectivo', 'amount' => 5]])->assertSessionHas('error');
        $this->sell($cashier, $item, [['method' => 'tarjeta', 'amount' => 15]])->assertSessionHas('error');
        $this->sell($cashier, $item, [['method' => 'efectivo', 'amount' => 4], ['method' => 'qr', 'amount' => 6]])->assertRedirect();

        $this->assertSame(1, Sale::count());
        $this->assertEquals(0, Sale::first()->change);
    }

    public function test_controlled_medicines_need_a_prescription()
    {
        $branch = $this->branch();
        $product = $this->product(5.0, ['is_controlled' => true, 'requires_prescription' => true]);
        $this->batch($product, $branch, 10);
        $cashier = $this->userWithRole('Cajero', $branch);
        $this->openCash($cashier, $branch);
        $item = [['product_presentation_id' => $this->presentation($product)->id, 'quantity' => 1]];
        $pay = [['method' => 'efectivo', 'amount' => 5]];

        $this->sell($cashier, $item, $pay)->assertSessionHas('error');
        $this->sell($cashier, $item, $pay, ['prescription_number' => 'R-77', 'prescription_doctor' => 'Dra. Rojas'])->assertRedirect();

        $this->assertDatabaseHas('sales', ['prescription_number' => 'R-77']);
    }

    public function test_selling_needs_an_open_cash_session()
    {
        $cashier = $this->userWithRole('Cajero', $this->branch());

        $this->actingAs($cashier)->get('/admin/pos')->assertRedirect('/admin/cash')->assertSessionHas('info');
    }

    public function test_cancelling_a_sale_returns_the_stock_to_the_same_batches()
    {
        $branch = $this->branch();
        $product = $this->product(1.0);
        $batch = $this->batch($product, $branch, 10);
        $cashier = $this->userWithRole('Cajero', $branch);
        $this->openCash($cashier, $branch);
        $this->sell($cashier, [['product_presentation_id' => $this->presentation($product)->id, 'quantity' => 4]], [['method' => 'efectivo', 'amount' => 4]]);
        $sale = Sale::firstOrFail();
        $admin = $this->userWithRole('Administrador');

        $this->actingAs($admin)->post("/admin/sales/{$sale->id}/cancel", ['reason' => 'Cliente devolvió'])->assertSessionHas('success');

        $this->assertSame('anulada', $sale->fresh()->status);
        $this->assertSame(10, $batch->fresh()->stock);
        $this->assertDatabaseHas('stock_movements', ['batch_id' => $batch->id, 'type' => 'anulacion_venta', 'quantity' => 4]);
        // La venta anulada ya no cuenta en el efectivo esperado
        $this->assertEquals(100, app(CashService::class)->expectedCash($sale->cashSession));
    }

    public function test_a_cancelled_sale_leaves_the_list_and_only_shows_with_its_status_filter()
    {
        $branch = $this->branch();
        $product = $this->product(1.0);
        $this->batch($product, $branch, 10);
        $cashier = $this->userWithRole('Cajero', $branch);
        $this->openCash($cashier, $branch);
        $items = [['product_presentation_id' => $this->presentation($product)->id, 'quantity' => 1]];
        $this->sell($cashier, $items, [['method' => 'efectivo', 'amount' => 1]]);
        $this->sell($cashier, $items, [['method' => 'efectivo', 'amount' => 1]]);
        [$cancelled, $kept] = Sale::orderBy('id')->get();
        $admin = $this->userWithRole('Administrador');
        $this->actingAs($admin)->post("/admin/sales/{$cancelled->id}/cancel", ['reason' => 'Se registró por error']);

        $this->actingAs($admin)->get('/admin/sales')
            ->assertInertia(fn (Assert $page) => $page
                ->has('sales.data', 1)
                ->where('sales.data.0.id', $kept->id));

        $this->actingAs($admin)->get('/admin/sales?status=anulada')
            ->assertInertia(fn (Assert $page) => $page
                ->has('sales.data', 1)
                ->where('sales.data.0.id', $cancelled->id));
    }

    public function test_cancelling_a_sale_taken_from_two_batches_returns_each_batch_its_own_units()
    {
        $branch = $this->branch();
        $product = $this->product(1.0);
        $first = $this->batch($product, $branch, 15, '+3 months');
        $second = $this->batch($product, $branch, 40, '+8 months');
        $cashier = $this->userWithRole('Cajero', $branch);
        $this->openCash($cashier, $branch);

        // 20 unidades: 15 del lote que vence antes y 5 del siguiente
        $this->sell($cashier, [['product_presentation_id' => $this->presentation($product)->id, 'quantity' => 20]], [['method' => 'efectivo', 'amount' => 20]]);
        $sale = Sale::firstOrFail();
        $this->assertSame([0, 35], [$first->fresh()->stock, $second->fresh()->stock]);
        $this->assertSame([$first->id => 15, $second->id => 5], $sale->items()->pluck('units', 'batch_id')->all());

        $this->actingAs($this->userWithRole('Administrador'))->post("/admin/sales/{$sale->id}/cancel", ['reason' => 'Cliente devolvió'])
            ->assertSessionHas('success');

        $this->assertSame([15, 40], [$first->fresh()->stock, $second->fresh()->stock]);
        $this->assertDatabaseHas('stock_movements', ['batch_id' => $first->id, 'type' => 'anulacion_venta', 'quantity' => 15]);
        $this->assertDatabaseHas('stock_movements', ['batch_id' => $second->id, 'type' => 'anulacion_venta', 'quantity' => 5]);
    }

    public function test_a_sale_cannot_be_cancelled_after_its_cash_session_was_closed()
    {
        $branch = $this->branch();
        $product = $this->product(1.0);
        $this->batch($product, $branch, 10);
        $cashier = $this->userWithRole('Cajero', $branch);
        $session = $this->openCash($cashier, $branch);
        $this->sell($cashier, [['product_presentation_id' => $this->presentation($product)->id, 'quantity' => 1]], [['method' => 'qr', 'amount' => 1]]);
        app(CashService::class)->close($session, [$this->denomination(100)->id => 1]);

        $this->actingAs($this->userWithRole('Administrador'))
            ->post('/admin/sales/'.Sale::first()->id.'/cancel', ['reason' => 'x'])
            ->assertSessionHas('error');
    }

    public function test_pos_search_shows_price_stock_and_promotion()
    {
        $branch = $this->branch();
        $product = $this->product(1.0, ['name' => 'Paracetamolix']);
        $batch = $this->batch($product, $branch, 30, '+20 days');
        app(PromotionService::class)->apply($batch, 30, $this->userWithRole('Administrador'));
        $cashier = $this->userWithRole('Cajero', $branch);
        $this->openCash($cashier, $branch);

        $this->actingAs($cashier)->getJson('/admin/pos/search?q=Paracet')
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonPath('0.commercial_name', 'Paracetamolix')
            ->assertJsonPath('0.stock_units', 30)
            ->assertJsonPath('0.promo_discount', 30)
            // Qué trae cada empaque: la unidad suelta no tiene niveles, la caja contiene 100 unidades
            ->assertJsonPath('0.breakdown', [])
            ->assertJsonPath('1.package', 'caja')
            ->assertJsonPath('1.breakdown', [['package' => 'caja', 'count' => 100, 'unit' => ProductPresentation::plural($product->base_unit)]]);
    }

    public function test_pos_search_finds_products_by_symptom()
    {
        $branch = $this->branch();
        $product = $this->product(1.0, ['name' => 'Cefalín']);
        $product->indications()->sync(Indication::idsFor(['Dolor de cabeza', 'Fiebre']));
        $this->product(1.0, ['name' => 'Otro']);
        $cashier = $this->userWithRole('Cajero', $branch);
        $this->openCash($cashier, $branch);

        $this->actingAs($cashier)->getJson('/admin/pos/search?q=dolor de cabeza')
            ->assertOk()
            ->assertJsonPath('0.product_id', $product->id)
            ->assertJsonPath('0.indications', ['Dolor de cabeza', 'Fiebre']);
    }

    public function test_presentations_that_are_not_sold_stay_out_of_the_pos()
    {
        $branch = $this->branch();
        $product = $this->product(1.0, ['name' => 'Febrax']);
        $this->batch($product, $branch, 300);
        $this->presentation($product, 100)->update(['is_sellable' => false]);
        $cashier = $this->userWithRole('Cajero', $branch);
        $this->openCash($cashier, $branch);

        $this->actingAs($cashier)->getJson('/admin/pos/search?q=Febrax')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.factor', 1);
        $this->sell($cashier, [['product_presentation_id' => $this->presentation($product, 100)->id, 'quantity' => 1]], [['method' => 'efectivo', 'amount' => 100]])
            ->assertSessionHasErrors('items.0.product_presentation_id');
        $this->assertSame(0, Sale::count());
    }
}
