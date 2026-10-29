<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA stock_movements — Kardex
 *
 * Cada entrada o salida de stock queda como un movimiento: el stock nunca se edita a mano. Permite ver la historia
 * de un producto en una sucursal (quién, cuándo, por qué y el saldo después de cada movimiento).
 *
 * Columnas:
 *   id                             BIGINT UNSIGNED, PK             Identificador (autoincremental).
 *   product_id                     BIGINT UNSIGNED, FK products    Producto.
 *   branch_id                      BIGINT UNSIGNED, FK branches    Sucursal.
 *   batch_id                       BIGINT UNSIGNED, FK batches     Lote que se movió.
 *   type                           VARCHAR(30)                     compra, venta, ajuste_entrada, ajuste_salida, baja, transferencia_salida,
 *                                                                  transferencia_entrada, anulacion_compra, anulacion_venta, anulacion_transferencia.
 *   quantity                       INT                             Unidades base: positivo = entra, negativo = sale.
 *   unit_cost                      DECIMAL(14,4)                   Costo de una unidad base del lote.
 *   balance                        INT                             Stock del producto en la sucursal DESPUÉS del movimiento.
 *   reference_type / reference_id  VARCHAR(255) / BIGINT UNSIGNED  Documento que lo originó (compra, venta, transferencia). null = ajuste manual.
 *   note                           VARCHAR(255)                    Motivo (obligatorio en ajustes y bajas).
 *   created_at / updated_at        TIMESTAMP                       Fecha de registro y de la última modificación.
 *   registerUser_id                BIGINT UNSIGNED, FK users       Quién registró el registro (opcional).
 *   registerRole                   VARCHAR(255)                    Rol que tenía al registrarlo.
 *   deleteUser_id                  BIGINT UNSIGNED, FK users       Quién lo eliminó (opcional).
 *   deleteRole                     VARCHAR(255)                    Rol que tenía al eliminarlo.
 *   deleted_at                     TIMESTAMP                       Fecha de eliminación lógica (null = vigente). Nunca se borra de verdad.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained();
            $table->foreignId('branch_id')->constrained();
            $table->foreignId('batch_id')->constrained();
            $table->string('type', 30)->index();
            $table->integer('quantity');
            $table->decimal('unit_cost', 14, 4);
            $table->integer('balance');
            $table->nullableMorphs('reference');
            $table->string('note')->nullable();
            $table->timestamps();
            $table->auditable();

            $table->index(['branch_id', 'product_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
