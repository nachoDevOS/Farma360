/*
 * PÁGINA: Punto de venta  (ruta /admin/pos)
 *
 * 1. Buscar (nombre, genérico, síntoma o código de barras con lector) → se agrega al carrito. "3*alergin" agrega 3.
 *    F2 vuelve al buscador, F4 va al monto del pago. El carrito sobrevive a recargar la página (useForm con clave).
 * 2. Cantidades por presentación (unidad, blíster, caja).
 * 3. Cliente (opcional), receta si hay controlados, y formas de pago (se pueden combinar; billetes rápidos en efectivo).
 * El precio final lo calcula Laravel (SaleService): usa el lote que vence primero y su promoción.
 * Aquí se muestra una estimación con la promoción del primer lote.
 */
import { DocStatus, PromoBadge } from '@/components/admin/common/doc-status';
import { StoredImage } from '@/components/admin/common/image-upload';
import { describeLevels, PackageChain } from '@/components/admin/common/package-chain';
import { blockFractionKeys } from '@/components/admin/common/quantity-input';
import { SearchPicker } from '@/components/admin/common/search-picker';
import { Panel, PanelHeader } from '@/components/admin/dashboard/panel';
import { countOf, plural } from '@/components/admin/products/presentation-levels';
import InputError from '@/components/shared/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AdminLayout from '@/layouts/admin/admin-layout';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type CashSession, type PosLookup } from '@/types/admin/pharmacy';
import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowLeftRight,
    Banknote,
    CreditCard,
    Lightbulb,
    LoaderCircle,
    type LucideIcon,
    Minus,
    Pill,
    Plus,
    QrCode,
    ScanBarcode,
    Search,
    ShoppingCart,
    Sparkles,
    Stethoscope,
    Trash2,
    UserRound,
    Wallet,
    X,
} from 'lucide-react';
import { FormEventHandler, Fragment, useEffect, useRef, useState } from 'react';

interface Props {
    session: CashSession;
    paymentMethods: Record<string, string>;
}

/** siblings: las presentaciones a la venta del mismo producto (para sugerir 1 blíster + 1 tableta en vez de 11 tabletas) */
type CartLine = PosLookup & { quantity: number; siblings?: PosLookup[] };
type Packing = { option: PosLookup; quantity: number }[];
type PackingSuggestion = { productId: number; units: number; unitWord: string; packing: Packing; savings: number };
/** Un producto del buscador con sus presentaciones a la venta (options[0] = la que agrega Enter: la escaneada o la más chica). */
type PosProduct = PosLookup & { options: PosLookup[]; chosen?: PosLookup };
type PaymentRow = { method: string; amount: string; reference: string };
type CustomerLookup = { id: number; name: string; document_type: string; document_number: string | null };

const round = (n: number) => Math.round(n * 100) / 100;

/** Ícono de cada forma de pago (config/farmacia.php → payment_methods); las nuevas usan la billetera. */
const PAYMENT_ICONS: Record<string, LucideIcon> = { efectivo: Banknote, qr: QrCode, tarjeta: CreditCard, transferencia: ArrowLeftRight };

/** Agrupa las presentaciones que manda el servidor (una fila por presentación) en un resultado por producto. */
function groupByProduct(rows: PosLookup[]): PosProduct[] {
    const products = new Map<number, PosProduct>();
    rows.forEach((row) => {
        const product = products.get(row.product_id);
        if (product) {
            product.options.push(row);
        } else {
            products.set(row.product_id, { ...row, options: [row] });
        }
    });
    return [...products.values()];
}

/** "3*alergin", "3x alergin", "3 × alergin" → { quantity: 3, text: 'alergin' }; sin prefijo, cantidad 1. */
function parseQuantity(query: string): { quantity: number; text: string } {
    const match = query.match(/^\s*(\d{1,3})\s*[*x×]\s*(.*)$/i);
    const quantity = match ? Number(match[1]) : 1;
    return quantity >= 1 && match ? { quantity, text: match[2].trim() } : { quantity: 1, text: query.trim() };
}

const priceOf = (option: PosLookup, quantity: number) => round(option.sale_price * quantity * (1 - (option.promo_discount ?? 0) / 100));

/** Arma las unidades con los empaques más grandes primero: 11 tabletas → 1 blíster (10) + 1 tableta. Null si no cierra justo. */
function bestPacking(units: number, options: PosLookup[]): Packing | null {
    const packing: Packing = [];
    let left = units;
    [...options]
        .filter((option) => option.sale_price > 0)
        .sort((a, b) => b.factor - a.factor)
        .forEach((option) => {
            const quantity = Math.floor(left / option.factor);
            if (quantity > 0) {
                packing.push({ option, quantity });
                left -= quantity * option.factor;
            }
        });
    return left === 0 ? packing : null;
}

/**
 * Si las líneas de un producto se pueden vender en empaques más grandes y al cliente le sale más barato
 * (11 tabletas a Bs 1,50 = Bs 16,50 → 1 blíster Bs 12 + 1 tableta Bs 1,50 = Bs 13,50), la sugerencia; si no, null.
 */
function packingSuggestion(cart: CartLine[], productId: number): PackingSuggestion | null {
    const lines = cart.filter((line) => line.product_id === productId);
    const siblings = lines.find((line) => line.siblings?.length)?.siblings;
    if (!siblings || siblings.length < 2) {
        return null;
    }
    const units = lines.reduce((sum, line) => sum + line.quantity * line.factor, 0);
    const packing = bestPacking(units, siblings);
    if (!packing) {
        return null;
    }
    const key = (items: { id: number; quantity: number }[]) =>
        items
            .map((item) => `${item.id}:${item.quantity}`)
            .sort()
            .join('|');
    const current = key(lines.map((line) => ({ id: line.presentation_id, quantity: line.quantity })));
    if (current === key(packing.map((item) => ({ id: item.option.presentation_id, quantity: item.quantity })))) {
        return null;
    }
    const savings = round(
        lines.reduce((sum, line) => sum + priceOf(line, line.quantity), 0) -
            packing.reduce((sum, item) => sum + priceOf(item.option, item.quantity), 0),
    );
    if (savings < 0.01) {
        return null;
    }
    const loose = siblings.find((option) => option.factor === 1)?.package;
    const unitWord = loose
        ? units === 1
            ? loose
            : plural(loose)
        : (siblings.find((o) => o.breakdown?.length)?.breakdown.at(-1)?.unit ?? 'unidades');
    return { productId, units, unitWord, packing, savings };
}

/** Billetes de Bolivia para sugerir con cuánto paga el cliente. */
const BILLS = [10, 20, 50, 100, 200];

/** Montos con los que probablemente paga en efectivo: el siguiente múltiplo de cada billete por encima del total (máx. 4). */
function cashSuggestions(total: number): number[] {
    if (total <= 0) {
        return [];
    }
    const amounts = BILLS.map((bill) => Math.ceil(total / bill) * bill).filter((amount) => amount > total);
    return [...new Set(amounts)].sort((a, b) => a - b).slice(0, 4);
}

export default function Pos({ session, paymentMethods }: Props) {
    const search = useRef<HTMLInputElement>(null);
    const firstAmount = useRef<HTMLInputElement>(null);
    // Cantidad escrita antes del producto ("3*alergin"): la toma el buscador al pedir resultados
    const [pendingQuantity, setPendingQuantity] = useState(1);
    // Última línea agregada: destella en el carrito (la clave cambia en cada agregado para repetir el destello)
    const [flash, setFlash] = useState<{ id: number; key: number } | null>(null);
    // Con clave: si se recarga la página no se pierde el carrito a medio cobrar
    const { data, setData, transform, post, processing, errors, reset } = useForm('pos-sale', {
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

    // F2: volver al buscador desde cualquier parte (para el siguiente cliente)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'F2') {
                e.preventDefault();
                search.current?.focus();
            } else if (e.key === 'F4') {
                e.preventDefault();
                firstAmount.current?.focus();
                firstAmount.current?.select();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const lineTotal = (line: CartLine) => round(line.sale_price * line.quantity * (1 - (line.promo_discount ?? 0) / 100));
    const subtotal = round(data.cart.reduce((sum, line) => sum + line.sale_price * line.quantity, 0));
    const total = round(data.cart.reduce((sum, line) => sum + lineTotal(line), 0));
    const savings = round(subtotal - total);
    const paid = round(data.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0));
    const change = round(paid - total);
    const needsPrescription = data.cart.some((line) => line.is_controlled);
    const unitsInCart = (productId: number) => data.cart.filter((l) => l.product_id === productId).reduce((s, l) => s + l.quantity * l.factor, 0);
    const quantityInCart = (presentationId: number) => data.cart.find((l) => l.presentation_id === presentationId)?.quantity ?? 0;
    const articles = data.cart.reduce((sum, line) => sum + line.quantity, 0);

    const addLine = (item: PosLookup, quantity = 1, siblings?: PosLookup[]) => {
        const existing = data.cart.findIndex((l) => l.presentation_id === item.presentation_id);
        if (existing >= 0) setQuantity(existing, data.cart[existing].quantity + quantity);
        else {
            // Otra presentación de un producto que ya está: va debajo de sus líneas (se ven juntas y se pueden combinar)
            const after = data.cart.findLastIndex((l) => l.product_id === item.product_id) + 1 || data.cart.length;
            setData('cart', [...data.cart.slice(0, after), { ...item, quantity, siblings }, ...data.cart.slice(after)]);
        }
        setFlash({ id: item.presentation_id, key: Date.now() });
        setPendingQuantity(1);
        search.current?.focus();
    };

    const setQuantity = (index: number, quantity: number) => {
        if (quantity < 1) return;
        setData(
            'cart',
            data.cart.map((line, i) => (i === index ? { ...line, quantity } : line)),
        );
    };

    /** Cambia las líneas del producto por la combinación sugerida, en el lugar de la primera. */
    const applyPacking = (suggestion: PackingSuggestion) => {
        const first = data.cart.findIndex((line) => line.product_id === suggestion.productId);
        const siblings = data.cart[first]?.siblings;
        const others = data.cart.filter((line) => line.product_id !== suggestion.productId);
        const packed = suggestion.packing.map(({ option, quantity }) => ({ ...option, quantity, siblings }));
        setData('cart', [...others.slice(0, first), ...packed, ...others.slice(first)]);
        setFlash({ id: packed[0].presentation_id, key: Date.now() });
    };

    const setPayment = (index: number, field: keyof PaymentRow, value: string) =>
        setData(
            'payments',
            data.payments.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
        );

    /** Lo que falta para cubrir el total, en la última forma de pago (botón "Exacto"). */
    const payExact = () => {
        const last = data.payments.length - 1;
        setPayment(last, 'amount', String(round(total - (paid - Number(data.payments[last].amount || 0)))));
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('admin.sales.store'), { onSuccess: () => reset() });
    };

    const singleCash = data.payments.length === 1 && data.payments[0].method === 'efectivo';
    const blocker = data.cart.length === 0 ? 'Agrega al menos un producto' : change < 0 ? `Falta cobrar ${money(Math.abs(change))}` : null;

    return (
        <AdminLayout breadcrumbs={[{ title: 'Punto de venta', href: route('admin.pos') }]}>
            <Head title="Punto de venta" />
            <form onSubmit={submit} className="grid w-full flex-1 items-start gap-6 p-4 md:p-6 xl:grid-cols-[1fr_25rem]">
                {/* IZQUIERDA: búsqueda + carrito */}
                <div className="flex min-w-0 flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h1 className="font-display flex items-center gap-3 text-xl font-semibold">
                            <span className="from-primary flex size-10 items-center justify-center rounded-xl bg-gradient-to-br to-sky-500 text-white shadow-md shadow-sky-500/25">
                                <ShoppingCart className="size-5" />
                            </span>
                            Punto de venta
                        </h1>
                        <Link
                            href={route('admin.cash.index')}
                            className="text-muted-foreground bg-card ring-border hover:text-foreground flex items-center gap-2 rounded-full px-3 py-1 text-sm ring-1 transition-colors"
                        >
                            {session.cash_register.name} · {session.branch.name} <DocStatus status="abierta" />
                        </Link>
                    </div>

                    <SearchPicker<PosProduct, PosLookup>
                        inputRef={search}
                        autoFocus
                        minLength={1}
                        url={(q) => {
                            const { quantity, text } = parseQuantity(q);
                            setPendingQuantity(quantity);
                            return route('admin.pos.search', { q: text });
                        }}
                        mapResults={groupByProduct}
                        onPick={(product) => addLine(product.chosen ?? product.options[0], pendingQuantity, product.options)}
                        inputClassName="h-12 rounded-xl text-base shadow-sm transition-shadow focus-visible:shadow-lg focus-visible:shadow-sky-500/15"
                        itemKey={(product) => product.product_id}
                        placeholder="Buscar producto, genérico, síntoma (ej: dolor de cabeza) o escanear código…  (F2)"
                        listClassName="max-h-[36rem] divide-y"
                        renderItem={(product, pick) => (
                            <ProductResult
                                product={product}
                                quantity={pendingQuantity}
                                inCart={quantityInCart}
                                onChoose={(option) => pick({ ...product, chosen: option })}
                            />
                        )}
                    />
                    <p className="text-muted-foreground -mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs">
                        <span>
                            <kbd className="bg-muted rounded border px-1 text-[10px] font-medium">3*</kbd> antes del nombre agrega 3 de una vez
                        </span>
                        <span>
                            <kbd className="bg-muted rounded border px-1 text-[10px] font-medium">F2</kbd> buscar
                        </span>
                        <span>
                            <kbd className="bg-muted rounded border px-1 text-[10px] font-medium">F4</kbd> monto a cobrar
                        </span>
                    </p>

                    <Panel className="flex-1 overflow-hidden">
                        {data.cart.length === 0 ? (
                            <EmptyCart />
                        ) : (
                            <>
                                <div className="flex items-center justify-between border-b px-4 py-2.5">
                                    <p className="flex items-center gap-2 text-sm font-semibold">
                                        <ShoppingCart className="text-primary size-4" />
                                        Carrito
                                        <span className="bg-primary/10 text-primary num rounded-full px-2 py-0.5 text-xs">
                                            {articles} {articles === 1 ? 'artículo' : 'artículos'}
                                        </span>
                                    </p>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-muted-foreground hover:text-destructive h-7"
                                        onClick={() => setData('cart', [])}
                                    >
                                        <Trash2 className="size-3.5" /> Vaciar
                                    </Button>
                                </div>
                                <ul className="divide-y">
                                    {data.cart.map((line, i) => {
                                        const isLastOfProduct = data.cart.findLastIndex((l) => l.product_id === line.product_id) === i;
                                        const suggestion = isLastOfProduct ? packingSuggestion(data.cart, line.product_id) : null;
                                        return (
                                            <Fragment key={line.presentation_id}>
                                                <CartItem
                                                    line={line}
                                                    grouped={i > 0 && data.cart[i - 1].product_id === line.product_id}
                                                    flashKey={flash?.id === line.presentation_id ? flash.key : null}
                                                    total={lineTotal(line)}
                                                    overStock={unitsInCart(line.product_id) > line.stock_units}
                                                    onQuantity={(quantity) => setQuantity(i, quantity)}
                                                    onRemove={() =>
                                                        setData(
                                                            'cart',
                                                            data.cart.filter((_, j) => j !== i),
                                                        )
                                                    }
                                                />
                                                {suggestion && <PackingHint suggestion={suggestion} onApply={() => applyPacking(suggestion)} />}
                                            </Fragment>
                                        );
                                    })}
                                </ul>
                            </>
                        )}
                    </Panel>
                    <InputError message={err.items} />
                </div>

                {/* DERECHA: cliente, receta, pago y cobro (queda fija al bajar) */}
                <div className="flex flex-col gap-4 xl:sticky xl:top-4">
                    <Panel>
                        <PanelHeader title="Cliente" description="Opcional: sin datos sale a nombre de S/N." />
                        <div className="grid gap-3 p-4">
                            {data.customer_id ? (
                                <div className="bg-primary/5 ring-primary/15 flex items-center justify-between rounded-lg px-3 py-2 text-sm ring-1">
                                    <span className="flex min-w-0 items-center gap-2">
                                        <span className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full">
                                            <UserRound className="size-4" />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block truncate font-medium">{data.customer_name}</span>
                                            <span className="text-muted-foreground num block text-xs">{data.customer_document}</span>
                                        </span>
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-7"
                                        onClick={() => setData((d) => ({ ...d, customer_id: null, customer_name: '', customer_document: '' }))}
                                        aria-label="Quitar cliente"
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
                        <Panel className="animate-in fade-in slide-in-from-top-1 border-red-500/40">
                            <PanelHeader title="Receta (medicamento controlado)" description="Obligatoria para vender controlados." />
                            <div className="grid gap-3 p-4">
                                <Input
                                    value={data.prescription_number}
                                    onChange={(e) => setData('prescription_number', e.target.value)}
                                    placeholder="N° de receta"
                                />
                                <InputError message={err.prescription_number} />
                                <Input
                                    value={data.prescription_doctor}
                                    onChange={(e) => setData('prescription_doctor', e.target.value)}
                                    placeholder="Médico que receta"
                                />
                                <InputError message={err.prescription_doctor} />
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
                        <div className="grid gap-4 p-4">
                            {data.payments.map((payment, i) => (
                                <div key={i} className={cn('grid gap-2', i > 0 && 'border-t pt-4')}>
                                    <div className="flex items-center gap-2">
                                        <MethodPicker
                                            methods={paymentMethods}
                                            value={payment.method}
                                            onChange={(value) => setPayment(i, 'method', value)}
                                        />
                                        {data.payments.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="size-8 shrink-0"
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
                                        )}
                                    </div>
                                    <div className="relative">
                                        <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                                            Bs
                                        </span>
                                        <Input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            ref={i === 0 ? firstAmount : undefined}
                                            className="num h-11 pl-9 text-lg font-semibold"
                                            value={payment.amount}
                                            onChange={(e) => setPayment(i, 'amount', e.target.value)}
                                            placeholder="0.00"
                                            aria-label={`Monto en ${paymentMethods[payment.method] ?? payment.method}`}
                                        />
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
                                <div className="flex flex-wrap gap-1.5">
                                    <QuickAmount label="Exacto" onClick={payExact} highlight />
                                    {singleCash &&
                                        cashSuggestions(total).map((amount) => (
                                            <QuickAmount key={amount} label={money(amount)} onClick={() => setPayment(0, 'amount', String(amount))} />
                                        ))}
                                </div>
                            )}
                            <InputError message={err.payments} />
                        </div>
                    </Panel>

                    <Summary subtotal={subtotal} savings={savings} total={total} paid={paid} change={change} />

                    <div className="grid gap-1.5">
                        <Button
                            type="submit"
                            size="lg"
                            className="btn-brand h-12 text-base shadow-lg shadow-sky-500/20"
                            disabled={processing || blocker !== null}
                        >
                            {processing ? <LoaderCircle className="size-5 animate-spin" /> : <ShoppingCart className="size-5" />}
                            Cobrar {money(total)}
                        </Button>
                        <p className="text-muted-foreground text-center text-xs">
                            {blocker ?? 'El total final lo confirma el sistema con los lotes que salen (FEFO y promociones).'}
                        </p>
                    </div>
                </div>
            </form>
        </AdminLayout>
    );
}

/**
 * Resultado del buscador: un producto (foto, nombre, genérico, laboratorio, usos) y abajo sus presentaciones como botones:
 * tocar una agrega ESA (tableta, blíster, caja); tocar el resto de la tarjeta o Enter agrega la primera (marcada con Enter).
 */
function ProductResult({
    product,
    quantity,
    inCart,
    onChoose,
}: {
    product: PosProduct;
    /** Cantidad escrita antes del nombre ("3*alergin"): se muestra para que se vea cuánto se va a agregar */
    quantity: number;
    inCart: (presentationId: number) => number;
    onChoose: (option: PosLookup) => void;
}) {
    const meta = [product.generic_name, product.laboratory].filter(Boolean).join(' · ');
    const options = [...product.options].sort((a, b) => a.factor - b.factor);
    const defaultId = product.options[0].presentation_id;
    // Unidad base en singular: la presentación suelta ("tableta"); si no se vende suelta, la sacamos del último nivel ("tabletas")
    const looseUnit = options.find((o) => o.factor === 1)?.package;
    const stockUnit = looseUnit
        ? product.stock_units === 1
            ? looseUnit
            : plural(looseUnit)
        : (options.find((o) => o.breakdown?.length)?.breakdown.at(-1)?.unit ?? options[0].package);

    return (
        <div className="flex gap-3 py-1">
            <StoredImage
                path={product.image}
                alt={product.product_name}
                fallback={<Pill className="size-5" />}
                className="size-16 shrink-0 rounded-lg"
            />
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="truncate text-base font-semibold">{product.commercial_name ?? product.product_name}</span>
                            {product.concentration && <span className="text-muted-foreground text-sm">{product.concentration}</span>}
                            {product.is_controlled ? (
                                <span className="rounded bg-red-100 px-1.5 py-px text-[10px] font-bold tracking-wide text-red-700 dark:bg-red-950 dark:text-red-300">
                                    CONTROLADO
                                </span>
                            ) : (
                                product.requires_prescription && (
                                    <span className="rounded bg-amber-100 px-1.5 py-px text-[10px] font-bold tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                                        RECETA
                                    </span>
                                )
                            )}
                        </p>
                        {meta && <p className="text-muted-foreground truncate text-xs">{meta}</p>}
                    </div>
                    <span className="flex shrink-0 items-center gap-2">
                        {quantity > 1 && (
                            <span className="from-primary animate-in zoom-in-50 num rounded-full bg-gradient-to-r to-sky-500 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                                ×{quantity}
                            </span>
                        )}
                        <span className="text-muted-foreground num text-xs">
                            Stock: <span className="text-foreground font-semibold">{product.stock_units.toLocaleString('es')}</span> {stockUnit}
                        </span>
                    </span>
                </div>
                {product.indications.length > 0 && (
                    <p className="mt-1 flex flex-wrap gap-1">
                        {product.indications.slice(0, 3).map((indication) => (
                            <span key={indication} className="bg-primary/10 text-primary rounded-full px-1.5 py-px text-[10px] font-medium">
                                {indication}
                            </span>
                        ))}
                    </p>
                )}
                <div className="mt-2 grid [grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))] gap-2">
                    {options.map((option) => (
                        <OptionButton
                            key={option.presentation_id}
                            option={option}
                            isDefault={option.presentation_id === defaultId && options.length > 1}
                            inCart={inCart(option.presentation_id)}
                            onChoose={() => onChoose(option)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

/** Una presentación para vender: píldora del empaque, qué trae, precio (con promoción) y cuántas hay. */
function OptionButton({ option, isDefault, inCart, onChoose }: { option: PosLookup; isDefault: boolean; inCart: number; onChoose: () => void }) {
    const available = Math.floor(option.stock_units / option.factor);
    const finalPrice = option.promo_discount ? round(option.sale_price * (1 - option.promo_discount / 100)) : option.sale_price;
    const first = option.breakdown?.[0];

    return (
        <button
            type="button"
            title={describeLevels(option.breakdown ?? []) || 'Unidad suelta'}
            onClick={(e) => {
                e.stopPropagation();
                onChoose();
            }}
            className={cn(
                'group/opt bg-card relative flex flex-col gap-1 rounded-lg p-2.5 text-left ring-1 transition-all duration-150',
                'hover:ring-primary hover:bg-primary/5 hover:-translate-y-px hover:shadow-md active:translate-y-0 active:scale-[0.98]',
                isDefault ? 'ring-primary/40' : 'ring-border',
                available === 0 && 'opacity-55',
            )}
        >
            <span className="flex items-center justify-between gap-2">
                <PackageChain size="sm" pkg={option.package ?? option.presentation_name} levels={[]} withLevels={false} />
                <span className="flex items-center gap-1">
                    {option.promo_discount && <PromoBadge percent={option.promo_discount} />}
                    <span className="num font-display text-base font-bold">{money(finalPrice)}</span>
                </span>
            </span>
            <span className="text-muted-foreground flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate">
                    {first ? (
                        <>
                            trae <span className="num text-foreground/80 font-semibold">{first.count}</span> {first.unit}
                        </>
                    ) : (
                        'unidad suelta'
                    )}
                </span>
                {option.promo_discount && <span className="num line-through">{money(option.sale_price)}</span>}
            </span>
            <span className="flex items-center justify-between gap-2">
                <StockPill available={available} pkg={option.package ?? 'unidad'} />
                {inCart > 0 ? (
                    <span className="text-primary text-[10px] font-semibold">En carrito: {inCart}</span>
                ) : (
                    isDefault && <kbd className="bg-muted text-muted-foreground rounded border px-1 text-[9px] font-medium">Enter</kbd>
                )}
            </span>
            <span className="bg-primary absolute -top-1.5 -right-1.5 flex size-5 scale-0 items-center justify-center rounded-full text-white shadow transition-transform duration-150 group-hover/opt:scale-100">
                <Plus className="size-3" />
            </span>
        </button>
    );
}

/** "Hay 12 cajas" (verde), "Últimas 2 cajas" (ámbar), "Sin stock" (rojo): cuántas de ESA presentación se pueden vender. */
function StockPill({ available, pkg }: { available: number; pkg: string }) {
    const tone = available === 0 ? 'out' : available <= 3 ? 'low' : 'ok';
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-px text-[11px] font-medium',
                tone === 'ok' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
                tone === 'low' && 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
                tone === 'out' && 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
            )}
        >
            <span
                className={cn(
                    'size-1.5 rounded-full',
                    tone === 'ok' && 'bg-emerald-500',
                    tone === 'low' && 'bg-amber-500',
                    tone === 'out' && 'bg-red-500',
                )}
            />
            {tone === 'out' ? 'Sin stock' : `${tone === 'low' ? 'Últimas' : 'Hay'} ${countOf(available, pkg)}`}
        </span>
    );
}

/** Línea del carrito: foto, nombre, empaque y precio unitario; − cantidad + con las unidades que salen; total y quitar. */
function CartItem({
    line,
    grouped,
    flashKey,
    total,
    overStock,
    onQuantity,
    onRemove,
}: {
    line: CartLine;
    /** Otra presentación del mismo producto que la línea de arriba: se ve pegada a ella */
    grouped: boolean;
    /** Cambia cada vez que se agrega esta línea: dispara el destello */
    flashKey: number | null;
    total: number;
    overStock: boolean;
    onQuantity: (quantity: number) => void;
    onRemove: () => void;
}) {
    const baseUnit = line.breakdown?.[line.breakdown.length - 1]?.unit;
    const full = round(line.sale_price * line.quantity);

    return (
        <li
            className={cn(
                'group animate-in fade-in slide-in-from-top-1 relative grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 duration-200 sm:grid-cols-[1fr_auto_7rem_auto]',
                grouped && 'border-dashed pt-2',
            )}
        >
            {flashKey !== null && (
                <span
                    key={flashKey}
                    aria-hidden
                    className="bg-primary/15 animate-out fade-out fill-mode-forwards pointer-events-none absolute inset-0 duration-1000 motion-reduce:hidden"
                />
            )}
            {/* En celular: nombre arriba y abajo − cantidad + · total · quitar */}
            <div className="col-span-3 flex min-w-0 items-center gap-3 sm:col-span-1">
                {grouped ? (
                    // Otra presentación del mismo producto: sin repetir foto ni nombre, colgando de la línea de arriba
                    <span aria-hidden className="text-muted-foreground flex size-11 shrink-0 items-start justify-end pr-1 text-lg leading-none">
                        ↳
                    </span>
                ) : (
                    <StoredImage
                        path={line.image}
                        alt={line.product_name}
                        fallback={<Pill className="size-4" />}
                        className="size-11 shrink-0 rounded-lg"
                    />
                )}
                <div className="min-w-0">
                    {grouped ? (
                        <p className="sr-only">{line.commercial_name ?? line.product_name}</p>
                    ) : (
                        <p className="truncate font-medium">
                            {line.commercial_name ?? line.product_name}{' '}
                            {line.concentration && <span className="text-muted-foreground text-sm font-normal">{line.concentration}</span>}
                        </p>
                    )}
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                        <span title={describeLevels(line.breakdown ?? []) || 'Unidad suelta'}>
                            <PackageChain size="sm" pkg={line.package ?? line.presentation_name} levels={line.breakdown ?? []} withLevels={false} />
                        </span>
                        <span className="num text-muted-foreground">{money(line.sale_price)} c/u</span>
                        {line.promo_discount && <PromoBadge percent={line.promo_discount} />}
                        {line.requires_prescription && <span className="font-medium text-amber-600">con receta</span>}
                        {overStock && <span className="font-semibold text-red-600">stock insuficiente</span>}
                    </div>
                </div>
            </div>
            {/* − cantidad + en una sola pieza (clase .stepper de app.css) */}
            <div className="flex flex-col items-center gap-0.5">
                <div className="stepper" data-active="true">
                    <button type="button" onClick={() => onQuantity(line.quantity - 1)} disabled={line.quantity <= 1} aria-label="Menos">
                        <Minus className="size-3.5" />
                    </button>
                    <input
                        type="number"
                        min={1}
                        className="text-sm"
                        value={line.quantity}
                        step={1}
                        inputMode="numeric"
                        onKeyDown={blockFractionKeys}
                        onChange={(e) => onQuantity(Math.floor(Number(e.target.value)))}
                        onFocus={(e) => e.target.select()}
                        aria-label="Cantidad"
                    />
                    <button type="button" onClick={() => onQuantity(line.quantity + 1)} aria-label="Más">
                        <Plus className="size-3.5" />
                    </button>
                </div>
                {line.factor > 1 && baseUnit && (
                    <span className="text-muted-foreground num text-[10px]">
                        = {(line.quantity * line.factor).toLocaleString('es')} {baseUnit}
                    </span>
                )}
            </div>
            <div className="text-right">
                <span className="num block font-semibold">{money(total)}</span>
                {full > total && <span className="num text-muted-foreground block text-[11px] line-through">{money(full)}</span>}
            </div>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="hover:text-destructive size-8 transition-opacity sm:opacity-40 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                onClick={onRemove}
                aria-label="Quitar"
            >
                <Trash2 className="size-4" />
            </Button>
        </li>
    );
}

/** Sugerencia bajo un producto: "11 tabletas = 1 blíster + 1 tableta · el cliente ahorra Bs 3,00  [Convertir]". */
function PackingHint({ suggestion, onApply }: { suggestion: PackingSuggestion; onApply: () => void }) {
    return (
        <li className="animate-in fade-in slide-in-from-top-1 px-4 pb-3 duration-300">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-gradient-to-r from-amber-50 to-emerald-50 px-3 py-2 ring-1 ring-amber-200/70 dark:from-amber-950/40 dark:to-emerald-950/40 dark:ring-amber-900/60">
                <Lightbulb className="size-4 shrink-0 text-amber-500" />
                <p className="min-w-0 flex-1 text-sm">
                    <span className="num font-semibold">
                        {suggestion.units.toLocaleString('es')} {suggestion.unitWord}
                    </span>{' '}
                    ={' '}
                    {suggestion.packing.map(({ option, quantity }, i) => (
                        <span key={option.presentation_id}>
                            {i > 0 && ' + '}
                            <span className="num font-semibold">{countOf(quantity, option.package)}</span>
                        </span>
                    ))}
                    <span className="text-muted-foreground"> · el cliente ahorra </span>
                    <span className="num font-semibold text-emerald-700 dark:text-emerald-400">{money(suggestion.savings)}</span>
                </p>
                <Button type="button" size="sm" className="h-7 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700" onClick={onApply}>
                    <Sparkles className="size-3.5" /> Convertir
                </Button>
            </div>
        </li>
    );
}

/** Carrito vacío: cómo empezar (escanear, buscar, por síntoma). */
function EmptyCart() {
    const tips: { icon: LucideIcon; title: string; text: string }[] = [
        { icon: ScanBarcode, title: 'Escanea', text: 'el código de barras con el lector' },
        { icon: Search, title: 'Busca', text: 'por nombre comercial o genérico' },
        { icon: Stethoscope, title: 'Por síntoma', text: '"dolor de cabeza", "fiebre"…' },
    ];
    return (
        <div className="flex h-full min-h-72 flex-col items-center justify-center gap-5 p-6 text-center">
            <div className="relative">
                <div className="bg-primary/20 absolute inset-0 animate-pulse rounded-full blur-xl motion-reduce:animate-none" />
                <span className="from-primary relative flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br to-sky-500 text-white shadow-lg shadow-sky-500/30">
                    <ShoppingCart className="size-7" />
                </span>
            </div>
            <div>
                <p className="font-display text-lg font-semibold">Listo para vender</p>
                <p className="text-muted-foreground text-sm">Agrega productos al carrito para empezar.</p>
            </div>
            <div className="grid w-full max-w-xl gap-2 sm:grid-cols-3">
                {tips.map(({ icon: Icon, title, text }) => (
                    <div key={title} className="bg-muted/40 ring-border rounded-lg p-3 text-left ring-1">
                        <Icon className="text-primary mb-1.5 size-4" />
                        <p className="text-sm font-medium">{title}</p>
                        <p className="text-muted-foreground text-xs">{text}</p>
                    </div>
                ))}
            </div>
            <p className="text-muted-foreground text-xs">
                Presiona <kbd className="bg-muted rounded border px-1.5 py-0.5 text-[10px] font-medium">F2</kbd> para volver al buscador
            </p>
        </div>
    );
}

/** Formas de pago como botones con ícono (en vez de una lista desplegable). */
function MethodPicker({ methods, value, onChange }: { methods: Record<string, string>; value: string; onChange: (value: string) => void }) {
    return (
        <div role="radiogroup" aria-label="Forma de pago" className="bg-muted/60 grid flex-1 grid-cols-4 gap-1 rounded-lg p-1">
            {Object.entries(methods).map(([key, label]) => {
                const Icon = PAYMENT_ICONS[key] ?? Wallet;
                const selected = key === value;
                return (
                    <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onChange(key)}
                        className={cn(
                            'flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[11px] font-medium transition-all duration-150',
                            selected ? 'bg-card text-primary shadow-sm ring-1 ring-black/5' : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <Icon className="size-4" />
                        <span className="truncate">{label}</span>
                    </button>
                );
            })}
        </div>
    );
}

function QuickAmount({ label, onClick, highlight }: { label: string; onClick: () => void; highlight?: boolean }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'num rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors active:scale-95',
                highlight ? 'bg-primary/10 text-primary ring-primary/20 hover:bg-primary/15' : 'bg-card ring-border hover:bg-muted',
            )}
        >
            {label}
        </button>
    );
}

/** Resumen del cobro: subtotal, ahorro por promociones, total, pagado y el cambio (o lo que falta) bien grande. */
function Summary({ subtotal, savings, total, paid, change }: { subtotal: number; savings: number; total: number; paid: number; change: number }) {
    return (
        <div className="surface grid gap-2 rounded-xl p-4">
            {savings > 0 && (
                <>
                    <Row label="Subtotal" value={money(subtotal)} />
                    <Row label="Ahorro por promociones" value={`− ${money(savings)}`} tone="text-emerald-600 dark:text-emerald-400" />
                </>
            )}
            <div className="from-primary relative overflow-hidden rounded-lg bg-gradient-to-br to-sky-500 px-4 py-3 text-white shadow-lg shadow-sky-500/20">
                <span aria-hidden className="absolute -top-8 -right-6 size-24 rounded-full bg-white/10 blur-sm" />
                <span aria-hidden className="absolute -bottom-10 left-8 size-20 rounded-full bg-white/10 blur-sm" />
                <div className="relative flex items-baseline justify-between">
                    <span className="text-sm font-medium text-white/80">Total a cobrar</span>
                    <span
                        key={total}
                        className="num font-display animate-in fade-in slide-in-from-bottom-1 text-3xl font-bold tracking-tight duration-200"
                    >
                        {money(total)}
                    </span>
                </div>
            </div>
            <Row label="Pagado" value={money(paid)} />
            {total > 0 && paid > 0 && (
                <div
                    className={cn(
                        'animate-in fade-in zoom-in-95 mt-1 flex items-center justify-between rounded-lg px-3 py-2.5 duration-200',
                        change >= 0
                            ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900'
                            : 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900',
                    )}
                >
                    <span className="text-sm font-medium">{change >= 0 ? 'Cambio a entregar' : 'Falta cobrar'}</span>
                    <span className="num font-display text-2xl font-bold">{money(Math.abs(change))}</span>
                </div>
            )}
        </div>
    );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
    return (
        <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground text-sm">{label}</span>
            <span className={cn('num text-base font-semibold', tone)}>{value}</span>
        </div>
    );
}
