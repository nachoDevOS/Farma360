<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA role_has_permissions — Permisos de cada rol
 *
 * Qué permisos tiene cada rol (lo que se marca en Roles y permisos). Tabla pivote de spatie/laravel-permission.
 * Al terminar carga el catálogo de config/roles.php (permisos, Super Admin y roles iniciales) con permissions:sync,
 * así el sistema funciona apenas se migra.
 *
 * Columnas:
 *   permission_id  BIGINT UNSIGNED, FK permissions  Permiso.
 *   role_id        BIGINT UNSIGNED, FK roles        Rol que lo tiene.
 */
return new class extends Migration
{
    public function up(): void
    {
        $tableNames = config('permission.table_names');
        $columnNames = config('permission.column_names');
        throw_if(empty($tableNames), 'Error: config/permission.php not loaded. Run [php artisan config:clear] and try again.');
        $pivotRole = $columnNames['role_pivot_key'] ?? 'role_id';
        $pivotPermission = $columnNames['permission_pivot_key'] ?? 'permission_id';

        Schema::create($tableNames['role_has_permissions'], static function (Blueprint $table) use ($tableNames, $pivotRole, $pivotPermission) {
            $table->unsignedBigInteger($pivotPermission);
            $table->unsignedBigInteger($pivotRole);

            $table->foreign($pivotPermission)->references('id')->on($tableNames['permissions'])->cascadeOnDelete();
            $table->foreign($pivotRole)->references('id')->on($tableNames['roles'])->cascadeOnDelete();

            $table->primary([$pivotPermission, $pivotRole], 'role_has_permissions_permission_id_role_id_primary');
        });

        // Olvida los permisos guardados en caché y carga el catálogo de config/roles.php
        app('cache')
            ->store(config('permission.cache.store') != 'default' ? config('permission.cache.store') : null)
            ->forget(config('permission.cache.key'));
        Artisan::call('permissions:sync');
    }

    public function down(): void
    {
        $tableNames = config('permission.table_names');
        throw_if(empty($tableNames), 'Error: config/permission.php not found and defaults could not be merged.');

        Schema::dropIfExists($tableNames['role_has_permissions']);
    }
};
