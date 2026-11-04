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

    public function test_a_register_shows_its_open_session_numbers_and_history()
    {
        $branch = $this->branch();
        $product = $this->product(1.0);
        $this->batch($product, $branch, 10);
        $cashier = $this->userWithRole('Cajero', $branch);
        $session = $this->openCash($cashier, $branch);
        $this->actingAs($cashier)->post('/admin/sales', [
            'items' => [['product_presentation_id' => $this->presentation($product)->id, 'quantity' => 4]],
            'payments' => [['method' => 'efectivo', 'amount' => 4]],
        ]);

        $this->actingAs($this->userWithRole('Administrador'))->get("/admin/cash-registers/{$session->cash_register_id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('admin/cash/register')
                ->where('register.id', $session->cash_register_id)
                ->where('current.id', $session->id)
                ->where('summary.sales_count', 1)
                ->where('summary.expected', 104)
                ->where('stats.sessions', 1)
                ->where('stats.month_sales', fn ($total) => (float) $total === 4.0)
                ->where('sessions.total', 1)
                ->where('sessions.data.0.sales_count', 1));
    }

    public function test_the_register_history_filters_by_status()
    {
        $branch = $this->branch();
        $session = $this->openCash($this->userWithRole('Cajero', $branch), $branch);

        $this->actingAs($this->userWithRole('Administrador'))->get("/admin/cash-registers/{$session->cash_register_id}?status=cerrada")
            ->assertInertia(fn ($page) => $page->where('sessions.total', 0)->where('current.id', $session->id));
    }

    public function test_a_register_without_an_open_session_says_so()
    {
        $register = CashRegister::factory()->create(['branch_id' => $this->branch()->id]);

        $this->actingAs($this->userWithRole('Administrador'))->get("/admin/cash-registers/{$register->id}")
            ->assertInertia(fn ($page) => $page->where('current', null)->where('summary', null)->where('stats.sessions', 0));
    }

    public function test_a_register_needs_the_permission_and_to_be_of_my_branches()
    {
        $mine = $this->branch();
        $register = CashRegister::factory()->create(['branch_id' => $this->branch()->id]);

        $this->actingAs($this->userWithRole('Cajero', $mine))->get("/admin/cash-registers/{$register->id}")->assertForbidden();

        $supervisor = $this->userWithRole('Regente', $mine);
        $supervisor->givePermissionTo('caja.editar');
        $this->actingAs($supervisor)->get("/admin/cash-registers/{$register->id}")->assertForbidden();
    }

    public function test_the_blind_close_hides_the_expected_cash_from_the_cashier_of_that_session()
    {
        config(['farmacia.show_expected_cash' => false]);
        $branch = $this->branch();
        $admin = $this->userWithRole('Administrador');
        $session = $this->openCash($admin, $branch);

        $this->actingAs($admin)->get("/admin/cash-registers/{$session->cash_register_id}")
            ->assertInertia(fn ($page) => $page->where('summary.expected', null));
    }

    public function test_the_registers_list_offers_to_see_each_register()
    {
        $this->actingAs($this->userWithRole('Administrador'))->get('/admin/cash-registers')
            ->assertInertia(fn ($page) => $page->where('resource.showRoute', 'admin.cash-registers.show'));
    }

    public function test_the_registers_list_says_if_each_register_is_available_or_who_has_it()
    {
        $branch = $this->branch();
        $cashier = $this->userWithRole('Cajero', $branch);
        $this->openCash($cashier, $branch);
        CashRegister::factory()->create(['branch_id' => $branch->id, 'name' => 'Yeta']);
        CashRegister::factory()->create(['branch_id' => $branch->id, 'name' => 'Zeta', 'is_active' => false]);

        $this->actingAs($this->userWithRole('Administrador'))->get('/admin/cash-registers')
            ->assertInertia(fn ($page) => $page
                ->where('rows.data.0.availability', 'aperturada')
                ->where('rows.data.0.open_session.user.name', $cashier->name)
                ->where('rows.data.1.availability', 'disponible')
                ->where('rows.data.1.open_session', null)
                ->where('rows.data.2.availability', 'desactivada')
                ->where('stats.1.value', 1)
                ->where('stats.2.value', 1));
    }

    public function test_a_register_is_available_again_after_closing_its_session()
    {
        $branch = $this->branch();
        $session = $this->openCash($this->userWithRole('Cajero', $branch), $branch);
        app(CashService::class)->close($session, [$this->denomination(100)->id => 1]);

        $this->actingAs($this->userWithRole('Administrador'))->get('/admin/cash-registers')
            ->assertInertia(fn ($page) => $page->where('rows.data.0.availability', 'disponible')->where('rows.data.0.open_session', null)->where('stats.1.value', 0));
    }

    public function test_the_registers_list_filters_by_branch_and_its_numbers_follow()
    {
        $central = $this->branch();
        $north = $this->branch();
        $this->openCash($this->userWithRole('Cajero', $central), $central);
        $there = CashRegister::factory()->create(['branch_id' => $north->id]);

        $this->actingAs($this->userWithRole('Administrador'))->get("/admin/cash-registers?branch={$north->id}")
            ->assertInertia(fn ($page) => $page
                ->has('rows.data', 1)
                ->where('rows.data.0.id', $there->id)
                ->where('filters.branch', (string) $north->id)
                ->where('stats.0.value', 1)
                ->where('stats.1.value', 0)
                ->where('stats.2.value', 1));

        $this->actingAs($this->userWithRole('Administrador'))->get('/admin/cash-registers')
            ->assertInertia(fn ($page) => $page->has('rows.data', 2)->where('selectFilters.0.name', 'branch')->has('selectFilters.0.options', 2));
    }

    public function test_the_registers_list_filters_by_status()
    {
        $branch = $this->branch();
        $session = $this->openCash($this->userWithRole('Cajero', $branch), $branch);
        $available = CashRegister::factory()->create(['branch_id' => $branch->id]);
        $disabled = CashRegister::factory()->create(['branch_id' => $branch->id, 'is_active' => false]);
        $admin = $this->userWithRole('Administrador');

        foreach (['aperturada' => $session->cash_register_id, 'disponible' => $available->id, 'desactivada' => $disabled->id] as $status => $id) {
            $this->actingAs($admin)->get("/admin/cash-registers?status={$status}")
                ->assertInertia(fn ($page) => $page->has('rows.data', 1)->where('rows.data.0.id', $id));
        }
    }

    public function test_the_branch_filter_is_hidden_with_a_single_branch_and_cannot_reach_others()
    {
        $mine = $this->branch();
        $other = $this->branch();
        CashRegister::factory()->create(['branch_id' => $other->id]);
        $supervisor = $this->userWithRole('Regente', $mine);
        $supervisor->givePermissionTo('caja.editar');

        $this->actingAs($supervisor)->get("/admin/cash-registers?branch={$other->id}")
            ->assertInertia(fn ($page) => $page->has('rows.data', 0)->has('selectFilters', 1)->where('selectFilters.0.name', 'status'));
    }

    public function test_the_registers_list_only_shows_my_branches()
    {
        $mine = $this->branch();
        $own = CashRegister::factory()->create(['branch_id' => $mine->id]);
        CashRegister::factory()->create(['branch_id' => $this->branch()->id]);
        $supervisor = $this->userWithRole('Regente', $mine);
        $supervisor->givePermissionTo('caja.editar');

        $this->actingAs($supervisor)->get('/admin/cash-registers')
            ->assertInertia(fn ($page) => $page->has('rows.data', 1)->where('rows.data.0.id', $own->id)->where('stats.0.value', 1));
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

    public function test_every_page_shares_the_open_cash_for_the_floating_button()
    {
        $branch = $this->branch();
        $cashier = $this->userWithRole('Cajero', $branch);

        // Sin turno abierto: no hay botón
        $this->actingAs($cashier)->get('/dashboard')->assertInertia(fn ($page) => $page->where('cash', null));

        $session = $this->openCash($cashier, $branch, 2);
        $this->cash->addMovement($session, 'retiro', 50, 'A la bóveda');

        $this->actingAs($cashier)->get('/dashboard')->assertInertia(fn ($page) => $page
            ->where('cash.id', $session->id)
            ->where('cash.register', $session->cashRegister->name)
            ->where('cash.show_expected', true)
            ->where('cash.summary.opening', 200)
            ->where('cash.summary.withdrawals', 50)
            ->where('cash.summary.expected', 150));

        // Quien no opera caja nunca lo recibe
        $this->actingAs($this->userWithRole('Almacenero', $branch))->get('/dashboard')->assertInertia(fn ($page) => $page->where('cash', null));
    }

    public function test_the_floating_button_hides_the_expected_cash_when_the_pharmacy_keeps_the_close_blind()
    {
        config(['farmacia.show_expected_cash' => false]);
        $branch = $this->branch();
        $cashier = $this->userWithRole('Cajero', $branch);
        $this->openCash($cashier, $branch);

        $this->actingAs($cashier)->get('/dashboard')->assertInertia(fn ($page) => $page
            ->where('cash.show_expected', false)
            ->where('cash.summary.expected', null)
            ->where('cash.summary.opening', 100));
    }
}
