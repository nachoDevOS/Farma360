<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA transfer_items — Detalle de cada transferencia
 *
 * Lotes que viajan en la transferencia: de qué lote salen y en qué lote entraron en el destino.
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK            Identificador (autoincremental).
 *   transfer_id              BIGINT UNSIGNED, FK transfers  Transferencia.
 *   product_id               BIGINT UNSIGNED, FK products   Producto.
 *   batch_id                 BIGINT UNSIGNED, FK batches    Lote de origen.
 *   destination_batch_id     BIGINT UNSIGNED, FK batches    Lote donde entró en el destino (al recibir).
 *   batch_number             VARCHAR(50)                    Número de lote.
 *   expires_at               DATE                           Vencimiento del lote.
 *   unit_cost                DECIMAL(14,4)                  Costo de una unidad base.
 *   quantity                 INT UNSIGNED                   Unidades base enviadas.
 *   created_at / updated_at  TIMESTAMP                      Fecha de registro y de la última modificación.
 *   registerUser_id          BIGINT UNSIGNED, FK users      Quién registró el registro (opcional).
 *   registerRole             VARCHAR(255)                   Rol que tenía al registrarlo.
 *   deleteUser_id            BIGINT UNSIGNED, FK users      Quién lo eliminó (opcional).
 *   deleteRole               VARCHAR(255)                   Rol que tenía al eliminarlo.
 *   deleted_at               TIMESTAMP                      Fecha de eliminación lógica (null = vigente). Nunca se borra de verdad.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transfer_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transfer_id')->constrained();
            $table->foreignId('product_id')->constrained();
            $table->foreignId('batch_id')->constrained();
            $table->foreignId('destination_batch_id')->nullable()->constrained('batches');
            $table->string('batch_number', 50);
            $table->date('expires_at');
            $table->decimal('unit_cost', 14, 4);
            $table->unsignedInteger('quantity');
            $table->timestamps();
            $table->auditable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transfer_items');
    }
};
