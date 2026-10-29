/*
 * PÁGINA: Punto de venta  (ruta /admin/pos)
 *
 * 1. Buscar (nombre, genérico, síntoma o código de barras con lector) → se agrega al carrito.
 * 2. Cantidades por presentación (unidad, blíster, caja).
 * 3. Cliente (opcional), receta si hay controlados, y formas de pago (se pueden combinar).
 * El precio final lo calcula Laravel (SaleService): usa el lote que vence primero y su promoción.
 * Aquí se muestra una estimación con la promoción del primer lote.
 */
import { DocStatus, PromoBadge } from '@/components/admin/common/doc-status';
import { SearchPicker } from '@/components/admin/common/search-picker';
import { Panel, PanelHeader } from '@/components/admin/dashboard/panel';
import InputError from '@/components/shared/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AdminLayout from '@/layouts/admin/admin-layout';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type CashSession, type PosLookup } from '@/types/admin/pharmacy';
import { Head, Link, useForm } from '@inertiajs/react';
import { LoaderCircle, Minus, Plus, ShoppingCart, Trash2, UserRound, X } from 'lucide-react';
import { FormEventHandler, useRef } from 'react';

interface Props {
    session: CashSession;
    paymentMethods: Record<string, string>;
}

type CartLine = PosLookup & { quantity: number };
type PaymentRow = { method: string; amount: string; reference: string };
type CustomerLookup = { id: number; name: string; document_type: string; document_number: string | null };

const round = (n: number) => Math.round(n * 100) / 100;

export default function Pos({ session, paymentMethods }: Props) {
    const search = useRef<HTMLInputElement>(null);
    const { data, setData, transform, post, processing, errors, reset } = useForm({
        cart: [] as CartLine[],
        customer_id: null as number | null,
        customer_name: '',
        customer_document: '',
        prescription_number: '',
        prescription_doctor: '',
        payments: [{ method: 'efectivo', amount: '', reference: '' }] as PaymentRow[],
    });
    const err = errors as Record<string, string | undefined>;

    // Lo que viaja a Laravel (SaleController@store)
    transform((d) => ({
        items: d.cart.map((line) => ({ product_presentation_id: line.presentation_id, quantity: line.quantity })),
        payments: d.payments.map((p) => ({ method: p.method, amount: Number(p.amount || 0), reference: p.reference || null })),
        customer_id: d.customer_id,
        customer_name: d.customer_name,
        customer_document: d.customer_document,
        prescription_number: d.prescription_number,
        prescription_doctor: d.prescription_doctor,
    }));

    const lineTotal = (line: CartLine) => round(line.sale_price * line.quantity * (1 - (line.promo_discount ?? 0) / 100));
    const total = round(data.cart.reduce((sum, line) => sum + lineTotal(line), 0));
    const paid = round(data.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0));
    const change = round(paid - total);
    const needsPrescription = data.cart.some((line) => line.is_controlled);
    const unitsInCart = (productId: number) => data.cart.filter((l) => l.product_id === productId).reduce((s, l) => s + l.quantity * l.factor, 0);

    const addLine = (item: PosLookup) => {
        const existing = data.cart.findIndex((l) => l.presentation_id === item.presentation_id);
        if (existing >= 0) setQuantity(existing, data.cart[existing].quantity + 1);
        else setData('cart', [...data.cart, { ...item, quantity: 1 }]);
        search.current?.focus();
    };

    const setQuantity = (index: number, quantity: number) => {
        if (quantity < 1) return;
        setData(
            'cart',
            data.cart.map((line, i) => (i === index ? { ...line, quantity } : line)),
        );
    };

    const setPayment = (index: number, field: keyof PaymentRow, value: string) =>
        setData(
            'payments',
            data.payments.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
        );

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('admin.sales.store'), { onSuccess: () => reset() });
    };

    return (
        <AdminLayout breadcrumbs={[{ title: 'Punto de venta', href: route('admin.pos') }]}>
            <Head title="Punto de venta" />
            <form onSubmit={submit} className="grid w-full flex-1 gap-6 p-4 md:p-6 xl:grid-cols-[1fr_24rem]">
                {/* IZQUIERDA: búsqueda + carrito */}
                <div className="flex min-w-0 flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h1 className="font-display flex items-center gap-3 text-xl font-semibold">
                            <span className="bg-primary/10 text-primary ring-primary/15 flex size-10 items-center justify-center rounded-xl ring-1 ring-inset">
                                <ShoppingCart className="size-5" />
                            </span>
                            Punto de venta
                        </h1>
                        <Link href={route('admin.cash.index')} className="text-muted-foreground flex items-center gap-2 text-sm hover:underline">
                            {session.cash_register.name} · {session.branch.name} <DocStatus status="abierta" />
                        </Link>
                    </div>

                    <SearchPicker<PosLookup>
                        inputRef={search}
                        autoFocus
                        minLength={1}
                        url={(q) => route('admin.pos.search', { q })}
                        onPick={addLine}
                        itemKey={(i) => i.presentation_id}
                        placeholder="Buscar producto, genérico, síntoma (ej: dolor de cabeza) o escanear código…"
                        renderItem={(item) => {
                            const out = item.stock_units < item.factor;
                            return (
                                <div className={cn('flex items-center justify-between gap-3', out && 'opacity-50')}>
                                    <div className="min-w-0">
                                        <p className="truncate">
                                            <span className="font-medium">{item.product_name}</span> · {item.presentation_name}
                                            {item.is_controlled && <span className="ml-2 text-xs font-semibold text-red-600">CONTROLADO</span>}
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                            {item.generic_name ?? '—'} · stock {item.stock_units}
                                        </p>
                                        {item.indications.length > 0 && (
                                            <p className="text-primary truncate text-xs">Sirve para: {item.indications.join(', ')}</p>
                                        )}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        {item.promo_discount && <PromoBadge percent={item.promo_discount} />}
                                        <span className="num font-semibold">{money(item.sale_price)}</span>
                                    </div>
                                </div>
                            );
                        }}
                    />

                    <Panel className="flex-1 overflow-hidden">
                        {data.cart.length === 0 ? (
                            <div className="text-muted-foreground flex h-full min-h-60 flex-col items-center justify-center gap-2 text-sm">
                                <ShoppingCart className="size-8" />
                                Busca un producto o escanea su código para empezar.
                            </div>
                        ) : (
                            <ul className="divide-y">
                                {data.cart.map((line, i) => {
                                    const overStock = unitsInCart(line.product_id) > line.stock_units;
                                    return (
                                        <li
                                            key={line.presentation_id}
                                            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_auto_7rem_auto]"
                                        >
                                            {/* En celular: nombre arriba y abajo − cantidad + · total · quitar */}
                                            <div className="col-span-3 min-w-0 sm:col-span-1">
                                                <p className="truncate font-medium">{line.product_name}</p>
                                                <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                                                    {line.presentation_name} · {money(line.sale_price)}
                                                    {line.promo_discount && <PromoBadge percent={line.promo_discount} />}
                                                    {line.requires_prescription && <span className="text-amber-600">con receta</span>}
                                                    {overStock && <span className="font-semibold text-red-600">stock insuficiente</span>}
                                                </p>
                                            </div>
                                            {/* − cantidad + en una sola pieza (clase .stepper de app.css) */}
                                            <div className="stepper" data-active="true">
                                                <button
                                                    type="button"
                                                    onClick={() => setQuantity(i, line.quantity - 1)}
                                                    disabled={line.quantity <= 1}
                                                    aria-label="Menos"
                                                >
                                                    <Minus className="size-3.5" />
                                                </button>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    className="text-sm"
                                                    value={line.quantity}
                                                    onChange={(e) => setQuantity(i, Number(e.target.value))}
                                                    onFocus={(e) => e.target.select()}
                                                    aria-label="Cantidad"
                                                />
                                                <button type="button" onClick={() => setQuantity(i, line.quantity + 1)} aria-label="Más">
                                                    <Plus className="size-3.5" />
                                                </button>
                                            </div>
                                            <span className="num text-right font-semibold">{money(lineTotal(line))}</span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="size-8"
                                                onClick={() =>
                                                    setData(
                                                        'cart',
                                                        data.cart.filter((_, j) => j !== i),
                                                    )
                                                }
                                                aria-label="Quitar"
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Panel>
                    <InputError message={err.items} />
                </div>

                {/* DERECHA: cliente, receta, pago */}
                <div className="flex flex-col gap-4">
                    <Panel>
                        <PanelHeader title="Cliente" />
                        <div className="grid gap-3 p-4">
                            {data.customer_id ? (
                                <div className="bg-muted/50 flex items-center justify-between rounded-md px-3 py-2 text-sm">
                                    <span className="flex items-center gap-2">
                                        <UserRound className="size-4" /> {data.customer_name} · {data.customer_document}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-7"
                                        onClick={() => setData((d) => ({ ...d, customer_id: null, customer_name: '', customer_document: '' }))}
                                    >
                                        <X className="size-4" />
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <SearchPicker<CustomerLookup>
                                        url={(q) => route('admin.customers.search', { q })}
                                        onPick={(c) =>
                                            setData((d) => ({
                                                ...d,
                                                customer_id: c.id,
                                                customer_name: c.name,
                                                customer_document: c.document_number ?? '',
                                            }))
                                        }
                                        itemKey={(c) => c.id}
                                        placeholder="Buscar cliente registrado…"
                                        renderItem={(c) => (
                                            <span>
                                                {c.name}{' '}
                                                <span className="text-muted-foreground">
                                                    · {c.document_type} {c.document_number}
                                                </span>
                                            </span>
                                        )}
                                    />
                                    <div className="grid grid-cols-[1fr_8rem] gap-2">
                                        <Input
                                            value={data.customer_name}
                                            onChange={(e) => setData('customer_name', e.target.value)}
                                            placeholder="Nombre (S/N si vacío)"
                                        />
                                        <Input
                                            value={data.customer_document}
                                            onChange={(e) => setData('customer_document', e.target.value)}
                                            placeholder="CI / NIT"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </Panel>

                    {needsPrescription && (
                        <Panel className="border-red-500/40">
                            <PanelHeader title="Receta (medicamento controlado)" />
                            <div className="grid gap-3 p-4">
                                <Input
                                    value={data.prescription_number}
                                    onChange={(e) => setData('prescription_number', e.target.value)}
                                    placeholder="N° de receta"
                                />
                                <Input
                                    value={data.prescription_doctor}
                                    onChange={(e) => setData('prescription_doctor', e.target.value)}
                                    placeholder="Médico que receta"
                                />
                            </div>
                        </Panel>
                    )}

                    <Panel>
                        <PanelHeader
                            title="Pago"
                            aside={
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setData('payments', [...data.payments, { method: 'qr', amount: '', reference: '' }])}
                                >
                                    <Plus /> Combinar
                                </Button>
                            }
                        />
                        <div className="grid gap-3 p-4">
                            {data.payments.map((payment, i) => (
                                <div key={i} className="grid gap-2">
                                    <div className="grid grid-cols-[8rem_1fr_auto] gap-2">
                                        <Select value={payment.method} onValueChange={(value) => setPayment(i, 'method', value)}>
                                            <SelectTrigger className="h-10">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(paymentMethods).map(([key, label]) => (
                                                    <SelectItem key={key} value={key}>
                                                        {label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            className="num"
                                            value={payment.amount}
                                            onChange={(e) => setPayment(i, 'amount', e.target.value)}
                                            placeholder="0.00"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            disabled={data.payments.length === 1}
                                            onClick={() =>
                                                setData(
                                                    'payments',
                                                    data.payments.filter((_, j) => j !== i),
                                                )
                                            }
                                            aria-label="Quitar pago"
                                        >
                                            <X className="size-4" />
                                        </Button>
                                    </div>
                                    {payment.method !== 'efectivo' && (
                                        <Input
                                            value={payment.reference}
                                            onChange={(e) => setPayment(i, 'reference', e.target.value)}
                                            placeholder="Referencia / N° de operación (opcional)"
                                        />
                                    )}
                                </div>
                            ))}
                            {total > 0 && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setPayment(
                                            data.payments.length - 1,
                                            'amount',
                                            String(round(total - (paid - Number(data.payments[data.payments.length - 1].amount || 0)))),
                                        )
                                    }
                                >
                                    Monto exacto
                                </Button>
                            )}
                            <InputError message={err.payments} />
                        </div>
                    </Panel>

                    <div className="surface grid gap-2 rounded-xl p-4">
                        <Row label="Total" value={money(total)} big />
                        <Row label="Pagado" value={money(paid)} />
                        <Row
                            label={change >= 0 ? 'Cambio' : 'Falta'}
                            value={money(Math.abs(change))}
                            tone={change < 0 ? 'text-red-600' : 'text-emerald-600'}
                        />
                        <Label className="text-muted-foreground text-xs font-normal">
                            El total final lo confirma el sistema con los lotes que salen (FEFO y promociones).
                        </Label>
                        <Button type="submit" size="lg" className="btn-brand mt-2" disabled={processing || data.cart.length === 0 || change < 0}>
                            {processing ? <LoaderCircle className="size-4 animate-spin" /> : <ShoppingCart />}
                            Cobrar {money(total)}
                        </Button>
                    </div>
                </div>
            </form>
        </AdminLayout>
    );
}

function Row({ label, value, big, tone }: { label: string; value: string; big?: boolean; tone?: string }) {
    return (
        <div className="flex items-baseline justify-between">
            <span className={cn('text-sm', big ? 'font-medium' : 'text-muted-foreground')}>{label}</span>
            <span className={cn('num font-semibold', big ? 'font-display text-2xl' : 'text-base', tone)}>{value}</span>
        </div>
    );
}
