<?php

namespace Tests\Feature\Pharmacy;

use App\Exceptions\BusinessException;
use App\Models\BatchPromotion;
use App\Models\ExpiryPromotionRule;
use App\Models\ProductPresentation;
use App\Services\PromotionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * PROMOCIONES POR VENCIMIENTO (reglas iniciales: 90 días → 10%, 60 → 20%, 30 → 30%).
 */
class PromotionTest extends TestCase
{
    use PharmacyHelpers, RefreshDatabase;

    private PromotionService $promotions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->promotions = app(PromotionService::class);
    }

    public function test_the_tightest_rule_applies()
    {
        $this->assertSame(30.0, $this->promotions->suggestedDiscount(10));
        $this->assertSame(30.0, $this->promotions->suggestedDiscount(30));
        $this->assertSame(20.0, $this->promotions->suggestedDiscount(45));
        $this->assertSame(10.0, $this->promotions->suggestedDiscount(90));
        $this->assertNull($this->promotions->suggestedDiscount(91));
        $this->assertNull($this->promotions->suggestedDiscount(-1));
    }

    public function test_candidates_are_batches_with_stock_close_to_expiry()
    {
        $branch = $this->branch();
        $product = $this->product();
        $soon = $this->batch($product, $branch, 10, '+45 days');
        $this->batch($product, $branch, 10, '+200 days'); // lejos
        $this->batch($product, $branch, 0, '+20 days');   // sin stock
        $this->batch($product, $branch, 10, '-2 days');   // vencido

        $candidates = $this->promotions->candidates();

        $this->assertSame([$soon->id], $candidates->pluck('id')->all());
        $this->assertSame(20.0, $candidates->first()->suggested_discount);
    }

    public function test_an_automatic_promotion_is_raised_when_the_batch_gets_closer_to_expiry()
    {
        $admin = $this->userWithRole('Administrador');
        $batch = $this->batch($this->product(), $this->branch(), 10, '+25 days');
        $this->promotions->apply($batch, 10, $admin, 'regla');

        $this->assertSame(1, $this->promotions->candidates()->count());

        $this->assertSame(1, $this->promotions->applySuggested($admin));
        $this->assertEquals(30, $batch->fresh()->activePromotion->discount_percent);
        // La anterior queda como historial (inactiva), no se borra
        $this->assertSame(2, BatchPromotion::where('batch_id', $batch->id)->count());
    }

    public function test_selling_below_cost_needs_the_approve_permission()
    {
        // Precio 1.00, costo 0.80: con 30% quedaría en 0.70 < 0.80
        $branch = $this->branch();
        $batch = $this->batch($this->product(1.0), $branch, 10, '+20 days', 0.8);
        $regente = $this->userWithRole('Regente', $branch);

        $this->actingAs($regente)->post('/admin/promotions/apply', ['batch_id' => $batch->id, 'discount_percent' => 30])->assertSessionHas('error');
        $this->assertNull($batch->fresh()->activePromotion);

        // applySuggested se salta los que quedarían bajo el costo
        $this->assertSame(0, $this->promotions->applySuggested($regente));

        $admin = $this->userWithRole('Administrador');
        $this->actingAs($admin)->post('/admin/promotions/apply', ['batch_id' => $batch->id, 'discount_percent' => 30])->assertSessionHas('success');
        $this->assertTrue($batch->fresh()->activePromotion->below_cost);
    }

    public function test_a_promotion_covers_the_whole_batch_by_default_or_only_the_chosen_presentation()
    {
        $admin = $this->userWithRole('Administrador');
        $product = $this->product(1.0);
        $batch = $this->batch($product, $this->branch(), 500, '+20 days');
        $unit = $this->presentation($product);
        $box = $this->presentation($product, 100);

        $this->actingAs($admin)->post('/admin/promotions/apply', ['batch_id' => $batch->id, 'discount_percent' => 10])->assertSessionHas('success');
        $wholeBatch = $batch->fresh()->activePromotion;
        $this->assertCount(0, $wholeBatch->presentations);
        $this->assertSame(10.0, $wholeBatch->discountFor($unit));
        $this->assertSame(10.0, $wholeBatch->discountFor($box));

        $this->actingAs($admin)->post('/admin/promotions/apply', [
            'batch_id' => $batch->id,
            'presentation_discounts' => [$box->id => 15],
        ])->assertSessionHas('success');
        $onlyBox = $batch->fresh()->activePromotion;
        $this->assertSame(0.0, $onlyBox->discountFor($unit));
        $this->assertSame(15.0, $onlyBox->discountFor($box));
    }

    public function test_each_chosen_presentation_gets_its_own_percent_and_the_rest_stay_out()
    {
        $admin = $this->userWithRole('Administrador');
        $product = $this->product(1.0);
        $unit = $this->presentation($product);
        $blister = $product->presentations()->create([
            ...ProductPresentation::arrange($unit, 10, 'Blíster', $product->base_unit),
            'parent_id' => $unit->id,
            'sale_price' => 9.5,
        ]);
        $box = $this->presentation($product, 100);
        $batch = $this->batch($product, $this->branch(), 500, '+20 days');

        $this->actingAs($admin)->post('/admin/promotions/apply', [
            'batch_id' => $batch->id,
            'presentation_discounts' => [$blister->id => 10, $box->id => 20],
        ])->assertSessionHas('success');

        $promotion = $batch->fresh()->activePromotion;
        $this->assertSame(10.0, $promotion->discountFor($blister));
        $this->assertSame(20.0, $promotion->discountFor($box));
        $this->assertSame(0.0, $promotion->discountFor($unit));
        // El más alto queda como descuento de la promoción
        $this->assertEquals(20, $promotion->discount_percent);
    }

    public function test_a_promotion_cannot_target_a_presentation_of_another_product()
    {
        $batch = $this->batch($this->product(), $this->branch(), 10, '+20 days');

        $this->actingAs($this->userWithRole('Administrador'))->post('/admin/promotions/apply', [
            'batch_id' => $batch->id,
            'presentation_discounts' => [$this->presentation($this->product())->id => 10],
        ])->assertSessionHas('error');

        $this->assertNull($batch->fresh()->activePromotion);
    }

    public function test_below_cost_looks_only_at_the_chosen_presentation()
    {
        // Unidad 1.00 y caja x100 a 90.00, costo 0.85: con 10% la unidad queda en 0.90 y la caja en 0.81 c/u
        $branch = $this->branch();
        $product = $this->product(1.0);
        $batch = $this->batch($product, $branch, 500, '+20 days', 0.85);
        $regente = $this->userWithRole('Regente', $branch);
        $apply = fn (array $discount) => $this->actingAs($regente)->post('/admin/promotions/apply', ['batch_id' => $batch->id] + $discount);

        $apply(['presentation_discounts' => [$this->presentation($product, 100)->id => 10]])->assertSessionHas('error');
        $apply(['discount_percent' => 10])->assertSessionHas('error');
        $this->assertNull($batch->fresh()->activePromotion);

        $apply(['presentation_discounts' => [$this->presentation($product)->id => 10]])->assertSessionHas('success');
        $this->assertFalse($batch->fresh()->activePromotion->below_cost);
    }

    public function test_a_chosen_presentation_needs_a_valid_percent()
    {
        $admin = $this->userWithRole('Administrador');
        $product = $this->product();
        $batch = $this->batch($product, $this->branch(), 10, '+20 days');
        $box = $this->presentation($product, 100);

        $this->actingAs($admin)->post('/admin/promotions/apply', ['batch_id' => $batch->id, 'presentation_discounts' => [$box->id => 0]])
            ->assertSessionHasErrors("presentation_discounts.{$box->id}");
        $this->actingAs($admin)->post('/admin/promotions/apply', ['batch_id' => $batch->id])->assertSessionHasErrors('discount_percent');

        $this->assertNull($batch->fresh()->activePromotion);
    }

    public function test_expired_batches_cannot_get_a_promotion()
    {
        $batch = $this->batch($this->product(), $this->branch(), 10, '-1 day');

        $this->expectException(BusinessException::class);
        $this->promotions->apply($batch, 10, $this->userWithRole('Administrador'));
    }

    public function test_a_promotion_can_be_removed()
    {
        $admin = $this->userWithRole('Administrador');
        $batch = $this->batch($this->product(), $this->branch(), 10, '+20 days');
        $this->promotions->apply($batch, 15, $admin);

        $this->actingAs($admin)->delete("/admin/promotions/{$batch->id}")->assertSessionHas('success');

        $this->assertNull($batch->fresh()->activePromotion);
    }

    public function test_rules_can_be_edited()
    {
        $admin = $this->userWithRole('Administrador');

        $this->actingAs($admin)->put('/admin/promotions/rules', ['rules' => [
            ['days_before' => 120, 'discount_percent' => 5],
            ['days_before' => 30, 'discount_percent' => 40],
        ]])->assertSessionHas('success');

        $this->assertSame([120, 30], ExpiryPromotionRule::orderByDesc('days_before')->pluck('days_before')->all());
        $this->assertSame(40.0, $this->promotions->suggestedDiscount(15));
        // Las reglas quitadas quedan eliminadas lógicamente
        $this->assertSoftDeleted('expiry_promotion_rules', ['days_before' => 90]);

        // Volver a agregar una regla quitada la recupera
        $this->actingAs($admin)->put('/admin/promotions/rules', ['rules' => [['days_before' => 90, 'discount_percent' => 12]]])->assertSessionHas('success');
        $this->assertSame(12.0, $this->promotions->suggestedDiscount(80));
    }

    public function test_promotions_screen_renders()
    {
        $this->batch($this->product(), $this->branch(), 10, '+20 days');

        $this->actingAs($this->userWithRole('Administrador'))->get('/admin/promotions')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('admin/promotions/index')->has('candidates.data', 1)->where('candidates.total', 1)->has('rules', 3));
    }

    public function test_the_active_list_says_which_presentation_has_the_discount()
    {
        $admin = $this->userWithRole('Administrador');
        $product = $this->product();
        $box = $this->presentation($product, 100);
        $this->promotions->apply($this->batch($product, $this->branch(), 500, '+20 days'), 10, $admin, 'manual', [$box->id => 10]);

        $this->actingAs($admin)->get('/admin/promotions')
            ->assertInertia(fn ($page) => $page
                ->where('active.data.0.presentation_discounts.0.name', $box->name)
                ->where('active.data.0.presentation_discounts.0.pivot.discount_percent', fn ($percent) => (float) $percent === 10.0)
                ->has('active.data.0.presentations', 2));
    }

    public function test_promotion_lists_are_paginated_on_the_server_with_separate_pages()
    {
        $admin = $this->userWithRole('Administrador');
        $product = $this->product();
        $branch = $this->branch();
        foreach (range(1, 12) as $n) {
            $this->batch($product, $branch, 10, "+{$n} days", 0.5, "C-{$n}");
        }
        foreach (range(1, 11) as $n) {
            $this->promotions->apply($this->batch($product, $branch, 10, '+1 year', 0.5, "A-{$n}"), 5, $admin);
        }

        $this->actingAs($admin)->get('/admin/promotions?per_page=10&candidates_page=2')
            ->assertInertia(fn ($page) => $page
                ->where('candidates.total', 12)
                ->has('candidates.data', 2)
                ->where('active.total', 11)
                ->has('active.data', 10)
                ->where('active.current_page', 1));

        $this->actingAs($admin)->get('/admin/promotions?per_page=10&active_page=2')
            ->assertInertia(fn ($page) => $page->has('candidates.data', 10)->has('active.data', 1));
    }
}
