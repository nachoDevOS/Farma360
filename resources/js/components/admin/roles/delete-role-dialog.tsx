/**
 * Ventana de confirmación antes de eliminar un rol (RoleController@destroy).
 * Se usa en pages/admin/roles/index.tsx. Si el rol tiene usuarios, Laravel no deja eliminarlo y muestra el motivo.
 */
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { type RoleSummary } from '@/types/admin/roles';
import { router } from '@inertiajs/react';
import { LoaderCircle, ShieldX } from 'lucide-react';
import { useState } from 'react';

export function DeleteRoleDialog({ role, onClose }: { role: RoleSummary | null; onClose: () => void }) {
    const [processing, setProcessing] = useState(false);

    // DELETE /admin/roles/{id}
    const confirm = () => {
        if (!role) return;
        router.delete(route('admin.roles.destroy', role.id), {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => {
                setProcessing(false);
                onClose();
            },
        });
    };

    return (
        <Dialog open={role !== null} onOpenChange={(value) => !value && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-red-500/10">
                        <ShieldX className="size-6 text-red-600" />
                    </div>
                    <DialogTitle>¿Eliminar el rol {role?.name}?</DialogTitle>
                    <DialogDescription>Se eliminará el rol y sus permisos. Esta acción no se puede deshacer.</DialogDescription>
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
