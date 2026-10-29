<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA customers — Clientes
 *
 * Personas o empresas a las que se vende y que se quieren guardar (para el comprobante y el historial).
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK        Identificador (autoincremental).
 *   name                     VARCHAR(255)               Nombre o razón social.
 *   document_type            VARCHAR(10)                CI o NIT.
 *   document_number          VARCHAR(30)                Número de CI o NIT (opcional).
 *   phone                    VARCHAR(30)                Teléfono (opcional).
 *   email                    VARCHAR(255)               Correo (opcional).
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
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('document_type', 10)->default('CI');
            $table->string('document_number', 30)->nullable()->index();
            $table->string('phone', 30)->nullable();
            $table->string('email')->nullable();
            $table->timestamps();
            $table->auditable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
