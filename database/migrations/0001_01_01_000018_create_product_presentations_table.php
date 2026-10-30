<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA product_presentations — Formas de vender un producto
 *
 * Se arman por NIVELES: la unidad base (Tableta) y empaques que contienen al nivel anterior
 * (Blíster contiene 10 tabletas, Caja contiene 10 blísteres). El sistema calcula el factor y el nombre;
 * el usuario no los escribe. El precio es GLOBAL (igual en todas las sucursales).
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK           Identificador (autoincremental).
 *   product_id               BIGINT UNSIGNED, FK products  Producto al que pertenece.
 *   parent_id                BIGINT UNSIGNED, FK propia    Presentación que contiene. Ej: la Caja contiene Blísteres (null = unidad base).
 *   package                  VARCHAR(30)                   Tipo de empaque. Ej: Blíster, Caja (en la unidad base: tableta).
 *   contains                 INT UNSIGNED                  Cuántas del nivel de adentro trae. Ej: Caja = 10 (blísteres). Null en la unidad base.
 *   name                     VARCHAR(100)                  Nombre armado por el sistema. Ej: Caja x10 blísteres (100 tabletas).
 *   factor                   INT UNSIGNED                  Cuántas unidades base trae, calculado: contains × factor del de adentro (unidad base = 1).
 *   sale_price               DECIMAL(12,2)                 Precio de venta normal de la presentación (null si no se vende).
 *   is_sellable              BOOLEAN                       true = aparece en el punto de venta.
 *   is_purchasable           BOOLEAN                       true = aparece al registrar compras.
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
            $table->foreignId('parent_id')->nullable()->constrained('product_presentations');
            $table->string('package', 30);
            $table->unsignedInteger('contains')->nullable();
            $table->string('name', 100);
            $table->unsignedInteger('factor');
            $table->decimal('sale_price', 12, 2)->nullable();
            $table->boolean('is_sellable')->default(true);
            $table->boolean('is_purchasable')->default(true);
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
