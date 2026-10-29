<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * CATÁLOGO DE PRODUCTOS: categorías, laboratorios, principios activos, productos y sus presentaciones.
     */
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->timestamps();
            $table->auditable();
        });

        Schema::create('laboratories', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('country', 60)->nullable();
            $table->timestamps();
            $table->auditable();
        });

        // Principio activo / genérico (ej: Paracetamol). Sirve para buscar equivalentes.
        Schema::create('active_ingredients', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->timestamps();
            $table->auditable();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            // Nombre comercial (ej: Panadol)
            $table->string('name');
            $table->foreignId('active_ingredient_id')->nullable()->constrained();
            // Ej: "500 mg", "120 mg/5 ml"
            $table->string('concentration', 60)->nullable();
            // Ej: Tableta, Jarabe, Cápsula, Inyectable
            $table->string('pharmaceutical_form', 60)->nullable();
            $table->foreignId('laboratory_id')->nullable()->constrained();
            $table->foreignId('category_id')->nullable()->constrained();
            $table->string('barcode', 50)->nullable()->unique();
            $table->string('health_registry', 60)->nullable(); // registro sanitario
            // Unidad más chica en la que se cuenta el stock (ej: tableta, frasco)
            $table->string('base_unit', 30)->default('unidad');
            $table->boolean('requires_prescription')->default(false);
            // Psicotrópicos / estupefacientes: la venta pide receta y médico
            $table->boolean('is_controlled')->default(false);
            // Stock mínimo por sucursal, en unidades base (alerta de reposición)
            $table->unsignedInteger('min_stock')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->auditable();

            $table->index('name');
        });

        // Formas de vender un producto: Unidad (factor 1), Blíster x10 (factor 10), Caja x100 (factor 100)
        Schema::create('product_presentations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained();
            $table->string('name', 60);
            // Cuántas unidades base trae
            $table->unsignedInteger('factor');
            // Precio de venta normal de la presentación
            $table->decimal('sale_price', 12, 2);
            $table->string('barcode', 50)->nullable()->unique();
            $table->timestamps();
            $table->auditable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_presentations');
        Schema::dropIfExists('products');
        Schema::dropIfExists('active_ingredients');
        Schema::dropIfExists('laboratories');
        Schema::dropIfExists('categories');
    }
};
