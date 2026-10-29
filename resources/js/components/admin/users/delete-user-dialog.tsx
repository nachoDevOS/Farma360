/**
 * Pieza de Gestión de usuarios (se usa en pages/admin/users/index.tsx).
 */
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { type User } from '@/types';
import { router } from '@inertiajs/react';
import { LoaderCircle, UserX } from 'lucide-react';
import { useState } from 'react';

/** Ventana de confirmación antes de eliminar un usuario (UserController@destroy). */
export function DeleteUserDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
    const [processing, setProcessing] = useState(false);

    // DELETE /admin/users/{id}. router = navegación de Inertia (no recarga toda la página)
    const confirm = () => {
        if (!user) return;
        router.delete(route('admin.users.destroy', user.id), {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => {
                setProcessing(false);
                onClose();
            },
        });
    };

    return (
        <Dialog open={user !== null} onOpenChange={(value) => !value && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-red-500/10">
                        <UserX className="size-6 text-red-600" />
                    </div>
                    <DialogTitle>¿Eliminar a {user?.name}?</DialogTitle>
                    <DialogDescription>
                        Se eliminará la cuenta <strong>{user?.email}</strong> de forma permanente. Esta acción no se puede deshacer.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button variant="destructive" onClick={confirm} disabled={processing}>
                        {processing && <LoaderCircle className="size-4 animate-spin" />}
                        Eliminar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
