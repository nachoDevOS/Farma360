<?php

namespace Tests\Feature;

use App\Models\Concerns\Auditable;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use LogicException;
use Tests\TestCase;

/**
 * REGLA DEL SISTEMA: nada se borra de la base de datos, todo es eliminación lógica,
 * y cada registro guarda quién lo registró y quién lo eliminó (con su rol).
 * Correr solo estas: php artisan test --filter=SoftDeleteRuleTest
 */
class SoftDeleteRuleTest extends TestCase
{
    use RefreshDatabase;

    /** Tablas internas de Laravel y tablas pivote de Spatie: no guardan datos del negocio. */
    private const EXCLUDED_TABLES = [
        'migrations', 'password_reset_tokens', 'sessions', 'cache', 'cache_locks',
        'jobs', 'job_batches', 'failed_jobs',
        'model_has_roles', 'model_has_permissions', 'role_has_permissions',
    ];

    private const AUDIT_COLUMNS = ['registerUser_id', 'registerRole', 'deleteUser_id', 'deleteRole', 'deleted_at'];

    public function test_every_table_has_the_audit_columns()
    {
        $tables = collect(Schema::getTableListing(schemaQualified: false))
            ->reject(fn (string $table) => in_array($table, self::EXCLUDED_TABLES) || str_starts_with($table, 'sqlite_'));

        foreach ($tables as $table) {
            foreach (self::AUDIT_COLUMNS as $column) {
                $this->assertTrue(Schema::hasColumn($table, $column), "La tabla \"{$table}\" no tiene la columna \"{$column}\". Agrega \$table->auditable() en su migración.");
            }
        }
    }

    public function test_every_model_uses_the_auditable_trait()
    {
        foreach (glob(app_path('Models/*.php')) as $file) {
            $class = 'App\\Models\\'.basename($file, '.php');

            $this->assertContains(Auditable::class, class_uses_recursive($class), "El modelo {$class} no usa el trait Auditable.");
        }
    }

    public function test_creating_saves_who_registered_it()
    {
        $admin = User::factory()->withRole('Administrador')->create();
        $this->actingAs($admin);

        $role = Role::create(['name' => 'Cajero', 'guard_name' => 'web']);

        $this->assertSame($admin->id, $role->fresh()->registerUser_id);
        $this->assertSame('Administrador', $role->fresh()->registerRole);
    }

    public function test_deleting_is_logical_and_saves_who_deleted_it()
    {
        $admin = User::factory()->withRole('Administrador')->create();
        $user = User::factory()->create();
        $this->actingAs($admin);

        $user->delete();

        $this->assertSoftDeleted($user);
        $this->assertDatabaseHas('users', ['id' => $user->id, 'deleteUser_id' => $admin->id, 'deleteRole' => 'Administrador']);
        $this->assertNull(User::find($user->id));
        $this->assertNotNull(User::withTrashed()->find($user->id));
    }

    public function test_restoring_clears_who_deleted_it()
    {
        $admin = User::factory()->withRole('Administrador')->create();
        $user = User::factory()->create();
        $this->actingAs($admin);

        $user->delete();
        $user->restore();

        $this->assertNotSoftDeleted($user);
        $this->assertDatabaseHas('users', ['id' => $user->id, 'deleteUser_id' => null, 'deleteRole' => null]);
    }

    public function test_force_delete_is_forbidden()
    {
        $role = Role::create(['name' => 'Temporal', 'guard_name' => 'web']);

        $this->expectException(LogicException::class);

        try {
            $role->forceDelete();
        } finally {
            $this->assertDatabaseHas('roles', ['id' => $role->id]);
        }
    }

    public function test_a_deleted_user_cannot_log_in()
    {
        $user = User::factory()->create();
        $user->delete();

        $this->post('/login', ['email' => $user->email, 'password' => 'password']);

        $this->assertGuest();
    }

    public function test_a_deleted_role_is_not_recreated_by_permissions_sync()
    {
        Role::findByName('Operador')->delete();

        $this->artisan('permissions:sync')->assertSuccessful();

        $this->assertSame(1, Role::withTrashed()->where('name', 'Operador')->count());
        $this->assertSoftDeleted('roles', ['name' => 'Operador']);
    }
}
