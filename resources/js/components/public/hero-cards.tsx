/**
 * Piezas del sistema que flotan alrededor de la copa, con datos de ejemplo. Aparecen cuando la víbora llega arriba (app.css → .pub-card).
 * Copian el aspecto de la franja "Venta realizada" y del aviso de vencimiento.
 */
import { CalendarClock, Check } from 'lucide-react';

export function SaleCard({ className = '' }: { className?: string }) {
    return (
        <div className={`pub-card w-72 rounded-xl bg-white p-4 text-slate-900 shadow-2xl shadow-black/40 ${className}`}>
            <div className="flex items-center gap-3">
                <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-full">
                    <Check className="size-5" strokeWidth={3} />
                </span>
                <span>
                    <span className="block text-sm leading-tight font-semibold">Venta realizada</span>
                    <span className="block text-xs text-slate-500">V-000012 · Efectivo</span>
                </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-left">
                <span className="rounded-md bg-slate-100 px-2.5 py-1.5">
                    <span className="block text-[11px] text-slate-500">Total cobrado</span>
                    <span className="block font-bold tabular-nums">Bs 11,95</span>
                </span>
                <span className="bg-primary/10 text-primary rounded-md px-2.5 py-1.5">
                    <span className="block text-[11px]">Entregar al cliente</span>
                    <span className="block font-bold tabular-nums">Bs 38,05</span>
                </span>
            </div>
        </div>
    );
}

export function ExpiryCard({ className = '' }: { className?: string }) {
    return (
        <div className={`pub-card flex w-60 items-center gap-3 rounded-xl bg-white p-3 text-slate-900 shadow-2xl shadow-black/40 ${className}`}>
            <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                <CalendarClock className="size-5" />
            </span>
            <span>
                <span className="block text-sm leading-tight font-semibold">Dolofen 500 mg</span>
                <span className="block text-xs text-slate-500">Lote por vencer · 26 días</span>
            </span>
        </div>
    );
}
