<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA roles — Roles
 *
 * Grupos de permisos que se asignan a los usuarios (Super Admin, Administrador, Regente, Cajero…).
 * Paquete spatie/laravel-permission.
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK        Identificador (autoincremental).
 *   team_id                  BIGINT UNSIGNED            Solo si se activan "equipos" en config/permission.php (hoy no se usa).
 *   name                     VARCHAR(255)               Nombre del rol.
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
        $teams = config('permission.teams');

        Schema::create($tableNames['roles'], static function (Blueprint $table) use ($teams, $columnNames) {
            $table->id();
            if ($teams || config('permission.testing')) { // permission.testing: arreglo para las pruebas con sqlite
                $table->unsignedBigInteger($columnNames['team_foreign_key'])->nullable();
                $table->index($columnNames['team_foreign_key'], 'roles_team_foreign_key_index');
            }
            $table->string('name');
            $table->string('guard_name');
            $table->timestamps();
            // REGLA DEL SISTEMA: registerUser_id, registerRole, deleteUser_id, deleteRole y deleted_at
            $table->auditable();
            if ($teams || config('permission.testing')) {
                $table->unique([$columnNames['team_foreign_key'], 'name', 'guard_name']);
            } else {
                $table->unique(['name', 'guard_name']);
            }
        });
    }

    public function down(): void
    {
        $tableNames = config('permission.table_names');
        throw_if(empty($tableNames), 'Error: config/permission.php not found and defaults could not be merged.');

        Schema::dropIfExists($tableNames['roles']);
    }
};
