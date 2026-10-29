<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA sessions — Sesiones abiertas
 *
 * Sesiones de los navegadores conectados (quién inició sesión y desde dónde). Tabla interna de Laravel.
 *
 * Columnas:
 *   id             VARCHAR(255), PK  Identificador de la sesión.
 *   user_id        BIGINT UNSIGNED   Usuario de la sesión (null = visitante sin iniciar sesión).
 *   ip_address     VARCHAR(45)       Dirección IP.
 *   user_agent     TEXT              Navegador y sistema operativo.
 *   payload        LONGTEXT          Datos de la sesión (cifrados por Laravel).
 *   last_activity  INT               Última actividad (marca de tiempo Unix).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sessions');
    }
};
