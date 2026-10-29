/*
 * PÁGINA: Mi caja  (ruta /admin/cash)
 *
 * Sin turno abierto → 1) elegir caja libre, 2) contar el fondo inicial billete por billete.
 * Con turno abierto → resumen del turno, ingresos / egresos / retiros, y CIERRE CIEGO:
 *   el cajero cuenta los billetes SIN ver cuánto debería haber; el sistema compara después.
 * Cada cajero abre y cierra SU caja y rinde cuenta de su efectivo.
 * Datos y acciones: app/Http/Controllers/Admin/CashController.php
 */
import { BillCounter, cleanCounts, CountSummary, countTotal, type Counts } from '@/components/admin/cash/bill-counter';
import { PageHeader } from '@/components/admin/common/page-header';
import { StatCard, StatGrid } from '@/components/admin/common/stat-card';
import { Panel, PanelHeader } from '@/components/admin/dashboard/panel';
import InputError from '@/components/shared/input-error';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCan } from '@/hooks/use-can';
import AdminLayout from '@/layouts/admin/admin-layout';
import { formatDate, money, relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type CashSession, type CashSummary, type Denomination } from '@/types/admin/pharmacy';
import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowDownLeft,
    ArrowUpRight,
    Banknote,
    CheckCircle2,
    CreditCard,
    History,
    Inbox,
    LoaderCircle,
    Lock,
    LockOpen,
    Monitor,
    PiggyBank,
    Receipt,
    ShoppingCart,
    Wallet,
    type LucideIcon,
} from 'lucide-react';
import { FormEventHandler, useEffect, useState } from 'react';

interface Props {
    session: CashSession | null;
    summary: CashSummary | null;
    registers: { id: number; name: string; branch: { id: number; name: string } }[];
    denominations: Denomination[];
    movementTypes: Record<string, string>;
    paymentMethods: Record<string, string>;
    lastClosed: CashSession | null;
}

/** Ícono y color de cada tipo de movimiento de efectivo. */
const movementStyle: Record<string, { icon: LucideIcon; tone: string; sign: string }> = {
    ingreso: { icon: ArrowDownLeft, tone: 'bg-emerald-500/10 text-emerald-600', sign: '+' },
    egreso: { icon: ArrowUpRight, tone: 'bg-red-500/10 text-red-600', sign: '−' },
    retiro: { icon: PiggyBank, tone: 'bg-amber-500/10 text-amber-600', sign: '−' },
};

export default function CashIndex(props: Props) {
    return (
        <AdminLayout breadcrumbs={[{ title: 'Mi caja', href: route('admin.cash.index') }]}>
            <Head title="Mi caja" />
            <div className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                {props.session && props.summary ? (
                    <OpenSession {...props} session={props.session} summary={props.summary} />
                ) : (
                    <OpenForm {...props} />
                )}
            </div>
        </AdminLayout>
    );
}

/* ───────────────────────── ABRIR CAJA ───────────────────────── */

function OpenForm({ registers, denominations, lastClosed }: Props) {
    const can = useCan();
    const { data, setData, transform, post, processing, errors } = useForm({
        cash_register_id: registers.length === 1 ? String(registers[0].id) : '',
        counts: {} as Counts,
    });
    transform((d) => ({ ...d, counts: cleanCounts(d.counts) }));

    const total = countTotal(denominations, data.counts);
    const pieces = Object.values(data.counts).reduce((sum, q) => sum + Number(q || 0), 0);
    const selected = registers.find((r) => String(r.id) === data.cash_register_id);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('admin.cash.open'));
    };

    return (
        <>
            <PageHeader
                icon={Wallet}
                title="Abrir caja"
                description="Elige tu caja y cuenta el dinero con el que empiezas el turno. Al cerrar rendirás cuenta de este efectivo."
                actions={
                    <Button asChild variant="outline" size="sm">
                        <Link href={route('admin.cash.sessions.index')}>
                            <History /> Historial de turnos
                        </Link>
                    </Button>
                }
            />

            <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="grid gap-6">
                    {/* Paso 1: caja. Con una sola caja libre basta una línea; con varias, tarjetas para elegir */}
                    {registers.length === 1 ? (
                        <Panel className="flex items-center gap-4 p-4">
                            <div className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
                                <Monitor className="size-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold">
                                    {registers[0].name} <span className="text-muted-foreground font-normal">· {registers[0].branch.name}</span>
                                </p>
                                <p className="text-muted-foreground text-xs">Es la única caja libre de tu sucursal: queda elegida.</p>
                            </div>
                            <CheckCircle2 className="text-primary size-5 shrink-0" />
                        </Panel>
                    ) : (
                        <Panel>
                            <PanelHeader icon={Monitor} title="1. Elige tu caja" description="Solo aparecen las cajas libres de tu sucursal." />
                            <div className="p-5">
                                {registers.length === 0 ? (
                                    <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center text-sm">
                                        <Inbox className="size-6" />
                                        Todas las cajas de tu sucursal están en uso o no hay cajas creadas.
                                        {can('caja.editar') && (
                                            <Link href={route('admin.cash-registers.index')} className="text-primary font-medium hover:underline">
                                                Configurar cajas
                                            </Link>
                                        )}
                                    </div>
                                ) : (
                                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                        {registers.map((register) => {
                                            const active = String(register.id) === data.cash_register_id;
                                            return (
                                                <button
                                                    type="button"
                                                    key={register.id}
                                                    onClick={() => setData('cash_register_id', String(register.id))}
                                                    className={cn(
                                                        'flex items-center gap-3 rounded-xl border p-4 text-left transition-[border-color,box-shadow]',
                                                        active ? 'border-primary ring-primary/20 bg-primary/5 ring-2' : 'hover:border-foreground/25',
                                                    )}
                                                >
                                                    <div
                                                        className={cn(
                                                            'flex size-10 shrink-0 items-center justify-center rounded-lg',
                                                            active ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground/70',
                                                        )}
                                                    >
                                                        <Monitor className="size-5" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-semibold">{register.name}</p>
                                                        <p className="text-muted-foreground truncate text-xs">{register.branch.name}</p>
                                                    </div>
                                                    {active && <CheckCircle2 className="text-primary size-5 shrink-0" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                <InputError message={errors.cash_register_id} className="mt-2" />
                            </div>
                        </Panel>
                    )}

                    {/* Paso 2: fondo */}
                    <Panel>
                        <PanelHeader
                            icon={Banknote}
                            title={registers.length === 1 ? 'Cuenta tu fondo inicial' : '2. Cuenta tu fondo inicial'}
                            description="El dinero con el que empiezas el turno. El total se suma solo."
                        />
                        <div className="p-5">
                            <BillCounter denominations={denominations} counts={data.counts} onChange={(counts) => setData('counts', counts)} />
                        </div>
                    </Panel>
                </div>

                {/* Resumen fijo a la derecha */}
                <div className="grid gap-4 lg:sticky lg:top-20">
                    <Panel className="overflow-hidden">
                        <div className="from-primary to-primary/80 text-primary-foreground bg-gradient-to-br p-5">
                            <p className="text-sm opacity-80">Fondo inicial</p>
                            <p className="font-display num mt-1 text-4xl font-semibold">{money(total)}</p>
                            <p className="mt-1 text-xs opacity-80">{pieces === 0 ? 'Todavía no contaste nada' : `${pieces} billetes y monedas`}</p>
                        </div>
                        <div className="grid gap-3 p-5 text-sm">
                            <CountSummary denominations={denominations} counts={data.counts} />
                            <div className="border-t" />
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Caja</span>
                                <span className="font-medium">{selected ? selected.name : '—'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Sucursal</span>
                                <span className="font-medium">{selected?.branch.name ?? '—'}</span>
                            </div>
                            <Button
                                type="submit"
                                size="lg"
                                className="btn-brand mt-2 w-full"
                                disabled={processing || !data.cash_register_id || !can('caja.operar')}
                            >
                                {processing ? <LoaderCircle className="size-4 animate-spin" /> : <LockOpen />}
                                Abrir caja
                            </Button>
                        </div>
                    </Panel>
                    {lastClosed && (
                        <p className="text-muted-foreground px-1 text-xs">
                            Tu último turno se cerró {relativeTime(lastClosed.closed_at)}.{' '}
                            <Link href={route('admin.cash.sessions.show', lastClosed.id)} className="text-foreground font-medium hover:underline">
                                Ver detalle
                            </Link>
                        </p>
                    )}
                </div>
            </form>
        </>
    );
}

/* ───────────────────────── TURNO ABIERTO ───────────────────────── */

function OpenSession({ session, summary, denominations, movementTypes, paymentMethods }: Props & { session: CashSession; summary: CashSummary }) {
    const can = useCan();
    const [movement, setMovement] = useState<string | null>(null);
    const [closing, setClosing] = useState(false);
    const otherMethods = Object.entries(summary.by_method).filter(([method]) => method !== 'efectivo');
    const otherTotal = otherMethods.reduce((s, [, v]) => s + v, 0);

    return (
        <>
            <PageHeader
                icon={Wallet}
                title={`${session.cash_register.name} · ${session.branch.name}`}
                description={
                    <span className="flex items-center gap-2">
                        <span className="relative flex size-2">
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                        </span>
                        Turno abierto desde las {formatDate(session.opened_at, { timeStyle: 'short' })} ({relativeTime(session.opened_at)})
                    </span>
                }
                actions={
                    <>
                        {can('caja.operar') && (
                            <Button variant="outline" onClick={() => setClosing(true)}>
                                <Lock /> Cerrar caja
                            </Button>
                        )}
                        {can('ventas.crear') && (
                            <Button asChild className="btn-brand">
                                <Link href={route('admin.pos')}>
                                    <ShoppingCart /> Ir a vender
                                </Link>
                            </Button>
                        )}
                    </>
                }
            />

            <StatGrid>
                <StatCard
                    icon={Receipt}
                    tone="blue"
                    label="Ventas del turno"
                    value={summary.sales_count}
                    hint={`Total vendido ${money(summary.sales_total)}`}
                />
                <StatCard
                    icon={Banknote}
                    tone="green"
                    label="Cobrado en efectivo"
                    value={money(summary.cash_sales)}
                    hint="Entra al corte de billetes"
                />
                <StatCard
                    icon={CreditCard}
                    tone="violet"
                    label="QR, tarjeta y transferencia"
                    value={money(otherTotal)}
                    hint={otherMethods.map(([m, v]) => `${paymentMethods[m] ?? m} ${money(v)}`).join(' · ') || 'No entra al conteo de billetes'}
                />
                <StatCard icon={PiggyBank} tone="slate" label="Fondo inicial" value={money(summary.opening)} hint="Contado al abrir" />
            </StatGrid>

            <Panel className="overflow-hidden">
                <PanelHeader
                    icon={ArrowDownLeft}
                    title="Movimientos de efectivo"
                    description="Entradas y salidas de dinero que no son ventas. Siempre con su motivo."
                    aside={
                        can('caja.operar') && (
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(movementStyle).map(([type, style]) => (
                                    <Button key={type} size="sm" variant="outline" onClick={() => setMovement(type)}>
                                        <style.icon /> {movementTypes[type]}
                                    </Button>
                                ))}
                            </div>
                        )
                    }
                />
                {session.movements?.length ? (
                    <ul className="divide-y">
                        {session.movements.map((m) => {
                            const style = movementStyle[m.type];
                            return (
                                <li key={m.id} className="flex items-center gap-4 px-5 py-3">
                                    <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', style.tone)}>
                                        <style.icon className="size-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium">{m.reason}</p>
                                        <p className="text-muted-foreground text-xs">
                                            {movementTypes[m.type]} · {formatDate(m.created_at, { timeStyle: 'short' })}
                                        </p>
                                    </div>
                                    <span className={cn('num font-semibold', m.type === 'ingreso' ? 'text-emerald-600' : 'text-foreground')}>
                                        {style.sign} {money(m.amount)}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <div className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-sm">
                        <Inbox className="size-6" />
                        Sin movimientos en este turno.
                    </div>
                )}
            </Panel>

            <MovementDialog type={movement} movementTypes={movementTypes} onClose={() => setMovement(null)} />
            <CloseDialog open={closing} onClose={() => setClosing(false)} denominations={denominations} />
        </>
    );
}

function MovementDialog({ type, movementTypes, onClose }: { type: string | null; movementTypes: Record<string, string>; onClose: () => void }) {
    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({ type: '', amount: '', reason: '' });

    // Cada vez que se abre: formulario limpio con el tipo elegido (ingreso / egreso / retiro)
    useEffect(() => {
        if (!type) return;
        clearErrors();
        setData({ type, amount: '', reason: '' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type]);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('admin.cash.movement'), {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                onClose();
            },
        });
    };

    const style = type ? movementStyle[type] : null;

    return (
        <Dialog open={type !== null} onOpenChange={(value) => !value && onClose()}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={submit} className="grid gap-4">
                    <DialogHeader>
                        {style && (
                            <div className={cn('mb-2 flex size-11 items-center justify-center rounded-xl', style.tone)}>
                                <style.icon className="size-5" />
                            </div>
                        )}
                        <DialogTitle>{type ? movementTypes[type] : ''}</DialogTitle>
                        <DialogDescription>
                            {type === 'retiro'
                                ? 'Sacar efectivo de la caja para guardarlo (ej: a la bóveda).'
                                : type === 'egreso'
                                  ? 'Pago en efectivo desde la caja (ej: un flete).'
                                  : 'Efectivo que entra a la caja (ej: cambio).'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2">
                        <Label htmlFor="amount">Monto</Label>
                        <Input
                            id="amount"
                            type="number"
                            min={0.01}
                            step="0.01"
                            className="num h-12 text-lg"
                            value={data.amount}
                            onChange={(e) => setData('amount', e.target.value)}
                            autoFocus
                        />
                        <InputError message={errors.amount} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="reason">Motivo</Label>
                        <Input id="reason" value={data.reason} onChange={(e) => setData('reason', e.target.value)} />
                        <InputError message={errors.reason ?? errors.type} />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit" className="btn-brand" disabled={processing}>
                            {processing && <LoaderCircle className="size-4 animate-spin" />}
                            Registrar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function CloseDialog({ open, onClose, denominations }: { open: boolean; onClose: () => void; denominations: Denomination[] }) {
    const { data, setData, transform, post, processing, errors } = useForm({ counts: {} as Counts, note: '' });
    transform((d) => ({ ...d, counts: cleanCounts(d.counts) }));

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('admin.cash.close'));
    };

    return (
        <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
            <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-4xl">
                <form onSubmit={submit} className="flex min-h-0 flex-col">
                    <DialogHeader className="border-b p-6">
                        <DialogTitle className="flex items-center gap-2">
                            <Lock className="size-5" /> Cerrar caja · arqueo
                        </DialogTitle>
                        <DialogDescription>
                            Cuenta todo el efectivo que hay en tu caja. No se muestra cuánto debería haber (cierre ciego): el sistema lo compara al
                            guardar. QR, tarjeta y transferencias no se cuentan aquí.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid min-h-0 gap-5 overflow-y-auto p-6">
                        <BillCounter denominations={denominations} counts={data.counts} onChange={(counts) => setData('counts', counts)} />
                        <div className="grid gap-2">
                            <Label htmlFor="note">Observación</Label>
                            <Input
                                id="note"
                                value={data.note}
                                onChange={(e) => setData('note', e.target.value)}
                                placeholder="Obligatoria si hay una diferencia grande"
                            />
                            <InputError message={errors.note} />
                        </div>
                    </div>
                    <DialogFooter className="bg-muted/40 flex-row items-center justify-between border-t p-4 sm:justify-between">
                        <div>
                            <p className="text-muted-foreground text-xs">Total contado</p>
                            <p className="font-display num text-2xl font-semibold">{money(countTotal(denominations, data.counts))}</p>
                        </div>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancelar
                            </Button>
                            <Button type="submit" className="btn-brand" disabled={processing}>
                                {processing ? <LoaderCircle className="size-4 animate-spin" /> : <Lock />}
                                Cerrar caja
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
