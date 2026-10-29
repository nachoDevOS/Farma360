<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use App\Support\PermissionCatalog;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules;
use Illuminate\Validation\Validator;

/**
 * Validación del formulario "Nuevo usuario" (POST /admin/users).
 *
 * Un Form Request saca la validación del controlador: si los datos no cumplen
 * las reglas, Laravel devuelve los errores a React ANTES de entrar al controlador.
 */
class StoreUserRequest extends FormRequest
{
    /**
     * ¿Quién puede enviar este formulario? Lo decide UserPolicy@create.
     */
    public function authorize(): bool
    {
        return $this->user()->can('create', User::class);
    }

    /**
     * Reglas de cada campo.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', Rule::unique(User::class)],
            // Debe ser un rol que exista en la tabla roles (se administran en Administración → Roles)
            'role' => ['required', 'string', Rule::exists('roles', 'name')],
            'is_active' => ['boolean'],
            // Password::defaults() = mínimo 8 caracteres (se puede endurecer en AppServiceProvider)
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ];
    }

    /**
     * Solo un Super Admin puede crear otro Super Admin.
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($this->input('role') === PermissionCatalog::superAdmin() && ! $this->user()->isSuperAdmin()) {
                    $validator->errors()->add('role', 'Solo un Super Admin puede asignar el rol Super Admin.');
                }
            },
        ];
    }

    /**
     * Nombre en español de los campos, para los mensajes de error ("El campo rol es obligatorio").
     *
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'role' => 'rol',
            'is_active' => 'estado',
        ];
    }
}
