<?php

namespace App\Console\Commands;

use App\Models\Permission;
use App\Models\Role;
use App\Support\PermissionCatalog;
use Illuminate\Console\Command;
use Spatie\Permission\PermissionRegistrar;

/**
 * php artisan permissions:sync
 *
 * Copia el catálogo de config/roles.php a la base de datos:
 *   1. Crea los permisos que falten (ej: "ventas.ver" si agregaste el módulo ventas).
 *   2. Elimina (lógicamente) los permisos que ya no están en el catálogo, y restaura los que vuelven.
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

        // 1. Crear los que falten. Si uno se había eliminado (lógicamente) y volvió al catálogo, se restaura.
        foreach ($names as $name) {
            Permission::onlyTrashed()->where(['name' => $name, 'guard_name' => 'web'])->first()?->restore();
            Permission::findOrCreate($name, 'web');
        }

        // 2. Eliminar (lógicamente) los que sobran (módulos o acciones que se quitaron del catálogo)
        $removed = Permission::whereNotIn('name', $names)->get();
        $removed->each->delete();

        // 3. Roles iniciales
        Role::onlyTrashed()->where(['name' => PermissionCatalog::superAdmin(), 'guard_name' => 'web'])->first()?->restore();
        Role::findOrCreate(PermissionCatalog::superAdmin(), 'web');

        foreach (config('roles.defaults') as $roleName => $permissions) {
            // withTrashed: si un rol inicial se eliminó desde el panel, no se vuelve a crear
            if (Role::withTrashed()->where('name', $roleName)->exists()) {
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
