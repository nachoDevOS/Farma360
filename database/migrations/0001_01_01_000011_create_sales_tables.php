<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * VENTAS: cabecera, ítems (uno por lote usado) y pagos.
     */
    public function up(): void
    {
        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->string('number', 20)->nullable()->unique();
            $table->foreignId('branch_id')->constrained();
            $table->foreignId('cash_session_id')->constrained();
            $table->foreignId('customer_id')->nullable()->constrained();
            // Copia de los datos del cliente al momento de vender (para el comprobante)
            $table->string('customer_name')->nullable();
            $table->string('customer_document', 30)->nullable();
            $table->decimal('total', 14, 2);
            // Efectivo que entregó el cliente y su cambio
            $table->decimal('cash_received', 14, 2)->default(0);
            $table->decimal('change', 14, 2)->default(0);
            // Receta (obligatoria si se vende un producto controlado)
            $table->string('prescription_number', 50)->nullable();
            $table->string('prescription_doctor')->nullable();
            // completada | anulada
            $table->string('status', 15)->default('completada')->index();
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelUser_id')->nullable()->constrained('users');
            $table->string('cancel_reason')->nullable();
            $table->timestamps();
            $table->auditable();

            $table->index(['branch_id', 'created_at']);
        });

        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained();
            $table->foreignId('product_id')->constrained();
            $table->foreignId('product_presentation_id')->constrained();
            $table->foreignId('batch_id')->constrained();
            // Unidades base que salieron de ESTE lote
            $table->unsignedInteger('units');
            $table->unsignedInteger('factor');
            // Precio normal de la presentación, descuento por vencimiento y subtotal cobrado
            $table->decimal('list_price', 12, 2);
            $table->decimal('discount_percent', 5, 2)->default(0);
            $table->decimal('subtotal', 14, 2);
            // Costo de una unidad base del lote (para calcular la ganancia)
            $table->decimal('unit_cost', 14, 4);
            $table->timestamps();
            $table->auditable();
        });

        Schema::create('sale_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained();
            // efectivo | qr | tarjeta | transferencia (config/farmacia.php)
            $table->string('method', 20);
            $table->decimal('amount', 14, 2);
            $table->string('reference', 60)->nullable();
            $table->timestamps();
            $table->auditable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_payments');
        Schema::dropIfExists('sale_items');
        Schema::dropIfExists('sales');
    }
};
