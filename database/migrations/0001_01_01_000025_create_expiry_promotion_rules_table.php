<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA expiry_promotion_rules — Reglas de descuento por vencimiento
 *
 * "Si faltan X días o menos para vencer, sugerir Y% de descuento". Se editan en Promociones.
 * Al migrar se cargan las reglas iniciales: 90 días → 10%, 60 → 20%, 30 → 30%.
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK        Identificador (autoincremental).
 *   days_before              INT UNSIGNED, único        Días que faltan para vencer (o menos).
 *   discount_percent         DECIMAL(5,2)               Descuento sugerido en %.
 *   is_active                BOOLEAN                    false = la regla no se aplica.
 *   created_at / updated_at  TIMESTAMP                  Fecha de registro y de la última modificación.
 *   registerUser_id          BIGINT UNSIGNED, FK users  Quién registró el registro (opcional).
 *   registerRole             VARCHAR(255)               Rol que tenía al registrarlo.
 *   deleteUser_id            BIGINT UNSIGNED, FK users  Quién lo eliminó (opcional).
 *   deleteRole               VARCHAR(255)               Rol que tenía al eliminarlo.
 *   deleted_at               TIMESTAMP                  Fecha de eliminación lógica (null = vigente). Nunca se borra de verdad.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expiry_promotion_rules', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('days_before')->unique();
            $table->decimal('discount_percent', 5, 2);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->auditable();
        });

        // Reglas iniciales (se cambian desde Promociones)
        $now = now();
        DB::table('expiry_promotion_rules')->insert([
            ['days_before' => 90, 'discount_percent' => 10, 'created_at' => $now, 'updated_at' => $now],
            ['days_before' => 60, 'discount_percent' => 20, 'created_at' => $now, 'updated_at' => $now],
            ['days_before' => 30, 'discount_percent' => 30, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('expiry_promotion_rules');
    }
};
