<?php

namespace Tests\Feature\Admin;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pruebas automáticas del módulo de usuarios y del dashboard.
 * Correr solo estas: php artisan test --filter=UserManagementTest
 */
class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_non_admins_cannot_access_user_management()
    {
        $user = User::factory()->withRole('Operador')->create();

        $this->actingAs($user)->get('/admin/users')->assertForbidden();
    }

    public function test_admins_can_list_and_search_users()
    {
        $admin = User::factory()->withRole('Administrador')->create();
        User::factory()->create(['name' => 'Zacarías Buscado']);

        $this->actingAs($admin)
            ->get('/admin/users?search=Zacar')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('admin/users/index')
                ->has('users.data', 1)
                ->where('users.data.0.name', 'Zacarías Buscado'));
    }

    public function test_admins_can_create_update_toggle_and_delete_users()
    {
        $admin = User::factory()->withRole('Administrador')->create();

        $this->actingAs($admin)->post('/admin/users', [
            'name' => 'Nuevo Editor',
            'email' => 'editor@example.com',
            'role' => 'Supervisor',
            'is_active' => true,
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertSessionHas('success');

        $user = User::where('email', 'editor@example.com')->firstOrFail();
        $this->assertSame('Supervisor', $user->role);

        $this->actingAs($admin)->put("/admin/users/{$user->id}", [
            'name' => 'Editor Renombrado',
            'email' => 'editor@example.com',
            'role' => 'Operador',
            'is_active' => true,
        ])->assertSessionHas('success');
        $this->assertSame('Editor Renombrado', $user->fresh()->name);

        $this->actingAs($admin)->patch("/admin/users/{$user->id}/toggle");
        $this->assertFalse($user->fresh()->is_active);

        $this->actingAs($admin)->delete("/admin/users/{$user->id}");
        // Eliminación lógica: sigue en la base de datos, marcado con deleted_at y quién lo eliminó
        $this->assertSoftDeleted($user);
        $this->assertSame($admin->id, $user->fresh()->deleteUser_id);
    }

    public function test_admins_cannot_delete_or_deactivate_themselves()
    {
        $admin = User::factory()->withRole('Administrador')->create();

        $this->actingAs($admin)->delete("/admin/users/{$admin->id}")->assertSessionHas('error');
        $this->actingAs($admin)->patch("/admin/users/{$admin->id}/toggle")->assertSessionHas('error');

        $this->assertModelExists($admin);
        $this->assertTrue($admin->fresh()->is_active);
    }

    public function test_inactive_users_cannot_log_in()
    {
        $user = User::factory()->create(['is_active' => false]);

        $this->post('/login', ['email' => $user->email, 'password' => 'password'])
            ->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    public function test_dashboard_shows_user_metrics()
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('admin/dashboard')
                ->where('stats.total', 1)
                ->has('monthly', 12)
                ->has('recentUsers', 1));
    }

    public function test_users_are_paginated_on_the_server_with_per_page()
    {
        $admin = User::factory()->withRole('Administrador')->create();
        User::factory(30)->withRole('Operador')->create();

        // Por defecto: 10 por página (de 31 usuarios)
        $this->actingAs($admin)->get('/admin/users')
            ->assertInertia(fn ($page) => $page->has('users.data', 10)->where('users.total', 31)->where('users.last_page', 4));

        // "Mostrar 25 registros"
        $this->actingAs($admin)->get('/admin/users?per_page=25')
            ->assertInertia(fn ($page) => $page->has('users.data', 25)->where('users.per_page', 25));

        // Un valor fuera de la lista (ej: 100000) vuelve a 10: nadie puede pedir todo de golpe
        $this->actingAs($admin)->get('/admin/users?per_page=100000')
            ->assertInertia(fn ($page) => $page->has('users.data', 10));
    }
}
