<?php

namespace Tests\Feature\Admin;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pruebas de: auditoría, exportación CSV, permisos (Policy), validación en español y páginas de error.
 * Correr solo estas: php artisan test --filter=ProfessionalFeaturesTest
 */
class ProfessionalFeaturesTest extends TestCase
{
    use RefreshDatabase;

    public function test_successful_and_failed_logins_are_audited()
    {
        $user = User::factory()->create();

        $this->post('/login', ['email' => $user->email, 'password' => 'wrong-password']);
        $this->assertDatabaseHas('activity_logs', ['action' => 'auth.failed']);

        $this->post('/login', ['email' => $user->email, 'password' => 'password']);
        $this->assertDatabaseHas('activity_logs', ['action' => 'auth.login', 'user_id' => $user->id]);
    }

    public function test_user_management_actions_are_audited()
    {
        $admin = User::factory()->withRole('Administrador')->create();

        $this->actingAs($admin)->post('/admin/users', [
            'name' => 'Ana Pérez',
            'email' => 'ana@example.com',
            'role' => 'Operador',
            'is_active' => true,
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);
        $ana = User::where('email', 'ana@example.com')->firstOrFail();

        $this->actingAs($admin)->patch("/admin/users/{$ana->id}/toggle");
        $this->actingAs($admin)->delete("/admin/users/{$ana->id}");

        foreach (['user.created', 'user.deactivated', 'user.deleted'] as $action) {
            $this->assertDatabaseHas('activity_logs', ['action' => $action, 'user_id' => $admin->id]);
        }
    }

    public function test_only_roles_with_permission_can_see_the_audit_page()
    {
        $admin = User::factory()->withRole('Administrador')->create();
        $editor = User::factory()->withRole('Operador')->create();
        ActivityLog::record('auth.login', 'Inició sesión', causer: $editor);

        // El Operador no tiene "auditoria.ver"
        $this->actingAs($editor)->get('/admin/activity')->assertForbidden();

        $this->actingAs($admin)
            ->get('/admin/activity?group=auth')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('admin/activity/index')
                ->has('logs.data', 1)
                ->where('logs.data.0.causer.name', $editor->name));
    }

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
