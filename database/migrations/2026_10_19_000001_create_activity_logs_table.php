<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Crea la tabla de AUDITORÍA: un registro por cada acción importante del sistema.
     */
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            // Quién hizo la acción. null = invitado (ej: intento de login fallido). Si se borra el usuario, queda en null.
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            // Tipo de acción, con formato "grupo.accion" (ej: auth.login, user.created)
            $table->string('action', 50)->index();
            // Texto legible que se muestra en pantalla (ej: "Creó al usuario Ana Pérez")
            $table->string('description');
            // Sobre qué registro se hizo (ej: subject_type = App\Models\User, subject_id = 5). Opcional.
            $table->nullableMorphs('subject');
            // Datos extra en formato JSON (ej: qué campos cambiaron)
            $table->json('properties')->nullable();
            // Desde dónde se hizo
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->timestamp('created_at')->useCurrent()->index();
        });
    }

    /**
     * Borra la tabla (php artisan migrate:rollback).
     */
    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
