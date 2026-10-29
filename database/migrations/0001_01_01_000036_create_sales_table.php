<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA sales — Ventas
 *
 * Venta hecha en el punto de venta dentro de un turno de caja. No se borra: se ANULA y el stock vuelve a los lotes.
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK                Identificador (autoincremental).
 *   number                   VARCHAR(20), único                 Número correlativo (ej: V-000001).
 *   branch_id                BIGINT UNSIGNED, FK branches       Sucursal.
 *   cash_session_id          BIGINT UNSIGNED, FK cash_sessions  Turno de caja en que se vendió.
 *   customer_id              BIGINT UNSIGNED, FK customers      Cliente registrado (opcional).
 *   customer_name            VARCHAR(255)                       Nombre del cliente al momento de vender (para el comprobante).
 *   customer_document        VARCHAR(30)                        CI / NIT del cliente al momento de vender.
 *   total                    DECIMAL(14,2)                      Total cobrado.
 *   cash_received            DECIMAL(14,2)                      Efectivo que entregó el cliente.
 *   change                   DECIMAL(14,2)                      Cambio devuelto.
 *   prescription_number      VARCHAR(50)                        N° de receta (obligatorio si hay un producto controlado).
 *   prescription_doctor      VARCHAR(255)                       Médico que firmó la receta.
 *   status                   VARCHAR(15)                        completada | anulada.
 *   cancelled_at             TIMESTAMP                          Cuándo se anuló.
 *   cancelUser_id            BIGINT UNSIGNED, FK users          Quién la anuló.
 *   cancel_reason            VARCHAR(255)                       Motivo de la anulación.
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
        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->string('number', 20)->nullable()->unique();
            $table->foreignId('branch_id')->constrained();
            $table->foreignId('cash_session_id')->constrained();
            $table->foreignId('customer_id')->nullable()->constrained();
            $table->string('customer_name')->nullable();
            $table->string('customer_document', 30)->nullable();
            $table->decimal('total', 14, 2);
            $table->decimal('cash_received', 14, 2)->default(0);
            $table->decimal('change', 14, 2)->default(0);
            $table->string('prescription_number', 50)->nullable();
            $table->string('prescription_doctor')->nullable();
            $table->string('status', 15)->default('completada')->index();
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelUser_id')->nullable()->constrained('users');
            $table->string('cancel_reason')->nullable();
            $table->timestamps();
            $table->auditable();

            $table->index(['branch_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales');
    }
};
