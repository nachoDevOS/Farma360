/**
 * GRÁFICOS DE VENTAS Y PRECIO DE UN PRODUCTO (los usa product-performance.tsx, pestaña "Rendimiento"), sin librerías.
 * Datos: ProductController@show → salesByMonth, priceSeries y purchaseCosts. Todo es de TODAS las sucursales.
 *
 *   <SalesByMonthChart months={salesByMonth} units="tabletas" />
 *   <PriceChart series={priceSeries} costs={purchaseCosts} unit="tableta" colorOf={colorOf} />
 *
 * - Ventas por mes (12 meses): columnas en unidades o en Bs (botón arriba). En Bs cada columna se parte en
 *   costo (abajo, claro) y ganancia (arriba, fuerte). Línea punteada = promedio mensual. El detalle del mes
 *   (unidades, cobrado, ganancia, margen, ventas) aparece al pasar el mouse o con el foco.
 * - Precio contra costo: una línea en escalones por presentación con el precio POR UNIDAD BASE (así todas comparten
 *   la escala y se ve el descuento por volumen) y un rombo por compra con el costo por unidad. La distancia entre
 *   la línea y los rombos es la ganancia.
 * Colores por presentación: SERIES, en el orden de las presentaciones que se venden (colorOf), igual en todos los gráficos.
 */
import { ChartCard, compact, niceMax, useWidth } from '@/components/admin/common/chart-utils';
import { SegmentedControl } from '@/components/admin/common/segmented-control';
import { plural } from '@/components/admin/products/presentation-levels';
import { formatDate, formatDay, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useState } from 'react';

/** Ventas de un mes. Ver ProductAnalytics@byMonth. */
export interface MonthSales {
    /** "2026-10" */
    month: string;
    units: number;
    amount: number;
    profit: number;
    sales: number;
}

/** Precios de una presentación a lo largo del tiempo. Ver ProductController@priceSeries. */
export interface PriceSeries {
    presentation_id: number;
    name: string;
    factor: number;
    points: { date: string; price: number }[];
}

/** Costo por unidad base de una compra. Ver ProductController@purchaseCosts. */
export interface PurchaseCost {
    date: string;
    unit_cost: number;
    supplier: string | null;
}

/** Colores fijos por orden de presentación (validados para daltonismo y contraste en claro y oscuro). */
export const SERIES = [
    { stroke: 'stroke-chart-1', fill: 'fill-chart-1', bg: 'bg-chart-1' },
    { stroke: 'stroke-[#0f9b6c] dark:stroke-[#10a374]', fill: 'fill-[#0f9b6c] dark:fill-[#10a374]', bg: 'bg-[#0f9b6c] dark:bg-[#10a374]' },
    { stroke: 'stroke-amber-600 dark:stroke-chart-4', fill: 'fill-amber-600 dark:fill-chart-4', bg: 'bg-amber-600 dark:bg-chart-4' },
    { stroke: 'stroke-purple-600 dark:stroke-purple-500', fill: 'fill-purple-600 dark:fill-purple-500', bg: 'bg-purple-600 dark:bg-purple-500' },
];

export const monthName = (month: string, withYear = false) => {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('es', withYear ? { month: 'long', year: 'numeric' } : { month: 'short' }).replace('.', '');
};

export function SalesByMonthChart({ months, units }: { months: MonthSales[]; units: string }) {
    const [measure, setMeasure] = useState<'units' | 'amount'>('amount');
    const [hover, setHover] = useState<number | null>(null);
    const HEIGHT = 200;

    const value = (m: MonthSales) => (measure === 'units' ? m.units : m.amount);
    const max = niceMax(Math.max(0, ...months.map(value)));
    const ticks = [4, 3, 2, 1, 0].map((i) => (max / 4) * i);
    const pct = (v: number) => (v / max) * 100;
    const peak = months.reduce((best, m, i) => (value(m) > value(months[best]) ? i : best), 0);
    const current = months.length - 1;
    const format = (v: number) => (measure === 'units' ? compact(v) : `Bs ${compact(Math.round(v))}`);
    const empty = months.every((m) => m.units === 0);
    // Promedio de los meses con ventas desde la primera venta (los meses de antes no cuentan)
    const firstSale = months.findIndex((m) => m.units > 0);
    const active = firstSale < 0 ? [] : months.slice(firstSale);
    const average = active.length ? active.reduce((sum, m) => sum + value(m), 0) / active.length : 0;

    return (
        <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <SegmentedControl
                    label="Medida"
                    value={measure}
                    onChange={setMeasure}
                    className="w-fit"
                    options={[
                        { value: 'amount', label: 'En Bs' },
                        { value: 'units', label: `En ${units}` },
                    ]}
                />
                {!empty && (
                    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        {measure === 'amount' ? (
                            <>
                                <Swatch className="bg-chart-1" label="Ganancia" />
                                <Swatch className="bg-chart-1/30" label="Costo" />
                            </>
                        ) : (
                            <Swatch className="bg-chart-1" label={`${units[0].toUpperCase()}${units.slice(1)} vendidas`} />
                        )}
                        <span className="flex items-center gap-1.5">
                            <span className="border-foreground/50 w-4 border-t border-dashed" />
                            Promedio {format(average)}
                        </span>
                    </div>
                )}
            </div>

            {empty ? (
                <EmptyChart height={HEIGHT} text="Sin ventas en los últimos 12 meses." />
            ) : (
                <div className="flex gap-3">
                    {/* Eje Y */}
                    <div className="text-muted-foreground num relative w-12 shrink-0 text-right text-[11px]" style={{ height: HEIGHT }}>
                        {ticks.map((t) => (
                            <span key={t} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: `${100 - pct(t)}%` }}>
                                {format(t)}
                            </span>
                        ))}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="relative" style={{ height: HEIGHT }} onMouseLeave={() => setHover(null)}>
                            {ticks.map((t) => (
                                <div
                                    key={t}
                                    className={cn('absolute inset-x-0 border-t', t === 0 ? 'border-foreground/25' : 'border-border')}
                                    style={{ top: `${100 - pct(t)}%` }}
                                />
                            ))}

                            <div className="absolute inset-0 flex items-end gap-1">
                                {months.map((m, i) => {
                                    const v = value(m);
                                    const profit = Math.max(0, Math.min(m.profit, m.amount));
                                    // Etiqueta solo en el mes más alto y en el actual
                                    const showLabel = (i === peak || i === current) && v > 0 && hover !== i;
                                    return (
                                        <div
                                            key={m.month}
                                            tabIndex={0}
                                            aria-label={`${monthName(m.month, true)}: ${m.units} ${units}, ${money(m.amount)}, ganancia ${money(m.profit)}`}
                                            className="relative flex h-full flex-1 items-end justify-center rounded-md outline-none focus-visible:ring-2"
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
                                            <div
                                                className={cn(
                                                    'relative flex w-full max-w-6 flex-col gap-[2px] transition-[height,opacity] duration-500',
                                                    hover !== null && hover !== i && 'opacity-60',
                                                )}
                                                style={{ height: `${pct(v)}%`, minHeight: v > 0 ? 2 : 0 }}
                                            >
                                                {measure === 'amount' ? (
                                                    <>
                                                        {profit > 0 && (
                                                            <div className="bg-chart-1 rounded-t-[4px]" style={{ flexGrow: profit, minHeight: 2 }} />
                                                        )}
                                                        {m.amount - profit > 0 && (
                                                            <div
                                                                className={cn('bg-chart-1/30', profit <= 0 && 'rounded-t-[4px]')}
                                                                style={{ flexGrow: m.amount - profit }}
                                                            />
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="bg-chart-1 flex-1 rounded-t-[4px]" />
                                                )}
                                                {showLabel && (
                                                    <span className="num text-foreground absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] font-semibold whitespace-nowrap">
                                                        {format(v)}
                                                    </span>
                                                )}
                                            </div>

                                            {hover === i && (
                                                <div
                                                    className={cn(
                                                        'bg-popover text-popover-foreground pointer-events-none absolute top-0 z-20 w-52 rounded-md border px-3 py-2 text-xs shadow-md',
                                                        i >= months.length / 2 ? 'right-full mr-1' : 'left-full ml-1',
                                                    )}
                                                >
                                                    <p className="text-muted-foreground mb-1 capitalize">{monthName(m.month, true)}</p>
                                                    <Row
                                                        label={`Vendido (${units})`}
                                                        value={m.units.toLocaleString('es')}
                                                        strong={measure === 'units'}
                                                    />
                                                    <Row label="Cobrado" value={money(m.amount)} strong={measure === 'amount'} />
                                                    <Row label="Costo" value={money(m.amount - m.profit)} />
                                                    <Row
                                                        label="Ganancia"
                                                        value={`${money(m.profit)}${m.amount > 0 ? ` · ${Math.round((m.profit / m.amount) * 100)}%` : ''}`}
                                                    />
                                                    <Row label="Ventas" value={m.sales.toLocaleString('es')} />
                                                    {average > 0 && v > 0 && (
                                                        <p className="text-muted-foreground mt-1 border-t pt-1">
                                                            {v >= average
                                                                ? `${Math.round((v / average - 1) * 100)}% sobre el promedio`
                                                                : `${Math.round((1 - v / average) * 100)}% bajo el promedio`}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Promedio mensual */}
                            {average > 0 && (
                                <div
                                    className="border-foreground/50 pointer-events-none absolute inset-x-0 border-t border-dashed"
                                    style={{ top: `${100 - pct(average)}%` }}
                                />
                            )}
                        </div>

                        {/* Eje X */}
                        <div className="mt-2 flex gap-1">
                            {months.map((m, i) => (
                                <span
                                    key={m.month}
                                    className={cn(
                                        'min-w-0 flex-1 truncate text-center text-[10px] capitalize',
                                        i === current ? 'text-foreground font-semibold' : 'text-muted-foreground',
                                    )}
                                >
                                    {monthName(m.month)}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
    return (
        <p className="flex justify-between gap-4">
            <span className="text-muted-foreground">{label}</span>
            <span className={cn('num text-right', strong ? 'font-semibold' : 'font-medium')}>{value}</span>
        </p>
    );
}

export function Swatch({ className, label }: { className: string; label: string }) {
    return (
        <span className="flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-[3px]', className)} />
            {label}
        </span>
    );
}

export function EmptyChart({ height, text }: { height: number; text: string }) {
    return (
        <div
            className="text-muted-foreground flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center text-sm"
            style={{ height }}
        >
            {text}
        </div>
    );
}

const PLOT_HEIGHT = 200;
const AXIS_LEFT = 52;
const AXIS_BOTTOM = 22;
const PAD_TOP = 12;
const PAD_RIGHT = 12;
const DAY = 86_400_000;

/** "2026-10-30" a medianoche local (sin correrlo por zona horaria). */
const dayTime = (date: string) => {
    const [y, m, d] = date.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
};

export function PriceChart({
    series,
    costs,
    unit,
    colorOf,
}: {
    series: PriceSeries[];
    costs: PurchaseCost[];
    unit: string;
    /** Índice de color (SERIES) de cada presentación; undefined = no se dibuja */
    colorOf: (presentationId: number) => number | undefined;
}) {
    const [ref, width] = useWidth<HTMLDivElement>();
    const [active, setActive] = useState<number | null>(null);

    const shown = series
        .filter((s) => colorOf(s.presentation_id) !== undefined)
        .map((s) => ({
            ...s,
            color: SERIES[colorOf(s.presentation_id)!],
            points: s.points.map((p) => ({ time: new Date(p.date).getTime(), unitPrice: p.price / s.factor, price: p.price })),
        }));
    const costPoints = costs.map((c) => ({ ...c, time: dayTime(c.date) }));

    if (shown.length === 0) {
        return <EmptyChart height={PAD_TOP + PLOT_HEIGHT + AXIS_BOTTOM} text="Todavía no hay precios registrados." />;
    }

    const now = Date.now();
    const first = Math.min(...shown.flatMap((s) => s.points.map((p) => p.time)), ...costPoints.map((c) => c.time));
    // Al menos 30 días de ancho, para que un historial de un solo día no quede en un punto
    const start = Math.min(first, now - 30 * DAY);
    const max = niceMax(Math.max(...shown.flatMap((s) => s.points.map((p) => p.unitPrice)), ...costPoints.map((c) => c.unit_cost)) * 100) / 100;
    const plotWidth = Math.max(0, width - AXIS_LEFT - PAD_RIGHT);
    const x = (t: number) => AXIS_LEFT + ((t - start) / (now - start)) * plotWidth;
    const y = (v: number) => PAD_TOP + PLOT_HEIGHT - (v / max) * PLOT_HEIGHT;
    const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i);
    const xLabels = [start, start + (now - start) / 2, now];

    // Precio vigente de una serie en un momento (el último cambio anterior o igual)
    const priceAt = (s: (typeof shown)[number], t: number) => [...s.points].reverse().find((p) => p.time <= t) ?? null;
    const costAt = (t: number) => [...costPoints].reverse().find((c) => c.time <= t) ?? null;

    const path = (s: (typeof shown)[number]) =>
        s.points.map((p, i) => (i === 0 ? `M${x(p.time)},${y(p.unitPrice)}` : `H${x(p.time)} V${y(p.unitPrice)}`)).join(' ') + ` H${x(now)}`;

    const pick = (clientX: number, rect: DOMRect) => {
        const t = start + ((clientX - rect.left - AXIS_LEFT) / plotWidth) * (now - start);
        setActive(Math.min(now, Math.max(start, t)));
    };

    const lastCost = costPoints[costPoints.length - 1] ?? null;
    const activeCost = active !== null ? costAt(active) : null;

    return (
        <div className="grid gap-3">
            {/* Leyenda con el precio actual de cada presentación y el último costo */}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
                {shown.map((s) => {
                    const last = s.points[s.points.length - 1];
                    return (
                        <span key={s.presentation_id} className="flex items-center gap-1.5">
                            <span className={cn('h-0.5 w-3.5 rounded', s.color.bg)} />
                            <span className="text-muted-foreground">{s.name}</span>
                            <span className="num font-semibold">{money(last.unitPrice)}</span>
                        </span>
                    );
                })}
                {lastCost && (
                    <span className="flex items-center gap-1.5">
                        <span className="bg-foreground/70 size-2 rotate-45 rounded-[1px]" />
                        <span className="text-muted-foreground">Costo de compra</span>
                        <span className="num font-semibold">{money(lastCost.unit_cost)}</span>
                    </span>
                )}
            </div>

            <div ref={ref} className="relative" style={{ height: PAD_TOP + PLOT_HEIGHT + AXIS_BOTTOM }}>
                {width > 0 && (
                    <svg
                        width={width}
                        height={PAD_TOP + PLOT_HEIGHT + AXIS_BOTTOM}
                        role="img"
                        aria-label={`Precio por ${unit} contra el costo de compra`}
                        tabIndex={0}
                        className="focus-visible:ring-ring/40 rounded-md outline-none focus-visible:ring-2"
                        onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
                        onPointerLeave={() => setActive(null)}
                        onBlur={() => setActive(null)}
                        onKeyDown={(e) => {
                            const current = active ?? now;
                            if (e.key === 'ArrowLeft') setActive(Math.max(start, current - DAY));
                            if (e.key === 'ArrowRight') setActive(Math.min(now, current + DAY));
                        }}
                    >
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
                                    {money(t)}
                                </text>
                            </g>
                        ))}
                        {xLabels.map((t, k) => (
                            <text
                                key={k}
                                x={x(t)}
                                y={PAD_TOP + PLOT_HEIGHT + 16}
                                textAnchor={k === 0 ? 'start' : k === xLabels.length - 1 ? 'end' : 'middle'}
                                className="fill-muted-foreground text-[11px]"
                            >
                                {k === xLabels.length - 1 ? 'Hoy' : formatDate(new Date(t).toISOString(), { day: '2-digit', month: 'short' })}
                            </text>
                        ))}

                        {shown.map((s) => (
                            <path
                                key={s.presentation_id}
                                d={path(s)}
                                fill="none"
                                className={s.color.stroke}
                                strokeWidth={2}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                        ))}

                        {/* Un rombo por compra: costo por unidad */}
                        {costPoints.map((c, k) => (
                            <rect
                                key={k}
                                x={x(c.time) - 4}
                                y={y(c.unit_cost) - 4}
                                width={8}
                                height={8}
                                rx={1}
                                transform={`rotate(45 ${x(c.time)} ${y(c.unit_cost)})`}
                                className={cn('fill-foreground/70 stroke-card', activeCost === c && 'fill-foreground')}
                                strokeWidth={2}
                            />
                        ))}

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

                        {/* Punto en cada línea: en el momento marcado o al final */}
                        {shown.map((s) => {
                            const point = priceAt(s, active ?? now);
                            if (!point) return null;
                            return (
                                <circle
                                    key={s.presentation_id}
                                    cx={x(active ?? now)}
                                    cy={y(point.unitPrice)}
                                    r={4}
                                    className={cn(s.color.fill, 'stroke-card')}
                                    strokeWidth={2}
                                />
                            );
                        })}
                    </svg>
                )}

                {active !== null && (
                    <div
                        className="bg-popover text-popover-foreground pointer-events-none absolute top-0 z-10 w-64 rounded-md border px-3 py-2 text-xs shadow-md"
                        style={x(active) > width / 2 ? { right: width - x(active) + 10 } : { left: x(active) + 10 }}
                    >
                        <p className="text-muted-foreground mb-1">{formatDate(new Date(active).toISOString())}</p>
                        {shown.map((s) => {
                            const point = priceAt(s, active);
                            const margin =
                                point && activeCost && point.unitPrice > 0
                                    ? ((point.unitPrice - activeCost.unit_cost) / point.unitPrice) * 100
                                    : null;
                            return (
                                <p key={s.presentation_id} className="flex items-center justify-between gap-3">
                                    <span className="flex min-w-0 items-center gap-1.5">
                                        <span className={cn('h-0.5 w-3 shrink-0 rounded', s.color.bg)} />
                                        <span className="text-muted-foreground truncate">{s.name}</span>
                                    </span>
                                    <span className="num shrink-0 text-right">
                                        {point ? (
                                            <>
                                                <span className="font-semibold">{money(point.unitPrice)}</span>
                                                {margin !== null && <span className="text-muted-foreground"> · gana {Math.round(margin)}%</span>}
                                            </>
                                        ) : (
                                            '—'
                                        )}
                                    </span>
                                </p>
                            );
                        })}
                        {activeCost && (
                            <p className="mt-1 flex items-center justify-between gap-3 border-t pt-1">
                                <span className="text-muted-foreground flex min-w-0 items-center gap-1.5">
                                    <span className="bg-foreground/70 size-2 shrink-0 rotate-45 rounded-[1px]" />
                                    <span className="truncate">
                                        Costo · {formatDay(activeCost.date)}
                                        {activeCost.supplier && ` · ${activeCost.supplier}`}
                                    </span>
                                </span>
                                <span className="num shrink-0 font-semibold">{money(activeCost.unit_cost)}</span>
                            </p>
                        )}
                        <p className="text-muted-foreground mt-1 border-t pt-1">Todo por {unit}.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

/** Tarjeta "Ventas por mes" + "Precio contra costo", lado a lado en pantallas anchas. */
export function SalesAndPriceCharts({
    salesByMonth,
    priceSeries,
    purchaseCosts,
    baseUnit,
    scopeLabel,
    colorOf,
}: {
    salesByMonth: MonthSales[];
    priceSeries: PriceSeries[];
    purchaseCosts: PurchaseCost[];
    baseUnit: string;
    /** "Central" / "todas las sucursales" */
    scopeLabel: string;
    colorOf: (presentationId: number) => number | undefined;
}) {
    const unit = baseUnit.toLowerCase();
    return (
        <div className="grid gap-6 xl:grid-cols-2">
            <ChartCard title="Ventas por mes" description={`Últimos 12 meses, ${scopeLabel} (sin las anuladas). La parte fuerte es la ganancia.`}>
                <SalesByMonthChart months={salesByMonth} units={plural(baseUnit)} />
            </ChartCard>
            <ChartCard
                title="Precio contra costo"
                description={`Lo que paga el cliente por cada ${unit} según la presentación, y lo que costó en cada compra. La distancia es la ganancia. Igual en todas las sucursales.`}
            >
                <PriceChart series={priceSeries} costs={purchaseCosts} unit={unit} colorOf={colorOf} />
            </ChartCard>
        </div>
    );
}
