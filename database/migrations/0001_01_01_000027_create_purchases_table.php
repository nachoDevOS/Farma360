<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA purchases — Compras
 *
 * Mercadería recibida de un proveedor en una sucursal. Al guardarse crea los lotes y suma el stock.
 * No se borra: se ANULA (queda quién, cuándo y por qué) y el stock se descuenta.
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK            Identificador (autoincremental).
 *   number                   VARCHAR(20), único             Número correlativo (ej: C-000001).
 *   branch_id                BIGINT UNSIGNED, FK branches   Sucursal que recibe.
 *   supplier_id              BIGINT UNSIGNED, FK suppliers  Proveedor.
 *   invoice_number           VARCHAR(50)                    N° de factura o nota del proveedor (opcional).
 *   purchased_at             DATE                           Fecha de la compra.
 *   total                    DECIMAL(14,2)                  Total de la compra.
 *   status                   VARCHAR(15)                    registrada | anulada.
 *   note                     VARCHAR(255)                   Observación (opcional).
 *   cancelled_at             TIMESTAMP                      Cuándo se anuló (null = vigente).
 *   cancelUser_id            BIGINT UNSIGNED, FK users      Quién la anuló.
 *   cancel_reason            VARCHAR(255)                   Motivo de la anulación.
 *   created_at / updated_at  TIMESTAMP                      Fecha de registro y de la última modificación.
 *   registerUser_id          BIGINT UNSIGNED, FK users      Quién registró el registro (opcional).
 *   registerRole             VARCHAR(255)                   Rol que tenía al registrarlo.
 *   deleteUser_id            BIGINT UNSIGNED, FK users      Quién lo eliminó (opcional).
 *   deleteRole               VARCHAR(255)                   Rol que tenía al eliminarlo.
 *   deleted_at               TIMESTAMP                      Fecha de eliminación lógica (null = vigente). Nunca se borra de verdad.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchases', function (Blueprint $table) {
            $table->id();
            $table->string('number', 20)->nullable()->unique();
            $table->foreignId('branch_id')->constrained();
            $table->foreignId('supplier_id')->constrained();
            $table->string('invoice_number', 50)->nullable();
            $table->date('purchased_at');
            $table->decimal('total', 14, 2)->default(0);
            $table->string('status', 15)->default('registrada')->index();
            $table->string('note')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelUser_id')->nullable()->constrained('users');
            $table->string('cancel_reason')->nullable();
            $table->timestamps();
            $table->auditable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchases');
    }
};
