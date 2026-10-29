<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA laboratories — Laboratorios
 *
 * Laboratorios que fabrican los productos (ej: Laboratorios Andinos).
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK        Identificador (autoincremental).
 *   name                     VARCHAR(255), único        Nombre del laboratorio.
 *   country                  VARCHAR(60)                País de origen (opcional).
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
        Schema::create('laboratories', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('country', 60)->nullable();
            $table->timestamps();
            $table->auditable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('laboratories');
    }
};
