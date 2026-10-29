<?php

namespace App\Console\Commands;

use App\Support\PermissionCatalog;
use Illuminate\Console\Command;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * php artisan permissions:sync
 *
 * Copia el catálogo de config/roles.php a la base de datos:
 *   1. Crea los permisos que falten (ej: "ventas.ver" si agregaste el módulo ventas).
 *   2. Borra los permisos que ya no están en el catálogo.
 *   3. Crea el rol Super Admin y los roles de 'defaults' SOLO si todavía no existen
 *      (si ya existen no los toca: lo que se configuró desde el panel se respeta).
 *
 * Es seguro correrlo las veces que haga falta. Lo usan también la migración y el seeder.
 */
class SyncPermissions extends Command
{
    protected $signature = 'permissions:sync';

    protected $description = 'Sincroniza los permisos de config/roles.php con la base de datos';

    public function handle(): int
    {
        // Spatie guarda los permisos en caché: la limpiamos antes y después para no leer datos viejos
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $names = PermissionCatalog::all();

        // 1. Crear los que falten
        foreach ($names as $name) {
            Permission::findOrCreate($name, 'web');
        }

        // 2. Borrar los que sobran (módulos o acciones que se quitaron del catálogo)
        $removed = Permission::whereNotIn('name', $names)->get();
        $removed->each->delete();

        // 3. Roles iniciales
        Role::findOrCreate(PermissionCatalog::superAdmin(), 'web');

        foreach (config('roles.defaults') as $roleName => $permissions) {
            if (Role::where('name', $roleName)->exists()) {
                continue;
            }

            Role::create(['name' => $roleName, 'guard_name' => 'web'])
                ->syncPermissions($permissions === ['*'] ? $names : $permissions);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $this->info(count($names).' permisos sincronizados'.($removed->isNotEmpty() ? ", {$removed->count()} eliminados" : '').'.');

        return self::SUCCESS;
    }
}
