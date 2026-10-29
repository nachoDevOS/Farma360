<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA product_presentations — Formas de vender un producto
 *
 * Ej: Unidad (factor 1), Blíster x10 (factor 10), Caja x100 (factor 100). El precio es GLOBAL (igual en todas las sucursales).
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK           Identificador (autoincremental).
 *   product_id               BIGINT UNSIGNED, FK products  Producto al que pertenece.
 *   name                     VARCHAR(60)                   Nombre de la presentación. Ej: Caja x100.
 *   factor                   INT UNSIGNED                  Cuántas unidades base trae (Unidad = 1, Caja x100 = 100).
 *   sale_price               DECIMAL(12,2)                 Precio de venta normal de la presentación.
 *   barcode                  VARCHAR(50), único            Código de barras de esta presentación (opcional).
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
        Schema::create('product_presentations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained();
            $table->string('name', 60);
            $table->unsignedInteger('factor');
            $table->decimal('sale_price', 12, 2);
            $table->string('barcode', 50)->nullable()->unique();
            $table->timestamps();
            $table->auditable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_presentations');
    }
};
