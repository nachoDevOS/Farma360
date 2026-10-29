<?php

namespace Database\Seeders;

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

        $this->createAdmin();
        $this->createDemoUsers();
    }

    /**
     * Usuario principal: admin@admin.com / password, con rol Super Admin (acceso total).
     * firstOrCreate = lo crea solo si no existe (no se duplica).
     */
    private function createAdmin(): void
    {
        $admin = User::firstOrCreate(['email' => 'admin@admin.com'], [
            'name' => 'Administrador',
            'password' => 'password',
            'email_verified_at' => now(),
            'last_login_at' => now(),
        ]);

        $admin->syncRoles([PermissionCatalog::superAdmin()]);
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
}
