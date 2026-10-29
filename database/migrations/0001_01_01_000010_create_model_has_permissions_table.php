<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA model_has_permissions — Permisos sueltos de un usuario
 *
 * Permisos dados directo a un usuario, sin pasar por un rol (el sistema usa roles; queda por compatibilidad del paquete).
 * Tabla pivote de spatie/laravel-permission: no lleva columnas de auditoría.
 *
 * Columnas:
 *   permission_id  BIGINT UNSIGNED, FK permissions  Permiso otorgado.
 *   model_type     VARCHAR(255)                     Tipo de modelo (App\Models\User).
 *   model_id       BIGINT UNSIGNED                  Id del usuario.
 */
return new class extends Migration
{
    public function up(): void
    {
        $tableNames = config('permission.table_names');
        $columnNames = config('permission.column_names');
        throw_if(empty($tableNames), 'Error: config/permission.php not loaded. Run [php artisan config:clear] and try again.');
        $teams = config('permission.teams');
        $pivotPermission = $columnNames['permission_pivot_key'] ?? 'permission_id';

        Schema::create($tableNames['model_has_permissions'], static function (Blueprint $table) use ($tableNames, $columnNames, $pivotPermission, $teams) {
            $table->unsignedBigInteger($pivotPermission);
            $table->string('model_type');
            $table->unsignedBigInteger($columnNames['model_morph_key']);
            $table->index([$columnNames['model_morph_key'], 'model_type'], 'model_has_permissions_model_id_model_type_index');

            $table->foreign($pivotPermission)->references('id')->on($tableNames['permissions'])->cascadeOnDelete();
            if ($teams) {
                $table->unsignedBigInteger($columnNames['team_foreign_key']);
                $table->index($columnNames['team_foreign_key'], 'model_has_permissions_team_foreign_key_index');
                $table->primary([$columnNames['team_foreign_key'], $pivotPermission, $columnNames['model_morph_key'], 'model_type'],
                    'model_has_permissions_permission_model_type_primary');
            } else {
                $table->primary([$pivotPermission, $columnNames['model_morph_key'], 'model_type'],
                    'model_has_permissions_permission_model_type_primary');
            }
        });
    }

    public function down(): void
    {
        $tableNames = config('permission.table_names');
        throw_if(empty($tableNames), 'Error: config/permission.php not found and defaults could not be merged.');

        Schema::dropIfExists($tableNames['model_has_permissions']);
    }
};
