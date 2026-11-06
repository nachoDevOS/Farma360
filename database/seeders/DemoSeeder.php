<?php

namespace Database\Seeders;

use App\Models\CashRegister;
use App\Models\Denomination;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\CashService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Auth;

class DemoSeeder extends Seeder
{
    /**
     * Datos de ejemplo más la cuenta de demostración: ve casi todo y tiene su caja abierta para vender.
     * Sin permisos de usuarios, roles ni sucursales, para que un visitante no le dañe la demo a los demás.
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

        Auth::setUser($user);
        app(CashService::class)->open($register, $user, [Denomination::where('value', 100)->value('id') => 2]);
        Auth::logout();
    }
}
