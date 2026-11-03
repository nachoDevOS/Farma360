/**
 * BOTÓN "MI CAJA": círculo con la billetera (el mismo ícono de "Mi caja" en el menú) en la barra superior,
 * justo antes del usuario (admin-header.tsx). Solo el ícono, sin montos a la vista.
 * Nunca tapa la página y siempre está a la vista. Aparece para quien puede operar caja (permiso caja.operar).
 *   - Con turno abierto: círculo azul del tema que titila (un halo se enciende y apaga) y punto verde.
 *     Al pasar el mouse muestra debajo una tarjeta con las ventas y el tiempo del turno. Cuando el dinero
 *     cambia (una venta, un retiro…) destella y baja un aviso "+ Bs 25,00".
 *     Al tocarlo abre un panel con el dinero del turno: efectivo en caja, de dónde sale, cobros por forma de pago.
 *   - Sin turno abierto: círculo gris punteado cuya billetera titila suave, para recordar abrir la caja.
 *     El panel solo invita a abrir la caja.
 *   - Alt + C abre y cierra el panel desde cualquier pantalla.
 *
 * Los datos llegan en TODAS las páginas como el prop compartido "cash" (HandleInertiaRequests::openCash),
 * así que se actualizan solos después de cada venta o movimiento.
 * Si la farmacia oculta el efectivo esperado (config/farmacia.php → show_expected_cash = false), no se muestra
 * el total: el cierre sigue siendo ciego (el aviso cuenta ventas en lugar de dinero).
 * No aparece en "Mi caja" (ahí ya está todo).
 * Animaciones: clases cash-* en resources/css/app.css (respetan "reducir movimiento" del sistema).
 */
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useCan } from '@/hooks/use-can';
import { formatDate, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { type OpenCash } from '@/types/admin/pharmacy';
import { Link, usePage } from '@inertiajs/react';
import {
    ArrowDownLeft,
    ArrowRight,
    ArrowUpRight,
    Banknote,
    ChevronRight,
    Clock,
    CreditCard,
    EyeOff,
    LockOpen,
    PiggyBank,
    Receipt,
    ShoppingCart,
    TrendingUp,
    Wallet,
    type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

/*
 * Cada página del panel vuelve a dibujar el botón. Estas variables viven mientras la pestaña esté abierta,
 * así el botón recuerda el último monto que mostró (para animar el cambio) y entra con efecto solo la primera vez.
 */
let lastSeen: { session: number; value: number } | null = null;
let hasAppeared = false;

/** Color de cada forma de pago en las barras. */
const methodColors: Record<string, string> = {
    efectivo: 'bg-emerald-500',
    qr: 'bg-violet-500',
    tarjeta: 'bg-sky-500',
    transferencia: 'bg-amber-500',
};

export function CashWidget() {
    const { cash } = usePage<SharedData>().props;
    const can = useCan();
    const [open, setOpen] = useState(false);
    const now = useNow(30_000);
    const visible = can('caja.operar') && !route().current('admin.cash.index');

    // Lo que muestra la isla: el efectivo en caja, o la cantidad de ventas si la farmacia oculta el efectivo
    const showsMoney = cash?.summary.expected !== null && cash?.summary.expected !== undefined;
    const tracked = cash ? (cash.summary.expected ?? cash.summary.sales_count) : 0;
    const sessionId = cash?.id ?? null;

    const [entering] = useState(() => !hasAppeared);
    const [delta, setDelta] = useState<{ amount: number; key: number } | null>(() =>
        sessionId !== null && lastSeen?.session === sessionId && lastSeen.value !== tracked ? { amount: tracked - lastSeen.value, key: 0 } : null,
    );

    // Recordar el monto mostrado; si cambia sin cambiar de página, también se avisa
    useEffect(() => {
        hasAppeared = true;
        if (sessionId === null) {
            lastSeen = null;
            return;
        }
        if (lastSeen?.session === sessionId && lastSeen.value !== tracked) {
            setDelta({ amount: tracked - lastSeen.value, key: Date.now() });
        }
        lastSeen = { session: sessionId, value: tracked };
    }, [sessionId, tracked]);

    // El aviso "+ Bs 25,00" se recoge solo cuando termina su animación
    useEffect(() => {
        if (!delta) return;
        const timer = setTimeout(() => setDelta(null), 3400);
        return () => clearTimeout(timer);
    }, [delta]);

    // Alt + C: abrir / cerrar el panel
    useEffect(() => {
        if (!visible) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.altKey && e.code === 'KeyC') {
                e.preventDefault();
                setOpen((o) => !o);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [visible]);

    if (!visible) {
        return null;
    }

    const salesCount = cash?.summary.sales_count ?? 0;
    const changed = delta !== null && delta.amount !== 0;

    return (
        <>
            {/* group/cash: al pasar el mouse por la isla aparece su tarjeta de resumen (debajo, sin mover la barra) */}
            <span className={cn('group/cash relative flex', entering && 'animate-in fade-in zoom-in-75 duration-700')}>
                {cash ? (
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        aria-label="Ver el dinero de mi caja (Alt + C)"
                        className={cn(
                            'cash-island cash-fab-sheen cash-brand relative flex size-10 items-center justify-center overflow-hidden rounded-full',
                            changed ? (delta.amount > 0 ? 'cash-island-flash' : 'cash-island-flash-out') : 'cash-blink',
                        )}
                    >
                        <Wallet className="cash-fab-icon size-5" strokeWidth={2.25} />
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        aria-label="Mi caja: cerrada (Alt + C)"
                        className="cash-island cash-blink-soft bg-muted/60 text-muted-foreground hover:border-primary/40 hover:bg-background hover:text-primary relative flex size-10 items-center justify-center rounded-full border border-dashed transition-colors"
                    >
                        <Wallet className="cash-fab-icon size-5" strokeWidth={2.25} />
                    </button>
                )}

                {/* Punto de estado: verde que late = turno abierto · gris = caja cerrada */}
                {cash ? (
                    <span className="pointer-events-none absolute -top-0.5 -right-0.5 flex size-3">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="border-background relative inline-flex size-3 rounded-full border-2 bg-emerald-500" />
                    </span>
                ) : (
                    <span className="border-background bg-muted-foreground/40 pointer-events-none absolute -top-0.5 -right-0.5 size-3 rounded-full border-2" />
                )}

                {/* Aviso que baja debajo de la isla cuando cambia el dinero: "+ Bs 25,00" / "+1 venta" */}
                {changed && (
                    <span
                        key={delta.key}
                        className={cn(
                            'cash-delta num pointer-events-none absolute top-full left-1/2 z-10 mt-2 rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap text-white shadow-lg',
                            delta.amount > 0 ? 'bg-emerald-500 shadow-emerald-500/30' : 'bg-amber-500 shadow-amber-500/30',
                        )}
                    >
                        {delta.amount > 0 ? '+' : '−'}{' '}
                        {showsMoney
                            ? money(Math.abs(delta.amount))
                            : `${Math.abs(delta.amount)} ${Math.abs(delta.amount) === 1 ? 'venta' : 'ventas'}`}
                    </span>
                )}

                {/* Tarjeta de resumen al pasar el mouse (no se muestra mientras baja el aviso de dinero) */}
                {!changed && (
                    <span className="bg-popover text-popover-foreground pointer-events-none invisible absolute top-full right-0 z-10 mt-2 w-60 translate-y-1 rounded-xl border p-3 text-xs opacity-0 shadow-lg transition-all duration-200 group-hover/cash:visible group-hover/cash:translate-y-0 group-hover/cash:opacity-100">
                        {cash ? (
                            <span className="grid gap-2">
                                <span className="flex items-center justify-between font-semibold">
                                    <span className="truncate">{cash.register}</span>
                                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                        <span className="size-1.5 rounded-full bg-emerald-500" /> Abierta
                                    </span>
                                </span>
                                <span className="text-muted-foreground flex items-center gap-2">
                                    <Receipt className="size-3.5 shrink-0" />
                                    {salesCount} {salesCount === 1 ? 'venta' : 'ventas'} · {money(cash.summary.sales_total)}
                                </span>
                                <span className="text-muted-foreground flex items-center gap-2">
                                    <Clock className="size-3.5 shrink-0" />
                                    Desde las {formatDate(cash.opened_at, { timeStyle: 'short' })} · {elapsed(cash.opened_at, now)}
                                </span>
                                <span className="text-primary flex items-center gap-1 border-t pt-2 font-medium">
                                    Clic para ver el detalle <ChevronRight className="size-3.5" />
                                    <span className="text-muted-foreground ml-auto font-normal">Alt + C</span>
                                </span>
                            </span>
                        ) : (
                            <span className="grid gap-2">
                                <span className="font-semibold">Tu caja está cerrada</span>
                                <span className="text-muted-foreground">Ábrela para empezar a vender y ver aquí el dinero de tu turno.</span>
                                <span className="text-primary flex items-center gap-1 border-t pt-2 font-medium">
                                    Abrir caja <ArrowRight className="size-3.5" />
                                    <span className="text-muted-foreground ml-auto font-normal">Alt + C</span>
                                </span>
                            </span>
                        )}
                    </span>
                )}
            </span>

            <Sheet open={open} onOpenChange={setOpen}>
                <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-md">
                    {cash ? <OpenCashDetail cash={cash} canSell={can('ventas.crear') && !route().current('admin.pos')} /> : <ClosedCash />}
                </SheetContent>
            </Sheet>
        </>
    );
}

/* ───────────────────────── PANEL: CAJA CERRADA ───────────────────────── */

function ClosedCash() {
    const steps = ['Elige tu caja', 'Cuenta el fondo inicial', '¡Listo para vender!'];

    return (
        <>
            <SheetHeader className="p-5 pr-12">
                <SheetTitle>Mi caja</SheetTitle>
                <SheetDescription className="flex items-center gap-2">
                    <span className="bg-muted-foreground/50 size-2 shrink-0 rounded-full" />
                    Sin turno abierto
                </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
                {/* Billetera con anillos que laten */}
                <div className="relative flex size-28 items-center justify-center">
                    <span className="cash-ring border-primary/30 absolute inset-0 rounded-full border-2" />
                    <span className="cash-ring border-primary/20 absolute inset-0 rounded-full border-2" style={{ animationDelay: '1.4s' }} />
                    <span className="cash-brand animate-in zoom-in-50 fade-in relative flex size-20 items-center justify-center rounded-full duration-500">
                        <Wallet className="size-9" />
                    </span>
                </div>

                <div {...reveal(1)}>
                    <h3 className="font-display text-lg font-bold">Tu caja está cerrada</h3>
                    <p className="text-muted-foreground mt-1 text-sm">Ábrela para empezar a vender y ver aquí, en vivo, el dinero de tu turno.</p>
                </div>

                <ol className="grid w-full max-w-xs gap-2 text-left">
                    {steps.map((step, i) => (
                        <li key={step} {...reveal(i + 2, 'bg-muted/50 flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm')}>
                            <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                                {i + 1}
                            </span>
                            {step}
                        </li>
                    ))}
                </ol>
            </div>

            <div className="bg-muted/40 mt-auto grid gap-2 border-t p-4">
                <Button asChild className="btn-brand w-full">
                    <Link href={route('admin.cash.index')}>
                        <LockOpen /> Abrir caja
                    </Link>
                </Button>
                <ShortcutHint />
            </div>
        </>
    );
}

/* ───────────────────────── PANEL: CAJA ABIERTA ───────────────────────── */

function OpenCashDetail({ cash, canSell }: { cash: OpenCash; canSell: boolean }) {
    const { summary } = cash;
    const now = useNow(30_000);
    const showsMoney = summary.expected !== null;
    const hero = useCountUp(summary.expected ?? summary.sales_total, 0);

    // De dónde sale el efectivo: entradas (barra) y salidas
    const inflows = [
        { label: 'Fondo inicial', value: summary.opening, color: 'bg-slate-400', icon: PiggyBank },
        { label: 'Ventas en efectivo', value: summary.cash_sales, color: 'bg-emerald-500', icon: Banknote },
        { label: 'Ingresos', value: summary.income, color: 'bg-sky-500', icon: ArrowDownLeft },
    ];
    const outflows = [
        { label: 'Egresos', value: summary.expense, color: 'bg-red-500', icon: ArrowUpRight },
        { label: 'Retiros parciales', value: summary.withdrawals, color: 'bg-amber-500', icon: PiggyBank },
    ];
    const inflowTotal = inflows.reduce((s, f) => s + f.value, 0);

    // Cobros por forma de pago (efectivo + QR + tarjeta + transferencia)
    const methods = Object.entries(summary.by_method).filter(([, v]) => v > 0);
    const methodsTotal = methods.reduce((s, [, v]) => s + v, 0);
    const otherTotal = methods.filter(([m]) => m !== 'efectivo').reduce((s, [, v]) => s + v, 0);

    const stats: { icon: LucideIcon; label: string; value: string; tone: string }[] = [
        { icon: Receipt, label: 'Ventas', value: String(summary.sales_count), tone: 'bg-primary/10 text-primary' },
        {
            icon: TrendingUp,
            label: 'Ticket promedio',
            value: money(summary.sales_count ? summary.sales_total / summary.sales_count : 0),
            tone: 'bg-emerald-500/10 text-emerald-600',
        },
        { icon: CreditCard, label: 'QR y otros', value: money(otherTotal), tone: 'bg-violet-500/10 text-violet-600' },
    ];

    return (
        <>
            <SheetHeader className="p-5 pr-12 pb-4">
                <SheetTitle>Mi caja</SheetTitle>
                <SheetDescription>
                    {cash.register} · {cash.branch}
                </SheetDescription>
            </SheetHeader>

            <div className="grid content-start gap-5 overflow-y-auto px-5 pb-5">
                {/* Tarjeta principal: el dinero en caja contando hacia arriba */}
                <div className="cash-brand animate-in fade-in zoom-in-95 relative overflow-hidden rounded-2xl p-5 duration-500">
                    <span aria-hidden className="absolute -top-10 -right-8 size-32 rounded-full bg-white/10 blur-sm" />
                    <span aria-hidden className="absolute -bottom-12 left-10 size-24 rounded-full bg-white/10 blur-sm" />
                    <Wallet aria-hidden className="absolute right-4 bottom-3 size-20 -rotate-12 text-white/10" />

                    <div className="relative">
                        <p className="text-sm font-medium text-white/80">{showsMoney ? 'Efectivo en caja' : 'Total vendido en el turno'}</p>
                        <p className="num font-display mt-1 text-4xl font-bold tracking-tight">{money(hero)}</p>
                        <p className="mt-1 text-xs text-white/70">
                            {showsMoney
                                ? 'Lo que debería haber al contar los billetes'
                                : `${summary.sales_count} ventas con todas las formas de pago`}
                        </p>
                        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/20">
                            <span className="relative flex size-2">
                                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                            </span>
                            Abierta desde las {formatDate(cash.opened_at, { timeStyle: 'short' })}
                            <span className="text-white/60">·</span>
                            <Clock className="size-3" /> {elapsed(cash.opened_at, now)}
                        </div>
                    </div>
                </div>

                {!showsMoney && (
                    <div {...reveal(1, 'text-muted-foreground flex items-start gap-3 rounded-lg border border-dashed p-3 text-xs')}>
                        <EyeOff className="mt-0.5 size-4 shrink-0" />
                        El total de efectivo no se muestra: al cerrar cuentas los billetes sin saber cuánto debería haber (cierre ciego).
                    </div>
                )}

                {/* Indicadores rápidos */}
                <div className="grid grid-cols-3 gap-2">
                    {stats.map((stat, i) => (
                        <div key={stat.label} {...reveal(i + 1, 'surface rounded-xl p-3')}>
                            <span className={cn('mb-2 flex size-7 items-center justify-center rounded-lg', stat.tone)}>
                                <stat.icon className="size-4" />
                            </span>
                            <p className="text-muted-foreground text-[11px]">{stat.label}</p>
                            <p className="num truncate text-sm font-bold">{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* ¿De dónde sale el efectivo? */}
                <section {...reveal(4, 'grid gap-3')}>
                    <SectionTitle>¿De dónde sale el efectivo?</SectionTitle>
                    <StackedBar parts={inflows.map((f) => ({ key: f.label, value: f.value, color: f.color }))} total={inflowTotal} />
                    <ul className="grid gap-1 text-sm">
                        {[...inflows.map((f) => ({ ...f, sign: '+' })), ...outflows.map((f) => ({ ...f, sign: '−' }))].map((line) => (
                            <li key={line.label} className="hover:bg-muted/60 flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors">
                                <span className={cn('size-2.5 shrink-0 rounded-full', line.color)} />
                                <span className="text-muted-foreground flex-1">{line.label}</span>
                                <span className={cn('num font-medium', line.value === 0 && 'text-muted-foreground/60')}>
                                    {line.sign} {money(line.value, false)}
                                </span>
                            </li>
                        ))}
                        {showsMoney && (
                            <li className="mt-1 flex items-center justify-between border-t px-2 pt-2.5 font-semibold">
                                <span>Efectivo en caja</span>
                                <span className="num text-emerald-600 dark:text-emerald-400">{money(summary.expected)}</span>
                            </li>
                        )}
                    </ul>
                </section>

                {/* Cobros por forma de pago */}
                <section {...reveal(5, 'grid gap-3 border-t pt-5')}>
                    <SectionTitle>Cobros por forma de pago</SectionTitle>
                    {methods.length ? (
                        <>
                            <StackedBar
                                parts={methods.map(([m, v]) => ({ key: m, value: v, color: methodColors[m] ?? 'bg-slate-400' }))}
                                total={methodsTotal}
                            />
                            <ul className="grid gap-1 text-sm">
                                {methods.map(([method, value]) => (
                                    <li key={method} className="hover:bg-muted/60 flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors">
                                        <span className={cn('size-2.5 shrink-0 rounded-full', methodColors[method] ?? 'bg-slate-400')} />
                                        <span className="text-muted-foreground flex-1">
                                            {cash.payment_methods[method] ?? method}
                                            {method !== 'efectivo' && <span className="text-muted-foreground/70 text-xs"> · no va al conteo</span>}
                                        </span>
                                        <span className="text-muted-foreground num text-xs">{Math.round((value / methodsTotal) * 100)}%</span>
                                        <span className="num w-20 text-right font-medium">{money(value, false)}</span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed py-6 text-sm">
                            <ShoppingCart className="size-5" />
                            Todavía no hay ventas en este turno.
                        </div>
                    )}
                </section>
            </div>

            <div className="bg-muted/40 mt-auto grid gap-2 border-t p-4">
                <div className="flex gap-2">
                    <Button asChild variant="outline" className="flex-1">
                        <Link href={route('admin.cash.index')}>
                            <Wallet /> Ver mi caja
                        </Link>
                    </Button>
                    {canSell && (
                        <Button asChild className="btn-brand flex-1">
                            <Link href={route('admin.pos')}>
                                <ShoppingCart /> Ir a vender
                            </Link>
                        </Button>
                    )}
                </div>
                <ShortcutHint />
            </div>
        </>
    );
}

/* ───────────────────────── PIEZAS ───────────────────────── */

function SectionTitle({ children }: { children: React.ReactNode }) {
    return <h3 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">{children}</h3>;
}

/** Barra dividida en partes proporcionales (crece de izquierda a derecha al abrir). */
function StackedBar({ parts, total }: { parts: { key: string; value: number; color: string }[]; total: number }) {
    return (
        <div className="bg-muted h-2.5 overflow-hidden rounded-full">
            <div className="cash-bar flex h-full gap-0.5">
                {total > 0 &&
                    parts
                        .filter((p) => p.value > 0)
                        .map((p) => (
                            <span
                                key={p.key}
                                className={cn('h-full first:rounded-l-full last:rounded-r-full', p.color)}
                                style={{ width: `${(p.value / total) * 100}%` }}
                            />
                        ))}
            </div>
        </div>
    );
}

function ShortcutHint() {
    return (
        <p className="text-muted-foreground text-center text-[11px]">
            <kbd className="bg-background rounded border px-1.5 py-0.5 font-sans text-[10px] font-semibold">Alt</kbd> +{' '}
            <kbd className="bg-background rounded border px-1.5 py-0.5 font-sans text-[10px] font-semibold">C</kbd> abre y cierra este panel
        </p>
    );
}

/** Entrada escalonada: cada bloque aparece un poco después del anterior. */
function reveal(order: number, className?: string): { className: string; style: CSSProperties } {
    return {
        className: cn('animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500', className),
        style: { animationDelay: `${100 + order * 70}ms` },
    };
}

/** Tiempo desde la apertura: "3 h 12 min" / "8 min". */
function elapsed(from: string, now: number): string {
    const minutes = Math.max(0, Math.floor((now - new Date(from).getTime()) / 60_000));
    const hours = Math.floor(minutes / 60);

    return hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}

/** Hora actual que se renueva cada `every` ms (para el tiempo del turno). */
function useNow(every: number): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), every);
        return () => clearInterval(timer);
    }, [every]);

    return now;
}

/** Número que cuenta suavemente desde `from` hasta `target` (salta directo con "reducir movimiento"). */
function useCountUp(target: number, from: number, duration = 900): number {
    const [value, setValue] = useState(from);
    const current = useRef(from);

    useEffect(() => {
        const start = current.current;
        if (start === target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            current.current = target;
            setValue(target);
            return;
        }

        let frame = 0;
        const began = performance.now();
        const tick = (time: number) => {
            const progress = Math.min(1, (time - began) / duration);
            current.current = start + (target - start) * (1 - Math.pow(1 - progress, 3));
            setValue(current.current);
            if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(frame);
    }, [target, duration]);

    return value;
}
