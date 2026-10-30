/**
 * GRÁFICOS DE LA FICHA DE INVENTARIO (pages/admin/inventory/show.tsx), sin librerías.
 * Datos: InventoryController@show → history (un día por fila, sacado del kardex).
 *
 *   <StockCharts history={history} minStock={product.min_stock} baseUnit={product.base_unit} movementTypes={movementTypes} />
 *
 * - Evolución del stock: saldo al cierre de cada día (escalones: el stock cambia de golpe) y una línea
 *   punteada en el stock mínimo. Al pasar el mouse (o con ← → teniendo el foco) muestra el detalle del día.
 * - Entradas y salidas por semana: columnas hacia arriba (entró) y hacia abajo (salió) sobre el mismo eje.
 * El filtro "30 / 90 días" está arriba y cambia los dos. La tabla de cada valor es el kardex de la misma página.
 * Colores: azul = entradas / stock (--chart-1), ámbar = salidas (amber-600 en claro, --chart-4 en oscuro):
 * validados para daltonismo y contraste en claro y oscuro.
 */
import { SegmentedControl } from '@/components/admin/common/segmented-control';
import { plural } from '@/components/admin/products/presentation-levels';
import { formatDay } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useLayoutEffect, useRef, useState } from 'react';

/** Un día de la historia del stock. Ver InventoryController@stockHistory. */
export interface StockDay {
    date: string;
    /** Stock al cierre del día */
    balance: number;
    /** Unidades que entraron / salieron ese día */
    in: number;
    out: number;
    /** Neto por tipo de movimiento (venta: -12, compra: 100…) */
    types: Record<string, number>;
}

interface Props {
    history: StockDay[];
    minStock: number;
    baseUnit: string;
    movementTypes: Record<string, string>;
}

const RANGES = [30, 90] as const;

export function StockCharts({ history, minStock, baseUnit, movementTypes }: Props) {
    const [range, setRange] = useState<(typeof RANGES)[number]>(30);
    const days = history.slice(-range);
    const units = plural(baseUnit);

    return (
        <div className="grid gap-3">
            {/* Un solo filtro, arriba de los dos gráficos */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-sm">Período:</span>
                <SegmentedControl
                    label="Período"
                    value={range}
                    onChange={setRange}
                    options={RANGES.map((r) => ({ value: r, label: `Últimos ${r} días` }))}
                />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
                <ChartCard title="Evolución del stock" description={`Stock al cierre de cada día, en ${units}.`}>
                    <StockLineChart days={days} minStock={minStock} units={units} movementTypes={movementTypes} />
                </ChartCard>
                <ChartCard title="Entradas y salidas por semana" description={`Lo que entró y salió cada semana, en ${units}.`}>
                    <FlowChart days={days} units={units} movementTypes={movementTypes} />
                </ChartCard>
            </div>
        </div>
    );
}

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
    return (
        <div className="surface min-w-0 rounded-xl">
            <div className="border-b px-5 py-4">
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-muted-foreground text-xs">{description}</p>
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

/** Ancho real del contenedor (los gráficos se dibujan en píxeles para que las líneas no se deformen). */
function useWidth<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [width, setWidth] = useState(0);
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
        observer.observe(element);
        setWidth(element.getBoundingClientRect().width);
        return () => observer.disconnect();
    }, []);
    return [ref, width] as const;
}

/** Máximo "redondo" para el eje (4 divisiones con números limpios). */
function niceMax(value: number): number {
    if (value <= 4) return 4;
    const step = Math.pow(10, Math.floor(Math.log10(value / 4)));
    // Pasos finos (110 → 120, no 200) para no dejar aire de más arriba
    const nice = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * step).find((s) => s * 4 >= value) ?? step * 10;
    return nice * 4;
}

const compact = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString('es', { maximumFractionDigits: 1 })}K` : n.toLocaleString('es'));
const shortDay = (date: string) => formatDay(date).replace(/ \d{4}$/, '');

/** Detalle de un día o semana: neto por tipo de movimiento (venta −12, compra +100). */
function TypeLines({ types, movementTypes }: { types: Record<string, number>; movementTypes: Record<string, string> }) {
    const entries = Object.entries(types).filter(([, qty]) => qty !== 0);
    if (entries.length === 0) return <p className="text-muted-foreground">Sin movimientos</p>;
    return (
        <>
            {entries.map(([type, qty]) => (
                <p key={type} className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{movementTypes[type] ?? type}</span>
                    <span className="num font-medium">
                        {qty > 0 ? '+' : '−'}
                        {Math.abs(qty).toLocaleString('es')}
                    </span>
                </p>
            ))}
        </>
    );
}

const PLOT_HEIGHT = 200;
const AXIS_LEFT = 40;
const AXIS_BOTTOM = 22;
const PAD_TOP = 12;
const PAD_RIGHT = 12;

function StockLineChart({
    days,
    minStock,
    units,
    movementTypes,
}: {
    days: StockDay[];
    minStock: number;
    units: string;
    movementTypes: Record<string, string>;
}) {
    const [ref, width] = useWidth<HTMLDivElement>();
    const [active, setActive] = useState<number | null>(null);

    const max = niceMax(Math.max(minStock, ...days.map((d) => d.balance)));
    const plotWidth = Math.max(0, width - AXIS_LEFT - PAD_RIGHT);
    const x = (i: number) => AXIS_LEFT + (days.length > 1 ? (i / (days.length - 1)) * plotWidth : plotWidth / 2);
    const y = (v: number) => PAD_TOP + PLOT_HEIGHT - (v / max) * PLOT_HEIGHT;
    const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i);

    // Escalones: el saldo se mantiene hasta el día siguiente y cambia de golpe
    const line = days.map((d, i) => (i === 0 ? `M${x(0)},${y(d.balance)}` : `H${x(i)} V${y(d.balance)}`)).join(' ');
    const area = days.length ? `${line} V${y(0)} H${x(0)} Z` : '';
    const last = days.length - 1;
    const labelIndexes = days.length > 1 ? [0, Math.round(last / 3), Math.round((2 * last) / 3), last] : [0];
    const current = active ?? last;
    const day = days[current];

    const pick = (clientX: number, rect: DOMRect) => {
        const relative = clientX - rect.left - AXIS_LEFT;
        const index = days.length > 1 ? Math.round((relative / plotWidth) * last) : 0;
        setActive(Math.min(last, Math.max(0, index)));
    };

    if (days.length === 0) return null;

    return (
        <div ref={ref} className="relative" style={{ height: PAD_TOP + PLOT_HEIGHT + AXIS_BOTTOM }}>
            {width > 0 && (
                <svg
                    width={width}
                    height={PAD_TOP + PLOT_HEIGHT + AXIS_BOTTOM}
                    role="img"
                    aria-label={`Evolución del stock: hoy ${days[last].balance} ${units}`}
                    tabIndex={0}
                    className="focus-visible:ring-ring/40 rounded-md outline-none focus-visible:ring-2"
                    onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
                    onPointerLeave={() => setActive(null)}
                    onBlur={() => setActive(null)}
                    onKeyDown={(e) => {
                        if (e.key === 'ArrowLeft') setActive(Math.max(0, current - 1));
                        if (e.key === 'ArrowRight') setActive(Math.min(last, current + 1));
                    }}
                >
                    {/* Líneas guía y eje Y */}
                    {ticks.map((t) => (
                        <g key={t}>
                            <line
                                x1={AXIS_LEFT}
                                x2={width - PAD_RIGHT}
                                y1={y(t)}
                                y2={y(t)}
                                className={t === 0 ? 'stroke-foreground/25' : 'stroke-border'}
                                strokeWidth={1}
                            />
                            <text x={AXIS_LEFT - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground num text-[11px]">
                                {compact(t)}
                            </text>
                        </g>
                    ))}

                    {/* Eje X: unas pocas fechas */}
                    {labelIndexes.map((i, k) => (
                        <text
                            key={i}
                            x={x(i)}
                            y={PAD_TOP + PLOT_HEIGHT + 16}
                            textAnchor={k === 0 ? 'start' : k === labelIndexes.length - 1 ? 'end' : 'middle'}
                            className="fill-muted-foreground text-[11px]"
                        >
                            {shortDay(days[i].date)}
                        </text>
                    ))}

                    {/* Stock mínimo (umbral) */}
                    {minStock > 0 && (
                        <g>
                            <line
                                x1={AXIS_LEFT}
                                x2={width - PAD_RIGHT}
                                y1={y(minStock)}
                                y2={y(minStock)}
                                className="stroke-red-600/70 dark:stroke-red-400/70"
                                strokeWidth={1}
                                strokeDasharray="4 4"
                            />
                            <text x={AXIS_LEFT + 4} y={y(minStock) - 5} className="fill-muted-foreground text-[11px]">
                                Mínimo {minStock.toLocaleString('es')}
                            </text>
                        </g>
                    )}

                    <path d={area} className="fill-chart-1/10" />
                    <path d={line} fill="none" className="stroke-chart-1" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

                    {/* Cruz que sigue al mouse */}
                    {active !== null && (
                        <line
                            x1={x(active)}
                            x2={x(active)}
                            y1={PAD_TOP}
                            y2={PAD_TOP + PLOT_HEIGHT}
                            className="stroke-foreground/30"
                            strokeWidth={1}
                        />
                    )}

                    {/* Punto del día marcado (el último si no hay mouse) con anillo del color de fondo */}
                    <circle cx={x(current)} cy={y(day.balance)} r={4} className="fill-chart-1 stroke-card" strokeWidth={2} />
                    {active === null && (
                        <text x={x(last) - 8} y={y(day.balance) - 10} textAnchor="end" className="fill-foreground num text-[12px] font-semibold">
                            {day.balance.toLocaleString('es')}
                        </text>
                    )}
                </svg>
            )}

            {/* Detalle del día */}
            {active !== null && (
                <div
                    className="bg-popover text-popover-foreground pointer-events-none absolute top-0 z-10 w-52 rounded-md border px-3 py-2 text-xs shadow-md"
                    style={x(active) > width / 2 ? { right: width - x(active) + 10 } : { left: x(active) + 10 }}
                >
                    <p className="num text-sm font-semibold">
                        {day.balance.toLocaleString('es')} <span className="text-muted-foreground text-xs font-normal">{units}</span>
                    </p>
                    <p className="text-muted-foreground mb-1">{formatDay(day.date)}</p>
                    <TypeLines types={day.types} movementTypes={movementTypes} />
                </div>
            )}
        </div>
    );
}

interface Week {
    label: string;
    in: number;
    out: number;
    types: Record<string, number>;
}

/** Agrupa los días en semanas de lunes a domingo. */
function toWeeks(days: StockDay[]): Week[] {
    const weeks: Week[] = [];
    let current: (Week & { from: string; to: string }) | null = null;
    for (const d of days) {
        const [yy, mm, dd] = d.date.split('-').map(Number);
        const isMonday = new Date(yy, mm - 1, dd).getDay() === 1;
        if (!current || isMonday) {
            current = { label: '', from: d.date, to: d.date, in: 0, out: 0, types: {} };
            weeks.push(current);
        }
        current.to = d.date;
        current.in += d.in;
        current.out += d.out;
        for (const [type, qty] of Object.entries(d.types)) current.types[type] = (current.types[type] ?? 0) + qty;
        current.label = current.from === current.to ? shortDay(current.from) : `${shortDay(current.from)} – ${shortDay(current.to)}`;
    }
    return weeks;
}

function FlowChart({ days, units, movementTypes }: { days: StockDay[]; units: string; movementTypes: Record<string, string> }) {
    const [hover, setHover] = useState<number | null>(null);
    const weeks = toWeeks(days);
    const totalIn = weeks.reduce((s, w) => s + w.in, 0);
    const totalOut = weeks.reduce((s, w) => s + w.out, 0);
    // Una sola escala: arriba lo que entró, abajo lo que salió. El cero se ubica según los datos
    // (si no hubo salidas, toda la altura es para las entradas).
    const maxIn = Math.max(0, ...weeks.map((w) => w.in));
    const maxOut = Math.max(0, ...weeks.map((w) => w.out));
    const top = maxIn > 0 ? niceMax(maxIn) : 0;
    const bottom = maxOut > 0 ? niceMax(maxOut) : 0;
    const span = top + bottom || 1;
    const pct = (v: number) => (v / span) * 100;
    const zero = pct(top);
    const HEIGHT = 200;

    return (
        <div className="grid gap-3">
            {/* Leyenda (con los totales del período) */}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
                <span className="flex items-center gap-1.5">
                    <span className="bg-chart-1 size-2.5 rounded-[3px]" />
                    <span className="text-muted-foreground">Entradas</span>
                    <span className="num font-semibold">{totalIn.toLocaleString('es')}</span>
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="dark:bg-chart-4 size-2.5 rounded-[3px] bg-amber-600" />
                    <span className="text-muted-foreground">Salidas</span>
                    <span className="num font-semibold">{totalOut.toLocaleString('es')}</span>
                </span>
            </div>

            {totalIn + totalOut === 0 ? (
                <p className="text-muted-foreground flex items-center justify-center text-sm" style={{ height: HEIGHT }}>
                    Sin entradas ni salidas en este período.
                </p>
            ) : (
                <div className="flex gap-3">
                    {/* Eje Y: arriba entra, abajo sale */}
                    <div className="text-muted-foreground num relative w-8 shrink-0 text-right text-[11px]" style={{ height: HEIGHT }}>
                        {top > 0 && <span className="absolute top-0 right-0 -translate-y-1/2">{compact(top)}</span>}
                        <span className="absolute right-0 -translate-y-1/2" style={{ top: `${zero}%` }}>
                            0
                        </span>
                        {bottom > 0 && <span className="absolute right-0 bottom-0 translate-y-1/2">−{compact(bottom)}</span>}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="relative" style={{ height: HEIGHT }} onMouseLeave={() => setHover(null)}>
                            {top > 0 && <div className="border-border absolute inset-x-0 top-0 border-t" />}
                            <div className="border-foreground/25 absolute inset-x-0 border-t" style={{ top: `${zero}%` }} />
                            {bottom > 0 && <div className="border-border absolute inset-x-0 bottom-0 border-t" />}

                            <div className="absolute inset-0 flex gap-1">
                                {weeks.map((w, i) => (
                                    <div
                                        key={w.label}
                                        tabIndex={0}
                                        aria-label={`Semana ${w.label}: entraron ${w.in} ${units}, salieron ${w.out} ${units}`}
                                        className="relative flex h-full flex-1 justify-center rounded-md outline-none focus-visible:ring-2"
                                        onMouseEnter={() => setHover(i)}
                                        onFocus={() => setHover(i)}
                                        onBlur={() => setHover(null)}
                                    >
                                        <div
                                            className={cn(
                                                'bg-muted absolute inset-0 rounded-md transition-opacity',
                                                hover === i ? 'opacity-100' : 'opacity-0',
                                            )}
                                        />
                                        {/* Entró: hacia arriba desde el cero */}
                                        <div
                                            className="bg-chart-1 absolute left-1/2 w-full max-w-6 -translate-x-1/2 rounded-t-[4px] transition-[height] duration-500"
                                            style={{
                                                bottom: `${100 - zero}%`,
                                                height: `${pct(w.in)}%`,
                                                minHeight: w.in > 0 ? 2 : 0,
                                                marginBottom: w.in > 0 ? 1 : 0,
                                            }}
                                        />
                                        {/* Salió: hacia abajo desde el cero */}
                                        <div
                                            className="dark:bg-chart-4 absolute left-1/2 w-full max-w-6 -translate-x-1/2 rounded-b-[4px] bg-amber-600 transition-[height] duration-500"
                                            style={{
                                                top: `${zero}%`,
                                                height: `${pct(w.out)}%`,
                                                minHeight: w.out > 0 ? 2 : 0,
                                                marginTop: w.out > 0 ? 1 : 0,
                                            }}
                                        />

                                        {hover === i && (
                                            <div
                                                className={cn(
                                                    'bg-popover text-popover-foreground pointer-events-none absolute top-0 z-20 w-52 rounded-md border px-3 py-2 text-xs shadow-md',
                                                    i >= weeks.length / 2 ? 'right-full mr-1' : 'left-full ml-1',
                                                )}
                                            >
                                                <p className="text-muted-foreground mb-1">Semana {w.label}</p>
                                                <p className="flex items-center justify-between gap-4">
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="bg-chart-1 h-0.5 w-3 rounded" /> Entró
                                                    </span>
                                                    <span className="num font-semibold">{w.in.toLocaleString('es')}</span>
                                                </p>
                                                <p className="mb-1 flex items-center justify-between gap-4">
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="dark:bg-chart-4 h-0.5 w-3 rounded bg-amber-600" /> Salió
                                                    </span>
                                                    <span className="num font-semibold">{w.out.toLocaleString('es')}</span>
                                                </p>
                                                <div className="border-t pt-1">
                                                    <TypeLines types={w.types} movementTypes={movementTypes} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Eje X: inicio de cada semana (algunas, para que no se amontonen) */}
                        <div className="mt-2 flex gap-1">
                            {weeks.map((w, i) => (
                                <span key={w.label} className="text-muted-foreground min-w-0 flex-1 truncate text-center text-[10px]">
                                    {weeks.length <= 6 || i % 2 === 0 || i === weeks.length - 1 ? w.label.split(' – ')[0] : ''}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            <p className="text-muted-foreground text-[11px]">Cada movimiento, uno por uno, está en el kardex de abajo.</p>
        </div>
    );
}
