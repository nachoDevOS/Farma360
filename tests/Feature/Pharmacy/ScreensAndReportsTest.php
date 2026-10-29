<?php

namespace Tests\Feature\Pharmacy;

use App\Models\CashRegister;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\Supplier;
use App\Models\Transfer;
use App\Services\PurchaseService;
use App\Services\TransferService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Todas las pantallas abren, cada rol ve solo lo suyo, y los reportes suman bien.
 */
class ScreensAndReportsTest extends TestCase
{
    use PharmacyHelpers, RefreshDatabase;

    public function test_every_pharmacy_screen_renders_for_an_administrator()
    {
        $branch = $this->branch();
        $other = $this->branch();
        $product = $this->product(2.0);
        $batch = $this->batch($product, $branch, 50);
        $admin = $this->userWithRole('Administrador');
        $purchase = app(PurchaseService::class)->create([
            'branch_id' => $branch->id, 'supplier_id' => Supplier::factory()->create()->id, 'purchased_at' => today()->toDateString(),
            'items' => [['product_presentation_id' => $this->presentation($product)->id, 'quantity' => 1, 'cost' => 1, 'batch_number' => 'X', 'expires_at' => today()->addYear()->toDateString()]],
        ]);
        $transfer = app(TransferService::class)->send($branch->id, $other->id, [['batch_id' => $batch->id, 'quantity' => 1]]);
        $this->openCash($admin, $branch);
        $this->actingAs($admin)->post('/admin/sales', ['items' => [['product_presentation_id' => $this->presentation($product)->id, 'quantity' => 1]], 'payments' => [['method' => 'efectivo', 'amount' => 2]]]);
        $sale = Sale::firstOrFail();

        $screens = [
            '/admin/branches' => 'admin/resources/index',
            '/admin/suppliers' => 'admin/resources/index',
            '/admin/customers' => 'admin/resources/index',
            '/admin/categories' => 'admin/resources/index',
            '/admin/laboratories' => 'admin/resources/index',
            '/admin/indications' => 'admin/resources/index',
            '/admin/cash-registers' => 'admin/resources/index',
            '/admin/denominations' => 'admin/resources/index',
            '/admin/products' => 'admin/products/index',
            '/admin/products/create' => 'admin/products/form',
            "/admin/products/{$product->id}/edit" => 'admin/products/form',
            '/admin/purchases' => 'admin/purchases/index',
            '/admin/purchases/create' => 'admin/purchases/create',
            "/admin/purchases/{$purchase->id}" => 'admin/purchases/show',
            '/admin/inventory' => 'admin/inventory/index',
            '/admin/transfers' => 'admin/transfers/index',
            '/admin/transfers/create' => 'admin/transfers/create',
            "/admin/transfers/{$transfer->id}" => 'admin/transfers/show',
            '/admin/promotions' => 'admin/promotions/index',
            '/admin/cash' => 'admin/cash/index',
            '/admin/pos' => 'admin/sales/pos',
            '/admin/sales' => 'admin/sales/index',
            "/admin/sales/{$sale->id}" => 'admin/sales/show',
            '/admin/reports' => 'admin/reports/index',
        ];

        foreach ($screens as $url => $component) {
            $this->actingAs($admin)->get($url)->assertOk()->assertInertia(fn ($page) => $page->component($component));
        }
    }

    public function test_each_role_only_reaches_its_modules()
    {
        $branch = $this->branch();
        $cajero = $this->userWithRole('Cajero', $branch);
        $almacenero = $this->userWithRole('Almacenero', $branch);

        foreach (['/admin/cash', '/admin/sales', '/admin/customers', '/admin/products'] as $url) {
            $this->actingAs($cajero)->get($url)->assertOk();
        }
        foreach (['/admin/purchases', '/admin/inventory', '/admin/transfers', '/admin/reports', '/admin/promotions', '/admin/branches', '/admin/cash-registers'] as $url) {
            $this->actingAs($cajero)->get($url)->assertForbidden();
        }
        foreach (['/admin/purchases', '/admin/inventory', '/admin/transfers'] as $url) {
            $this->actingAs($almacenero)->get($url)->assertOk();
        }
        foreach (['/admin/sales', '/admin/cash', '/admin/reports'] as $url) {
            $this->actingAs($almacenero)->get($url)->assertForbidden();
        }
    }

    public function test_a_user_of_one_branch_does_not_see_documents_of_another()
    {
        $mine = $this->branch();
        $other = $this->branch();
        $product = $this->product();
        $purchase = app(PurchaseService::class)->create([
            'branch_id' => $other->id, 'supplier_id' => Supplier::factory()->create()->id, 'purchased_at' => today()->toDateString(),
            'items' => [['product_presentation_id' => $this->presentation($product)->id, 'quantity' => 1, 'cost' => 1, 'batch_number' => 'X', 'expires_at' => today()->addYear()->toDateString()]],
        ]);
        $almacenero = $this->userWithRole('Almacenero', $mine);

        $this->actingAs($almacenero)->get('/admin/purchases')->assertInertia(fn ($page) => $page->has('purchases.data', 0));
        $this->actingAs($almacenero)->get("/admin/purchases/{$purchase->id}")->assertForbidden();
        $this->assertSame(1, Purchase::count());
    }

    public function test_reports_compute_revenue_cost_and_profit()
    {
        $branch = $this->branch();
        $product = $this->product(2.0);
        $this->batch($product, $branch, 100, '+1 year', 0.5);
        $admin = $this->userWithRole('Administrador', $branch);
        $this->openCash($admin, $branch);
        $presentation = $this->presentation($product)->id;
        $this->actingAs($admin)->post('/admin/sales', ['items' => [['product_presentation_id' => $presentation, 'quantity' => 10]], 'payments' => [['method' => 'efectivo', 'amount' => 20]]]);
        $this->actingAs($admin)->post('/admin/sales', ['items' => [['product_presentation_id' => $presentation, 'quantity' => 5]], 'payments' => [['method' => 'qr', 'amount' => 10]]]);
        $this->actingAs($admin)->post('/admin/sales/'.Sale::latest('id')->first()->id.'/cancel', ['reason' => 'Prueba']);

        $this->actingAs($admin)->get('/admin/reports')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('admin/reports/index')
                ->where('summary.sales_count', 1)
                ->where('summary.revenue', 20)
                ->where('summary.cost', 5)
                ->where('summary.profit', 15)
                ->where('summary.cancelled', 1)
                ->where('topProducts.0.units', 10)
                ->where('byMethod.0.method', 'efectivo')
                ->where('bySeller.0.name', $admin->name)
                ->where('inventory.0.value', 45));
    }

    public function test_cash_registers_are_configured_with_caja_editar()
    {
        $branch = $this->branch();
        $admin = $this->userWithRole('Administrador');

        $this->actingAs($admin)->post('/admin/cash-registers', ['branch_id' => $branch->id, 'name' => 'Caja 2', 'is_active' => true])->assertSessionHas('success');
        $this->assertDatabaseHas('cash_registers', ['branch_id' => $branch->id, 'name' => 'Caja 2']);

        $this->actingAs($this->userWithRole('Cajero', $branch))->post('/admin/cash-registers', ['branch_id' => $branch->id, 'name' => 'Caja 3'])->assertForbidden();
        $this->assertSame(1, CashRegister::count());
    }

    public function test_document_numbers_are_sequential_per_type()
    {
        $from = $this->branch();
        $batch = $this->batch($this->product(), $from, 10);
        $first = app(TransferService::class)->send($from->id, $this->branch()->id, [['batch_id' => $batch->id, 'quantity' => 1]]);
        $second = app(TransferService::class)->send($from->id, $this->branch()->id, [['batch_id' => $batch->id, 'quantity' => 1]]);

        // El número sale del id (en MySQL los id no se reinician entre pruebas, por eso se compara contra el id)
        $this->assertSame('T-'.str_pad((string) $first->id, 6, '0', STR_PAD_LEFT), $first->number);
        $this->assertSame($first->id + 1, $second->id);
        $this->assertSame('T-'.str_pad((string) $second->id, 6, '0', STR_PAD_LEFT), $second->number);
        $this->assertSame(2, Transfer::count());
    }
}
