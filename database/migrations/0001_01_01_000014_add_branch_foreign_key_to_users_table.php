<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA users.branch_id → branches — Sucursal de cada usuario
 *
 * Conecta users.branch_id con la tabla branches. Va aparte porque branches se crea después de users
 * (branches necesita a users para sus columnas de auditoría).
 *
 * Columnas:
 *   branch_id  BIGINT UNSIGNED, FK branches  Sucursal donde trabaja el usuario (null = ve todas).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreign('branch_id')->references('id')->on('branches');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['branch_id']);
        });
    }
};
