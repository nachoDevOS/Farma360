<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * CAJA: cajas físicas, billetes y monedas, turnos (apertura / cierre con corte de billetes) y movimientos.
     */
    public function up(): void
    {
        Schema::create('cash_registers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained();
            $table->string('name', 60);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->auditable();
        });

        // Billetes y monedas que se cuentan en el corte (se editan sin tocar código)
        Schema::create('denominations', function (Blueprint $table) {
            $table->id();
            $table->decimal('value', 10, 2)->unique();
            // billete | moneda
            $table->string('type', 10);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->auditable();
        });

        // Un turno de caja: desde que se abre hasta que se cierra
        Schema::create('cash_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cash_register_id')->constrained();
            $table->foreignId('branch_id')->constrained();
            // Cajero dueño del turno
            $table->foreignId('user_id')->constrained();
            $table->timestamp('opened_at');
            $table->decimal('opening_amount', 14, 2);
            $table->timestamp('closed_at')->nullable();
            // Esperado según el sistema, contado por el cajero, y la diferencia (contado - esperado)
            $table->decimal('expected_amount', 14, 2)->nullable();
            $table->decimal('counted_amount', 14, 2)->nullable();
            $table->decimal('difference', 14, 2)->nullable();
            $table->string('close_note')->nullable();
            // abierta | pendiente (diferencia grande, espera revisión) | cerrada
            $table->string('status', 15)->default('abierta')->index();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('reviewUser_id')->nullable()->constrained('users');
            $table->string('review_note')->nullable();
            $table->timestamps();
            $table->auditable();
        });

        // Corte de billetes: cuántos de cada denominación se contaron al abrir y al cerrar
        Schema::create('cash_session_counts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cash_session_id')->constrained();
            // apertura | cierre
            $table->string('moment', 10);
            $table->foreignId('denomination_id')->constrained();
            $table->decimal('value', 10, 2);
            $table->unsignedInteger('quantity');
            $table->decimal('subtotal', 14, 2);
            $table->timestamps();
            $table->auditable();
        });

        // Entradas y salidas de efectivo que no son ventas
        Schema::create('cash_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cash_session_id')->constrained();
            // ingreso | egreso | retiro (retiro parcial cuando se junta mucho efectivo)
            $table->string('type', 10);
            $table->decimal('amount', 14, 2);
            $table->string('reason');
            $table->timestamps();
            $table->auditable();
        });

        // Billetes y monedas de Bolivia (se cambian desde Caja → Billetes y monedas)
        $now = now();
        DB::table('denominations')->insert(collect([
            [200, 'billete'], [100, 'billete'], [50, 'billete'], [20, 'billete'], [10, 'billete'],
            [5, 'moneda'], [2, 'moneda'], [1, 'moneda'], [0.5, 'moneda'], [0.2, 'moneda'], [0.1, 'moneda'],
        ])->map(fn (array $d) => ['value' => $d[0], 'type' => $d[1], 'created_at' => $now, 'updated_at' => $now])->all());
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_movements');
        Schema::dropIfExists('cash_session_counts');
        Schema::dropIfExists('cash_sessions');
        Schema::dropIfExists('denominations');
        Schema::dropIfExists('cash_registers');
    }
};
