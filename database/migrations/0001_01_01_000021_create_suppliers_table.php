<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA suppliers — Proveedores
 *
 * Distribuidoras y laboratorios a los que se compra.
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK        Identificador (autoincremental).
 *   name                     VARCHAR(255)               Razón social o nombre.
 *   nit                      VARCHAR(30)                NIT (opcional).
 *   contact_name             VARCHAR(255)               Persona de contacto (opcional).
 *   phone                    VARCHAR(30)                Teléfono (opcional).
 *   email                    VARCHAR(255)               Correo (opcional).
 *   address                  VARCHAR(255)               Dirección (opcional).
 *   is_active                BOOLEAN                    false = ya no se le compra.
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
        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('nit', 30)->nullable();
            $table->string('contact_name')->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('email')->nullable();
            $table->string('address')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->auditable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('suppliers');
    }
};
