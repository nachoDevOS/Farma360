<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA cash_session_counts — Conteo de billetes de cada turno
 *
 * Cuántos billetes y monedas de cada valor se contaron al abrir y al cerrar el turno.
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK                Identificador (autoincremental).
 *   cash_session_id          BIGINT UNSIGNED, FK cash_sessions  Turno.
 *   moment                   VARCHAR(10)                        apertura | cierre.
 *   denomination_id          BIGINT UNSIGNED, FK denominations  Billete o moneda.
 *   value                    DECIMAL(10,2)                      Valor del billete al momento de contar.
 *   quantity                 INT UNSIGNED                       Cuántos se contaron.
 *   subtotal                 DECIMAL(14,2)                      value × quantity.
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
        Schema::create('cash_session_counts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cash_session_id')->constrained();
            $table->string('moment', 10);
            $table->foreignId('denomination_id')->constrained();
            $table->decimal('value', 10, 2);
            $table->unsignedInteger('quantity');
            $table->decimal('subtotal', 14, 2);
            $table->timestamps();
            $table->auditable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_session_counts');
    }
};
