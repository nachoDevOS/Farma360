<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA product_price_histories — Historial de precios de venta
 *
 * Una fila cada vez que cambia el precio de venta de una presentación (y la primera al crearla).
 * Solo sirve para consultar: cuándo cambió, de cuánto a cuánto y quién lo cambió. NO se relaciona con
 * las ventas: cada venta ya guarda sus propios montos (sale_items). Se llena sola (ProductPresentation::booted).
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK                          Identificador (autoincremental).
 *   product_id               BIGINT UNSIGNED, FK products                 Producto (para consultar su historial rápido).
 *   product_presentation_id  BIGINT UNSIGNED, FK product_presentations    Presentación cuyo precio cambió.
 *   presentation_name        VARCHAR(100)                                 Nombre de la presentación en ese momento. Ej: Caja x100.
 *   old_price                DECIMAL(12,2)                                Precio anterior (null = precio inicial, al crearla).
 *   new_price                DECIMAL(12,2)                                Precio nuevo (null = se quitó el precio).
 *   source                   VARCHAR(20)                                  Origen: creacion (al crear la presentación) o edicion.
 *   created_at / updated_at  TIMESTAMP                                    Fecha del cambio.
 *   registerUser_id          BIGINT UNSIGNED, FK users                    Quién cambió el precio (opcional).
 *   registerRole             VARCHAR(255)                                 Rol que tenía al cambiarlo.
 *   deleteUser_id            BIGINT UNSIGNED, FK users                    Quién lo eliminó (opcional).
 *   deleteRole               VARCHAR(255)                                 Rol que tenía al eliminarlo.
 *   deleted_at               TIMESTAMP                                    Fecha de eliminación lógica (null = vigente). Nunca se borra de verdad.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_price_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained();
            $table->foreignId('product_presentation_id')->constrained();
            $table->string('presentation_name', 100);
            $table->decimal('old_price', 12, 2)->nullable();
            $table->decimal('new_price', 12, 2)->nullable();
            $table->string('source', 20);
            $table->timestamps();
            $table->auditable();

            $table->index(['product_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_price_histories');
    }
};
