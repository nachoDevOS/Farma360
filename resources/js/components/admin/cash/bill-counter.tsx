/**
 * CORTE DE BILLETES en tabla compacta: Corte (foto + valor) · Cantidad · Subtotal, y el TOTAL al pie.
 * Se usa al abrir y al cerrar la caja (pages/admin/cash/index.tsx). Fotos: public/images/cash/{valor}.jpg
 *
 * Pensado para contar rápido:
 *   - Escribe la cantidad y presiona Enter → salta a la siguiente fila.
 *   - Tocar la foto suma uno · clic derecho en la foto resta uno · o botones − / +.
 *
 *   <BillCounter denominations={denominations} counts={data.counts} onChange={(counts) => setData('counts', counts)} />
 *
 * counts = { [id de la denominación]: cantidad }
 * Si se agrega un valor nuevo en "Billetes y monedas", sube su foto como public/images/cash/{valor}.jpg (ej: 500.jpg).
 */
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Denomination } from '@/types/admin/pharmacy';
import { Minus, Plus } from 'lucide-react';
import { useRef, useState } from 'react';

export type Counts = Record<string, string>;

/** Ruta de la foto: 200 → /images/cash/200.jpg · 0.5 → /images/cash/0.5.jpg */
export const cashPhoto = (value: number | string) => `/images/cash/${Number(value)}.jpg`;

/** "Bs 200" o "50 ctvs" */
export const cashLabel = (value: number | string) => (Number(value) >= 1 ? `Bs ${Number(value)}` : `${Math.round(Number(value) * 100)} ctvs`);

export function countTotal(denominations: Denomination[], counts: Counts): number {
    return denominations.reduce((sum, d) => sum + Number(d.value) * Number(counts[d.id] || 0), 0);
}

/** Miniatura del billete (rectángulo) o moneda (círculo). Si no hay foto, deja un espacio gris. */
export function CashThumb({ value, className }: { value: number | string; className?: string }) {
    const [broken, setBroken] = useState(false);
    const isBill = Number(value) >= 10;

    if (broken)
        return (
            <span
                className={cn('bg-muted block shrink-0', isBill ? 'h-6 w-12 rounded sm:h-8 sm:w-16' : 'size-7 rounded-full sm:size-8', className)}
            />
        );

    return (
        <img
            src={cashPhoto(value)}
            alt=""
            draggable={false}
            onError={() => setBroken(true)}
            className={cn(
                'shrink-0 object-cover shadow-sm ring-1 ring-black/10 select-none',
                isBill ? 'h-6 w-12 rounded sm:h-8 sm:w-16' : 'size-7 rounded-full sm:size-8',
                className,
            )}
        />
    );
}

export function BillCounter({
    denominations,
    counts,
    onChange,
}: {
    denominations: Denomination[];
    counts: Counts;
    onChange: (counts: Counts) => void;
}) {
    const inputs = useRef<(HTMLInputElement | null)[]>([]);
    const set = (d: Denomination, quantity: number) => onChange({ ...counts, [d.id]: quantity > 0 ? String(quantity) : '' });
    const total = countTotal(denominations, counts);

    // Billetes primero (de mayor a menor), luego monedas
    const rows = [...denominations].sort((a, b) => (a.type === b.type ? Number(b.value) - Number(a.value) : a.type === 'billete' ? -1 : 1));

    return (
        <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground border-b text-xs font-semibold tracking-wide uppercase">
                    <tr>
                        <th className="px-2 py-2.5 text-left sm:px-4">Corte</th>
                        <th className="px-2 py-2.5 text-center sm:px-4">Cantidad</th>
                        <th className="px-2 py-2.5 text-right sm:px-4">Subtotal</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {rows.map((d, i) => {
                        const value = Number(d.value);
                        const quantity = Number(counts[d.id] || 0);
                        const active = quantity > 0;
                        const firstCoin = d.type === 'moneda' && rows[i - 1]?.type === 'billete';

                        return (
                            <tr
                                key={d.id}
                                className={cn('transition-colors', active ? 'bg-primary/[0.06]' : 'hover:bg-muted/40', firstCoin && 'border-t-2')}
                            >
                                <td className="px-2 py-2 sm:px-4">
                                    <button
                                        type="button"
                                        onClick={() => set(d, quantity + 1)}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            set(d, Math.max(0, quantity - 1));
                                        }}
                                        title="Tocar: +1 · Clic derecho: −1"
                                        className="group flex items-center gap-2 text-left sm:gap-3"
                                    >
                                        <span className="flex w-12 justify-center transition-transform group-hover:-translate-y-0.5 group-active:scale-95 sm:w-16">
                                            <CashThumb value={d.value} />
                                        </span>
                                        <span className={cn('num font-semibold whitespace-nowrap', !active && 'text-foreground/80')}>
                                            {cashLabel(value)}
                                        </span>
                                    </button>
                                </td>
                                <td className="px-2 py-2 sm:px-4">
                                    <div className="stepper mx-auto" data-active={active}>
                                        <button
                                            type="button"
                                            tabIndex={-1}
                                            onClick={() => set(d, Math.max(0, quantity - 1))}
                                            disabled={!active}
                                            aria-label={`Quitar un ${cashLabel(value)}`}
                                        >
                                            <Minus className="size-3.5" />
                                        </button>
                                        <input
                                            ref={(el) => {
                                                inputs.current[i] = el;
                                            }}
                                            type="number"
                                            min={0}
                                            inputMode="numeric"
                                            value={quantity || ''}
                                            placeholder="0"
                                            onChange={(e) => set(d, Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                                            onFocus={(e) => e.target.select()}
                                            onKeyDown={(e) => {
                                                // Enter = siguiente fila (como en una planilla)
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    inputs.current[i + 1]?.focus();
                                                }
                                            }}
                                            className={cn('text-sm', !active && 'placeholder:text-muted-foreground/50')}
                                            aria-label={`Cantidad de ${cashLabel(value)}`}
                                        />
                                        <button
                                            type="button"
                                            tabIndex={-1}
                                            onClick={() => set(d, quantity + 1)}
                                            aria-label={`Sumar un ${cashLabel(value)}`}
                                        >
                                            <Plus className="size-3.5" />
                                        </button>
                                    </div>
                                </td>
                                <td
                                    className={cn(
                                        'num px-2 py-2 text-right whitespace-nowrap sm:px-4',
                                        active ? 'font-semibold' : 'text-muted-foreground/50',
                                    )}
                                >
                                    {money(value * quantity, false)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr className="bg-muted/40 border-t-2">
                        <td colSpan={2} className="px-2 py-3 text-right text-sm font-semibold tracking-wide uppercase sm:px-4">
                            Total
                        </td>
                        <td className="num text-primary px-2 py-3 text-right text-base font-bold whitespace-nowrap sm:px-4">{money(total)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

/** Convierte el formulario a lo que espera Laravel: solo cantidades > 0, como números. */
export function cleanCounts(counts: Counts): Record<string, number> {
    return Object.fromEntries(
        Object.entries(counts)
            .filter(([, q]) => Number(q) > 0)
            .map(([id, q]) => [id, Number(q)]),
    );
}
