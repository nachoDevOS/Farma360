<?php

namespace Tests\Feature\Public;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class PublicSiteTest extends TestCase
{
    use RefreshDatabase;

    public function test_visitor_sees_the_public_page_without_whatsapp_or_demo_until_configured(): void
    {
        config(['demo.whatsapp' => null, 'demo.phone' => null]);

        $this->get('/')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('public/home')
            ->where('demoEnabled', false)
            ->where('whatsappUrl', null)
            ->where('phone', null));
    }

    public function test_whatsapp_link_uses_the_configured_number(): void
    {
        config(['demo.whatsapp' => '59170000000']);

        $this->get('/')->assertInertia(fn (AssertableInertia $page) => $page
            ->where('whatsappUrl', fn (string $url) => str_starts_with($url, 'https://wa.me/59170000000?text=')));
    }

    public function test_only_configured_testimonials_reach_the_page(): void
    {
        $this->get('/')->assertInertia(fn (AssertableInertia $page) => $page->where('testimonials', []));

        $testimonial = ['quote' => 'Vendemos más rápido.', 'name' => 'Ana', 'pharmacy' => 'Farmacia Sur, Sucre'];
        config(['demo.testimonials' => [$testimonial]]);

        $this->get('/')->assertInertia(fn (AssertableInertia $page) => $page->where('testimonials', [$testimonial]));
    }

    public function test_logged_in_user_goes_to_the_panel(): void
    {
        $this->actingAs(User::factory()->create())->get('/')->assertRedirect('/dashboard');
    }

    public function test_demo_login_does_not_exist_with_demo_mode_off(): void
    {
        User::factory()->create(['email' => config('demo.user_email')]);

        $this->post('/demo')->assertNotFound();
        $this->assertGuest();
    }

    public function test_demo_login_enters_with_the_demo_account(): void
    {
        config(['demo.enabled' => true]);
        $demoUser = User::factory()->create(['email' => config('demo.user_email')]);

        $this->post('/demo')->assertRedirect(route('admin.pos'));
        $this->assertAuthenticatedAs($demoUser);
    }

    public function test_demo_reset_refuses_with_demo_mode_off(): void
    {
        config(['database.connections.'.config('database.default').'.database' => 'sivefarma_demo']);

        $this->artisan('demo:reset')->assertFailed();
    }

    public function test_demo_reset_refuses_a_database_without_demo_in_its_name(): void
    {
        config(['demo.enabled' => true, 'database.connections.'.config('database.default').'.database' => 'farmacia_real']);
        $user = User::factory()->create();

        $this->artisan('demo:reset')->assertFailed();
        $this->assertModelExists($user);
    }

    public function test_demo_account_cannot_change_its_password_or_profile(): void
    {
        $demoUser = User::factory()->create(['email' => config('demo.user_email'), 'name' => 'Cuenta demo']);

        $this->actingAs($demoUser)->patch('/settings/profile', ['name' => 'Otro', 'email' => 'otro@example.com'])->assertSessionHas('info');
        $this->actingAs($demoUser)->put('/settings/password', ['current_password' => 'password', 'password' => 'nueva-clave', 'password_confirmation' => 'nueva-clave'])->assertSessionHas('info');

        $this->assertSame('Cuenta demo', $demoUser->fresh()->name);
    }

    public function test_only_the_demo_account_sees_the_demo_notice(): void
    {
        $this->actingAs(User::factory()->create())->get('/dashboard')
            ->assertInertia(fn (AssertableInertia $page) => $page->where('isDemoAccount', false));
    }
}
