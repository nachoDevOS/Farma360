<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA batches — Lotes (el stock)
 *
 * Un lote de un producto EN UNA SUCURSAL, con su vencimiento y su costo. El stock de un producto en una sucursal es la
 * suma del stock de sus lotes. Se vende primero el que vence antes (FEFO).
 * received_quantity y stock solo cambian por App\Services\InventoryService, que además deja cada movimiento en el kardex.
 *   received_quantity = lo que ENTRÓ al lote (compra, ingreso sin compra, transferencia recibida). Las ventas nunca lo tocan.
 *   stock             = lo que QUEDA ahora. Baja con ventas, transferencias enviadas y bajas; sube con anulaciones y ajustes.
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK           Identificador (autoincremental).
 *   product_id               BIGINT UNSIGNED, FK products  Producto.
 *   branch_id                BIGINT UNSIGNED, FK branches  Sucursal donde está el lote.
 *   batch_number             VARCHAR(50)                   Número de lote del fabricante.
 *   expires_at               DATE, nullable                Fecha de vencimiento (null = no vence; en FEFO sale al final).
 *   received_quantity        INT UNSIGNED                  Unidades base que ENTRARON al lote (no baja al vender).
 *   stock                    INT UNSIGNED                  Unidades base que QUEDAN ahora (baja con cada venta).
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
            $table->date('expires_at')->nullable();
            $table->unsignedInteger('received_quantity')->default(0);
            $table->unsignedInteger('stock')->default(0);
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
