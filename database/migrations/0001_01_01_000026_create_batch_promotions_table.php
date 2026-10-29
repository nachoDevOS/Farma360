<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA batch_promotions — Descuentos aplicados a lotes
 *
 * Descuento por vencimiento de un lote. Solo uno activo por lote; los anteriores quedan como historial.
 * El punto de venta cobra el precio con descuento solo.
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK          Identificador (autoincremental).
 *   batch_id                 BIGINT UNSIGNED, FK batches  Lote con descuento.
 *   discount_percent         DECIMAL(5,2)                 Descuento en %.
 *   source                   VARCHAR(10)                  regla (sugerido automático) o manual.
 *   is_active                BOOLEAN                      true = es el descuento vigente del lote.
 *   below_cost               BOOLEAN                      true = el precio final queda bajo el costo (lo aprobó alguien con promociones.aprobar).
 *   created_at / updated_at  TIMESTAMP                    Fecha de registro y de la última modificación.
 *   registerUser_id          BIGINT UNSIGNED, FK users    Quién registró el registro (opcional).
 *   registerRole             VARCHAR(255)                 Rol que tenía al registrarlo.
 *   deleteUser_id            BIGINT UNSIGNED, FK users    Quién lo eliminó (opcional).
 *   deleteRole               VARCHAR(255)                 Rol que tenía al eliminarlo.
 *   deleted_at               TIMESTAMP                    Fecha de eliminación lógica (null = vigente). Nunca se borra de verdad.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('batch_promotions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('batch_id')->constrained();
            $table->decimal('discount_percent', 5, 2);
            $table->string('source', 10)->default('manual');
            $table->boolean('is_active')->default(true);
            $table->boolean('below_cost')->default(false);
            $table->timestamps();
            $table->auditable();

            $table->index(['batch_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('batch_promotions');
    }
};
