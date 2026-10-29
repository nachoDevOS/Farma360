<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TABLA users — Usuarios del sistema
 *
 * Personas que entran al panel. El ROL no es una columna: lo guarda spatie/laravel-permission (model_has_roles).
 *
 * Columnas:
 *   id                       BIGINT UNSIGNED, PK           Identificador (autoincremental).
 *   name                     VARCHAR(255)                  Nombre completo.
 *   email                    VARCHAR(255), único           Correo con el que inicia sesión.
 *   email_verified_at        TIMESTAMP                     Cuándo verificó el correo (null = sin verificar).
 *   password                 VARCHAR(255)                  Contraseña cifrada (hash).
 *   is_active                BOOLEAN                       false = no puede iniciar sesión.
 *   last_login_at            TIMESTAMP                     Último inicio de sesión (null = nunca entró).
 *   branch_id                BIGINT UNSIGNED, FK branches  Sucursal donde trabaja (null = ve todas). La FK se agrega en add_branch_foreign_key_to_users_table.
 *   remember_token           VARCHAR(100)                  Token de "recordarme" del inicio de sesión.
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
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_login_at')->nullable();
            // La clave foránea se crea después: branches necesita a users para sus columnas de auditoría
            $table->unsignedBigInteger('branch_id')->nullable()->index();
            $table->rememberToken();
            $table->timestamps();
            // REGLA DEL SISTEMA: registerUser_id, registerRole, deleteUser_id, deleteRole y deleted_at
            $table->auditable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
