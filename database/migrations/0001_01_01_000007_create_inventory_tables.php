<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * INVENTARIO: lotes (el stock real vive aquí), kardex (cada movimiento) y promociones por vencimiento.
     */
    public function up(): void
    {
        // Un lote de un producto en una sucursal. quantity = unidades base disponibles.
        Schema::create('batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained();
            $table->foreignId('branch_id')->constrained();
            $table->string('batch_number', 50);
            $table->date('expires_at');
            $table->unsignedInteger('quantity')->default(0);
            // Costo de UNA unidad base
            $table->decimal('unit_cost', 14, 4);
            $table->timestamps();
            $table->auditable();

            // Para la venta: lotes de un producto en una sucursal, el que vence primero adelante
            $table->index(['branch_id', 'product_id', 'expires_at']);
        });

        // KARDEX: el stock nunca se edita a mano; cada cambio queda como un movimiento.
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained();
            $table->foreignId('branch_id')->constrained();
            $table->foreignId('batch_id')->constrained();
            // compra, venta, ajuste_entrada, ajuste_salida, baja, transferencia_salida, transferencia_entrada,
            // anulacion_compra, anulacion_venta, anulacion_transferencia
            $table->string('type', 30)->index();
            // + entra, - sale (unidades base)
            $table->integer('quantity');
            $table->decimal('unit_cost', 14, 4);
            // Stock del producto en la sucursal DESPUÉS del movimiento
            $table->integer('balance');
            // Documento que lo originó (compra, venta, transferencia). null = ajuste manual
            $table->nullableMorphs('reference');
            $table->string('note')->nullable();
            $table->timestamps();
            $table->auditable();

            $table->index(['branch_id', 'product_id', 'id']);
        });

        // Reglas automáticas: "si faltan X días o menos, sugerir Y% de descuento"
        Schema::create('expiry_promotion_rules', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('days_before')->unique();
            $table->decimal('discount_percent', 5, 2);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->auditable();
        });

        // Descuento aplicado a un lote. Solo uno activo por lote (los anteriores quedan como historial).
        Schema::create('batch_promotions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('batch_id')->constrained();
            $table->decimal('discount_percent', 5, 2);
            // regla | manual
            $table->string('source', 10)->default('manual');
            $table->boolean('is_active')->default(true);
            // true = el precio final queda por debajo del costo (lo aprobó alguien con promociones.aprobar)
            $table->boolean('below_cost')->default(false);
            $table->timestamps();
            $table->auditable();

            $table->index(['batch_id', 'is_active']);
        });

        // Reglas iniciales (se cambian desde Promociones): 90 días → 10%, 60 → 20%, 30 → 30%
        $now = now();
        DB::table('expiry_promotion_rules')->insert([
            ['days_before' => 90, 'discount_percent' => 10, 'created_at' => $now, 'updated_at' => $now],
            ['days_before' => 60, 'discount_percent' => 20, 'created_at' => $now, 'updated_at' => $now],
            ['days_before' => 30, 'discount_percent' => 30, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('batch_promotions');
        Schema::dropIfExists('expiry_promotion_rules');
        Schema::dropIfExists('stock_movements');
        Schema::dropIfExists('batches');
    }
};
