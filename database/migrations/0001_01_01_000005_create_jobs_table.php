<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA jobs — Cola de tareas
 *
 * Tareas pendientes que se hacen en segundo plano (ej: enviar correos). Tabla interna de Laravel.
 *
 * Columnas:
 *   id            BIGINT UNSIGNED, PK  Identificador (autoincremental).
 *   queue         VARCHAR(255)         Nombre de la cola.
 *   payload       LONGTEXT             Tarea a ejecutar (serializada).
 *   attempts      TINYINT UNSIGNED     Intentos hechos.
 *   reserved_at   INT UNSIGNED         Cuándo la tomó un trabajador (null = libre).
 *   available_at  INT UNSIGNED         Desde cuándo se puede ejecutar.
 *   created_at    INT UNSIGNED         Cuándo se encoló.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('jobs', function (Blueprint $table) {
            $table->id();
            $table->string('queue')->index();
            $table->longText('payload');
            $table->unsignedTinyInteger('attempts');
            $table->unsignedInteger('reserved_at')->nullable();
            $table->unsignedInteger('available_at');
            $table->unsignedInteger('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('jobs');
    }
};
