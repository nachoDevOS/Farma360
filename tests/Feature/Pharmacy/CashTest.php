<?php

namespace Tests\Feature\Pharmacy;

use App\Exceptions\BusinessException;
use App\Models\CashRegister;
use App\Models\CashSession;
use App\Services\CashService;
use App\Services\SaleService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * CAJA con corte de billetes: apertura, movimientos, arqueo y aprobación de diferencias.
 */
class CashTest extends TestCase
{
    use PharmacyHelpers, RefreshDatabase;

    private CashService $cash;

    protected function setUp(): void
    {
        parent::setUp();
        $this->cash = app(CashService::class);
    }

    public function test_opening_counts_bills_and_coins()
    {
        $branch = $this->branch();
        $register = CashRegister::factory()->create(['branch_id' => $branch->id]);
        $cashier = $this->userWithRole('Cajero', $branch);

        $this->actingAs($cashier)->post('/admin/cash/open', [
            'cash_register_id' => $register->id,
            'counts' => [$this->denomination(100)->id => 2, $this->denomination(10)->id => 3, $this->denomination(0.5)->id => 4],
        ])->assertSessionHas('success');

        $session = CashSession::firstOrFail();
        $this->assertEquals(232, $session->opening_amount);
        $this->assertSame(3, $session->counts()->where('moment', 'apertura')->count());
    }

    public function test_a_register_and_a_cashier_can_only_have_one_open_session()
    {
        $branch = $this->branch();
        $register = CashRegister::factory()->create(['branch_id' => $branch->id]);
        $this->cash->open($register, $this->userWithRole('Cajero', $branch), []);

        $this->expectException(BusinessException::class);
        $this->cash->open($register, $this->userWithRole('Cajero', $branch), []);
    }

    public function test_cashiers_only_open_registers_of_their_branch()
    {
        $register = CashRegister::factory()->create();
        $cashier = $this->userWithRole('Cajero', $this->branch());

        $this->expectException(BusinessException::class);
        $this->cash->open($register, $cashier, []);
    }

    public function test_expected_cash_adds_cash_sales_and_movements_but_not_qr()
    {
        $branch = $this->branch();
        $product = $this->product(10.0);
        $this->batch($product, $branch, 10);
        $cashier = $this->userWithRole('Cajero', $branch);
        $session = $this->openCash($cashier, $branch); // fondo 100
        $presentation = $this->presentation($product)->id;

        $this->actingAs($cashier)->post('/admin/sales', ['items' => [['product_presentation_id' => $presentation, 'quantity' => 3]], 'payments' => [['method' => 'efectivo', 'amount' => 50]]]);
        $this->actingAs($cashier)->post('/admin/sales', ['items' => [['product_presentation_id' => $presentation, 'quantity' => 2]], 'payments' => [['method' => 'qr', 'amount' => 20]]]);
        $this->actingAs($cashier)->post('/admin/cash/movement', ['type' => 'ingreso', 'amount' => 15, 'reason' => 'Cambio de sencillo']);
        $this->actingAs($cashier)->post('/admin/cash/movement', ['type' => 'egreso', 'amount' => 5, 'reason' => 'Flete']);
        $this->actingAs($cashier)->post('/admin/cash/movement', ['type' => 'retiro', 'amount' => 50, 'reason' => 'Retiro a bóveda']);

        $summary = $this->cash->summary($session);
        // 100 + 30 (efectivo) + 15 - 5 - 50 = 90. Los 20 de QR van aparte.
        $this->assertEquals(90, $summary['expected']);
        $this->assertEquals(20, $summary['by_method']['qr']);
        $this->assertSame(2, $summary['sales_count']);
    }

    /**
     * REGLA DEL NEGOCIO: una caja por trabajador. En una sucursal grande cada cajero abre SU caja,
     * vende en SU turno y rinde cuenta de SU efectivo. El stock sí es de la sucursal (compartido).
     */
    public function test_each_cashier_of_a_branch_accounts_for_their_own_register()
    {
        $branch = $this->branch();
        $product = $this->product(10.0);
        $this->batch($product, $branch, 5);
        $presentation = $this->presentation($product)->id;
        $luis = $this->userWithRole('Cajero', $branch);
        $ana = $this->userWithRole('Cajero', $branch);
        $luisSession = $this->openCash($luis, $branch); // Caja propia, fondo 100
        $anaSession = $this->openCash($ana, $branch);   // Otra caja, fondo 100

        $this->actingAs($luis)->post('/admin/sales', ['items' => [['product_presentation_id' => $presentation, 'quantity' => 3]], 'payments' => [['method' => 'efectivo', 'amount' => 30]]]);
        $this->actingAs($ana)->post('/admin/sales', ['items' => [['product_presentation_id' => $presentation, 'quantity' => 2]], 'payments' => [['method' => 'efectivo', 'amount' => 20]]]);

        // Cada uno responde solo por lo suyo
        $this->assertEquals(130, $this->cash->expectedCash($luisSession));
        $this->assertEquals(120, $this->cash->expectedCash($anaSession));
        $this->assertSame(1, $luisSession->sales()->count());
        $this->assertSame(1, $anaSession->sales()->count());

        // El stock es de la sucursal: entre los dos ya vendieron las 5 unidades
        $this->actingAs($ana)->post('/admin/sales', ['items' => [['product_presentation_id' => $presentation, 'quantity' => 1]], 'payments' => [['method' => 'efectivo', 'amount' => 10]]])
            ->assertSessionHas('error');

        // Nadie vende ni cierra en el turno del otro
        $this->expectException(BusinessException::class);
        app(SaleService::class)->create($luisSession, $ana, ['items' => [], 'payments' => []]);
    }

    public function test_a_withdrawal_cannot_exceed_the_cash_in_the_register()
    {
        $branch = $this->branch();
        $session = $this->openCash($this->userWithRole('Cajero', $branch), $branch);

        $this->expectException(BusinessException::class);
        $this->cash->addMovement($session, 'retiro', 150, 'Demasiado');
    }

    public function test_closing_with_a_small_difference_closes_the_session()
    {
        $branch = $this->branch();
        $cashier = $this->userWithRole('Cajero', $branch);
        $this->openCash($cashier, $branch); // esperado 100

        $this->actingAs($cashier)->post('/admin/cash/close', [
            'counts' => [$this->denomination(50)->id => 1, $this->denomination(20)->id => 2, $this->denomination(5)->id => 1, $this->denomination(2)->id => 2],
        ])->assertRedirect();

        $session = CashSession::firstOrFail();
        $this->assertSame('cerrada', $session->status);
        $this->assertEquals(99, $session->counted_amount);
        $this->assertEquals(-1, $session->difference);
    }

    public function test_a_big_difference_needs_a_note_and_a_supervisor_approval()
    {
        $branch = $this->branch();
        $cashier = $this->userWithRole('Cajero', $branch);
        $session = $this->openCash($cashier, $branch); // esperado 100
        $counts = [$this->denomination(50)->id => 1];

        $this->actingAs($cashier)->post('/admin/cash/close', ['counts' => $counts])->assertSessionHas('error');
        $this->assertSame('abierta', $session->fresh()->status);

        $this->actingAs($cashier)->post('/admin/cash/close', ['counts' => $counts, 'note' => 'Faltan 50, se revisará'])->assertRedirect();
        $this->assertSame('pendiente', $session->fresh()->status);

        $admin = $this->userWithRole('Administrador');
        $this->actingAs($admin)->post("/admin/cash/sessions/{$session->id}/approve", ['note' => 'Revisado'])->assertSessionHas('success');

        $session->refresh();
        $this->assertSame('cerrada', $session->status);
        $this->assertSame($admin->id, $session->reviewUser_id);
    }

    public function test_a_cashier_cannot_approve_their_own_session()
    {
        $branch = $this->branch();
        $admin = $this->userWithRole('Administrador', $branch);
        $session = $this->openCash($admin, $branch);
        $this->cash->close($session, [], 'Todo faltante');

        $this->expectException(BusinessException::class);
        $this->cash->approve($session->fresh(), $admin);
    }

    public function test_cash_screens_render()
    {
        $branch = $this->branch();
        $cashier = $this->userWithRole('Cajero', $branch);
        CashRegister::factory()->create(['branch_id' => $branch->id]);

        $this->actingAs($cashier)->get('/admin/cash')
            ->assertInertia(fn ($page) => $page->component('admin/cash/index')->where('session', null)->has('registers', 1)->has('denominations', 11));

        $session = $this->openCash($cashier, $branch);
        $this->actingAs($cashier)->get('/admin/cash')
            ->assertInertia(fn ($page) => $page->component('admin/cash/index')->where('session.id', $session->id)->where('summary.expected', 100));
        $this->actingAs($cashier)->get('/admin/cash/sessions')->assertInertia(fn ($page) => $page->component('admin/cash/sessions')->has('sessions.data', 1));
        $this->actingAs($cashier)->get("/admin/cash/sessions/{$session->id}")->assertInertia(fn ($page) => $page->component('admin/cash/show'));
        // Otro cajero no ve el turno ajeno
        $this->actingAs($this->userWithRole('Cajero', $branch))->get("/admin/cash/sessions/{$session->id}")->assertForbidden();
    }
}
