<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA cash_movements — Movimientos de efectivo
 *
 * Entradas y salidas de efectivo del turno que no son ventas (siempre con motivo).
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK                Identificador (autoincremental).
 *   cash_session_id          BIGINT UNSIGNED, FK cash_sessions  Turno.
 *   type                     VARCHAR(10)                        ingreso | egreso | retiro (retiro parcial cuando se junta mucho efectivo).
 *   amount                   DECIMAL(14,2)                      Monto.
 *   reason                   VARCHAR(255)                       Motivo.
 *   created_at / updated_at  TIMESTAMP                          Fecha de registro y de la última modificación.
 *   registerUser_id          BIGINT UNSIGNED, FK users          Quién registró el registro (opcional).
 *   registerRole             VARCHAR(255)                       Rol que tenía al registrarlo.
 *   deleteUser_id            BIGINT UNSIGNED, FK users          Quién lo eliminó (opcional).
 *   deleteRole               VARCHAR(255)                       Rol que tenía al eliminarlo.
 *   deleted_at               TIMESTAMP                          Fecha de eliminación lógica (null = vigente). Nunca se borra de verdad.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cash_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cash_session_id')->constrained();
            $table->string('type', 10);
            $table->decimal('amount', 14, 2);
            $table->string('reason');
            $table->timestamps();
            $table->auditable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_movements');
    }
};
