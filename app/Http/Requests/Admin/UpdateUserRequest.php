<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use App\Support\PermissionCatalog;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules;
use Illuminate\Validation\Validator;

/**
 * Validación del formulario "Editar usuario" (PUT /admin/users/{user}).
 */
class UpdateUserRequest extends FormRequest
{
    /**
     * ¿Quién puede editar a este usuario? Lo decide UserPolicy@update.
     */
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('user'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            // Único, pero ignorando al propio usuario que estamos editando
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', Rule::unique(User::class)->ignore($this->route('user'))],
            // Debe ser un rol que exista en la tabla roles (se administran en Administración → Roles)
            'role' => ['required', 'string', Rule::exists('roles', 'name')],
            'is_active' => ['boolean'],
            // Sucursal donde trabaja (vacío = todas)
            'branch_id' => ['nullable', Rule::exists('branches', 'id')->whereNull('deleted_at')],
            // nullable = se puede dejar vacía para no cambiarla
            'password' => ['nullable', 'confirmed', Rules\Password::defaults()],
        ];
    }

    /**
     * Validación extra que no se puede expresar con reglas simples.
     * Protecciones para no quedarse sin acceso:
     *   - nadie puede cambiar su propio rol ni desactivarse;
     *   - solo un Super Admin puede asignar el rol Super Admin.
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($this->input('role') === PermissionCatalog::superAdmin() && ! $this->user()->isSuperAdmin()) {
                    $validator->errors()->add('role', 'Solo un Super Admin puede asignar el rol Super Admin.');
                }

                if (! $this->route('user')->is($this->user())) {
                    return;
                }

                if ($this->input('role') !== $this->user()->role) {
                    $validator->errors()->add('role', 'No puedes cambiar tu propio rol.');
                }

                if (! $this->boolean('is_active', true)) {
                    $validator->errors()->add('is_active', 'No puedes desactivar tu propia cuenta.');
                }
            },
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'role' => 'rol',
            'is_active' => 'estado',
            'branch_id' => 'sucursal',
        ];
    }
}
