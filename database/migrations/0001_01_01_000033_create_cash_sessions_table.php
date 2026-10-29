<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA cash_sessions — Turnos de caja
 *
 * Desde que un cajero abre su caja hasta que la cierra. Al cerrar cuenta el efectivo sin ver cuánto debería haber
 * (cierre ciego); si la diferencia es grande queda "pendiente" hasta que alguien con caja.aprobar la revise.
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK                 Identificador (autoincremental).
 *   cash_register_id         BIGINT UNSIGNED, FK cash_registers  Caja.
 *   branch_id                BIGINT UNSIGNED, FK branches        Sucursal.
 *   user_id                  BIGINT UNSIGNED, FK users           Cajero dueño del turno.
 *   opened_at                TIMESTAMP                           Cuándo se abrió.
 *   opening_amount           DECIMAL(14,2)                       Fondo inicial contado al abrir.
 *   closed_at                TIMESTAMP                           Cuándo se cerró (null = abierta).
 *   expected_amount          DECIMAL(14,2)                       Efectivo que debería haber según el sistema.
 *   counted_amount           DECIMAL(14,2)                       Efectivo que contó el cajero.
 *   difference               DECIMAL(14,2)                       contado - esperado (negativo = falta).
 *   close_note               VARCHAR(255)                        Observación del cierre.
 *   status                   VARCHAR(15)                         abierta | pendiente (espera revisión) | cerrada.
 *   reviewed_at              TIMESTAMP                           Cuándo se revisó la diferencia.
 *   reviewUser_id            BIGINT UNSIGNED, FK users           Quién la revisó.
 *   review_note              VARCHAR(255)                        Comentario de la revisión.
 *   created_at / updated_at  TIMESTAMP                           Fecha de registro y de la última modificación.
 *   registerUser_id          BIGINT UNSIGNED, FK users           Quién registró el registro (opcional).
 *   registerRole             VARCHAR(255)                        Rol que tenía al registrarlo.
 *   deleteUser_id            BIGINT UNSIGNED, FK users           Quién lo eliminó (opcional).
 *   deleteRole               VARCHAR(255)                        Rol que tenía al eliminarlo.
 *   deleted_at               TIMESTAMP                           Fecha de eliminación lógica (null = vigente). Nunca se borra de verdad.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cash_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cash_register_id')->constrained();
            $table->foreignId('branch_id')->constrained();
            $table->foreignId('user_id')->constrained();
            $table->timestamp('opened_at');
            $table->decimal('opening_amount', 14, 2);
            $table->timestamp('closed_at')->nullable();
            $table->decimal('expected_amount', 14, 2)->nullable();
            $table->decimal('counted_amount', 14, 2)->nullable();
            $table->decimal('difference', 14, 2)->nullable();
            $table->string('close_note')->nullable();
            $table->string('status', 15)->default('abierta')->index();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('reviewUser_id')->nullable()->constrained('users');
            $table->string('review_note')->nullable();
            $table->timestamps();
            $table->auditable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_sessions');
    }
};
