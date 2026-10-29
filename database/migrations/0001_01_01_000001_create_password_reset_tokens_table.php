<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA password_reset_tokens — Recuperación de contraseña
 *
 * Códigos temporales que se envían por correo para cambiar la contraseña olvidada. Tabla interna de Laravel.
 *
 * Columnas:
 *   email       VARCHAR(255), PK  Correo del usuario que pidió el cambio.
 *   token       VARCHAR(255)      Código cifrado del enlace enviado.
 *   created_at  TIMESTAMP         Cuándo se pidió (el enlace vence después de un tiempo).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('password_reset_tokens');
    }
};
