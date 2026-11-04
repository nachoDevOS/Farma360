/**
 * Ventana antes de eliminar un rol (RoleController@destroy).
 * Se usa en pages/admin/roles/index.tsx. Si el rol tiene usuarios, Laravel no deja eliminarlo y muestra el motivo.
 */
import { ReasonDialog } from '@/components/admin/common/confirm-dialog';
import { type RoleSummary } from '@/types/admin/roles';

export function DeleteRoleDialog({ role, onClose }: { role: RoleSummary | null; onClose: () => void }) {
    return (
        <ReasonDialog
            action="eliminar"
            open={role !== null}
            onClose={onClose}
            title={`¿Eliminar el rol ${role?.name}?`}
            url={role ? route('admin.roles.destroy', role.id) : ''}
        />
    );
}
