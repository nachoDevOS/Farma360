<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A qué presentación del lote se le hace el descuento.
 *
 * Columnas nuevas de batch_promotions:
 *   product_presentation_id  BIGINT UNSIGNED, FK product_presentations  Solo esa presentación (ej: la caja). null = todo el lote.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('batch_promotions', function (Blueprint $table) {
            $table->foreignId('product_presentation_id')->nullable()->after('batch_id')->constrained();
        });
    }

    public function down(): void
    {
        Schema::table('batch_promotions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('product_presentation_id');
        });
    }
};
