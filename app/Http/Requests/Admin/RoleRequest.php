<?php

namespace App\Http\Requests\Admin;

use App\Support\PermissionCatalog;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validación del formulario de rol (crear y editar).
 * POST /admin/roles  ·  PUT /admin/roles/{role}
 *
 * El permiso para entrar (roles.crear / roles.editar) ya lo revisa la ruta (routes/admin.php).
 */
class RoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            // Único, ignorando el propio rol al editar. No se puede usar el nombre reservado del Super Admin.
            'name' => [
                'required', 'string', 'max:50',
                Rule::unique('roles', 'name')->ignore($this->route('role')),
                Rule::notIn([PermissionCatalog::superAdmin()]),
            ],
            // Lista de permisos marcados. Cada uno tiene que existir en el catálogo (config/roles.php)
            'permissions' => ['array'],
            'permissions.*' => ['string', Rule::in(PermissionCatalog::all())],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'name' => 'nombre del rol',
            'permissions' => 'permisos',
            'permissions.*' => 'permiso',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.not_in' => 'Ese nombre está reservado para el rol con acceso total.',
        ];
    }
}
