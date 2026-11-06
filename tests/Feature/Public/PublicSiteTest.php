<?php

namespace Tests\Feature\Public;

use App\Models\Product;
use App\Models\User;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
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

    public function test_no_command_erases_the_demo_database(): void
    {
        $this->assertArrayNotHasKey('demo:reset', Artisan::all());
    }

    public function test_demo_seeder_replaces_default_passwords_in_production_and_keeps_changed_ones(): void
    {
        $this->app['env'] = 'production';
        $changed = User::factory()->create(['password' => 'clave-ya-cambiada']);
        $default = User::factory()->create(['password' => 'password']);

        $this->app->make(DemoSeeder::class)->setContainer($this->app)->run();

        $this->assertTrue(Hash::check('clave-ya-cambiada', $changed->fresh()->password));
        $this->assertFalse(Hash::check('password', $default->fresh()->password));
        $this->assertFalse(Hash::check('password', User::where('email', 'admin@admin.com')->sole()->password));
    }

    public function test_demo_seeder_keeps_default_passwords_outside_production(): void
    {
        $user = User::factory()->create(['password' => 'password']);

        $this->seed(DemoSeeder::class);

        $this->assertTrue(Hash::check('password', $user->fresh()->password));
        $this->assertTrue(User::where('email', config('demo.user_email'))->exists());
    }

    public function test_demo_seeder_runs_again_without_losing_or_duplicating_data(): void
    {
        $this->seed(DemoSeeder::class);
        $users = User::count();
        $products = Product::count();

        $this->seed(DemoSeeder::class);

        $this->assertSame($users, User::count());
        $this->assertSame($products, Product::count());
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
