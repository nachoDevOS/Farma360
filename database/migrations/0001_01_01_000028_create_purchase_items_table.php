<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA purchase_items — Detalle de cada compra
 *
 * Cada producto comprado: presentación, cantidad, costo, lote y vencimiento. Cada línea crea un lote (batch_id).
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK                        Identificador (autoincremental).
 *   purchase_id              BIGINT UNSIGNED, FK purchases              Compra a la que pertenece.
 *   product_id               BIGINT UNSIGNED, FK products               Producto.
 *   product_presentation_id  BIGINT UNSIGNED, FK product_presentations  Presentación comprada (ej: Caja x100).
 *   quantity                 INT UNSIGNED                               Cantidad en esa presentación (ej: 5 cajas).
 *   factor                   INT UNSIGNED                               Unidades base por presentación al momento de comprar.
 *   units                    INT UNSIGNED                               quantity × factor: unidades base que entran al stock.
 *   cost                     DECIMAL(14,2)                              Costo de una presentación.
 *   unit_cost                DECIMAL(14,4)                              Costo de una unidad base.
 *   subtotal                 DECIMAL(14,2)                              quantity × cost.
 *   batch_number             VARCHAR(50)                                Número de lote.
 *   expires_at               DATE                                       Vencimiento del lote.
 *   batch_id                 BIGINT UNSIGNED, FK batches                Lote que se creó con esta línea.
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
        Schema::create('purchase_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_id')->constrained();
            $table->foreignId('product_id')->constrained();
            $table->foreignId('product_presentation_id')->constrained();
            $table->unsignedInteger('quantity');
            $table->unsignedInteger('factor');
            $table->unsignedInteger('units');
            $table->decimal('cost', 14, 2);
            $table->decimal('unit_cost', 14, 4);
            $table->decimal('subtotal', 14, 2);
            $table->string('batch_number', 50);
            $table->date('expires_at');
            $table->foreignId('batch_id')->nullable()->constrained();
            $table->timestamps();
            $table->auditable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_items');
    }
};
