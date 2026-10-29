<?php

namespace Database\Seeders;

use App\Models\ActivityLog;
use App\Models\User;
use App\Support\PermissionCatalog;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;

class DatabaseSeeder extends Seeder
{
    /**
     * Llena la base con datos iniciales: php artisan db:seed  (o migrate --seed)
     * Se puede correr varias veces: no duplica nada.
     */
    public function run(): void
    {
        // Permisos y roles iniciales (config/roles.php)
        Artisan::call('permissions:sync');

        $admin = $this->createAdmin();
        $this->createDemoUsers();
        $this->createDemoActivity($admin);
    }

    /**
     * Usuario principal: admin@admin.com / password, con rol Super Admin (acceso total).
     * firstOrCreate = lo crea solo si no existe (no se duplica).
     */
    private function createAdmin(): User
    {
        $admin = User::firstOrCreate(['email' => 'admin@admin.com'], [
            'name' => 'Administrador',
            'password' => 'password',
            'email_verified_at' => now(),
            'last_login_at' => now(),
        ]);

        $admin->syncRoles([PermissionCatalog::superAdmin()]);

        return $admin;
    }

    /**
     * 48 usuarios de prueba repartidos en los últimos 12 meses, para que el dashboard tenga datos.
     */
    private function createDemoUsers(): void
    {
        // Si ya hay más usuarios, no volvemos a crear los de prueba
        if (User::count() > 1) {
            return;
        }

        User::factory(48)->create()->each(function (User $user) {
            $createdAt = now()->subDays(random_int(0, 360))->subMinutes(random_int(0, 1440));

            // Mayoría Operadores, algunos Supervisores y pocos Administradores
            $user->assignRole(fake()->randomElement(['Operador', 'Operador', 'Operador', 'Supervisor', 'Administrador']));

            $user->forceFill([
                'is_active' => fake()->boolean(85),
                'email_verified_at' => fake()->boolean(75) ? $createdAt : null,
                'last_login_at' => fake()->boolean(70) ? fake()->dateTimeBetween($createdAt, 'now') : null,
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ])->save();
        });
    }

    /**
     * Historial de ejemplo para la pantalla de Auditoría (registros, accesos y acciones del admin).
     */
    private function createDemoActivity(User $admin): void
    {
        // Si ya hay historial, no lo duplicamos
        if (ActivityLog::exists()) {
            return;
        }

        $log = fn (string $action, string $description, ?User $causer, $at, ?User $subject = null) => ActivityLog::create([
            'user_id' => $causer?->id,
            'action' => $action,
            'description' => $description,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject?->id,
            'ip_address' => fake()->ipv4(),
            'user_agent' => fake()->userAgent(),
        ])->forceFill(['created_at' => $at])->save();

        User::where('id', '!=', $admin->id)->get()->each(function (User $user) use ($log, $admin) {
            $log('auth.registered', 'Se registró en el sistema', $user, $user->created_at, $user);

            if ($user->last_login_at) {
                $log('auth.login', 'Inició sesión', $user, $user->last_login_at);
            }

            if (! $user->is_active) {
                $log('user.deactivated', "Desactivó la cuenta de {$user->name}", $admin, $user->created_at->copy()->addDays(2), $user);
            }

            if ($user->role !== 'Operador') {
                $log('user.updated', "Editó al usuario {$user->name}", $admin, $user->created_at->copy()->addDay(), $user);
            }
        });

        foreach (range(1, 4) as $i) {
            $log('auth.failed', 'Intento de inicio de sesión fallido ('.fake()->safeEmail().')', null, now()->subHours($i * 7));
        }
    }
}
