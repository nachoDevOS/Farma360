<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA permissions — Permisos
 *
 * Cada acción que se puede permitir o negar (ej: ventas.crear, productos.editar). Los carga el comando permissions:sync
 * desde config/roles.php. Paquete spatie/laravel-permission (nombre de tabla en config/permission.php).
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK        Identificador (autoincremental).
 *   name                     VARCHAR(255)               Clave del permiso: "modulo.accion" (ej: productos.ver).
 *   guard_name               VARCHAR(255)               Guardia de Laravel (siempre "web").
 *   created_at / updated_at  TIMESTAMP                  Fecha de registro y de la última modificación.
 *   registerUser_id          BIGINT UNSIGNED, FK users  Quién registró el registro (opcional).
 *   registerRole             VARCHAR(255)               Rol que tenía al registrarlo.
 *   deleteUser_id            BIGINT UNSIGNED, FK users  Quién lo eliminó (opcional).
 *   deleteRole               VARCHAR(255)               Rol que tenía al eliminarlo.
 *   deleted_at               TIMESTAMP                  Fecha de eliminación lógica (null = vigente). Nunca se borra de verdad.
 */
return new class extends Migration
{
    public function up(): void
    {
        $tableNames = config('permission.table_names');
        $columnNames = config('permission.column_names');
        throw_if(empty($tableNames), 'Error: config/permission.php not loaded. Run [php artisan config:clear] and try again.');

        Schema::create($tableNames['permissions'], static function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('guard_name');
            $table->timestamps();
            // REGLA DEL SISTEMA: registerUser_id, registerRole, deleteUser_id, deleteRole y deleted_at
            $table->auditable();

            $table->unique(['name', 'guard_name']);
        });
    }

    public function down(): void
    {
        $tableNames = config('permission.table_names');
        throw_if(empty($tableNames), 'Error: config/permission.php not found and defaults could not be merged.');

        Schema::dropIfExists($tableNames['permissions']);
    }
};
