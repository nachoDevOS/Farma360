<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA denominations — Billetes y monedas
 *
 * Los cortes que se cuentan al abrir y cerrar caja. Al migrar se cargan los de Bolivia (Bs 200 … Bs 0,10);
 * se cambian en Billetes y monedas sin tocar código.
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK        Identificador (autoincremental).
 *   value                    DECIMAL(10,2), único       Valor del billete o moneda.
 *   type                     VARCHAR(10)                billete | moneda.
 *   is_active                BOOLEAN                    false = no aparece en el conteo.
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
        Schema::create('denominations', function (Blueprint $table) {
            $table->id();
            $table->decimal('value', 10, 2)->unique();
            $table->string('type', 10);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->auditable();
        });

        // Billetes y monedas de Bolivia
        $now = now();
        DB::table('denominations')->insert(collect([
            [200, 'billete'], [100, 'billete'], [50, 'billete'], [20, 'billete'], [10, 'billete'],
            [5, 'moneda'], [2, 'moneda'], [1, 'moneda'], [0.5, 'moneda'], [0.2, 'moneda'], [0.1, 'moneda'],
        ])->map(fn (array $d) => ['value' => $d[0], 'type' => $d[1], 'created_at' => $now, 'updated_at' => $now])->all());
    }

    public function down(): void
    {
        Schema::dropIfExists('denominations');
    }
};
