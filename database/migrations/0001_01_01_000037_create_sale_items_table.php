<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA sale_items — Detalle de cada venta
 *
 * Lo que salió en la venta, POR LOTE: si una cantidad se sacó de dos lotes (FEFO), son dos líneas (cada lote tiene su
 * costo y su promoción). Precio, factor, descuento y costo son una COPIA del momento de la venta: si luego cambian en
 * el catálogo, la venta no cambia. Los montos van en el orden Subtotal → Descuento → Total.
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK                        Identificador (autoincremental).
 *   sale_id                  BIGINT UNSIGNED, FK sales                  Venta.
 *   product_id               BIGINT UNSIGNED, FK products               Producto.
 *   product_presentation_id  BIGINT UNSIGNED, FK product_presentations  Presentación vendida.
 *   batch_id                 BIGINT UNSIGNED, FK batches                Lote del que salió.
 *   units                    INT UNSIGNED                               Unidades base que salieron de ESTE lote.
 *   factor                   INT UNSIGNED                               Unidades base por presentación al momento de vender.
 *   list_price               DECIMAL(12,2)                              Precio normal de 1 presentación vendida (caja, blíster…), sin descuento.
 *   subtotal                 DECIMAL(14,2)                              Importe SIN descuento: list_price / factor × units.
 *   discount_percent         DECIMAL(5,2)                               Descuento por vencimiento del lote, en % (0 = sin descuento).
 *   discount_amount          DECIMAL(14,2)                              Ese descuento en Bs: subtotal × discount_percent / 100.
 *   total                    DECIMAL(14,2)                              Monto de esta línea: subtotal − discount_amount (el "subtotal" de una factura).
 *   unit_cost                DECIMAL(14,4)                              Costo de una unidad base del lote (para calcular la ganancia).
 *   created_at / updated_at  TIMESTAMP                                  Fecha de registro y de la última modificación.
 *   registerUser_id          BIGINT UNSIGNED, FK users                  Quién registró el registro (opcional).
 *   registerRole             VARCHAR(255)                               Rol que tenía al registrarlo.
 *   deleteUser_id            BIGINT UNSIGNED, FK users                  Quién lo eliminó (opcional).
 *   deleteRole               VARCHAR(255)                               Rol que tenía al eliminarlo.
 *   deleted_at               TIMESTAMP                                  Fecha de eliminación lógica (null = vigente). Nunca se borra de verdad.
 *
 * Ejemplo: 9 tabletas a Bs 1. El lote A solo tenía 4 y está con −25%; las otras 5 salen del lote B, sin promoción:
 *   lote A: units 4 · factor 1 · list_price 1.00 · subtotal 4.00 · 25% · discount_amount 1.00 · total 3.00
 *   lote B: units 5 · factor 1 · list_price 1.00 · subtotal 5.00 · 0%  · discount_amount 0.00 · total 5.00
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
            $table->decimal('subtotal', 14, 2);
            $table->decimal('discount_percent', 5, 2)->default(0);
            $table->decimal('discount_amount', 14, 2)->default(0);
            $table->decimal('total', 14, 2);
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
