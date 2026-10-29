<?php

use App\Models\User;
use App\Support\PermissionCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Pasa los roles del sistema viejo (columna users.role: admin | editor | user)
 * a las tablas de Spatie (roles, permisos) y borra la columna.
 *
 *   admin  → Administrador   (el primer admin creado pasa a ser Super Admin)
 *   editor → Supervisor
 *   user   → Operador
 */
return new class extends Migration
{
    public function up(): void
    {
        // Crea los permisos y roles de config/roles.php
        Artisan::call('permissions:sync');

        $map = ['admin' => 'Administrador', 'editor' => 'Supervisor', 'user' => 'Operador'];
        $firstAdminId = DB::table('users')->where('role', 'admin')->min('id');

        DB::table('users')->orderBy('id')->each(function (object $row) use ($map, $firstAdminId) {
            $role = (int) $row->id === (int) $firstAdminId ? PermissionCatalog::superAdmin() : ($map[$row->role] ?? config('roles.default_role'));
            User::find($row->id)?->assignRole($role);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('role');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default('user')->after('email');
        });
    }
};
