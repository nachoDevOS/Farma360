<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA transfers — Transferencias entre sucursales
 *
 * Envío de stock de una sucursal a otra: se envía (sale del origen), se recibe (entra al destino) o se anula.
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK           Identificador (autoincremental).
 *   number                   VARCHAR(20), único            Número correlativo (ej: T-000001).
 *   from_branch_id           BIGINT UNSIGNED, FK branches  Sucursal que envía.
 *   to_branch_id             BIGINT UNSIGNED, FK branches  Sucursal que recibe.
 *   status                   VARCHAR(15)                   enviada | recibida | anulada.
 *   note                     VARCHAR(255)                  Observación (opcional).
 *   received_at              TIMESTAMP                     Cuándo se recibió.
 *   receiveUser_id           BIGINT UNSIGNED, FK users     Quién la recibió.
 *   cancelled_at             TIMESTAMP                     Cuándo se anuló.
 *   cancelUser_id            BIGINT UNSIGNED, FK users     Quién la anuló.
 *   cancel_reason            VARCHAR(255)                  Motivo de la anulación.
 *   created_at / updated_at  TIMESTAMP                     Fecha de registro y de la última modificación.
 *   registerUser_id          BIGINT UNSIGNED, FK users     Quién registró el registro (opcional).
 *   registerRole             VARCHAR(255)                  Rol que tenía al registrarlo.
 *   deleteUser_id            BIGINT UNSIGNED, FK users     Quién lo eliminó (opcional).
 *   deleteRole               VARCHAR(255)                  Rol que tenía al eliminarlo.
 *   deleted_at               TIMESTAMP                     Fecha de eliminación lógica (null = vigente). Nunca se borra de verdad.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transfers', function (Blueprint $table) {
            $table->id();
            $table->string('number', 20)->nullable()->unique();
            $table->foreignId('from_branch_id')->constrained('branches');
            $table->foreignId('to_branch_id')->constrained('branches');
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
    }

    public function down(): void
    {
        Schema::dropIfExists('transfers');
    }
};
