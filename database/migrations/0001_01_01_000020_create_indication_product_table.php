<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA indication_product — Usos de cada producto
 *
 * Tabla pivote producto ↔ uso / síntoma. No guarda datos propios, por eso no lleva columnas de auditoría.
 *
 * Columnas:
 *   indication_id  BIGINT UNSIGNED, FK indications  Uso / síntoma.
 *   product_id     BIGINT UNSIGNED, FK products     Producto que sirve para ese uso.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('indication_product', function (Blueprint $table) {
            $table->foreignId('indication_id')->constrained();
            $table->foreignId('product_id')->constrained();
            $table->primary(['indication_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('indication_product');
    }
};
