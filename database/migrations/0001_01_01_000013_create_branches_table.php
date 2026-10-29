<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA branches — Sucursales
 *
 * Cada farmacia o almacén de la empresa. El stock, las ventas y las cajas pertenecen a una sucursal.
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK        Identificador (autoincremental).
 *   code                     VARCHAR(20), único         Código corto (ej: CEN, NOR).
 *   name                     VARCHAR(255)               Nombre (ej: Farmacia Central).
 *   address                  VARCHAR(255)               Dirección (opcional).
 *   phone                    VARCHAR(30)                Teléfono (opcional).
 *   is_warehouse             BOOLEAN                    true = almacén central: no vende al público, abastece a las demás.
 *   is_active                BOOLEAN                    false = ya no opera (no aparece para vender ni comprar).
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
        Schema::create('branches', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique();
            $table->string('name');
            $table->string('address')->nullable();
            $table->string('phone', 30)->nullable();
            $table->boolean('is_warehouse')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->auditable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('branches');
    }
};
