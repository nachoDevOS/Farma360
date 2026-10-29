/**
 * AVISOS FLOTANTES (abajo a la derecha).
 * Muestra los mensajes que Laravel manda con ->with('success', '...') o ->with('error', '...').
 */
import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Toast {
    id: number;
    type: 'success' | 'error';
    message: string;
}

export function FlashToast() {
    const { flash } = usePage<SharedData>().props;
    const [toasts, setToasts] = useState<Toast[]>([]);

    // Cada vez que llega un mensaje nuevo lo agregamos, y lo quitamos a los 4 segundos
    useEffect(() => {
        const incoming: Toast[] = [];
        if (flash?.success) incoming.push({ id: Date.now(), type: 'success', message: flash.success });
        if (flash?.error) incoming.push({ id: Date.now() + 1, type: 'error', message: flash.error });
        if (incoming.length === 0) return;

        setToasts((current) => [...current, ...incoming]);
        const timer = setTimeout(() => {
            setToasts((current) => current.filter((t) => !incoming.some((i) => i.id === t.id)));
        }, 4000);

        return () => clearTimeout(timer);
    }, [flash]);

    // Cerrar un aviso con la X
    const dismiss = (id: number) => setToasts((current) => current.filter((t) => t.id !== id));

    return (
        <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-full max-w-sm flex-col gap-2">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    role="status"
                    className="bg-background animate-in slide-in-from-bottom-4 fade-in pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-lg"
                >
                    {toast.type === 'success' ? (
                        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
                    ) : (
                        <XCircle className="mt-0.5 size-5 shrink-0 text-red-500" />
                    )}
                    <p className="flex-1 text-sm">{toast.message}</p>
                    <button onClick={() => dismiss(toast.id)} className="text-muted-foreground hover:text-foreground" aria-label="Cerrar">
                        <X className="size-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}
