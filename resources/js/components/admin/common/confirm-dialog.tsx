/**
 * VENTANAS DE CONFIRMACIÓN reutilizables.
 *
 * ConfirmDialog: "¿Seguro?" → Sí / Cancelar. Ej: recibir una transferencia. Nunca para eliminar.
 *   <ConfirmDialog open={...} onClose={...} title="¿Recibir?" description="..." onConfirm={(done) => router.post(...)} />
 *
 * ReasonDialog: la ventana GLOBAL para ELIMINAR y ANULAR. Pide el motivo y un check de confirmación; sin los dos no deja seguir.
 *   <ReasonDialog action="eliminar" open={...} onClose={...} title="¿Eliminar?" url={route('admin.products.destroy', id)} />  → DELETE
 *   <ReasonDialog open={...} onClose={...} title="Anular venta" url={route('admin.sales.cancel', id)} />                      → POST
 *   Envía { reason }. Al eliminar se guarda en deleteReason (ver DeleteRequest y el trait Auditable).
 */
import InputError from '@/components/shared/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useForm } from '@inertiajs/react';
import { LoaderCircle, Trash2 } from 'lucide-react';
import { FormEventHandler, useEffect, useState } from 'react';

interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: React.ReactNode;
    confirmLabel?: string;
    /** Debe hacer la petición; llamar a done() cuando termine */
    onConfirm: (done: () => void) => void;
}

export function ConfirmDialog({ open, onClose, title, description, confirmLabel = 'Confirmar', onConfirm }: ConfirmDialogProps) {
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
                    <Button className="btn-brand" onClick={confirm} disabled={processing}>
                        {processing && <LoaderCircle className="size-4 animate-spin" />}
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Lo único que cambia entre eliminar y anular: la ventana es la misma en todo el sistema
const reasonActions = {
    eliminar: {
        method: 'delete',
        label: 'Eliminar',
        question: '¿Por qué se elimina?',
        check: 'Confirmo que quiero eliminarlo.',
    },
    anular: {
        method: 'post',
        label: 'Anular',
        question: '¿Por qué se anula?',
        check: 'Confirmo que quiero anularlo.',
    },
} as const;

interface ReasonDialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    url: string;
    action?: keyof typeof reasonActions;
}

export function ReasonDialog({ open, onClose, title, url, action = 'anular' }: ReasonDialogProps) {
    const { data, setData, submit, processing, errors, reset, clearErrors } = useForm({ reason: '' });
    const [confirmed, setConfirmed] = useState(false);
    const { method, label, question, check } = reasonActions[action];

    useEffect(() => {
        if (open) {
            reset();
            clearErrors();
            setConfirmed(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const send: FormEventHandler = (e) => {
        e.preventDefault();
        submit(method, url, { preserveScroll: true, onSuccess: () => onClose() });
    };

    return (
        <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
            <DialogContent className="bg-card w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-xl p-0 sm:max-w-[440px] sm:rounded-xl">
                <div className="bg-destructive h-1" />
                <form onSubmit={send}>
                    <DialogHeader className="flex-row items-start gap-3.5 space-y-0 px-5 pt-5 pr-11 pb-4 text-left sm:text-left">
                        <div className="bg-destructive/10 text-destructive ring-destructive/15 flex size-10 shrink-0 items-center justify-center rounded-lg ring-1">
                            <Trash2 className="size-5" />
                        </div>
                        <div className="grid min-w-0 gap-1">
                            <DialogTitle className="text-[15px] leading-snug font-bold">{title}</DialogTitle>
                            <DialogDescription className="text-[13px]">Esta acción no se puede deshacer.</DialogDescription>
                        </div>
                    </DialogHeader>
                    <div className="grid gap-3 px-5 pb-5">
                        <div className="grid gap-1.5">
                            <div className="flex items-baseline justify-between gap-3">
                                <Label htmlFor="reason">{question}</Label>
                                <span className="text-muted-foreground text-[11px] tabular-nums">{data.reason.length}/255</span>
                            </div>
                            <textarea
                                id="reason"
                                value={data.reason}
                                onChange={(e) => setData('reason', e.target.value)}
                                rows={3}
                                maxLength={255}
                                autoFocus
                                placeholder="Ej: se registró por error"
                                className="border-input bg-card placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/20 dark:bg-background/60 w-full resize-none rounded-md border px-3 py-2 text-sm shadow-xs transition-[border-color,box-shadow] outline-none focus-visible:ring-3"
                            />
                            <InputError message={errors.reason} />
                        </div>
                        <label htmlFor="reason-confirmed" className="flex cursor-pointer items-center gap-2.5">
                            <Checkbox id="reason-confirmed" checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} />
                            <span className="text-[13px]">{check}</span>
                        </label>
                    </div>
                    <DialogFooter className="bg-muted/40 gap-2 border-t px-5 py-3 sm:space-x-0">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            variant="destructive"
                            disabled={processing || !confirmed || data.reason.trim() === ''}
                            className="disabled:opacity-100 disabled:[--btn-bg:var(--muted)] disabled:[--btn-fg:var(--muted-foreground)]"
                        >
                            {processing ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                            {label}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
