<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA sale_payments — Pagos de cada venta
 *
 * Cómo se pagó la venta. Puede haber varios (pagos combinados: parte en efectivo y parte por QR).
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK        Identificador (autoincremental).
 *   sale_id                  BIGINT UNSIGNED, FK sales  Venta.
 *   method                   VARCHAR(20)                efectivo | qr | tarjeta | transferencia (config/farmacia.php).
 *   amount                   DECIMAL(14,2)              Monto pagado con ese método.
 *   reference                VARCHAR(60)                N° de operación del QR / tarjeta / transferencia (opcional).
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
        Schema::create('sale_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained();
            $table->string('method', 20);
            $table->decimal('amount', 14, 2);
            $table->string('reference', 60)->nullable();
            $table->timestamps();
            $table->auditable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_payments');
    }
};
