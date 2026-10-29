<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA sale_items — Detalle de cada venta
 *
 * Lo que salió en la venta, POR LOTE: si una cantidad se sacó de dos lotes (FEFO), son dos líneas.
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK                        Identificador (autoincremental).
 *   sale_id                  BIGINT UNSIGNED, FK sales                  Venta.
 *   product_id               BIGINT UNSIGNED, FK products               Producto.
 *   product_presentation_id  BIGINT UNSIGNED, FK product_presentations  Presentación vendida.
 *   batch_id                 BIGINT UNSIGNED, FK batches                Lote del que salió.
 *   units                    INT UNSIGNED                               Unidades base que salieron de ESTE lote.
 *   factor                   INT UNSIGNED                               Unidades base por presentación al momento de vender.
 *   list_price               DECIMAL(12,2)                              Precio normal de la presentación.
 *   discount_percent         DECIMAL(5,2)                               Descuento por vencimiento aplicado (0 = sin descuento).
 *   subtotal                 DECIMAL(14,2)                              Monto cobrado por esta línea.
 *   unit_cost                DECIMAL(14,4)                              Costo de una unidad base del lote (para calcular la ganancia).
 *   created_at / updated_at  TIMESTAMP                                  Fecha de registro y de la última modificación.
 *   registerUser_id          BIGINT UNSIGNED, FK users                  Quién registró el registro (opcional).
 *   registerRole             VARCHAR(255)                               Rol que tenía al registrarlo.
 *   deleteUser_id            BIGINT UNSIGNED, FK users                  Quién lo eliminó (opcional).
 *   deleteRole               VARCHAR(255)                               Rol que tenía al eliminarlo.
 *   deleted_at               TIMESTAMP                                  Fecha de eliminación lógica (null = vigente). Nunca se borra de verdad.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained();
            $table->foreignId('product_id')->constrained();
            $table->foreignId('product_presentation_id')->constrained();
            $table->foreignId('batch_id')->constrained();
            $table->unsignedInteger('units');
            $table->unsignedInteger('factor');
            $table->decimal('list_price', 12, 2);
            $table->decimal('discount_percent', 5, 2)->default(0);
            $table->decimal('subtotal', 14, 2);
            $table->decimal('unit_cost', 14, 4);
            $table->timestamps();
            $table->auditable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_items');
    }
};
