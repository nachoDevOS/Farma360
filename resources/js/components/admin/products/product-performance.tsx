/**
 * RENDIMIENTO DE UN PRODUCTO (pages/admin/products/show.tsx → pestaña "Rendimiento"): cómo le va al negocio con él.
 * Datos: ProductController@show → performance (app/Services/ProductAnalytics.php), salesByMonth, priceSeries y purchaseCosts.
 * Sin librerías de gráficos.
 *
 *   <ProductPerformance product={product} performance={performance} scope={scope} current={current} onChooseBranch={choose} … />
 *
 * La sucursal se elige arriba de la página (branch-picker.tsx) o tocando una fila de "Por sucursal"; scope dice qué se
 * mira. El precio y los costos de compra son siempre de todas las sucursales (el precio es único).
 * "Por sucursal" (comparar sucursales) solo aparece con "Todas las sucursales"; tocar una fila elige esa sucursal.
 *
 * De arriba a abajo:
 * 1. Indicadores de los últimos 30 días contra los 30 anteriores (con la forma de cada día) y para cuántos días alcanza el stock.
 * 2. Ventas por mes y precio contra costo (product-charts.tsx).
 * 3. Por sucursal (vendido, stock y para cuántos días alcanza) y cómo lo compran (suelto, blíster, caja…).
 * 4. Cuándo se vende (día y hora) y vencimientos: cuánto se vencería sin venderse al ritmo actual.
 * Colores: azul (--chart-1) = ventas; por presentación, SERIES de product-charts.tsx; vencimientos con colores de estado
 * (rojo vencido, naranja ≤ 30 días, ámbar ≤ 90, verde) siempre con su texto al lado.
 */
import { ChartCard, compact } from '@/components/admin/common/chart-utils';
import { plural } from '@/components/admin/products/presentation-levels';
import {
    EmptyChart,
    type MonthSales,
    type PriceSeries,
    type PurchaseCost,
    SalesAndPriceCharts,
    SERIES,
} from '@/components/admin/products/product-charts';
import { formatDay, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Product } from '@/types/admin/pharmacy';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, Check, Coins, type LucideIcon, Minus, Package, Wallet } from 'lucide-react';
import { useState } from 'react';

/** Un día de ventas. Ver ProductAnalytics@byDay. */
export interface DaySales {
    date: string;
    units: number;
    amount: number;
    profit: number;
    sales: number;
}

/** Ver ProductAnalytics@for. */
export interface Performance {
    /** Últimos 60 días, el más viejo primero */
    daily: DaySales[];
    /** Unidades base por día (últimos 90 días, o desde que existe el producto) */
    dailyRate: number;
    rateDays: number;
    branches: { branch_id: number; branch: string | null; units: number; amount: number; stock: number; daily_rate: number }[];
    mix: { presentation_id: number; name: string; factor: number; quantity: number; units: number; amount: number }[];
    /** day: 1 = lunes … 7 = domingo. Solo las celdas con ventas */
    hours: { day: number; hour: number; units: number; sales: number }[];
    /** Lotes con stock, el que vence primero adelante. units_at_risk null = la sucursal no vende: no se puede estimar */
    batches: {
        id: number;
        batch_number: string;
        branch: string | null;
        expires_at: string;
        days_left: number;
        quantity: number;
        unit_cost: number;
        units_at_risk: number | null;
    }[];
}

interface Props {
    product: Product;
    performance: Performance;
    salesByMonth: MonthSales[];
    priceSeries: PriceSeries[];
    purchaseCosts: PurchaseCost[];
    /** Lo que se mira (sucursal elegida arriba de la página, branch-picker.tsx) */
    scope: Scope;
    /** Elegir otra sucursal (al tocar una fila de "Por sucursal"); current = la marcada, aunque todavía esté cargando */
    current: number | null;
    onChooseBranch: (branchId: number | null) => void;
}

/** Lo que se está mirando: todas las sucursales o una. */
export interface Scope {
    branchId: number | null;
    /** "Central" / "todas las sucursales" */
    label: string;
    /** Stock de hoy en lo que se mira */
    stock: number;
}

const DAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export const sum = <T,>(rows: T[], pick: (row: T) => number) => rows.reduce((total, row) => total + pick(row), 0);

/** Fecha dentro de n días: "12 nov" */
const inDays = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + Math.round(days));
    return date.toLocaleDateString('es', { day: '2-digit', month: 'short' }).replace('.', '');
};

/** "23 días", "más de un año" */
export const daysText = (days: number) =>
    days >= 365 ? 'más de un año' : `${Math.max(0, Math.floor(days))} ${Math.floor(days) === 1 ? 'día' : 'días'}`;

/** Estado de cobertura del stock: rojo < 7 días, ámbar < 30, verde. */
export const coverageTone = (days: number | null) =>
    days === null ? 'slate' : days < 7 ? 'red' : days < 30 ? 'amber' : ('green' as 'slate' | 'red' | 'amber' | 'green');

const TONE_TEXT = {
    slate: 'text-muted-foreground',
    red: 'text-red-700 dark:text-red-400',
    amber: 'text-amber-700 dark:text-amber-400',
    green: 'text-emerald-700 dark:text-emerald-400',
    blue: 'text-blue-700 dark:text-blue-400',
};
const TONE_SOFT = {
    slate: 'bg-muted text-foreground/70',
    red: 'bg-red-500/10 text-red-700 dark:text-red-400',
    amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    green: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
};

export function ProductPerformance({ product, performance, salesByMonth, priceSeries, purchaseCosts, scope, current, onChooseBranch }: Props) {
    const units = plural(product.base_unit);
    // Mismo color para cada presentación en todos los gráficos: por su orden entre las que se venden
    const sellable = product.presentations.filter((p) => p.is_sellable).map((p) => p.id);
    const colorOf = (id: number) => {
        const index = sellable.indexOf(id);
        return index >= 0 && index < SERIES.length ? index : undefined;
    };

    return (
        <div className="grid gap-6">
            <Kpis performance={performance} scope={scope} units={units} />
            <SalesAndPriceCharts
                salesByMonth={salesByMonth}
                priceSeries={priceSeries}
                purchaseCosts={purchaseCosts}
                baseUnit={product.base_unit}
                scopeLabel={scope.label}
                colorOf={colorOf}
            />
            <div className="grid gap-6 xl:grid-cols-2">
                {/* Comparar sucursales solo tiene sentido mirando todas; con una elegida, "Cómo lo compran" ocupa la fila */}
                {scope.branchId === null && (
                    <ChartCard
                        title="Por sucursal"
                        description="Lo vendido en 90 días, el stock de hoy y para cuántos días alcanza. Toca una para verla sola."
                    >
                        <BranchBars branches={performance.branches} units={units} selected={current} onChoose={onChooseBranch} />
                    </ChartCard>
                )}
                <ChartCard
                    className={scope.branchId !== null ? 'xl:col-span-2' : undefined}
                    title="Cómo lo compran"
                    description={`Qué presentación eligen los clientes en ${scope.label} (últimos 90 días), contado en unidades.`}
                >
                    <MixBar mix={performance.mix} units={units} colorOf={colorOf} />
                </ChartCard>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
                <ChartCard
                    title="Cuándo se vende"
                    description={`Unidades vendidas en ${scope.label} por día de la semana y hora (últimos 90 días). Más oscuro = más ventas.`}
                >
                    <HoursHeatmap hours={performance.hours} units={units} />
                </ChartCard>
                <ChartCard
                    title="Vencimientos"
                    description={`Stock de hoy en ${scope.label} según cuándo vence, y cuánto se vencería sin venderse si ${scope.branchId ? 'sigue vendiendo' : 'cada sucursal sigue'} a su ritmo.`}
                >
                    <ExpiryRisk batches={performance.batches} units={units} />
                </ChartCard>
            </div>
        </div>
    );
}

/* ───────────────────────── 1. Indicadores ───────────────────────── */

function Kpis({ performance, scope, units }: { performance: Performance; scope: Scope; units: string }) {
    const previous = performance.daily.slice(0, 30);
    const current = performance.daily.slice(30);
    const total = (rows: DaySales[], key: 'units' | 'amount' | 'profit' | 'sales') => sum(rows, (d) => d[key]);
    const stock = scope.stock;
    const coverage = performance.dailyRate > 0 ? stock / performance.dailyRate : null;
    const amount = total(current, 'amount');
    const profit = total(current, 'profit');

    return (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <KpiTile
                icon={Wallet}
                label="Vendido · últimos 30 días"
                value={money(amount)}
                now={amount}
                before={total(previous, 'amount')}
                spark={current.map((d) => d.amount)}
                hint={`${total(current, 'sales').toLocaleString('es')} ventas`}
            />
            <KpiTile
                icon={Coins}
                label="Ganancia · últimos 30 días"
                value={money(profit)}
                now={profit}
                before={total(previous, 'profit')}
                spark={current.map((d) => d.profit)}
                hint={amount > 0 ? `Margen ${Math.round((profit / amount) * 100)}% de lo cobrado` : 'Sin ventas'}
            />
            <KpiTile
                icon={Package}
                label={`${units[0].toUpperCase()}${units.slice(1)} vendidas · 30 días`}
                value={total(current, 'units').toLocaleString('es')}
                now={total(current, 'units')}
                before={total(previous, 'units')}
                spark={current.map((d) => d.units)}
                hint={`Ritmo: ${performance.dailyRate.toLocaleString('es')} por día`}
            />
            <CoverageTile coverage={coverage} stock={stock} units={units} rate={performance.dailyRate} />
        </div>
    );
}

function KpiTile({
    icon: Icon,
    label,
    value,
    now,
    before,
    spark,
    hint,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
    now: number;
    before: number;
    spark: number[];
    hint: string;
}) {
    const max = Math.max(0, ...spark);
    return (
        <div className="surface flex min-w-0 flex-col gap-1.5 rounded-xl p-3 sm:p-3.5">
            <div className="flex items-start justify-between gap-2">
                <p className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
                    <Icon className="size-3.5 shrink-0" />
                    <span className="truncate">{label}</span>
                </p>
                <Delta now={now} before={before} />
            </div>
            <p className="font-display num truncate text-lg leading-tight font-bold sm:text-xl">{value}</p>
            {/* Cada día de los últimos 30 (el último es hoy) */}
            <div className="flex h-6 items-end gap-px" aria-hidden>
                {spark.map((v, i) => (
                    <div
                        key={i}
                        className={cn('flex-1 rounded-t-[2px]', v > 0 ? (i === spark.length - 1 ? 'bg-chart-1' : 'bg-chart-1/45') : 'bg-border')}
                        style={{ height: v > 0 && max > 0 ? `${Math.max(8, (v / max) * 100)}%` : 2 }}
                    />
                ))}
            </div>
            <p className="text-muted-foreground truncate text-[11px]">{hint} · contra los 30 días anteriores</p>
        </div>
    );
}

/** "+23%" verde con flecha, "−10%" rojo, "Nuevo" si antes no hubo. */
function Delta({ now, before }: { now: number; before: number }) {
    if (now === 0 && before === 0) {
        return null;
    }
    if (before <= 0) {
        return <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold', TONE_SOFT.blue)}>Nuevo</span>;
    }
    const change = ((now - before) / Math.abs(before)) * 100;
    const flat = Math.abs(change) < 1;
    const Icon = flat ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;
    return (
        <span
            className={cn(
                'num flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-semibold',
                flat ? TONE_SOFT.slate : change > 0 ? TONE_SOFT.green : TONE_SOFT.red,
            )}
            title={`Antes: ${before.toLocaleString('es', { maximumFractionDigits: 2 })}`}
        >
            <Icon className="size-3" />
            {flat ? '0%' : `${change > 0 ? '+' : '−'}${Math.abs(Math.round(change))}%`}
        </span>
    );
}

function CoverageTile({ coverage, stock, units, rate }: { coverage: number | null; stock: number; units: string; rate: number }) {
    const tone = coverageTone(coverage);
    // La barra se llena a los 60 días: más que eso ya es "de sobra"
    const fill = coverage === null ? 0 : Math.min(100, (coverage / 60) * 100);
    return (
        <div className="surface flex min-w-0 flex-col gap-1.5 rounded-xl p-3 sm:p-3.5">
            <div className="flex items-start justify-between gap-2">
                <p className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
                    <CalendarClock className="size-3.5 shrink-0" />
                    <span className="truncate">El stock alcanza para</span>
                </p>
                <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold', TONE_SOFT[tone])}>
                    {coverage === null
                        ? stock > 0
                            ? 'Sin ventas'
                            : 'Sin stock'
                        : tone === 'red'
                          ? 'Comprar ya'
                          : tone === 'amber'
                            ? 'Pronto'
                            : 'Bien'}
                </span>
            </div>
            <p className={cn('font-display num truncate text-lg leading-tight font-bold sm:text-xl', coverage !== null && TONE_TEXT[tone])}>
                {coverage === null ? '—' : daysText(coverage)}
            </p>
            <div className="flex h-6 flex-col justify-end gap-1" aria-hidden>
                <div className="bg-muted relative h-1.5 overflow-hidden rounded-full">
                    <div
                        className={cn(
                            'absolute inset-y-0 left-0 rounded-full',
                            tone === 'red' ? 'bg-red-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-emerald-500',
                        )}
                        style={{ width: `${fill}%` }}
                    />
                </div>
                <div className="text-muted-foreground flex justify-between text-[10px]">
                    <span>Hoy</span>
                    <span>30 días</span>
                    <span>60+</span>
                </div>
            </div>
            <p className="text-muted-foreground truncate text-[11px]">
                {coverage === null
                    ? `${stock.toLocaleString('es')} ${units} sin ventas en 90 días`
                    : `${stock.toLocaleString('es')} ${units} · hasta ~${inDays(coverage)} a ${rate.toLocaleString('es')}/día`}
            </p>
        </div>
    );
}

/* ───────────────────────── 4. Por sucursal y cómo lo compran ───────────────────────── */

function BranchBars({
    branches,
    units,
    selected,
    onChoose,
}: {
    branches: Performance['branches'];
    units: string;
    /** Sucursal elegida arriba: se resalta y las demás quedan atenuadas */
    selected: number | null;
    onChoose: (branchId: number | null) => void;
}) {
    if (!branches.length) {
        return <EmptyChart height={160} text="Sin stock ni ventas en ninguna sucursal." />;
    }
    const max = Math.max(1, ...branches.map((b) => b.units));
    const total = sum(branches, (b) => b.units);

    return (
        <div className="-mx-2 grid gap-1">
            {branches.map((b) => {
                const coverage = b.daily_rate > 0 ? b.stock / b.daily_rate : null;
                const tone = coverage === null ? (b.stock > 0 ? 'amber' : 'slate') : coverageTone(coverage);
                const isSelected = selected === b.branch_id;
                return (
                    <button
                        type="button"
                        key={b.branch_id}
                        onClick={() => onChoose(isSelected ? null : b.branch_id)}
                        title={isSelected ? 'Volver a todas las sucursales' : `Ver solo ${b.branch ?? 'esta sucursal'}`}
                        className={cn(
                            'grid gap-1.5 rounded-lg px-2 py-2 text-left transition-[background-color,opacity]',
                            isSelected ? 'bg-primary/[0.06] ring-primary/30 ring-1' : 'hover:bg-muted/60',
                            selected !== null && !isSelected && 'opacity-55 hover:opacity-100',
                        )}
                    >
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="flex min-w-0 items-center gap-1.5 truncate font-medium">
                                {isSelected && <Check className="text-primary size-3.5 shrink-0" />}
                                {b.branch ?? 'Sucursal eliminada'}
                            </span>
                            <span className="num text-muted-foreground shrink-0 text-xs">
                                <span className="text-foreground font-semibold">{b.units.toLocaleString('es')}</span> {units} · {money(b.amount)}
                                {total > 0 && ` · ${Math.round((b.units / total) * 100)}%`}
                            </span>
                        </div>
                        <div className="bg-muted h-2.5 overflow-hidden rounded-full">
                            <div
                                className="bg-chart-1 h-full rounded-full transition-[width] duration-500"
                                style={{ width: `${(b.units / max) * 100}%` }}
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            <span className="text-muted-foreground num">
                                Stock: {b.stock.toLocaleString('es')} {units}
                            </span>
                            <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', TONE_SOFT[tone])}>
                                {coverage !== null ? `Alcanza ${daysText(coverage)}` : b.stock > 0 ? 'Sin ventas: stock quieto' : 'Sin stock'}
                            </span>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

function MixBar({ mix, units, colorOf }: { mix: Performance['mix']; units: string; colorOf: (id: number) => number | undefined }) {
    const total = sum(mix, (m) => m.units);
    if (total === 0) {
        return <EmptyChart height={160} text="Sin ventas en los últimos 90 días." />;
    }
    const bg = (id: number) => {
        const index = colorOf(id);
        return index === undefined ? 'bg-muted-foreground/40' : SERIES[index].bg;
    };

    return (
        <div className="grid gap-4">
            {/* Barra al 100%: cada presentación su parte, con 2px de separación */}
            <div className="flex h-9 gap-[2px] overflow-hidden rounded-md" role="img" aria-label="Parte de lo vendido por presentación">
                {mix.map((m) => (
                    <div
                        key={m.presentation_id}
                        className={cn('flex min-w-[2px] items-center justify-center overflow-hidden', bg(m.presentation_id))}
                        style={{ flexGrow: m.units }}
                        title={`${m.name}: ${Math.round((m.units / total) * 100)}%`}
                    >
                        {m.units / total >= 0.12 && (
                            <span className="num text-xs font-semibold text-white">{Math.round((m.units / total) * 100)}%</span>
                        )}
                    </div>
                ))}
            </div>
            <table className="w-full text-[13px]">
                <thead>
                    <tr className="text-muted-foreground text-left text-[11px] tracking-wider uppercase">
                        <th className="pb-2 font-medium">Presentación</th>
                        <th className="pb-2 text-right font-medium">Vendidas</th>
                        <th className="pb-2 text-right font-medium">{units}</th>
                        <th className="pb-2 text-right font-medium">Cobrado</th>
                    </tr>
                </thead>
                <tbody>
                    {mix.map((m) => (
                        <tr key={m.presentation_id} className="border-t">
                            <td className="py-2">
                                <span className="flex items-center gap-2">
                                    <span className={cn('size-2.5 shrink-0 rounded-[3px]', bg(m.presentation_id))} />
                                    <span className="truncate">{m.name}</span>
                                </span>
                            </td>
                            <td className="num py-2 text-right">{m.quantity.toLocaleString('es')}</td>
                            <td className="num py-2 text-right">
                                {m.units.toLocaleString('es')} <span className="text-muted-foreground">· {Math.round((m.units / total) * 100)}%</span>
                            </td>
                            <td className="num py-2 text-right font-medium">{money(m.amount)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/* ───────────────────────── 5. Cuándo se vende y vencimientos ───────────────────────── */

/** Opacidad del azul por nivel (de menos a más): una sola tinta, de claro a oscuro. */
const HEAT = ['bg-chart-1/15', 'bg-chart-1/35', 'bg-chart-1/55', 'bg-chart-1/75', 'bg-chart-1'];

function HoursHeatmap({ hours, units }: { hours: Performance['hours']; units: string }) {
    const [hover, setHover] = useState<{ day: number; hour: number } | null>(null);
    if (!hours.length) {
        return <EmptyChart height={220} text="Sin ventas en los últimos 90 días." />;
    }

    // Horas con ventas, al menos de 8 a 20
    const from = Math.min(8, ...hours.map((h) => h.hour));
    const to = Math.max(20, ...hours.map((h) => h.hour));
    const columns = Array.from({ length: to - from + 1 }, (_, i) => from + i);
    const cell = (day: number, hour: number) => hours.find((h) => h.day === day && h.hour === hour);
    const max = Math.max(...hours.map((h) => h.units));
    const level = (v: number) => Math.min(HEAT.length - 1, Math.floor((v / max) * HEAT.length - 1e-9));
    const dayTotals = DAYS.map((_, d) =>
        sum(
            hours.filter((h) => h.day === d + 1),
            (h) => h.units,
        ),
    );
    const active = hover ? cell(hover.day, hover.hour) : undefined;

    return (
        <div className="grid gap-3">
            <div className="overflow-x-auto">
                <div className="grid min-w-[440px] gap-[3px]" style={{ gridTemplateColumns: `44px repeat(${columns.length}, minmax(0, 1fr)) 44px` }}>
                    {DAYS.map((name, d) => (
                        <div key={name} className="contents">
                            <span className="text-muted-foreground flex items-center text-[11px] capitalize">{name.slice(0, 3)}</span>
                            {columns.map((hour) => {
                                const c = cell(d + 1, hour);
                                const isHover = hover?.day === d + 1 && hover.hour === hour;
                                return (
                                    <div
                                        key={hour}
                                        tabIndex={c ? 0 : -1}
                                        aria-label={c ? `${name} ${hour}:00: ${c.units} ${units}` : undefined}
                                        className={cn(
                                            'aspect-square min-h-4 rounded-[3px] outline-none',
                                            c ? HEAT[level(c.units)] : 'bg-muted',
                                            isHover && 'ring-foreground/60 ring-2',
                                        )}
                                        onMouseEnter={() => setHover({ day: d + 1, hour })}
                                        onMouseLeave={() => setHover(null)}
                                        onFocus={() => setHover({ day: d + 1, hour })}
                                        onBlur={() => setHover(null)}
                                    />
                                );
                            })}
                            <span className="num text-muted-foreground flex items-center justify-end text-[11px]">{compact(dayTotals[d])}</span>
                        </div>
                    ))}
                    <span />
                    {columns.map((hour) => (
                        <span key={hour} className="text-muted-foreground num text-center text-[10px]">
                            {hour % 2 === 0 ? hour : ''}
                        </span>
                    ))}
                    <span className="text-muted-foreground text-right text-[10px]">Total</span>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="text-muted-foreground min-h-5">
                    {hover ? (
                        <span>
                            <span className="text-foreground font-medium capitalize">{DAYS[hover.day - 1]}</span> de {hover.hour}:00 a{' '}
                            {hover.hour + 1}:00 ·{' '}
                            {active ? (
                                <>
                                    <span className="num text-foreground font-semibold">{active.units.toLocaleString('es')}</span> {units} en{' '}
                                    {active.sales} {active.sales === 1 ? 'venta' : 'ventas'}
                                </>
                            ) : (
                                'sin ventas'
                            )}
                        </span>
                    ) : (
                        'Pasa el mouse por un cuadro para ver el detalle.'
                    )}
                </div>
                <div className="text-muted-foreground flex items-center gap-1">
                    Menos
                    {HEAT.map((c) => (
                        <span key={c} className={cn('size-3 rounded-[2px]', c)} />
                    ))}
                    Más
                </div>
            </div>
        </div>
    );
}

/** Texto resaltado dentro de una frase. */
const B = ({ children }: { children: React.ReactNode }) => <strong className="num font-semibold">{children}</strong>;

const EXPIRY_BUCKETS = [
    { key: 'expired', label: 'Vencido', test: (d: number) => d < 0, bar: 'bg-red-600', soft: TONE_SOFT.red },
    {
        key: '30',
        label: '30 días o menos',
        test: (d: number) => d >= 0 && d <= 30,
        bar: 'bg-orange-500',
        soft: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
    },
    { key: '90', label: '31 a 90 días', test: (d: number) => d > 30 && d <= 90, bar: 'bg-amber-400', soft: TONE_SOFT.amber },
    { key: 'ok', label: 'Más de 90 días', test: (d: number) => d > 90, bar: 'bg-emerald-600', soft: TONE_SOFT.green },
];

function ExpiryRisk({ batches, units }: { batches: Performance['batches']; units: string }) {
    if (!batches.length) {
        return <EmptyChart height={220} text="No hay stock en ninguna sucursal." />;
    }
    const total = sum(batches, (b) => b.quantity);
    const buckets = EXPIRY_BUCKETS.map((bucket) => {
        const rows = batches.filter((b) => bucket.test(b.days_left));
        return { ...bucket, units: sum(rows, (b) => b.quantity), cost: sum(rows, (b) => b.quantity * b.unit_cost) };
    });
    const riskUnits = sum(batches, (b) => b.units_at_risk ?? 0);
    const riskCost = sum(batches, (b) => (b.units_at_risk ?? 0) * b.unit_cost);
    const unknown = batches.filter((b) => b.units_at_risk === null);
    // Los lotes más urgentes: vencidos o con algo en riesgo primero, luego por vencimiento
    const urgent = [...batches]
        .sort((a, b) => Number((b.units_at_risk ?? 0) > 0) - Number((a.units_at_risk ?? 0) > 0) || a.days_left - b.days_left)
        .slice(0, 5);

    return (
        <div className="grid gap-4">
            <div className="flex h-9 gap-[2px] overflow-hidden rounded-md" role="img" aria-label="Stock por vencimiento">
                {buckets
                    .filter((b) => b.units > 0)
                    .map((b) => (
                        <div
                            key={b.key}
                            className={cn('flex min-w-[2px] items-center justify-center', b.bar)}
                            style={{ flexGrow: b.units }}
                            title={`${b.label}: ${b.units} ${units}`}
                        >
                            {b.units / total >= 0.12 && (
                                <span className={cn('num text-xs font-semibold', b.key === '90' ? 'text-amber-950' : 'text-white')}>
                                    {Math.round((b.units / total) * 100)}%
                                </span>
                            )}
                        </div>
                    ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {buckets.map((b) => (
                    <div key={b.key} className={cn('rounded-lg px-3 py-2', b.units > 0 ? b.soft : 'bg-muted/50 text-muted-foreground')}>
                        <p className="flex items-center gap-1.5 text-[11px] font-medium">
                            <span className={cn('size-2 rounded-full', b.bar)} />
                            {b.label}
                        </p>
                        <p className="num mt-0.5 text-sm font-semibold">{b.units.toLocaleString('es')}</p>
                        <p className="num text-[11px] opacity-80">{money(b.cost)}</p>
                    </div>
                ))}
            </div>

            <div
                className={cn(
                    'flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm',
                    riskUnits > 0 ? 'border-red-500/30 bg-red-500/5' : 'border-emerald-500/30 bg-emerald-500/5',
                )}
            >
                <AlertTriangle className={cn('mt-0.5 size-4 shrink-0', riskUnits > 0 ? 'text-red-600' : 'text-emerald-600')} />
                <p className="leading-snug">
                    {riskUnits > 0 ? (
                        <>
                            Se perderían{' '}
                            <B>
                                ~{riskUnits.toLocaleString('es')} {units}
                            </B>{' '}
                            (<B>{money(riskCost)}</B> al costo) si no se hace nada.
                        </>
                    ) : (
                        'Al ritmo actual no se vence nada sin venderse.'
                    )}
                    {unknown.length > 0 && (
                        <span className="text-muted-foreground">
                            {' '}
                            {unknown.length} {unknown.length === 1 ? 'lote está' : 'lotes están'} en una sucursal sin ventas: no se puede estimar.
                        </span>
                    )}
                </p>
            </div>

            {/* Lotes más urgentes: azul = se vende antes de vencer, rojo = se vencería */}
            <div className="grid gap-2.5">
                {urgent.map((b) => {
                    const risk = b.units_at_risk;
                    const sold = risk === null ? 0 : b.quantity - risk;
                    return (
                        <div key={b.id} className="grid gap-1">
                            <div className="flex items-baseline justify-between gap-3 text-xs">
                                <span className="min-w-0 truncate">
                                    <span className="font-medium">Lote {b.batch_number}</span>
                                    <span className="text-muted-foreground">
                                        {' '}
                                        · {b.branch ?? '—'} · vence {formatDay(b.expires_at)}
                                    </span>
                                </span>
                                <span className="num shrink-0">
                                    {risk === null ? (
                                        <span className="text-muted-foreground">{b.quantity} · sin ritmo</span>
                                    ) : risk > 0 ? (
                                        <span className="font-semibold text-red-700 dark:text-red-400">
                                            {risk} de {b.quantity} en riesgo
                                        </span>
                                    ) : (
                                        <span className="text-emerald-700 dark:text-emerald-400">{b.quantity} se venden a tiempo</span>
                                    )}
                                </span>
                            </div>
                            <div className="bg-muted flex h-1.5 gap-[2px] overflow-hidden rounded-full">
                                {sold > 0 && <div className="bg-chart-1" style={{ flexGrow: sold }} />}
                                {(risk ?? 0) > 0 && <div className="bg-red-500" style={{ flexGrow: risk ?? 0 }} />}
                            </div>
                        </div>
                    );
                })}
                <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                    <span className="flex items-center gap-1.5">
                        <span className="bg-chart-1 size-2 rounded-full" /> Se vende antes de vencer
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-red-500" /> Se vencería sin venderse
                    </span>
                </div>
            </div>
        </div>
    );
}
