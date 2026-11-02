<?php

namespace Tests\Feature\Pharmacy;

use App\Models\Laboratory;
use App\Models\Product;
use App\Models\ProductPresentation;
use App\Models\Sale;
use App\Services\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * PANTALLA DEL PUNTO DE VENTA (/admin/pos): la página, su buscador y una venta completa tal como la envía la pantalla.
 * Las reglas de la venta (FEFO, promociones, recetas, anulación) están en SaleTest.
 */
class PosTest extends TestCase
{
    use PharmacyHelpers, RefreshDatabase;

    public function test_pos_page_shows_my_open_cash_session_and_the_payment_methods()
    {
        $branch = $this->branch(['name' => 'Central']);
        $cashier = $this->userWithRole('Cajero', $branch);
        $session = $this->openCash($cashier, $branch);

        $this->actingAs($cashier)->get('/admin/pos')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('admin/sales/pos')
                ->where('session.id', $session->id)
                ->where('session.branch.name', 'Central')
                ->has('session.cash_register.name')
                ->where('paymentMethods', config('farmacia.payment_methods')));
    }

    public function test_pos_search_needs_an_open_cash_session()
    {
        $cashier = $this->userWithRole('Cajero', $this->branch());

        $this->actingAs($cashier)->getJson('/admin/pos/search?q=Para')->assertForbidden();
    }

    public function test_pos_search_gives_what_identifies_the_product_and_how_its_package_comes()
    {
        $branch = $this->branch();
        $laboratory = Laboratory::create(['name' => 'Farmacéutica del Oriente']);
        $product = Product::factory()->create([
            'name' => 'Alergin', 'concentration' => '10 mg', 'base_unit' => 'Tableta',
            'image' => 'products/alergin.avif', 'laboratory_id' => $laboratory->id,
        ]);
        $tablet = $product->presentations()->create([...ProductPresentation::arrange(null, null, 'Tableta', 'Tableta'), 'sale_price' => 1.5]);
        $blister = $product->presentations()->create([...ProductPresentation::arrange($tablet, 10, 'Blíster', 'Tableta'), 'parent_id' => $tablet->id, 'sale_price' => 14]);
        $product->presentations()->create([...ProductPresentation::arrange($blister, 3, 'Caja', 'Tableta'), 'parent_id' => $blister->id, 'sale_price' => 40]);
        $this->batch($product->load('presentations'), $branch, 60);
        $cashier = $this->userWithRole('Cajero', $branch);
        $this->openCash($cashier, $branch);

        $this->actingAs($cashier)->getJson('/admin/pos/search?q=Alergin')
            ->assertOk()
            ->assertJsonCount(3)
            ->assertJsonPath('2.commercial_name', 'Alergin')
            ->assertJsonPath('2.concentration', '10 mg')
            ->assertJsonPath('2.image', 'products/alergin.avif')
            ->assertJsonPath('2.laboratory', 'Farmacéutica del Oriente')
            ->assertJsonPath('2.package', 'caja')
            ->assertJsonPath('2.factor', 30)
            ->assertJsonPath('2.sale_price', 40)
            ->assertJsonPath('2.stock_units', 60)
            ->assertJsonPath('2.breakdown', [
                ['package' => 'caja', 'count' => 3, 'unit' => 'blísteres'],
                ['package' => 'blíster', 'count' => 10, 'unit' => 'tabletas'],
            ]);
    }

    public function test_scanning_the_barcode_of_a_box_puts_the_box_first_so_enter_sells_it()
    {
        $branch = $this->branch();
        $product = $this->product(1.0, ['name' => 'Febrax']);
        $this->presentation($product, 100)->update(['barcode' => '7790001112223']);
        $this->batch($product, $branch, 300);
        $cashier = $this->userWithRole('Cajero', $branch);
        $this->openCash($cashier, $branch);

        $this->actingAs($cashier)->getJson('/admin/pos/search?q=7790001112223')
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonPath('0.factor', 100)
            ->assertJsonPath('0.scanned', true)
            ->assertJsonPath('1.factor', 1)
            ->assertJsonPath('1.scanned', false);
        // Buscando por nombre siguen de la más chica a la más grande y ninguna cuenta como escaneada
        $this->actingAs($cashier)->getJson('/admin/pos/search?q=Febrax')
            ->assertJsonPath('0.factor', 1)
            ->assertJsonPath('1.scanned', false);
    }

    public function test_pos_search_only_counts_sellable_stock_of_my_branch()
    {
        $branch = $this->branch();
        $product = $this->product(1.0, ['name' => 'Febrax']);
        $this->batch($product, $branch, 40);
        $this->batch($product, $branch, 25, '-1 day');
        $this->batch($product, $this->branch(), 500);
        $cashier = $this->userWithRole('Cajero', $branch);
        $this->openCash($cashier, $branch);

        // Ni el lote vencido ni el de otra sucursal se pueden vender desde esta caja
        $this->actingAs($cashier)->getJson('/admin/pos/search?q=Febrax')
            ->assertOk()
            ->assertJsonPath('0.stock_units', 40)
            ->assertJsonPath('1.stock_units', 40);
    }

    public function test_a_checkout_sent_like_the_pos_registers_the_sale_with_its_change()
    {
        $branch = $this->branch();
        $product = $this->product(2.5, ['name' => 'Dolofen']);
        $this->batch($product, $branch, 300);
        $cashier = $this->userWithRole('Cajero', $branch);
        $this->openCash($cashier, $branch);
        $box = $this->presentation($product, 100);

        // 1 caja (Bs 225) + 4 unidades (Bs 10) = Bs 235: paga Bs 100 por QR y Bs 150 en efectivo → cambio Bs 15
        $this->actingAs($cashier)->post('/admin/sales', [
            'items' => [
                ['product_presentation_id' => $box->id, 'quantity' => 1],
                ['product_presentation_id' => $this->presentation($product)->id, 'quantity' => 4],
            ],
            'payments' => [
                ['method' => 'qr', 'amount' => 100, 'reference' => 'OP-123'],
                ['method' => 'efectivo', 'amount' => 150, 'reference' => null],
            ],
            'customer_id' => null,
            'customer_name' => 'Ana Rojas',
            'customer_document' => '4455667',
            'prescription_number' => '',
            'prescription_doctor' => '',
        ])->assertRedirect()->assertSessionHas('success');

        $sale = Sale::with('payments')->firstOrFail();
        $this->assertEquals(235, $sale->total);
        $this->assertEquals(15, $sale->change);
        $this->assertSame('Ana Rojas', $sale->customer_name);
        $this->assertSame(['qr', 'efectivo'], $sale->payments->pluck('method')->all());
        $this->assertSame('OP-123', $sale->payments->firstWhere('method', 'qr')->reference);
        $this->assertSame(196, app(InventoryService::class)->stock($product->id, $branch->id));
    }
}
