<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA batch_promotion_presentation — A qué presentaciones del lote se les hace el descuento y de cuánto (pivote)
 *
 * Cada presentación lleva su propio % (ej: blíster 10%, caja 20%, la tableta sin descuento).
 * Sin filas = vale para todo el lote. Reemplaza a batch_promotions.product_presentation_id, que admitía una sola.
 *
 * Columnas:
 *   batch_promotion_id       BIGINT UNSIGNED, FK batch_promotions        Descuento.
 *   product_presentation_id  BIGINT UNSIGNED, FK product_presentations   Presentación con descuento.
 *   discount_percent         DECIMAL(5,2)                                Descuento en % de esa presentación.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('batch_promotion_presentation', function (Blueprint $table) {
            $table->foreignId('batch_promotion_id')->constrained();
            $table->foreignId('product_presentation_id')->constrained();
            $table->decimal('discount_percent', 5, 2);

            $table->primary(['batch_promotion_id', 'product_presentation_id']);
        });

        DB::table('batch_promotion_presentation')->insertUsing(
            ['batch_promotion_id', 'product_presentation_id', 'discount_percent'],
            DB::table('batch_promotions')->whereNotNull('product_presentation_id')->select('id', 'product_presentation_id', 'discount_percent'),
        );

        Schema::table('batch_promotions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('product_presentation_id');
        });
    }

    public function down(): void
    {
        Schema::table('batch_promotions', function (Blueprint $table) {
            $table->foreignId('product_presentation_id')->nullable()->after('batch_id')->constrained();
        });

        foreach (DB::table('batch_promotion_presentation')->get() as $row) {
            DB::table('batch_promotions')->where('id', $row->batch_promotion_id)->update(['product_presentation_id' => $row->product_presentation_id]);
        }

        Schema::dropIfExists('batch_promotion_presentation');
    }
};
