/**
 * CORTE DE BILLETES con las fotos reales de los billetes y monedas (public/images/cash/{valor}.jpg).
 * Se usa al abrir y al cerrar la caja (pages/admin/cash/index.tsx).
 *
 * Cómo se cuenta (pensado también para pantalla táctil):
 *   - Tocar la foto        → suma uno
 *   - Clic derecho / −     → quita uno
 *   - O escribir la cantidad en el casillero
 * Con cantidad > 0 el billete se ve "apilado" y aparece un globo con la cantidad.
 *
 *   <BillCounter denominations={denominations} counts={data.counts} onChange={(counts) => setData('counts', counts)} />
 *
 * counts = { [id de la denominación]: cantidad }
 * Si se agrega un valor nuevo en "Billetes y monedas", sube su foto como public/images/cash/{valor}.jpg
 * (ej: 500.jpg). Mientras no haya foto se muestra una etiqueta de color.
 */
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Denomination } from '@/types/admin/pharmacy';
import { Banknote, Coins, Hand, Minus, Plus } from 'lucide-react';
import { useState } from 'react';

export type Counts = Record<string, string>;

/** Ruta de la foto: 200 → /images/cash/200.jpg · 0.5 → /images/cash/0.5.jpg */
export const cashPhoto = (value: number | string) => `/images/cash/${Number(value)}.jpg`;

/** "200 Bs" o "50 ctvs" */
export const cashLabel = (value: number | string) => (Number(value) >= 1 ? `${Number(value)} Bs` : `${Math.round(Number(value) * 100)} ctvs`);

/** Miniatura del billete (rectángulo) o moneda (círculo). Se usa en resúmenes e historial. */
export function CashThumb({ value, className }: { value: number | string; className?: string }) {
    const [broken, setBroken] = useState(false);
    const isBill = Number(value) >= 10;
    if (broken) return null;
    return (
        <img
            src={cashPhoto(value)}
            alt=""
            onError={() => setBroken(true)}
            className={cn('shrink-0 object-cover shadow-sm ring-1 ring-black/10', isBill ? 'h-7 w-14 rounded' : 'size-7 rounded-full', className)}
        />
    );
}

/**
 * RESUMEN DEL CONTEO: una línea por billete / moneda contado, con miniatura ("3 × 200 Bs = 600,00").
 * Para revisar de un vistazo antes de abrir o cerrar la caja.
 */
export function CountSummary({ denominations, counts }: { denominations: Denomination[]; counts: Counts }) {
    const rows = denominations.filter((d) => Number(counts[d.id] || 0) > 0);

    if (rows.length === 0) {
        return <p className="text-muted-foreground py-3 text-center text-xs">Lo que cuentes aparecerá aquí.</p>;
    }

    return (
        <ul className="grid gap-2">
            {rows.map((d) => {
                const quantity = Number(counts[d.id]);
                return (
                    <li key={d.id} className="animate-in fade-in slide-in-from-left-1 flex items-center gap-3 text-sm duration-200">
                        <CashThumb value={d.value} />
                        <span className="num text-muted-foreground">
                            {quantity} × <span className="text-foreground font-medium">{cashLabel(d.value)}</span>
                        </span>
                        <span className="num ml-auto font-semibold">{money(quantity * Number(d.value), false)}</span>
                    </li>
                );
            })}
        </ul>
    );
}

export function countTotal(denominations: Denomination[], counts: Counts): number {
    return denominations.reduce((sum, d) => sum + Number(d.value) * Number(counts[d.id] || 0), 0);
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
    const bills = denominations.filter((d) => d.type === 'billete');
    const coins = denominations.filter((d) => d.type === 'moneda');
    const set = (d: Denomination, quantity: number) => onChange({ ...counts, [d.id]: quantity > 0 ? String(quantity) : '' });
    const pieces = (list: Denomination[]) => list.reduce((s, d) => s + Number(counts[d.id] || 0), 0);

    return (
        <div className="grid gap-7">
            <p className="text-muted-foreground bg-muted/50 flex items-center gap-2 rounded-lg px-3 py-2 text-xs">
                <Hand className="size-4 shrink-0" />
                Toca la foto para sumar uno · clic derecho o <Minus className="inline size-3" /> para quitar · o escribe la cantidad.
            </p>

            <Group icon={Banknote} title="Billetes" pieces={pieces(bills)} total={countTotal(bills, counts)}>
                <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                    {bills.map((d) => (
                        <Tile key={d.id} denomination={d} quantity={Number(counts[d.id] || 0)} onChange={(q) => set(d, q)} />
                    ))}
                </div>
            </Group>

            <Group icon={Coins} title="Monedas" pieces={pieces(coins)} total={countTotal(coins, counts)}>
                <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 2xl:grid-cols-6">
                    {coins.map((d) => (
                        <Tile key={d.id} denomination={d} quantity={Number(counts[d.id] || 0)} onChange={(q) => set(d, q)} />
                    ))}
                </div>
            </Group>
        </div>
    );
}

function Group({
    icon: Icon,
    title,
    pieces,
    total,
    children,
}: {
    icon: typeof Banknote;
    title: string;
    pieces: number;
    total: number;
    children: React.ReactNode;
}) {
    return (
        <section className="grid gap-4">
            <div className="flex items-end justify-between border-b pb-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Icon className="text-muted-foreground size-4" /> {title}
                    {pieces > 0 && <span className="text-muted-foreground font-normal">· {pieces}</span>}
                </h3>
                <span className="num font-semibold">{money(total)}</span>
            </div>
            {children}
        </section>
    );
}

function Tile({ denomination, quantity, onChange }: { denomination: Denomination; quantity: number; onChange: (q: number) => void }) {
    const value = Number(denomination.value);
    const isBill = denomination.type === 'billete';
    const active = quantity > 0;
    const [broken, setBroken] = useState(false);
    const label = cashLabel(value);

    return (
        <div className="group flex flex-col items-center gap-3">
            {/* FOTO: tocar suma, clic derecho resta */}
            <button
                type="button"
                onClick={() => onChange(quantity + 1)}
                onContextMenu={(e) => {
                    e.preventDefault();
                    onChange(Math.max(0, quantity - 1));
                }}
                aria-label={`Sumar un ${label}`}
                title={`Sumar un ${label}`}
                className={cn(
                    'focus-visible:ring-ring relative block outline-none focus-visible:ring-3',
                    isBill ? 'w-full rounded-lg' : 'aspect-square w-24 rounded-full sm:w-28',
                )}
            >
                {/* Pila: hojas detrás cuando hay más de uno */}
                {isBill && quantity > 1 && <span className="bg-foreground/10 absolute inset-0 translate-x-2 translate-y-2 rounded-lg" />}
                {isBill && quantity > 2 && <span className="bg-foreground/10 absolute inset-0 translate-x-1 translate-y-1 rounded-lg" />}
                {!isBill && quantity > 1 && <span className="bg-foreground/15 absolute inset-0 translate-y-1.5 rounded-full" />}

                {broken ? (
                    <span
                        className={cn(
                            'bg-muted text-foreground relative flex items-center justify-center font-bold',
                            isBill ? 'aspect-[2/1] w-full rounded-lg text-2xl' : 'size-full rounded-full text-sm',
                        )}
                    >
                        {label}
                    </span>
                ) : (
                    <img
                        src={cashPhoto(value)}
                        alt={label}
                        draggable={false}
                        onError={() => setBroken(true)}
                        className={cn(
                            'relative block transition-[transform,box-shadow,filter] duration-150 select-none group-active:scale-95',
                            isBill
                                ? 'aspect-[2/1] w-full rounded-lg object-cover shadow-md group-hover:-translate-y-1 group-hover:shadow-lg'
                                : 'size-full scale-[1.02] rounded-full object-cover shadow-md ring-1 ring-black/10 group-hover:-translate-y-1 group-hover:shadow-lg',
                            !active && 'saturate-[.85]',
                        )}
                    />
                )}

                {/* "+1" al pasar el mouse */}
                <span
                    className={cn(
                        'bg-primary text-primary-foreground pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[11px] font-semibold opacity-0 shadow transition-opacity group-hover:opacity-100',
                        !isBill && 'bottom-1',
                    )}
                >
                    +1
                </span>

                {/* Globo con la cantidad (key: se anima cada vez que cambia) */}
                {active && (
                    <span
                        key={quantity}
                        className="bg-primary text-primary-foreground ring-background animate-in zoom-in-50 num absolute -top-2.5 -right-2.5 flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-sm font-bold shadow-md ring-2 duration-200"
                    >
                        ×{quantity}
                    </span>
                )}
            </button>

            {/* − cantidad + y subtotal */}
            <div className="flex w-full max-w-44 items-center gap-1.5">
                <button
                    type="button"
                    onClick={() => onChange(Math.max(0, quantity - 1))}
                    disabled={!active}
                    className="hover:bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:opacity-40"
                    aria-label={`Quitar un ${label}`}
                >
                    <Minus className="size-3.5" />
                </button>
                <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={quantity || ''}
                    placeholder="0"
                    onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                    onFocus={(e) => e.target.select()}
                    className={cn(
                        'num focus-visible:border-ring focus-visible:ring-ring/20 h-8 w-full min-w-0 [appearance:textfield] rounded-lg border text-center text-sm font-semibold outline-none focus-visible:ring-3 [&::-webkit-inner-spin-button]:appearance-none',
                        active
                            ? 'border-primary/40 bg-primary/5 text-foreground'
                            : 'placeholder:text-muted-foreground/40 border-dashed bg-transparent',
                    )}
                    aria-label={`Cantidad de ${label}`}
                />
                <button
                    type="button"
                    onClick={() => onChange(quantity + 1)}
                    className="bg-primary/10 text-primary hover:bg-primary/15 flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors"
                    aria-label={`Sumar un ${label}`}
                >
                    <Plus className="size-3.5" />
                </button>
            </div>
            <p className={cn('num text-primary -mt-1.5 text-xs font-semibold', !active && 'invisible')}>= {money(value * quantity)}</p>
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
