/**
 * VENTANAS DE CONFIRMACIÓN reutilizables.
 *
 * ConfirmDialog: "¿Seguro?" → Sí / Cancelar. Ej: eliminar, recibir una transferencia.
 *   <ConfirmDialog open={...} onClose={...} title="¿Eliminar?" description="..." onConfirm={() => router.delete(...)} />
 *
 * ReasonDialog: igual, pero pide un MOTIVO obligatorio y lo envía por POST. Ej: anular una venta o una compra.
 *   <ReasonDialog open={...} onClose={...} title="Anular venta" url={route('admin.sales.cancel', sale.id)} />
 */
import InputError from '@/components/shared/input-error';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler, useEffect, useState } from 'react';

interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: React.ReactNode;
    confirmLabel?: string;
    destructive?: boolean;
    /** Debe hacer la petición; llamar a done() cuando termine */
    onConfirm: (done: () => void) => void;
}

export function ConfirmDialog({ open, onClose, title, description, confirmLabel = 'Confirmar', destructive, onConfirm }: ConfirmDialogProps) {
    const [processing, setProcessing] = useState(false);

    const confirm = () => {
        setProcessing(true);
        onConfirm(() => {
            setProcessing(false);
            onClose();
        });
    };

    return (
        <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        variant={destructive ? 'destructive' : 'default'}
                        className={destructive ? '' : 'btn-brand'}
                        onClick={confirm}
                        disabled={processing}
                    >
                        {processing && <LoaderCircle className="size-4 animate-spin" />}
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface ReasonDialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: React.ReactNode;
    url: string;
    confirmLabel?: string;
}

export function ReasonDialog({ open, onClose, title, description, url, confirmLabel = 'Anular' }: ReasonDialogProps) {
    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({ reason: '' });

    useEffect(() => {
        if (open) {
            reset();
            clearErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(url, { preserveScroll: true, onSuccess: () => onClose() });
    };

    return (
        <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={submit} className="grid gap-4">
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        {description && <DialogDescription>{description}</DialogDescription>}
                    </DialogHeader>
                    <div className="grid gap-2">
                        <Label htmlFor="reason">Motivo</Label>
                        <Input
                            id="reason"
                            value={data.reason}
                            onChange={(e) => setData('reason', e.target.value)}
                            autoFocus
                            placeholder="Ej: error de registro"
                        />
                        <InputError message={errors.reason} />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit" variant="destructive" disabled={processing || data.reason.trim() === ''}>
                            {processing && <LoaderCircle className="size-4 animate-spin" />}
                            {confirmLabel}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
