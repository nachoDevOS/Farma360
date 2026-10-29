<?php

namespace Tests\Feature\Admin;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Pruebas de ROLES Y PERMISOS (spatie/laravel-permission + config/roles.php).
 * Los roles iniciales (Super Admin, Administrador, Supervisor, Operador) los crea la migración.
 */
class RolesAndPermissionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_each_route_requires_its_permission()
    {
        $operator = User::factory()->withRole('Operador')->create();

        $this->actingAs($operator)->get('/admin/users')->assertForbidden();
        $this->actingAs($operator)->get('/admin/roles')->assertForbidden();
        $this->actingAs($operator)->get('/admin/activity')->assertForbidden();
        // El dashboard y los ajustes propios los ve cualquiera
        $this->actingAs($operator)->get('/dashboard')->assertOk();
    }

    public function test_a_role_only_gets_what_it_has_marked()
    {
        // Supervisor: puede ver usuarios, pero no crear ni eliminar
        $supervisor = User::factory()->withRole('Supervisor')->create();
        $other = User::factory()->withRole('Operador')->create();

        $this->actingAs($supervisor)->get('/admin/users')->assertOk();
        $this->actingAs($supervisor)->post('/admin/users', [])->assertForbidden();
        $this->actingAs($supervisor)->delete("/admin/users/{$other->id}")->assertForbidden();
    }

    public function test_super_admin_has_every_permission_without_marking_them()
    {
        $super = User::factory()->withRole('Super Admin')->create();

        $this->assertTrue($super->can('usuarios.eliminar'));
        $this->assertTrue($super->can('roles.editar'));
        $this->actingAs($super)->get('/admin/roles')->assertOk();
    }

    public function test_shared_props_send_the_user_permissions_to_react()
    {
        $supervisor = User::factory()->withRole('Supervisor')->create();

        $this->actingAs($supervisor)
            ->get('/dashboard')
            ->assertInertia(fn ($page) => $page
                ->where('auth.user.role', 'Supervisor')
                ->where('auth.permissions', fn ($permissions) => collect($permissions)->sort()->values()->all() === ['auditoria.ver', 'usuarios.ver']));
    }

    public function test_roles_can_be_created_with_permissions()
    {
        $admin = User::factory()->withRole('Administrador')->create();

        $this->actingAs($admin)
            ->post('/admin/roles', ['name' => 'Cajero', 'permissions' => ['usuarios.ver']])
            ->assertRedirect('/admin/roles');

        $role = Role::findByName('Cajero');
        $this->assertTrue($role->hasPermissionTo('usuarios.ver'));
        $this->assertFalse($role->hasPermissionTo('usuarios.crear'));
        $this->assertDatabaseHas('activity_logs', ['action' => 'role.created']);
    }

    public function test_role_screens_render_with_the_permission_catalog()
    {
        $admin = User::factory()->withRole('Administrador')->create();
        $role = Role::findByName('Supervisor');

        $this->actingAs($admin)->get('/admin/roles')
            ->assertInertia(fn ($page) => $page->component('admin/roles/index')->has('roles', 4));

        $this->actingAs($admin)->get('/admin/roles/create')
            ->assertInertia(fn ($page) => $page->component('admin/roles/form')->where('role', null)->has('catalog.modules', 3));

        $this->actingAs($admin)->get("/admin/roles/{$role->id}/edit")
            ->assertInertia(fn ($page) => $page->component('admin/roles/form')->where('role.name', 'Supervisor')->has('role.permissions', 2));
    }

    public function test_permissions_outside_the_catalog_are_rejected()
    {
        $admin = User::factory()->withRole('Administrador')->create();

        $this->actingAs($admin)
            ->post('/admin/roles', ['name' => 'Raro', 'permissions' => ['inventado.ver']])
            ->assertSessionHasErrors('permissions.0');
    }

    public function test_role_permissions_can_be_changed_and_are_audited()
    {
        $admin = User::factory()->withRole('Administrador')->create();
        $role = Role::findByName('Supervisor');

        $this->actingAs($admin)
            ->put("/admin/roles/{$role->id}", ['name' => 'Supervisor', 'permissions' => ['usuarios.ver', 'usuarios.crear']])
            ->assertRedirect('/admin/roles');

        $this->assertTrue($role->fresh()->hasPermissionTo('usuarios.crear'));
        $this->assertFalse($role->fresh()->hasPermissionTo('auditoria.ver'));

        $log = ActivityLog::where('action', 'role.updated')->first();
        $this->assertEquals(['usuarios.crear'], $log->properties['added']);
    }

    public function test_super_admin_role_cannot_be_edited_or_deleted()
    {
        $super = User::factory()->withRole('Super Admin')->create();
        $role = Role::findByName('Super Admin');

        $this->actingAs($super)->get("/admin/roles/{$role->id}/edit")->assertRedirect('/admin/roles');
        $this->actingAs($super)->delete("/admin/roles/{$role->id}");
        $this->assertNotNull(Role::where('name', 'Super Admin')->first());

        // Tampoco se puede crear otro rol con ese nombre
        $this->actingAs($super)->post('/admin/roles', ['name' => 'Super Admin'])->assertSessionHasErrors('name');
    }

    public function test_a_role_with_users_cannot_be_deleted()
    {
        $admin = User::factory()->withRole('Administrador')->create();
        User::factory()->withRole('Operador')->create();
        $role = Role::findByName('Operador');

        $this->actingAs($admin)->delete("/admin/roles/{$role->id}")->assertSessionHas('error');
        $this->assertNotNull($role->fresh());

        $empty = Role::create(['name' => 'Temporal', 'guard_name' => 'web']);
        $this->actingAs($admin)->delete("/admin/roles/{$empty->id}")->assertSessionHas('success');
        $this->assertNull($empty->fresh());
    }

    public function test_only_a_super_admin_can_touch_another_super_admin()
    {
        $admin = User::factory()->withRole('Administrador')->create();
        $super = User::factory()->withRole('Super Admin')->create();

        // Un Administrador no puede eliminar ni dar el rol Super Admin
        $this->actingAs($admin)->delete("/admin/users/{$super->id}")->assertSessionHas('error');
        $this->assertNotNull($super->fresh());

        $this->actingAs($admin)
            ->post('/admin/users', [
                'name' => 'Nuevo', 'email' => 'nuevo@test.com', 'role' => 'Super Admin',
                'is_active' => true, 'password' => 'password123', 'password_confirmation' => 'password123',
            ])
            ->assertSessionHasErrors('role');
    }

    public function test_super_admin_cannot_delete_themselves()
    {
        $super = User::factory()->withRole('Super Admin')->create();

        $this->actingAs($super)->delete("/admin/users/{$super->id}")->assertSessionHas('error');
        $this->assertNotNull($super->fresh());
    }

    public function test_new_registrations_get_the_default_role()
    {
        $this->post('/register', [
            'name' => 'Persona', 'email' => 'persona@test.com',
            'password' => 'password123', 'password_confirmation' => 'password123',
        ]);

        $this->assertSame('Operador', User::where('email', 'persona@test.com')->first()->role);
    }

    public function test_permissions_sync_command_adds_new_modules()
    {
        config()->set('roles.modules.ventas', ['label' => 'Ventas', 'actions' => ['ver']]);

        $this->artisan('permissions:sync')->assertSuccessful();

        $this->assertDatabaseHas('permissions', ['name' => 'ventas.ver']);
    }
}
