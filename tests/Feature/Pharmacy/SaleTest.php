<?php

namespace Tests\Feature\Pharmacy;

use App\Models\Sale;
use App\Services\CashService;
use App\Services\InventoryService;
use App\Services\PromotionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
        $this->assertSame(0, $soon->fresh()->quantity);
        $this->assertSame(8, $late->fresh()->quantity);
        // Lo guardado en caja es el efectivo menos el cambio
        $this->assertDatabaseHas('sale_payments', ['sale_id' => $sale->id, 'method' => 'efectivo', 'amount' => 5]);
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
        $this->assertEquals(25, $sale->items->first()->discount_percent);
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
            ['product_presentation_id' => $this->presentation($product, 'Caja x100')->id, 'quantity' => 1],
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

        $this->actingAs($cashier)->get('/admin/pos')->assertRedirect('/admin/cash');
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
        $this->assertSame(10, $batch->fresh()->quantity);
        $this->assertDatabaseHas('stock_movements', ['batch_id' => $batch->id, 'type' => 'anulacion_venta', 'quantity' => 4]);
        // La venta anulada ya no cuenta en el efectivo esperado
        $this->assertEquals(100, app(CashService::class)->expectedCash($sale->cashSession));
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
            ->assertJsonPath('0.stock_units', 30)
            ->assertJsonPath('0.promo_discount', 30);
    }
}
