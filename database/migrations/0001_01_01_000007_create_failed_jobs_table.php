<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA failed_jobs — Tareas que fallaron
 *
 * Registro de las tareas en segundo plano que no se pudieron completar, para revisarlas o reintentarlas. Tabla interna de Laravel.
 *
 * Columnas:
 *   id          BIGINT UNSIGNED, PK  Identificador (autoincremental).
 *   uuid        VARCHAR(255), único  Identificador único de la tarea.
 *   connection  TEXT                 Conexión de la cola.
 *   queue       TEXT                 Nombre de la cola.
 *   payload     LONGTEXT             Tarea (serializada).
 *   exception   LONGTEXT             Error que produjo.
 *   failed_at   TIMESTAMP            Cuándo falló.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('failed_jobs', function (Blueprint $table) {
            $table->id();
            $table->string('uuid')->unique();
            $table->text('connection');
            $table->text('queue');
            $table->longText('payload');
            $table->longText('exception');
            $table->timestamp('failed_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('failed_jobs');
    }
};
