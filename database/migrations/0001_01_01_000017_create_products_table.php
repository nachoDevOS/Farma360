<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA products — Productos (medicamentos y artículos)
 *
 * El catálogo es GLOBAL: un producto se registra una vez y lo ven todas las sucursales. El stock NO está aquí:
 * está en los lotes (batches), y cada lote es de una sucursal. Se vende por presentaciones (product_presentations).
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK               Identificador (autoincremental).
 *   name                     VARCHAR(255)                      Nombre comercial (la marca). Ej: Dolofen.
 *   generic_name             VARCHAR(255)                      Nombre genérico (la sustancia). Ej: Paracetamol. Sirve para buscar equivalentes (opcional).
 *   concentration            VARCHAR(60)                       Concentración. Ej: "500 mg", "120 mg/5 ml" (opcional).
 *   pharmaceutical_form      VARCHAR(60)                       Forma farmacéutica. Ej: Tableta, Jarabe, Cápsula (opcional).
 *   description              TEXT                              Para qué sirve, en palabras. También se busca por este texto (opcional).
 *   laboratory_id            BIGINT UNSIGNED, FK laboratories  Laboratorio que lo fabrica (opcional).
 *   category_id              BIGINT UNSIGNED, FK categories    Categoría (opcional).
 *   barcode                  VARCHAR(50), único                Código de barras del producto (opcional; las presentaciones tienen el suyo).
 *   health_registry          VARCHAR(60)                       Registro sanitario (opcional).
 *   base_unit                VARCHAR(30)                       Unidad más chica en la que se cuenta el stock. Ej: tableta, frasco.
 *   requires_prescription    BOOLEAN                           true = se vende solo con receta.
 *   is_controlled            BOOLEAN                           true = psicotrópico / estupefaciente: la venta pide n° de receta y médico.
 *   min_stock                INT UNSIGNED                      Stock mínimo por sucursal, en unidades base (alerta de reposición).
 *   is_active                BOOLEAN                           false = ya no se vende ni se compra (se conserva el historial).
 *   created_at / updated_at  TIMESTAMP                         Fecha de registro y de la última modificación.
 *   registerUser_id          BIGINT UNSIGNED, FK users         Quién registró el registro (opcional).
 *   registerRole             VARCHAR(255)                      Rol que tenía al registrarlo.
 *   deleteUser_id            BIGINT UNSIGNED, FK users         Quién lo eliminó (opcional).
 *   deleteRole               VARCHAR(255)                      Rol que tenía al eliminarlo.
 *   deleted_at               TIMESTAMP                         Fecha de eliminación lógica (null = vigente). Nunca se borra de verdad.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('generic_name')->nullable()->index();
            $table->string('concentration', 60)->nullable();
            $table->string('pharmaceutical_form', 60)->nullable();
            $table->text('description')->nullable();
            $table->foreignId('laboratory_id')->nullable()->constrained();
            $table->foreignId('category_id')->nullable()->constrained();
            $table->string('barcode', 50)->nullable()->unique();
            $table->string('health_registry', 60)->nullable();
            $table->string('base_unit', 30)->default('unidad');
            $table->boolean('requires_prescription')->default(false);
            $table->boolean('is_controlled')->default(false);
            $table->unsignedInteger('min_stock')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->auditable();

            $table->index('name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
