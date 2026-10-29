<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA job_batches — Lotes de tareas
 *
 * Grupos de tareas en segundo plano que se siguen juntas (cuántas faltan, cuántas fallaron). Tabla interna de Laravel.
 *
 * Columnas:
 *   id              VARCHAR(255), PK  Identificador del lote.
 *   name            VARCHAR(255)      Nombre del lote.
 *   total_jobs      INT               Total de tareas.
 *   pending_jobs    INT               Tareas que faltan.
 *   failed_jobs     INT               Tareas que fallaron.
 *   failed_job_ids  LONGTEXT          Cuáles fallaron.
 *   options         MEDIUMTEXT        Opciones del lote.
 *   cancelled_at    INT               Cuándo se canceló (null = no).
 *   created_at      INT               Cuándo se creó.
 *   finished_at     INT               Cuándo terminó (null = en curso).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('job_batches', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name');
            $table->integer('total_jobs');
            $table->integer('pending_jobs');
            $table->integer('failed_jobs');
            $table->longText('failed_job_ids');
            $table->mediumText('options')->nullable();
            $table->integer('cancelled_at')->nullable();
            $table->integer('created_at');
            $table->integer('finished_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_batches');
    }
};
