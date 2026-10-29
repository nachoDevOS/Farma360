<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA cache_locks — Bloqueos de la caché
 *
 * Candados para que dos procesos no hagan la misma tarea a la vez. Tabla interna de Laravel.
 *
 * Columnas:
 *   key         VARCHAR(255), PK  Nombre del candado.
 *   owner       VARCHAR(255)      Proceso que lo tiene tomado.
 *   expiration  INT               Cuándo se libera solo (marca de tiempo Unix).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cache_locks', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->string('owner');
            $table->integer('expiration');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cache_locks');
    }
};
