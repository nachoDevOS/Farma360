<?php

namespace Database\Seeders;

use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\Denomination;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\CashService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class DemoSeeder extends Seeder
{
    /**
     * Datos de ejemplo más la cuenta de demostración: ve casi todo y tiene su caja abierta para vender.
     * Sin permisos de usuarios, roles ni sucursales, para que un visitante no le dañe la demo a los demás.
     * Se puede correr varias veces: no borra nada, no duplica y respeta las contraseñas ya cambiadas.
     */
    public function run(): void
    {
        $this->call(DatabaseSeeder::class);

        $permissions = Permission::all()->reject(fn (Permission $permission) => str($permission->name)->startsWith(['usuarios.', 'roles.', 'sucursales.']));
        $role = Role::firstOrCreate(['name' => 'Demostración', 'guard_name' => 'web']);
        $role->syncPermissions($permissions);

        $register = CashRegister::where('name', 'Caja 2')->firstOrFail();
        $user = User::firstOrCreate(['email' => config('demo.user_email')], [
            'name' => 'Cuenta demo',
            'password' => str()->random(40),
            'email_verified_at' => now(),
            'branch_id' => $register->branch_id,
        ]);
        $user->syncRoles([$role]);

        $this->openDemoCash($register, $user);

        // En local se conserva 'password': sin esto el desarrollador perdería el acceso a sus usuarios de prueba
        if (app()->isProduction()) {
            $this->replaceDefaultPasswords();
        }
    }

    /** La caja de la demo queda abierta para vender, salvo que ya tenga un turno en curso. */
    private function openDemoCash(CashRegister $register, User $user): void
    {
        if (CashSession::where('cash_register_id', $register->id)->where('status', CashSession::OPEN)->exists()) {
            return;
        }

        Auth::setUser($user);
        app(CashService::class)->open($register, $user, [Denomination::where('value', 100)->value('id') => 2]);
        Auth::logout();
    }

    /**
     * La demo es pública: nadie debe entrar con la contraseña 'password' de los datos de ejemplo.
     * La nueva clave del administrador se muestra solo aquí, una vez.
     */
    private function replaceDefaultPasswords(): void
    {
        User::query()->each(function (User $user) {
            if (! Hash::check('password', $user->password)) {
                return;
            }

            $password = str()->random(32);
            $user->update(['password' => $password]);

            if ($user->email === 'admin@admin.com') {
                $this->command?->warn("Clave de {$user->email}, guárdala ahora: {$password}");
            }
        });
    }
}
