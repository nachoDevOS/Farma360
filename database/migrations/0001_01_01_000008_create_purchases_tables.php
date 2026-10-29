<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * COMPRAS: mercadería que entra de un proveedor. Cada ítem crea un lote.
     */
    public function up(): void
    {
        Schema::create('purchases', function (Blueprint $table) {
            $table->id();
            $table->string('number', 20)->nullable()->unique();
            $table->foreignId('branch_id')->constrained();
            $table->foreignId('supplier_id')->constrained();
            // Número de factura / nota del proveedor
            $table->string('invoice_number', 50)->nullable();
            $table->date('purchased_at');
            $table->decimal('total', 14, 2)->default(0);
            // registrada | anulada
            $table->string('status', 15)->default('registrada')->index();
            $table->string('note')->nullable();
            // Anulación (no se borra: queda quién, cuándo y por qué)
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelUser_id')->nullable()->constrained('users');
            $table->string('cancel_reason')->nullable();
            $table->timestamps();
            $table->auditable();
        });

        Schema::create('purchase_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_id')->constrained();
            $table->foreignId('product_id')->constrained();
            $table->foreignId('product_presentation_id')->constrained();
            // Cantidad en la presentación comprada (ej: 5 cajas)
            $table->unsignedInteger('quantity');
            $table->unsignedInteger('factor');
            // quantity × factor (unidades base que entran al stock)
            $table->unsignedInteger('units');
            // Costo de una presentación y de una unidad base
            $table->decimal('cost', 14, 2);
            $table->decimal('unit_cost', 14, 4);
            $table->decimal('subtotal', 14, 2);
            $table->string('batch_number', 50);
            $table->date('expires_at');
            $table->foreignId('batch_id')->nullable()->constrained();
            $table->timestamps();
            $table->auditable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_items');
        Schema::dropIfExists('purchases');
    }
};
