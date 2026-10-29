<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA cash_registers — Cajas
 *
 * Cajas físicas de cada sucursal (ej: Caja 1, Caja 2). Cada cajero abre su propio turno en una caja.
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK           Identificador (autoincremental).
 *   branch_id                BIGINT UNSIGNED, FK branches  Sucursal de la caja.
 *   name                     VARCHAR(60)                   Nombre de la caja.
 *   is_active                BOOLEAN                       false = no se puede abrir.
 *   created_at / updated_at  TIMESTAMP                     Fecha de registro y de la última modificación.
 *   registerUser_id          BIGINT UNSIGNED, FK users     Quién registró el registro (opcional).
 *   registerRole             VARCHAR(255)                  Rol que tenía al registrarlo.
 *   deleteUser_id            BIGINT UNSIGNED, FK users     Quién lo eliminó (opcional).
 *   deleteRole               VARCHAR(255)                  Rol que tenía al eliminarlo.
 *   deleted_at               TIMESTAMP                     Fecha de eliminación lógica (null = vigente). Nunca se borra de verdad.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cash_registers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained();
            $table->string('name', 60);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->auditable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_registers');
    }
};
