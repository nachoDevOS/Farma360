<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA cache — Caché de Laravel
 *
 * Datos guardados un rato para no recalcularlos (ej: los permisos de cada rol). Tabla interna de Laravel.
 *
 * Columnas:
 *   key         VARCHAR(255), PK  Nombre del dato guardado.
 *   value       MEDIUMTEXT        Valor guardado.
 *   expiration  INT               Cuándo vence (marca de tiempo Unix).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cache', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->mediumText('value');
            $table->integer('expiration');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cache');
    }
};
