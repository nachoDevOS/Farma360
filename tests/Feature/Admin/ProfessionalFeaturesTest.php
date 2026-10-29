<?php

namespace Tests\Feature\Admin;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pruebas de: permisos (Policy), validación en español y páginas de error.
 * Correr solo estas: php artisan test --filter=ProfessionalFeaturesTest
 */
class ProfessionalFeaturesTest extends TestCase
{
    use RefreshDatabase;

    public function test_users_cannot_change_their_own_role()
    {
        $admin = User::factory()->withRole('Administrador')->create();

        $this->actingAs($admin)
            ->put("/admin/users/{$admin->id}", [
                'name' => $admin->name,
                'email' => $admin->email,
                'role' => 'Operador',
                'is_active' => true,
            ])
            ->assertSessionHasErrors('role');

        $this->assertSame('Administrador', $admin->fresh()->role);
    }

    public function test_validation_messages_are_in_spanish()
    {
        $admin = User::factory()->withRole('Administrador')->create();

        $this->actingAs($admin)
            ->post('/admin/users', ['name' => '', 'email' => 'no-es-correo', 'role' => 'Operador'])
            ->assertSessionHasErrors([
                'name' => 'El campo nombre es obligatorio.',
            ]);
    }

    public function test_missing_pages_show_the_styled_error_page()
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get('/esta-pagina-no-existe')
            ->assertNotFound()
            ->assertInertia(fn ($page) => $page->component('error')->where('status', 404));
    }
}
