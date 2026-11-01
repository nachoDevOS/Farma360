<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * El vencimiento del lote pasa a ser opcional (productos sin fecha de vencimiento impresa).
 * Un lote sin vencimiento se puede vender siempre y, en FEFO, sale después de los que sí vencen.
 */
return new class extends Migration
{
    /** @var list<string> */
    private array $tables = ['batches', 'purchase_items', 'transfer_items'];

    public function up(): void
    {
        foreach ($this->tables as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->date('expires_at')->nullable()->change();
            });
        }
    }

    public function down(): void
    {
        foreach ($this->tables as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->date('expires_at')->nullable(false)->change();
            });
        }
    }
};
