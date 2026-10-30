/**
 * REGISTRO DE UN LOTE (pages/admin/inventory/show.tsx → pestaña "Lotes", detalle desplegable de cada fila).
 * Datos: InventoryController@batchDetails.
 *
 *   <BatchOrigin batch={batch} />                       → "Compra · Droguería Inti" (columna Origen de la tabla)
 *   <BatchDetail batch={batch} units="tabletas" movementTypes={movementTypes} onSeeAll={() => setTab('kardex')} />
 *
 * El detalle tiene dos partes:
 * - De dónde vino y la cuenta del lote: lo que entró al principio + ventas, transferencias, ajustes y bajas = stock de hoy.
 * - Historial: los últimos movimientos del lote (el más reciente arriba), con cuánto quedó en el lote después de cada uno,
 *   quién lo hizo, el motivo y el documento (compra, venta, transferencia) con enlace si el usuario puede verlo.
 */
import { useCan } from '@/hooks/use-can';
import { formatDate, formatDay, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Batch } from '@/types/admin/pharmacy';
import { Link } from '@inertiajs/react';
import {
    ArrowLeftRight,
    CalendarClock,
    FileText,
    History,
    type LucideIcon,
    Minus,
    PackagePlus,
    PackageX,
    Plus,
    ShoppingCart,
    Truck,
    Undo2,
    Wallet,
} from 'lucide-react';

/** Un movimiento del lote. Ver InventoryController@movementRow. */
export interface BatchMovement {
    id: number;
    date: string;
    type: string;
    /** Con signo: + entra, − sale */
    quantity: number;
    note: string | null;
    user: string | null;
    role: string | null;
    /** Compra, venta o transferencia que lo originó */
    document: { kind: 'compra' | 'venta' | 'transferencia'; id: number; label: string } | null;
    /** Lo que quedó en el lote después del movimiento */
    batch_balance?: number;
}

/** Lote con su registro. Ver InventoryController@batchDetails. */
export interface BatchWithDetail extends Batch {
    days_left: number;
    /** Cómo entró: compra, ingreso sin compra o transferencia recibida */
    origin: (BatchMovement & { kind: 'compra' | 'ingreso' | 'transferencia' | 'otro' }) | null;
    /** Unidades que entraron al principio */
    initial: number;
    /** Lo que se movió después, por grupo (con signo): initial + Σ units = quantity */
    summary: { key: string; label: string; units: number; count: number }[];
    movements_count: number;
    /** Los últimos 15, el más reciente primero */
    movements: BatchMovement[];
    registered_by?: { id: number; name: string } | null;
}

const ORIGIN: Record<string, { icon: LucideIcon; label: string; tone: string }> = {
    compra: { icon: Truck, label: 'Compra', tone: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
    ingreso: { icon: PackagePlus, label: 'Ingreso sin compra', tone: 'bg-violet-500/10 text-violet-700 dark:text-violet-400' },
    transferencia: { icon: ArrowLeftRight, label: 'Transferencia recibida', tone: 'bg-sky-500/10 text-sky-700 dark:text-sky-400' },
    otro: { icon: FileText, label: 'Otro', tone: 'bg-muted text-foreground/70' },
};

/** Ícono y color de cada tipo de movimiento del kardex. */
const MOVEMENT: Record<string, { icon: LucideIcon; tone: string }> = {
    compra: { icon: Truck, tone: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
    venta: { icon: ShoppingCart, tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
    ajuste_entrada: { icon: Plus, tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
    ajuste_salida: { icon: Minus, tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
    baja: { icon: PackageX, tone: 'bg-red-500/10 text-red-700 dark:text-red-400' },
    transferencia_salida: { icon: ArrowLeftRight, tone: 'bg-sky-500/10 text-sky-700 dark:text-sky-400' },
    transferencia_entrada: { icon: ArrowLeftRight, tone: 'bg-sky-500/10 text-sky-700 dark:text-sky-400' },
};
const UNDO = { icon: Undo2, tone: 'bg-muted text-foreground/70' };

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('es')}`;

/** "Compra · Droguería Inti", "Ingreso sin compra", "De Central": columna Origen de la tabla de lotes. */
export function BatchOrigin({ batch }: { batch: BatchWithDetail }) {
    if (!batch.origin) return <span className="text-muted-foreground">—</span>;
    const origin = ORIGIN[batch.origin.kind];
    const detail =
        batch.origin.kind === 'compra'
            ? batch.origin.document?.label.split(' · ').at(-1)
            : batch.origin.kind === 'transferencia'
              ? `de ${batch.origin.document?.label.split(' · ').at(-1)?.split(' → ')[0] ?? '—'}`
              : null;
    return (
        <span className="flex min-w-0 items-center gap-2">
            <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-md', origin.tone)}>
                <origin.icon className="size-3.5" />
            </span>
            <span className="min-w-0">
                <span className="block truncate text-[13px]">{origin.label}</span>
                <span className="text-muted-foreground block truncate text-[11px]">
                    {formatDay(batch.origin.date)}
                    {detail && ` · ${detail}`}
                </span>
            </span>
        </span>
    );
}

export function BatchDetail({
    batch,
    units,
    movementTypes,
    onSeeAll,
}: {
    batch: BatchWithDetail;
    units: string;
    movementTypes: Record<string, string>;
    /** Ir a la pestaña Movimientos (todo el kardex) */
    onSeeAll: () => void;
}) {
    const origin = batch.origin ? ORIGIN[batch.origin.kind] : null;
    const unitCost = Number(batch.unit_cost);

    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="grid content-start gap-4">
                {/* De dónde vino */}
                <Section icon={origin?.icon ?? FileText} title="De dónde vino">
                    {batch.origin ? (
                        <div className="grid gap-1 text-[13px]">
                            <p className="font-medium">{origin!.label}</p>
                            <p className="text-muted-foreground text-xs">
                                {formatDate(batch.origin.date, {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                                {' · '}
                                {batch.origin.user ?? 'Sistema'}
                                {batch.origin.role && ` · ${batch.origin.role}`}
                            </p>
                            {batch.origin.document && <DocumentLink document={batch.origin.document} />}
                            {batch.origin.note && <p className="text-muted-foreground text-xs">Motivo: {batch.origin.note}</p>}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-xs">Sin movimientos registrados.</p>
                    )}
                </Section>

                {/* La cuenta del lote */}
                <Section icon={History} title="Cuenta del lote" hint={`En ${units}`}>
                    <div className="grid gap-1.5 text-[13px]">
                        <Line label="Entró" value={`+${batch.initial.toLocaleString('es')}`} tone="text-emerald-700 dark:text-emerald-400" />
                        {batch.summary.map((row) => (
                            <Line
                                key={row.key}
                                label={row.label}
                                sub={`${row.count} ${row.count === 1 ? 'movimiento' : 'movimientos'}`}
                                value={signed(row.units)}
                                tone={row.units > 0 ? 'text-emerald-700 dark:text-emerald-400' : row.units < 0 ? 'text-red-600' : ''}
                            />
                        ))}
                        <div className="mt-1 flex items-baseline justify-between gap-3 border-t pt-2">
                            <span className="font-semibold">Queda hoy</span>
                            <span className="num text-base font-bold">{batch.quantity.toLocaleString('es')}</span>
                        </div>
                        {/* Barrita: qué parte de lo que entró sigue en el lote */}
                        {batch.initial > 0 && (
                            <div className="grid gap-1">
                                <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                                    <div
                                        className="bg-chart-1 h-full rounded-full"
                                        style={{ width: `${Math.min(100, (batch.quantity / batch.initial) * 100)}%` }}
                                    />
                                </div>
                                <p className="text-muted-foreground text-[11px]">
                                    Queda el {Math.round((batch.quantity / batch.initial) * 100)}% de lo que entró
                                </p>
                            </div>
                        )}
                    </div>
                </Section>

                {/* Datos del lote */}
                <div className="grid grid-cols-2 gap-2">
                    <Fact
                        icon={CalendarClock}
                        label="Vence"
                        value={formatDay(batch.expires_at)}
                        sub={
                            batch.days_left < 0
                                ? `Vencido hace ${-batch.days_left} días`
                                : batch.days_left === 0
                                  ? 'Vence hoy'
                                  : `En ${batch.days_left} días`
                        }
                        danger={batch.days_left < 0}
                    />
                    <Fact
                        icon={Wallet}
                        label="Valor al costo"
                        value={money(batch.quantity * unitCost)}
                        sub={`${money(unitCost)} c/u · ${batch.quantity.toLocaleString('es')} ${units}`}
                    />
                </div>
            </div>

            {/* Historial */}
            <Section
                icon={History}
                title="Historial del lote"
                hint={
                    batch.movements_count > batch.movements.length
                        ? `Últimos ${batch.movements.length} de ${batch.movements_count}`
                        : `${batch.movements_count} ${batch.movements_count === 1 ? 'movimiento' : 'movimientos'}`
                }
            >
                <ol className="grid">
                    {batch.movements.map((m, i) => {
                        const style = MOVEMENT[m.type] ?? UNDO;
                        return (
                            <li key={m.id} className="relative flex gap-3 pb-3 last:pb-0">
                                {/* Línea de tiempo */}
                                {i < batch.movements.length - 1 && <span className="bg-border absolute top-7 bottom-0 left-[13px] w-px" />}
                                <span className={cn('relative flex size-7 shrink-0 items-center justify-center rounded-full', style.tone)}>
                                    <style.icon className="size-3.5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <p className="truncate text-[13px] font-medium">{movementTypes[m.type] ?? m.type}</p>
                                        <p className="num shrink-0 text-[13px]">
                                            <span
                                                className={cn(
                                                    'font-semibold',
                                                    m.quantity > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600',
                                                )}
                                            >
                                                {signed(m.quantity)}
                                            </span>
                                            {m.batch_balance !== undefined && (
                                                <span className="text-muted-foreground text-xs"> · queda {m.batch_balance.toLocaleString('es')}</span>
                                            )}
                                        </p>
                                    </div>
                                    <p className="text-muted-foreground text-xs">
                                        {formatDate(m.date, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        {' · '}
                                        {m.user ?? 'Sistema'}
                                        {m.role && ` · ${m.role}`}
                                    </p>
                                    {m.document && <DocumentLink document={m.document} />}
                                    {m.note && <p className="text-muted-foreground text-xs">Motivo: {m.note}</p>}
                                </div>
                            </li>
                        );
                    })}
                </ol>
                {batch.movements_count > batch.movements.length && (
                    <button type="button" onClick={onSeeAll} className="text-primary mt-3 text-xs font-medium hover:underline">
                        Ver todos los movimientos →
                    </button>
                )}
            </Section>
        </div>
    );
}

function Section({ icon: Icon, title, hint, children }: { icon: LucideIcon; title: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="bg-card min-w-0 rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
                    <Icon className="text-muted-foreground size-3.5" />
                    {title}
                </p>
                {hint && <span className="text-muted-foreground text-[11px]">{hint}</span>}
            </div>
            {children}
        </div>
    );
}

function Line({ label, sub, value, tone }: { label: string; sub?: string; value: string; tone?: string }) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <span>
                {label}
                {sub && <span className="text-muted-foreground text-[11px]"> · {sub}</span>}
            </span>
            <span className={cn('num font-semibold', tone)}>{value}</span>
        </div>
    );
}

function Fact({ icon: Icon, label, value, sub, danger }: { icon: LucideIcon; label: string; value: string; sub: string; danger?: boolean }) {
    return (
        <div className="bg-card rounded-lg border p-3">
            <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                <Icon className="size-3.5" />
                {label}
            </p>
            <p className={cn('num mt-1 text-sm font-semibold', danger && 'text-red-600')}>{value}</p>
            <p className={cn('text-[11px]', danger ? 'text-red-600' : 'text-muted-foreground')}>{sub}</p>
        </div>
    );
}

const DOCUMENT_ROUTES = {
    compra: { route: 'admin.purchases.show', permission: 'compras.ver' },
    venta: { route: 'admin.sales.show', permission: 'ventas.ver' },
    transferencia: { route: 'admin.transfers.show', permission: 'transferencias.ver' },
} as const;

/** Documento del movimiento, con enlace si el usuario puede verlo. */
function DocumentLink({ document }: { document: NonNullable<BatchMovement['document']> }) {
    const can = useCan();
    const target = DOCUMENT_ROUTES[document.kind];
    return can(target.permission) ? (
        <Link href={route(target.route, document.id)} className="text-primary flex w-fit items-center gap-1 text-xs font-medium hover:underline">
            <FileText className="size-3" />
            {document.label}
        </Link>
    ) : (
        <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <FileText className="size-3" />
            {document.label}
        </p>
    );
}
