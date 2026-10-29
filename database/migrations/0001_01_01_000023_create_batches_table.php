<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA batches — Lotes (el stock)
 *
 * Un lote de un producto EN UNA SUCURSAL, con su vencimiento y su costo. El stock de un producto en una sucursal es la
 * suma de sus lotes. Se vende primero el que vence antes (FEFO). La cantidad solo cambia por InventoryService (kardex).
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK           Identificador (autoincremental).
 *   product_id               BIGINT UNSIGNED, FK products  Producto.
 *   branch_id                BIGINT UNSIGNED, FK branches  Sucursal donde está el lote.
 *   batch_number             VARCHAR(50)                   Número de lote del fabricante.
 *   expires_at               DATE                          Fecha de vencimiento.
 *   quantity                 INT UNSIGNED                  Unidades base disponibles ahora.
 *   unit_cost                DECIMAL(14,4)                 Costo de UNA unidad base (para el valor del inventario y la ganancia).
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
        Schema::create('batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained();
            $table->foreignId('branch_id')->constrained();
            $table->string('batch_number', 50);
            $table->date('expires_at');
            $table->unsignedInteger('quantity')->default(0);
            $table->decimal('unit_cost', 14, 4);
            $table->timestamps();
            $table->auditable();

            // Para la venta: lotes de un producto en una sucursal, el que vence primero adelante
            $table->index(['branch_id', 'product_id', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('batches');
    }
};
