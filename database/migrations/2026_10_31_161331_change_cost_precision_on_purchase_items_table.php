<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * purchase_items.cost pasa de DECIMAL(14,2) a DECIMAL(14,5): el costo de una presentación se registra con hasta 5 decimales.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_items', function (Blueprint $table) {
            $table->decimal('cost', 14, 5)->change();
        });
    }

    public function down(): void
    {
        Schema::table('purchase_items', function (Blueprint $table) {
            $table->decimal('cost', 14, 2)->change();
        });
    }
};
