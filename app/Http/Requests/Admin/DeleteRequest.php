<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Toda eliminación pide el motivo (ver ReasonDialog en confirm-dialog.tsx). Se guarda en deleteReason.
 *
 * El permiso para eliminar ya lo revisa la ruta (routes/admin.php).
 */
class DeleteRequest extends FormRequest
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
            'reason' => ['required', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['reason' => 'motivo'];
    }
}
