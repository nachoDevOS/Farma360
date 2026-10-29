<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * TRANSFERENCIAS entre sucursales: se envía (sale del origen) y se recibe (entra al destino).
     */
    public function up(): void
    {
        Schema::create('transfers', function (Blueprint $table) {
            $table->id();
            $table->string('number', 20)->nullable()->unique();
            $table->foreignId('from_branch_id')->constrained('branches');
            $table->foreignId('to_branch_id')->constrained('branches');
            // enviada | recibida | anulada
            $table->string('status', 15)->default('enviada')->index();
            $table->string('note')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->foreignId('receiveUser_id')->nullable()->constrained('users');
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelUser_id')->nullable()->constrained('users');
            $table->string('cancel_reason')->nullable();
            $table->timestamps();
            $table->auditable();
        });

        Schema::create('transfer_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transfer_id')->constrained();
            $table->foreignId('product_id')->constrained();
            // Lote de origen y lote donde entró en el destino
            $table->foreignId('batch_id')->constrained();
            $table->foreignId('destination_batch_id')->nullable()->constrained('batches');
            $table->string('batch_number', 50);
            $table->date('expires_at');
            $table->decimal('unit_cost', 14, 4);
            $table->unsignedInteger('quantity'); // unidades base
            $table->timestamps();
            $table->auditable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transfer_items');
        Schema::dropIfExists('transfers');
    }
};
