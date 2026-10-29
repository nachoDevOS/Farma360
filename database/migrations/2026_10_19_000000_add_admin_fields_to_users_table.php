<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Agrega las columnas nuevas a la tabla users (php artisan migrate).
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Rol: admin, editor o user. Por defecto 'user' (los que se registran solos)
            $table->string('role')->default('user')->after('email');
            // false = no puede iniciar sesión
            $table->boolean('is_active')->default(true)->after('role');
            // Último inicio de sesión (null = nunca entró)
            $table->timestamp('last_login_at')->nullable()->after('is_active');
        });
    }

    /**
     * Las quita si ejecutas php artisan migrate:rollback.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['role', 'is_active', 'last_login_at']);
        });
    }
};
