/**
 * Pieza de Gestión de usuarios (se usa en pages/admin/users/index.tsx).
 */
import { ReasonDialog } from '@/components/admin/common/confirm-dialog';
import { type User } from '@/types';

/** Ventana antes de eliminar un usuario (UserController@destroy). */
export function DeleteUserDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
    return (
        <ReasonDialog
            action="eliminar"
            open={user !== null}
            onClose={onClose}
            title={`¿Eliminar a ${user?.name}?`}
            url={user ? route('admin.users.destroy', user.id) : ''}
        />
    );
}
