/*
 * PÁGINA: Punto de venta  (ruta /admin/pos)
 *
 * 1. Buscar (nombre, genérico, síntoma o código de barras con lector). "3*alergin" pide 3.
 *    F2 vuelve al buscador, F4 va al monto del pago. El carrito sobrevive a recargar la página (useForm con clave).
 * 2. Cuánto lleva (QuantityDialog): se escriben las tabletas y se arma solo con los empaques más grandes
 *    (11 tabletas → 1 blíster + 1 tableta), o se ajusta caja / blíster / tableta con − / +.
 *    Escaneado o con un solo empaque se agrega directo.
 * 3. Cliente (opcional), receta si hay controlados, y formas de pago (se pueden combinar; billetes rápidos en efectivo).
 * El precio final lo calcula Laravel (SaleService): usa el lote que vence primero y su promoción.
 * Aquí se muestra una estimación con la promoción del primer lote.
 */
import { DocStatus, PromoBadge } from '@/components/admin/common/doc-status';
import { StoredImage } from '@/components/admin/common/image-upload';
import { blockFractionKeys } from '@/components/admin/common/quantity-input';
import { SearchPicker } from '@/components/admin/common/search-picker';
import { Panel, PanelHeader } from '@/components/admin/dashboard/panel';
import { countOf, plural } from '@/components/admin/products/presentation-levels';
import { SaleDoneBanner } from '@/components/admin/sales/sale-done-banner';
import InputError from '@/components/shared/input-error';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCan } from '@/hooks/use-can';
import AdminLayout from '@/layouts/admin/admin-layout';
import { formatDay, money } from '@/lib/format';
import { useStorageUrl } from '@/lib/storage';
import { cn } from '@/lib/utils';
import { type CashSession, type PosLookup } from '@/types/admin/pharmacy';
import { Head, Link, useForm } from '@inertiajs/react';
import {
    BadgePercent,
    Banknote,
    Beaker,
    Factory,
    FlaskConical,
    LoaderCircle,
    Minus,
    Package,
    PackageOpen,
    Pencil,
    Pill,
    Plus,
    QrCode,
    ScanBarcode,
    Search,
    ShoppingCart,
    Stethoscope,
    Tag,
    Trash2,
    TriangleAlert,
    Undo2,
    UserPlus,
    UserRound,
    X,
    type LucideIcon,
} from 'lucide-react';
import { FormEventHandler, useEffect, useRef, useState } from 'react';

interface Props {
    session: CashSession;
    paymentMethods: Record<string, string>;
    /** Tope del descuento general (% del subtotal). config/farmacia.php → discount_limit */
    discountLimit: number;
}

/** siblings: las presentaciones a la venta del mismo producto (para sugerir 1 blíster + 1 tableta en vez de 11 tabletas) */
type CartLine = PosLookup & { quantity: number; siblings?: PosLookup[] };
type Packing = { option: PosLookup; quantity: number }[];
/** Un producto del buscador con sus presentaciones a la venta (options[0] = la escaneada o la más chica). */
type PosProduct = PosLookup & { options: PosLookup[] };
/** Producto abierto en la ventana de cantidad: sus presentaciones y lo que ya trae puesto (por presentation_id). */
type Choosing = { options: PosLookup[]; initial: Record<number, number>; editing: boolean };
/** Descuento general de la venta (el "descuento adicional" de una factura): monto en Bs y su motivo. */
type GeneralDiscount = { amount: number; reason: string };
/** Cómo paga: solo efectivo, solo QR o mixto (una parte por QR y el resto en efectivo). */
type PayMode = 'efectivo' | 'qr' | 'mixto';
type CustomerLookup = { id: number; name: string; document_type: string; document_number: string | null };

const round = (n: number) => Math.round(n * 100) / 100;

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

/** Importe de una línea del carrito con la promoción del lote que sale primero. */
const lineTotal = (line: CartLine) => round(line.sale_price * line.quantity * (1 - (line.promo_discount ?? 0) / 100));
const priceOf = (option: PosLookup, quantity: number) => round(option.sale_price * quantity * (1 - (option.promo_discount ?? 0) / 100));

/** Arma las unidades con los empaques más grandes primero: 11 tabletas → 1 blíster (10) + 1 tableta. left: lo que no entra justo. */
function packUnits(units: number, options: PosLookup[]): { packing: Packing; left: number } {
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
    return { packing, left };
}

/** Como packUnits, pero null si no cierra justo. */
function bestPacking(units: number, options: PosLookup[]): Packing | null {
    const { packing, left } = packUnits(units, options);
    return left === 0 ? packing : null;
}

/**
 * Vuelve a armar con los empaques más grandes: 10 tabletas sueltas pasan solas a 1 blíster, 3 blísteres a 1 caja.
 * Solo si cierra justo y no le sale más caro al cliente; si no (o ya está así), devuelve la misma combinación.
 */
function repack(current: Packing, options: PosLookup[]): Packing {
    const units = current.reduce((sum, { option, quantity }) => sum + quantity * option.factor, 0);
    const packing = bestPacking(units, options);
    const cost = (items: Packing) => items.reduce((sum, { option, quantity }) => sum + priceOf(option, quantity), 0);
    const key = (items: Packing) =>
        items
            .map(({ option, quantity }) => `${option.presentation_id}:${quantity}`)
            .sort()
            .join('|');
    return packing && key(packing) !== key(current) && cost(packing) <= cost(current) + 0.001 ? packing : current;
}

/** La unidad base en palabras según la cantidad: "tableta" / "tabletas" (de la presentación suelta o del último nivel de un empaque). */
function baseUnitWord(options: PosLookup[], count: number): string {
    const loose = options.find((option) => option.factor === 1)?.package;
    if (loose) {
        return count === 1 ? loose : plural(loose);
    }
    return options.find((option) => option.breakdown?.length)?.breakdown.at(-1)?.unit ?? 'unidades';
}

/**
 * Pagos que viajan a Laravel según el modo: efectivo → lo entregado; QR → el total; mixto → la parte por QR y el
 * efectivo entregado. El servidor guarda el efectivo sin el cambio.
 */
function paymentsOf(payment: { mode: PayMode; cash: string; qr: string; reference: string }, total: number) {
    const qr = payment.mode === 'qr' ? total : payment.mode === 'mixto' ? round(Number(payment.qr || 0)) : 0;
    const cash = payment.mode === 'qr' ? 0 : round(Number(payment.cash || 0));
    return [
        ...(qr > 0 ? [{ method: 'qr', amount: qr, reference: payment.reference || null }] : []),
        ...(cash > 0 ? [{ method: 'efectivo', amount: cash, reference: null }] : []),
    ];
}

/** Cómo arranca cada cobro: en efectivo y sin montos. */
const NEW_PAYMENT = { mode: 'efectivo' as PayMode, cash: '', qr: '', reference: '' };

/** Pago mixto: lo que le toca al otro medio de pago. Vacío si no se escribió monto o si ya no queda nada por cobrar. */
function mixedRemainder(total: number, amount: string): string {
    const remainder = round(total - Number(amount || 0));
    return amount !== '' && remainder > 0 ? remainder.toFixed(2) : '';
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

export default function Pos({ session, paymentMethods, discountLimit }: Props) {
    const can = useCan();
    const search = useRef<HTMLInputElement>(null);
    // Primer campo del cobro (F4): el efectivo recibido, el monto por QR (mixto) o el N° de operación (QR)
    const payAmount = useRef<HTMLInputElement>(null);
    // Cantidad escrita antes del producto ("3*alergin"): la toma el buscador al pedir resultados
    const [pendingQuantity, setPendingQuantity] = useState(1);
    // Última línea agregada: destella en el carrito (la clave cambia en cada agregado para repetir el destello)
    const [flash, setFlash] = useState<{ id: number; key: number } | null>(null);
    // Producto en la ventana "¿cuántas lleva?" (null = cerrada)
    const [choosing, setChoosing] = useState<Choosing | null>(null);
    // Datos del cliente: opcionales, plegados hasta que el cajero los pida (o si ya hay alguno puesto)
    const [showCustomer, setShowCustomer] = useState(false);
    // Ventana "Descuento a la venta" abierta
    const [discounting, setDiscounting] = useState(false);
    // Con clave: si se recarga la página no se pierde el carrito a medio cobrar
    const { data, setData, transform, post, processing, errors, reset } = useForm('pos-cart', {
        cart: [] as CartLine[],
        customer_id: null as number | null,
        customer_name: '',
        customer_document: '',
        prescription_number: '',
        prescription_doctor: '',
        // cash = efectivo que entrega el cliente · qr = monto por QR (en mixto) · reference = N° de operación del QR
        payment: NEW_PAYMENT,
        discount: null as GeneralDiscount | null,
    });
    const err = errors as Record<string, string | undefined>;

    // Lo que viaja a Laravel (SaleController@store)
    transform((d) => ({
        items: d.cart.map((line) => ({ product_presentation_id: line.presentation_id, quantity: line.quantity })),
        payments: paymentsOf(d.payment, round(d.cart.reduce((sum, line) => sum + lineTotal(line), 0) - (d.discount?.amount ?? 0))),
        discount: d.discount?.amount ?? 0,
        discount_reason: d.discount?.reason ?? null,
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
                payAmount.current?.focus();
                payAmount.current?.select();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // Como en una factura: Subtotal (suma de los productos, ya con su promoción) − Descuento general = Total
    const fullPrice = round(data.cart.reduce((sum, line) => sum + line.sale_price * line.quantity, 0));
    const subtotal = round(data.cart.reduce((sum, line) => sum + lineTotal(line), 0));
    const savings = round(fullPrice - subtotal);
    const generalDiscount = data.discount?.amount ?? 0;
    const discountOverLimit = generalDiscount > round((subtotal * discountLimit) / 100);
    const total = round(Math.max(0, subtotal - generalDiscount));
    const { mode } = data.payment;
    // Por QR: todo en QR; en mixto lo que escribe el cajero. En efectivo: lo que falta después del QR
    const qrAmount = mode === 'qr' ? total : mode === 'mixto' ? round(Number(data.payment.qr || 0)) : 0;
    const cashDue = round(Math.max(0, total - qrAmount));
    const cashGiven = mode === 'qr' ? 0 : round(Number(data.payment.cash || 0));
    const paid = round(qrAmount + cashGiven);
    const change = round(paid - total);
    const needsPrescription = data.cart.some((line) => line.is_controlled);
    const customerOpen = showCustomer || data.customer_id !== null || data.customer_name !== '' || data.customer_document !== '';
    const unitsInCart = (productId: number) => data.cart.filter((l) => l.product_id === productId).reduce((s, l) => s + l.quantity * l.factor, 0);
    // Una fila por producto en el carrito: sus líneas de caja, blíster y tableta van juntas
    const cartGroups = data.cart.reduce<CartLine[][]>((groups, line) => {
        const last = groups.at(-1);
        if (last && last[0].product_id === line.product_id) last.push(line);
        else groups.push([line]);
        return groups;
    }, []);

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

    /** Cambia la cantidad de una línea; si con eso se completa un empaque (10 tabletas → 1 blíster) se arma solo. */
    const setQuantity = (index: number, quantity: number) => {
        if (quantity < 1) return;
        const cart = data.cart.map((line, i) => (i === index ? { ...line, quantity } : line));
        const { product_id: productId, siblings } = data.cart[index];
        if (siblings && siblings.length > 1) {
            const current = cart
                .filter((line) => line.product_id === productId)
                .map((line) => ({ option: line as PosLookup, quantity: line.quantity }));
            const packed = repack(current, siblings);
            if (packed !== current) {
                setProductLines(productId, packed, siblings);
                return;
            }
        }
        setData('cart', cart);
    };

    /** Cambia las líneas del producto por otra combinación, en el lugar de la primera (o al final si no estaba). Vacía = lo quita. */
    const setProductLines = (productId: number, packing: Packing, siblings?: PosLookup[]) => {
        const first = data.cart.findIndex((line) => line.product_id === productId);
        const others = data.cart.filter((line) => line.product_id !== productId);
        const at = first >= 0 ? first : others.length;
        const packed = packing.map(({ option, quantity }) => ({ ...option, quantity, siblings }));
        setData('cart', [...others.slice(0, at), ...packed, ...others.slice(at)]);
        if (packed.length > 0) {
            setFlash({ id: packed[0].presentation_id, key: Date.now() });
        }
    };

    /** Cambia las unidades base de un producto y lo vuelve a armar en empaques (41 tabletas → 1 caja + 1 blíster + 1 tableta). */
    const setUnits = (productId: number, units: number, options: PosLookup[]) => {
        const { packing, left } = packUnits(units, options);
        if (units >= 1 && left === 0) {
            setProductLines(productId, packing, options);
        }
    };

    /**
     * Abre "¿cuántas lleva?": con lo que ya hay en el carrito de ese producto; si es nuevo, vacío para que el cajero escriba
     * la cantidad (solo viene llena si la pidieron en el buscador, ej: "3*alergin").
     */
    const openChooser = (options: PosLookup[], quantity = 1) => {
        const lines = data.cart.filter((line) => line.product_id === options[0].product_id);
        const smallest = [...options].sort((a, b) => a.factor - b.factor)[0];
        setChoosing({
            options,
            initial: lines.length
                ? Object.fromEntries(lines.map((line) => [line.presentation_id, line.quantity]))
                : quantity > 1
                  ? { [smallest.presentation_id]: quantity }
                  : {},
            editing: lines.length > 0,
        });
        setPendingQuantity(1);
    };

    /** Cierra la ventana y deja el cursor en el buscador para el siguiente producto. */
    const closeChooser = () => {
        setChoosing(null);
        requestAnimationFrame(() => search.current?.focus());
    };

    /** Elegido en el buscador: escaneado o con un solo empaque va directo al carrito; si no, se pregunta cuánto. */
    const pickProduct = (product: PosProduct) => {
        const direct = product.options.find((option) => option.scanned) ?? (product.options.length === 1 ? product.options[0] : null);
        if (direct) {
            addLine(direct, pendingQuantity, product.options);
        } else {
            openChooser(product.options, pendingQuantity);
        }
    };

    const setPayment = (field: keyof typeof data.payment, value: string) => setData('payment', { ...data.payment, [field]: value });

    /** Pago mixto: lo que se escribe en un medio de pago calcula el otro para llegar justo al total. */
    const setMixedAmount = (field: 'qr' | 'cash', value: string) =>
        setData('payment', { ...data.payment, [field]: value, [field === 'qr' ? 'cash' : 'qr']: mixedRemainder(total, value) });

    // Pago mixto: si cambia el total (carrito o descuento), el QR se queda y el efectivo se ajusta
    useEffect(() => {
        if (mode === 'mixto' && data.payment.qr !== '') {
            setData('payment', { ...data.payment, cash: mixedRemainder(total, data.payment.qr) });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [total]);

    // Al entrar o recargar se recupera el carrito, pero el cobro vuelve a Efectivo: no se arrastra el medio de pago anterior
    useEffect(() => setData('payment', NEW_PAYMENT), [setData]);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('admin.sales.store'), {
            preserveState: true,
            onSuccess: () => {
                reset();
                setShowCustomer(false);
                search.current?.focus();
            },
        });
    };

    const blocker =
        data.cart.length === 0
            ? 'Agrega al menos un producto'
            : discountOverLimit
              ? `El descuento pasa del ${discountLimit}% del subtotal: ajústalo`
              : qrAmount > total
                ? 'El monto por QR no puede pasar del total'
                : mode === 'mixto' && (qrAmount <= 0 || cashGiven <= 0)
                  ? 'En pago mixto, el QR y el efectivo deben ser mayores a 0'
                  : change < 0
                    ? `Falta cobrar ${money(Math.abs(change))}`
                    : null;

    return (
        <AdminLayout breadcrumbs={[{ title: 'Punto de venta', href: route('admin.pos') }]}>
            <Head title="Punto de venta" />
            <SaleDoneBanner />
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
                        onPick={pickProduct}
                        isDisabled={(product) => product.stock_units === 0}
                        itemKey={(product) => product.product_id}
                        placeholder="Buscar producto, genérico, síntoma (ej: dolor de cabeza) o escanear código…"
                        listClassName="max-h-[36rem] divide-y"
                        renderItem={(product) => (
                            <ProductResult product={product} quantity={pendingQuantity} inCart={unitsInCart(product.product_id)} />
                        )}
                    />

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
                                            {cartGroups.length} {cartGroups.length === 1 ? 'producto' : 'productos'}
                                        </span>
                                    </p>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-muted-foreground hover:text-destructive h-7"
                                        onClick={() => setData((d) => ({ ...d, cart: [], discount: null }))}
                                    >
                                        <Trash2 className="size-3.5" /> Vaciar
                                    </Button>
                                </div>
                                {/* Encabezado de columnas (mismas medidas que CartProduct) */}
                                <div className="text-muted-foreground hidden grid-cols-[1fr_8.5rem_9.5rem_2rem] gap-4 border-b px-4 py-1.5 text-[11px] font-medium tracking-wide uppercase sm:grid">
                                    <span>Producto</span>
                                    <span className="text-center">Cantidad</span>
                                    <span className="text-right">Importe</span>
                                    <span />
                                </div>
                                <ul className="divide-y">
                                    {cartGroups.map((lines, position) => {
                                        const first = lines[0];
                                        const options = first.siblings && first.siblings.length > 1 ? first.siblings : null;
                                        const index = data.cart.indexOf(first);
                                        return (
                                            <CartProduct
                                                key={first.product_id}
                                                position={position + 1}
                                                lines={lines}
                                                options={options}
                                                flashKey={flash && lines.some((l) => l.presentation_id === flash.id) ? flash.key : null}
                                                total={round(lines.reduce((sum, l) => sum + lineTotal(l), 0))}
                                                full={round(lines.reduce((sum, l) => sum + l.sale_price * l.quantity, 0))}
                                                overStock={unitsInCart(first.product_id) > first.stock_units}
                                                onUnits={(units) => options && setUnits(first.product_id, units, options)}
                                                onQuantity={(quantity) => setQuantity(index, quantity)}
                                                onEdit={() => options && openChooser(options)}
                                                onRemove={() =>
                                                    setData(
                                                        'cart',
                                                        data.cart.filter((l) => l.product_id !== first.product_id),
                                                    )
                                                }
                                            />
                                        );
                                    })}
                                </ul>
                            </>
                        )}
                    </Panel>
                    <InputError message={err.items} />
                </div>

                {discounting && (
                    <GeneralDiscountDialog
                        base={subtotal}
                        current={data.discount}
                        limit={discountLimit}
                        onApply={(discount) => {
                            setData('discount', discount);
                            setDiscounting(false);
                        }}
                        onReset={() => {
                            setData('discount', null);
                            setDiscounting(false);
                        }}
                        onClose={() => setDiscounting(false)}
                    />
                )}

                {choosing && (
                    <QuantityDialog
                        {...choosing}
                        onConfirm={(packing) => {
                            setProductLines(choosing.options[0].product_id, packing, choosing.options);
                            closeChooser();
                        }}
                        onClose={closeChooser}
                    />
                )}

                {/* DERECHA: cliente, receta, pago y cobro (queda fija al bajar) */}
                <div className="flex flex-col gap-4 xl:sticky xl:top-4">
                    <Panel>
                        <PanelHeader
                            title="Cliente"
                            description={customerOpen ? 'Opcional: sin datos sale a nombre de S/N.' : 'Opcional · la venta sale a nombre de S/N.'}
                            aside={
                                !data.customer_id && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setShowCustomer(!customerOpen);
                                            if (customerOpen) {
                                                setData((d) => ({ ...d, customer_name: '', customer_document: '' }));
                                            }
                                        }}
                                    >
                                        {customerOpen ? (
                                            <>
                                                <X /> Quitar
                                            </>
                                        ) : (
                                            <>
                                                <UserPlus /> Agregar
                                            </>
                                        )}
                                    </Button>
                                )
                            }
                        />
                        {customerOpen && (
                            <div className="animate-in fade-in slide-in-from-top-1 grid gap-3 p-4 duration-200">
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
                                            autoFocus={showCustomer}
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
                        )}
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

                    {/* COBRO: Subtotal → Descuento → Total, cómo paga y el cambio */}
                    <Panel>
                        <PanelHeader title="Cobro" />
                        <div className="grid gap-4 p-4">
                            <dl className="grid gap-1.5 text-sm">
                                <div className="flex items-baseline justify-between">
                                    <dt className="text-muted-foreground">Subtotal</dt>
                                    <dd className="num font-medium">{money(subtotal)}</dd>
                                </div>
                                <div className="flex items-baseline justify-between gap-2">
                                    <dt className="text-muted-foreground min-w-0">
                                        {can('ventas.descontar') && subtotal > 0 ? (
                                            // Con permiso: se pone o se cambia tocando la línea
                                            <button
                                                type="button"
                                                onClick={() => setDiscounting(true)}
                                                className="text-primary hover:text-primary/80 inline-flex items-center gap-1 font-medium"
                                                title="Descuento a la venta"
                                            >
                                                Descuento <Pencil className="size-3" />
                                            </button>
                                        ) : (
                                            'Descuento'
                                        )}
                                        {data.discount && <span className="text-muted-foreground ml-1.5 text-xs">· {data.discount.reason}</span>}
                                    </dt>
                                    <dd
                                        className={cn(
                                            'num font-medium',
                                            generalDiscount > 0
                                                ? discountOverLimit
                                                    ? 'text-red-600'
                                                    : 'text-emerald-600 dark:text-emerald-400'
                                                : 'text-muted-foreground',
                                        )}
                                    >
                                        {money(generalDiscount)}
                                    </dd>
                                </div>
                                <div className="mt-1 flex items-baseline justify-between border-t pt-2.5">
                                    <dt className="font-semibold">Total</dt>
                                    <dd key={total} className="num font-display animate-in fade-in text-2xl font-bold tracking-tight duration-200">
                                        {money(total)}
                                    </dd>
                                </div>
                                {savings > 0 && (
                                    <p className="text-right text-xs text-emerald-600 dark:text-emerald-400">
                                        Ahorro por promociones: {money(savings)} (ya en el subtotal)
                                    </p>
                                )}
                            </dl>

                            <PayModePicker
                                value={mode}
                                labels={paymentMethods}
                                onChange={(value) => setData('payment', { ...data.payment, mode: value, cash: '', qr: '' })}
                            />

                            {/* QR: solo QR o la parte por QR del mixto */}
                            {mode === 'qr' && (
                                <div className="flex items-baseline justify-between text-sm">
                                    <span className="text-muted-foreground">Monto por QR</span>
                                    <span className="num font-semibold">{money(total)}</span>
                                </div>
                            )}
                            {mode === 'mixto' && (
                                <MoneyField
                                    label="Por QR"
                                    value={data.payment.qr}
                                    onChange={(value) => setMixedAmount('qr', value)}
                                    inputRef={payAmount}
                                    invalid={qrAmount > total}
                                />
                            )}
                            {mode !== 'efectivo' && (
                                <Input
                                    ref={mode === 'qr' ? payAmount : undefined}
                                    value={data.payment.reference}
                                    onChange={(e) => setPayment('reference', e.target.value)}
                                    placeholder="N° de operación del QR (opcional)"
                                    className="h-9 text-sm"
                                />
                            )}

                            {/* Efectivo: solo efectivo o lo que falta después del QR */}
                            {mode !== 'qr' && (
                                <div className="grid gap-2">
                                    {mode === 'mixto' && (
                                        <div className="flex items-baseline justify-between text-sm">
                                            <span className="text-muted-foreground">Falta en efectivo</span>
                                            <span className="num font-semibold">{money(cashDue)}</span>
                                        </div>
                                    )}
                                    <MoneyField
                                        label="Efectivo recibido"
                                        value={data.payment.cash}
                                        onChange={(value) => (mode === 'mixto' ? setMixedAmount('cash', value) : setPayment('cash', value))}
                                        inputRef={mode === 'efectivo' ? payAmount : undefined}
                                    />
                                    {cashDue > 0 && (
                                        <div className="flex flex-wrap justify-end gap-1">
                                            <QuickAmount label="Exacto" onClick={() => setPayment('cash', String(cashDue))} highlight />
                                            {cashSuggestions(cashDue).map((amount) => (
                                                <QuickAmount key={amount} label={money(amount)} onClick={() => setPayment('cash', String(amount))} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Cambio (o lo que falta) */}
                            {total > 0 && paid > 0 && (
                                <div
                                    className={cn(
                                        'animate-in fade-in flex items-baseline justify-between rounded-lg px-3 py-2 duration-200',
                                        change >= 0
                                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                            : 'bg-red-500/10 text-red-600 dark:text-red-400',
                                    )}
                                >
                                    <span className="text-sm font-medium">{change >= 0 ? 'Cambio' : 'Falta'}</span>
                                    <span className="num text-lg font-bold">{money(Math.abs(change))}</span>
                                </div>
                            )}
                            <InputError message={err.payments} />
                        </div>
                    </Panel>

                    <div className="grid gap-1.5">
                        <Button type="submit" className="btn-brand h-10 w-full" disabled={processing || blocker !== null}>
                            {processing ? <LoaderCircle className="animate-spin" /> : <ShoppingCart />}
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
 * Resultado del buscador, como en compras: foto; comercial; genérico, concentración y laboratorio con íconos;
 * forma, categoría, código y receta; precio de cada empaque. A la derecha stock y "Elegir cantidad". Tocarlo (o Enter) pregunta cuánto.
 */
function ProductResult({
    product,
    quantity,
    inCart,
}: {
    product: PosProduct;
    /** Cantidad escrita antes del nombre ("3*alergin"): se muestra para que se vea cuánto se va a pedir */
    quantity: number;
    /** Unidades base de este producto que ya están en el carrito */
    inCart: number;
}) {
    const options = [...product.options].sort((a, b) => a.factor - b.factor);
    const facts = [
        { icon: FlaskConical, label: 'Genérico', value: product.generic_name },
        { icon: Beaker, label: 'Concentración', value: product.concentration },
        { icon: Factory, label: 'Laboratorio', value: product.laboratory },
    ].filter((fact) => fact.value);
    const barcode = product.options.find((option) => option.scanned)?.barcode ?? product.barcode;
    const extra = [product.pharmaceutical_form, product.category, barcode && `Cód. ${barcode}`].filter(Boolean).join(' · ');
    const outOfStock = product.stock_units === 0;

    return (
        <div className="flex items-center gap-3">
            <StoredImage
                path={product.image}
                alt={product.product_name}
                fallback={<Pill className="size-4" />}
                className={cn('size-16 shrink-0', outOfStock && 'opacity-50 grayscale')}
            />
            {/* Sin stock: se ve apagado (y SearchPicker no deja elegirlo) */}
            <div className={cn('grid min-w-0 flex-1 gap-1 text-left', outOfStock && 'opacity-50 grayscale')}>
                <p className="flex min-w-0 items-center gap-1.5 text-base leading-tight">
                    <Tag className="text-primary size-4 shrink-0" />
                    <span className="text-foreground/70 text-sm">Comercial:</span>
                    <span className="truncate font-bold">{product.commercial_name ?? product.product_name}</span>
                </p>
                {facts.length > 0 && (
                    <p className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
                        {facts.map(({ icon: Icon, label, value }) => (
                            <span key={label} className="inline-flex max-w-full min-w-0 items-start gap-1.5">
                                <Icon className="text-primary mt-0.5 size-4 shrink-0" />
                                <span className="text-foreground/70 shrink-0">{label}:</span>
                                <span className="text-foreground min-w-0 font-semibold break-words">{value}</span>
                            </span>
                        ))}
                    </p>
                )}
                {(extra || product.is_controlled || product.requires_prescription) && (
                    <p className="text-foreground/75 truncate text-sm">
                        {extra}
                        {product.is_controlled && <span className="ml-2 font-semibold text-red-600">Controlado</span>}
                        {!product.is_controlled && product.requires_prescription && (
                            <span className="ml-2 font-semibold text-amber-600">Con receta</span>
                        )}
                    </p>
                )}
                {/* Precio de cada empaque: Tableta Bs 1,50 · Blíster Bs 12,00 · Caja Bs 35,00 */}
                <p className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm">
                    <span className="inline-flex items-center gap-1.5">
                        <Banknote className="text-primary size-4 shrink-0" />
                        <span className="text-foreground/70">Precio:</span>
                    </span>
                    {options.map((option) => (
                        <span key={option.presentation_id} className="inline-flex items-center gap-1">
                            <span className="text-foreground/70 capitalize">{option.package}</span>
                            <span className="num font-semibold">{money(priceOf(option, 1))}</span>
                            {option.promo_discount && <PromoBadge percent={option.promo_discount} />}
                        </span>
                    ))}
                </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                {outOfStock ? (
                    <>
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-900">
                            <span className="size-1.5 rounded-full bg-red-500" /> Sin stock
                        </span>
                        <span className="text-muted-foreground text-[11px]">No se puede vender</span>
                    </>
                ) : (
                    <>
                        <span className="num text-muted-foreground text-xs">
                            Stock: <span className="text-foreground font-semibold">{product.stock_units.toLocaleString('es')}</span>{' '}
                            {baseUnitWord(options, product.stock_units)}
                        </span>
                        {inCart > 0 && (
                            <span className="text-primary num text-[11px] font-semibold">
                                En carrito: {inCart.toLocaleString('es')} {baseUnitWord(options, inCart)}
                            </span>
                        )}
                        <span className="text-primary flex items-center gap-1.5 text-xs font-medium">
                            {quantity > 1 && <span className="num font-bold">×{quantity}</span>}
                            {options.length > 1 ? 'Elegir cantidad' : 'Agregar'}
                            <kbd className="bg-muted text-muted-foreground rounded border px-1 text-[9px] font-medium">Enter</kbd>
                        </span>
                    </>
                )}
            </div>
        </div>
    );
}

/**
 * "¿CUÁNTAS LLEVA?": arriba se escriben las tabletas y se arma solo con los empaques más grandes
 * (11 → 1 blíster + 1 tableta); abajo cada empaque con − / + por si el cliente pide otra cosa (ej: 11 tabletas sueltas).
 * Enter agrega. Abajo, en palabras: "1 blíster + 1 tableta" y el total.
 */
function QuantityDialog({
    options,
    initial,
    editing,
    onConfirm,
    onClose,
}: Choosing & { onConfirm: (packing: Packing) => void; onClose: () => void }) {
    const product = options[0];
    // De la más grande a la más chica: igual que se arma (caja, blíster, tableta)
    const sorted = [...options].sort((a, b) => b.factor - a.factor);
    const unitsOf = (quantities: Record<number, number>) => sorted.reduce((sum, o) => sum + (quantities[o.presentation_id] ?? 0) * o.factor, 0);
    const [quantities, setQuantities] = useState<Record<number, number>>(initial);
    // Vacío cuando no hay nada elegido todavía (no se propone una cantidad)
    const [typed, setTyped] = useState(unitsOf(initial) > 0 ? String(unitsOf(initial)) : '');
    // Tabletas que no se pudieron armar porque ese empaque no se vende suelto
    const [left, setLeft] = useState(0);
    const unitsInput = useRef<HTMLInputElement>(null);

    const units = unitsOf(quantities);
    const packing: Packing = sorted
        .filter((o) => (quantities[o.presentation_id] ?? 0) > 0)
        .map((o) => ({ option: o, quantity: quantities[o.presentation_id] }));
    const total = round(packing.reduce((sum, { option, quantity }) => sum + priceOf(option, quantity), 0));
    const saved = round(packing.reduce((sum, { option, quantity }) => sum + option.sale_price * quantity, 0) - total);
    const hasPromotion = sorted.some((option) => option.promo_discount);
    const overStock = units > product.stock_units;
    const canConfirm = (units > 0 || editing) && !overStock;

    const typeUnits = (value: string) => {
        setTyped(value);
        const result = packUnits(Math.max(0, Math.floor(Number(value) || 0)), sorted);
        setQuantities(Object.fromEntries(result.packing.map(({ option, quantity }) => [option.presentation_id, quantity])));
        setLeft(result.left);
    };

    /** Cambia un empaque y se vuelve a armar solo: al llegar a 10 tabletas pasan a 1 blíster. */
    const setQuantity = (option: PosLookup, quantity: number) => {
        const next = { ...quantities, [option.presentation_id]: Math.max(0, quantity) };
        const packed = repack(
            sorted.filter((o) => (next[o.presentation_id] ?? 0) > 0).map((o) => ({ option: o, quantity: next[o.presentation_id] })),
            sorted,
        );
        setQuantities(Object.fromEntries(packed.map(({ option: o, quantity: q }) => [o.presentation_id, q])));
        setTyped(String(unitsOf(next)));
        setLeft(0);
    };

    const confirm = () => {
        if (canConfirm) {
            onConfirm(packing);
        }
    };

    const unitWord = (count: number) => baseUnitWord(sorted, count);

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className="bg-card w-[calc(100%-2rem)] max-w-xl gap-0 overflow-hidden rounded-xl p-0 sm:rounded-xl"
                onOpenAutoFocus={(e) => {
                    e.preventDefault();
                    unitsInput.current?.focus();
                    unitsInput.current?.select();
                }}
                onCloseAutoFocus={(e) => e.preventDefault()}
                onKeyDown={(e) => {
                    // Enter agrega (sin enviar el formulario de la venta)
                    if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
                        e.preventDefault();
                        confirm();
                    }
                }}
            >
                <div className="bg-primary h-1" />
                <div className="flex items-center gap-3 px-5 pt-5 pr-12 pb-4">
                    <StoredImage
                        path={product.image}
                        alt={product.product_name}
                        fallback={<Pill className="size-5" />}
                        className="size-12 shrink-0 rounded-lg"
                    />
                    <div className="min-w-0">
                        <DialogTitle className="truncate text-[15px] leading-snug font-bold">
                            {product.commercial_name ?? product.product_name}{' '}
                            {product.concentration && <span className="text-muted-foreground font-normal">{product.concentration}</span>}
                        </DialogTitle>
                        <DialogDescription className="num mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="bg-muted rounded-md px-1.5 py-0.5 font-medium">
                                Stock: {product.stock_units.toLocaleString('es')} {unitWord(product.stock_units)}
                            </span>
                            {hasPromotion && (
                                <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">
                                    Promoción por vencimiento
                                </span>
                            )}
                        </DialogDescription>
                    </div>
                </div>

                <div className="grid gap-4 px-5 pb-5">
                    {/* Cuántas tabletas: se arma solo */}
                    <label className="bg-muted/40 flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
                        <span className="min-w-0">
                            <span className="block text-sm font-semibold">¿Cuántas {unitWord(2)} pide?</span>
                            <span className="text-muted-foreground block text-xs">Se arma solo con el empaque más grande.</span>
                        </span>
                        <Input
                            ref={unitsInput}
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            onKeyDown={blockFractionKeys}
                            value={typed}
                            onChange={(e) => typeUnits(e.target.value)}
                            placeholder="0"
                            className="num bg-card h-12 w-32 shrink-0 [appearance:textfield] text-center text-2xl font-bold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                    </label>

                    {/* Cómo sale: cada empaque con − / + */}
                    <div className="grid gap-1.5">
                        <div className="flex items-baseline justify-between gap-3">
                            <span className="text-sm font-semibold">Se entrega así</span>
                            <span className="text-muted-foreground text-xs">Cámbialo con − / +</span>
                        </div>
                        <ul className="divide-y overflow-hidden rounded-lg border">
                            {sorted.map((option) => {
                                const quantity = quantities[option.presentation_id] ?? 0;
                                return (
                                    <li
                                        key={option.presentation_id}
                                        className={cn('flex items-center gap-3 px-3 py-2.5 transition-colors', quantity > 0 && 'bg-primary/5')}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="flex items-center gap-1.5 text-sm font-medium">
                                                <span className="capitalize">{option.package}</span>
                                                {option.promo_discount && <PromoBadge percent={option.promo_discount} />}
                                            </p>
                                            <p className="text-muted-foreground num text-xs">
                                                {option.factor > 1
                                                    ? `trae ${option.factor.toLocaleString('es')} ${unitWord(option.factor)}`
                                                    : 'suelta'}
                                                {' · '}
                                                {option.promo_discount ? (
                                                    <>
                                                        <span className="line-through">{money(option.sale_price)}</span>{' '}
                                                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                                            {money(priceOf(option, 1))}
                                                        </span>
                                                    </>
                                                ) : (
                                                    money(option.sale_price)
                                                )}{' '}
                                                c/u
                                            </p>
                                        </div>
                                        <div className="stepper" data-active={quantity > 0 ? 'true' : undefined}>
                                            <button
                                                type="button"
                                                onClick={() => setQuantity(option, quantity - 1)}
                                                disabled={quantity <= 0}
                                                aria-label="Menos"
                                            >
                                                <Minus className="size-3.5" />
                                            </button>
                                            <input
                                                type="number"
                                                min={0}
                                                className="text-sm"
                                                value={quantity}
                                                step={1}
                                                inputMode="numeric"
                                                onKeyDown={blockFractionKeys}
                                                onChange={(e) => setQuantity(option, Math.floor(Number(e.target.value) || 0))}
                                                onFocus={(e) => e.target.select()}
                                                aria-label={`Cantidad de ${option.package}`}
                                            />
                                            <button type="button" onClick={() => setQuantity(option, quantity + 1)} aria-label="Más">
                                                <Plus className="size-3.5" />
                                            </button>
                                        </div>
                                        {/* Lo que suma esta fila */}
                                        <span
                                            className={cn(
                                                'num w-20 shrink-0 text-right text-sm',
                                                quantity > 0 ? 'font-semibold' : 'text-muted-foreground/50',
                                            )}
                                        >
                                            {quantity > 0 ? money(priceOf(option, quantity)) : '—'}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    {left > 0 && (
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                            Sobran {left.toLocaleString('es')} {unitWord(left)}: no se venden sueltas.
                        </p>
                    )}
                    {overStock && (
                        <p className="text-xs font-medium text-red-600">
                            Solo hay {product.stock_units.toLocaleString('es')} {unitWord(product.stock_units)}.
                        </p>
                    )}
                </div>

                <div className="bg-muted/40 grid gap-3 border-t px-5 py-3.5">
                    <div className="flex items-end justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-muted-foreground text-xs">{editing && units === 0 ? 'Sin cantidad' : 'Entregar al cliente'}</p>
                            <p className="text-sm font-semibold">
                                {packing.length > 0
                                    ? packing.map(({ option, quantity }) => countOf(quantity, option.package)).join(' + ')
                                    : editing
                                      ? 'Se quita del carrito'
                                      : '—'}
                            </p>
                        </div>
                        <div className="shrink-0 text-right">
                            <p className="text-muted-foreground text-xs">Total</p>
                            <p className="num text-2xl leading-none font-bold">{money(total)}</p>
                            {saved > 0 && (
                                <p className="num mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">Ahorra {money(saved)}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant={editing && units === 0 ? 'destructive' : 'default'}
                            disabled={!canConfirm}
                            onClick={confirm}
                            className="disabled:opacity-100 disabled:[--btn-bg:var(--muted)] disabled:[--btn-fg:var(--muted-foreground)]"
                        >
                            {editing && units === 0 ? 'Quitar del carrito' : editing ? 'Actualizar carrito' : 'Agregar al carrito'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Un producto del carrito en UNA fila, como un ticket: número, foto, nombre (genérico · laboratorio) y, debajo, lo que se
 * entrega como etiquetas ("1 blíster × Bs 15,00"); a la derecha − cantidad +, el importe y quitar (aparece al pasar el mouse).
 * Si se vende en varios empaques, el − / + cuenta tabletas (se vuelve a armar solo) y "Cambiar" abre la ventana.
 * Con un solo empaque, cuenta frascos. Con promoción se muestra "Ahorra Bs 0,60" en vez de tachar el precio.
 */
function CartProduct({
    position,
    lines,
    options,
    flashKey,
    total,
    full,
    overStock,
    onUnits,
    onQuantity,
    onEdit,
    onRemove,
}: {
    /** Número de la fila (1, 2, 3…) */
    position: number;
    lines: CartLine[];
    /** Presentaciones a la venta del producto si son varias (null = un solo empaque) */
    options: PosLookup[] | null;
    /** Cambia cada vez que se agrega o cambia el producto: dispara el destello */
    flashKey: number | null;
    total: number;
    /** Total sin promoción (se tacha si hay descuento) */
    full: number;
    overStock: boolean;
    onUnits: (units: number) => void;
    onQuantity: (quantity: number) => void;
    onEdit: () => void;
    onRemove: () => void;
}) {
    const line = lines[0];
    const units = lines.reduce((sum, l) => sum + l.quantity * l.factor, 0);
    // Varios empaques: el paso es el empaque más chico que se vende (normalmente 1 tableta)
    const step = options ? Math.min(...options.filter((o) => o.sale_price > 0).map((o) => o.factor)) : 1;
    const value = options ? units : line.quantity;
    const sorted = [...lines].sort((a, b) => b.factor - a.factor);
    const unitOptions = options ?? [line];
    // Descuentos por vencimiento de las líneas (normalmente uno solo: el del lote que sale primero)
    const promoPercents = [...new Set(lines.filter((l) => l.promo_discount).map((l) => Number(l.promo_discount)))];
    const caption = options
        ? baseUnitWord(options, units)
        : line.factor > 1
          ? `= ${units.toLocaleString('es')} ${line.breakdown?.at(-1)?.unit ?? ''}`
          : null;

    return (
        <li
            className={cn(
                'group animate-in fade-in slide-in-from-top-1 hover:bg-muted/30 relative grid grid-cols-[1fr_auto_auto] items-start gap-x-4 gap-y-2 px-4 py-3.5 transition-colors duration-200 sm:grid-cols-[1fr_8.5rem_9.5rem_2rem]',
                overStock && 'bg-red-50/60 hover:bg-red-50/60 dark:bg-red-950/20',
            )}
        >
            {flashKey !== null && (
                <span
                    key={flashKey}
                    aria-hidden
                    className="bg-primary/15 animate-out fade-out fill-mode-forwards pointer-events-none absolute inset-0 duration-1000 motion-reduce:hidden"
                />
            )}

            {/* Producto: número, foto, nombre, genérico · laboratorio y lo que se entrega (en celular ocupa todo el ancho) */}
            <div className="col-span-3 flex min-w-0 gap-3 sm:col-span-1">
                <span className="bg-primary/10 text-primary num mt-3 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
                    {position}
                </span>
                {/* Al pasar el puntero: la foto en grande y la ficha completa del producto */}
                <ProductPreview line={line} options={unitOptions}>
                    <StoredImage
                        path={line.image}
                        alt={line.product_name}
                        fallback={<Pill className="size-4" />}
                        className="hover:ring-primary/40 size-12 shrink-0 rounded-xl transition-shadow hover:ring-2"
                    />
                </ProductPreview>
                <div className="grid min-w-0 gap-1">
                    <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 leading-tight">
                        <span className="truncate text-[15px] font-semibold">{line.commercial_name ?? line.product_name}</span>
                        {line.concentration && <span className="text-muted-foreground text-sm">{line.concentration}</span>}
                        {line.is_controlled ? (
                            <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">Controlado</span>
                        ) : (
                            line.requires_prescription && (
                                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                                    Con receta
                                </span>
                            )
                        )}
                        {/* Promoción por vencimiento del lote que sale primero */}
                        {promoPercents.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                                <BadgePercent className="size-3" />
                                {promoPercents.length === 1 ? `−${promoPercents[0]}% por vencimiento` : 'Promoción por vencimiento'}
                            </span>
                        )}
                    </p>
                    {(line.generic_name || line.laboratory) && (
                        <p className="text-muted-foreground truncate text-xs">{[line.generic_name, line.laboratory].filter(Boolean).join(' · ')}</p>
                    )}

                    {/* Lo que se entrega, como etiquetas: "1 blíster × Bs 15,00" · "1 unidad × Bs 1,50" */}
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {sorted.map((l) => (
                            <span
                                key={l.presentation_id}
                                className="bg-background inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs shadow-xs"
                                title={l.factor > 1 ? `${countOf(l.quantity * l.factor, baseUnitWord(unitOptions, 1))} en total` : undefined}
                            >
                                <Package className="text-primary size-3.5" />
                                <span className="num font-semibold">{countOf(l.quantity, l.package ?? l.presentation_name)}</span>
                                <span className="num text-muted-foreground">×</span>
                                {l.promo_discount ? (
                                    <>
                                        <span className="num text-muted-foreground/70 line-through">{money(l.sale_price)}</span>
                                        <span className="num font-semibold text-emerald-700 dark:text-emerald-400">{money(priceOf(l, 1))}</span>
                                    </>
                                ) : (
                                    <span className="num text-muted-foreground">{money(priceOf(l, 1))}</span>
                                )}
                                {l.promo_discount && (
                                    <span className="num rounded bg-emerald-500/10 px-1 font-semibold text-emerald-700 dark:text-emerald-400">
                                        −{Number(l.promo_discount)}%
                                    </span>
                                )}
                            </span>
                        ))}
                        {options && (
                            <button
                                type="button"
                                onClick={onEdit}
                                className="text-primary hover:bg-primary/10 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors"
                            >
                                <PackageOpen className="size-3.5" /> Cambiar
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* − cantidad + en una sola pieza (clase .stepper de app.css) */}
            {/* Un poco más abajo, a la altura del medio del importe */}
            <div className="flex flex-col items-center gap-0.5 sm:justify-self-center sm:pt-3">
                <div className="stepper stepper-sm" data-active="true">
                    <button
                        type="button"
                        onClick={() => (options ? onUnits(units - step) : onQuantity(line.quantity - 1))}
                        disabled={value <= (options ? step : 1)}
                        aria-label="Menos"
                    >
                        <Minus className="size-3.5" />
                    </button>
                    {options ? (
                        // Varios empaques: se escribe en la ventana (aquí escribir de a una cifra armaría empaques a medias)
                        <input
                            type="number"
                            className="cursor-pointer text-sm"
                            value={units}
                            readOnly
                            onClick={onEdit}
                            aria-label={`Cantidad en ${caption}`}
                        />
                    ) : (
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
                    )}
                    <button type="button" onClick={() => (options ? onUnits(units + step) : onQuantity(line.quantity + 1))} aria-label="Más">
                        <Plus className="size-3.5" />
                    </button>
                </div>
                {caption && <span className="text-muted-foreground num text-[10px]">{caption}</span>}
            </div>

            {/* Importe, siempre en el mismo orden: Subtotal (precio normal) − Descuento = Total que se cobra */}
            <dl className="grid gap-0.5 pt-1 text-xs">
                <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="num">{money(full)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">Descuento</dt>
                    <dd className={cn('num', full > total ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                        {money(full - total)}
                    </dd>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-2 border-t pt-1">
                    <dt className="font-semibold">Total</dt>
                    <dd className="num text-base font-bold">{money(total)}</dd>
                </div>
            </dl>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="hover:text-destructive mt-0.5 size-8 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                onClick={onRemove}
                aria-label="Quitar"
            >
                <Trash2 className="size-4" />
            </Button>

            {overStock && (
                <p className="col-span-full flex items-center gap-1.5 text-xs font-semibold text-red-600 sm:pl-[5.25rem]">
                    <TriangleAlert className="size-3.5 shrink-0" />
                    Stock insuficiente: solo hay {line.stock_units.toLocaleString('es')} {baseUnitWord(unitOptions, line.stock_units)}
                </p>
            )}
        </li>
    );
}

/**
 * FICHA AL PASAR EL PUNTERO por la foto de un producto del carrito: la foto en grande y todo lo del producto
 * (genérico, forma, categoría, laboratorio, código, para qué sirve, presentaciones con su precio, stock y vencimiento).
 * Sale fuera del carrito (Tooltip de Radix), así no se corta.
 */
function ProductPreview({ line, options, children }: { line: CartLine; options: PosLookup[]; children: React.ReactNode }) {
    const imageUrl = useStorageUrl();
    const url = imageUrl(line.image);
    const presentations = [...options].sort((a, b) => a.factor - b.factor);
    const details: { icon: LucideIcon; label: string; value: string | null }[] = [
        { icon: FlaskConical, label: 'Genérico', value: line.generic_name },
        { icon: Pill, label: 'Forma', value: line.pharmaceutical_form },
        { icon: Tag, label: 'Categoría', value: line.category },
        { icon: Factory, label: 'Laboratorio', value: line.laboratory },
        { icon: ScanBarcode, label: 'Código', value: line.barcode },
    ];

    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="cursor-zoom-in">{children}</span>
                </TooltipTrigger>
                <TooltipContent
                    side="right"
                    align="start"
                    sideOffset={10}
                    collisionPadding={16}
                    className="bg-popover text-popover-foreground w-80 rounded-xl border p-0 text-left text-sm font-normal shadow-xl"
                >
                    {/* Foto grande */}
                    <div className="bg-muted/60 flex h-44 items-center justify-center border-b">
                        {url ? (
                            <img src={url} alt={line.product_name} className="size-full object-contain p-2" />
                        ) : (
                            <Pill className="text-muted-foreground/40 size-14" />
                        )}
                    </div>

                    <div className="grid gap-3 p-4">
                        {/* Nombre y avisos */}
                        <div className="grid gap-1.5">
                            <p className="leading-tight">
                                <span className="text-base font-bold">{line.commercial_name ?? line.product_name}</span>{' '}
                                {line.concentration && <span className="text-muted-foreground">{line.concentration}</span>}
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {line.is_controlled ? (
                                    <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                                        Controlado · pide receta
                                    </span>
                                ) : line.requires_prescription ? (
                                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                                        Con receta
                                    </span>
                                ) : (
                                    <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-semibold">
                                        Venta libre
                                    </span>
                                )}
                                {line.promo_discount && (
                                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                                        −{Number(line.promo_discount)}% por vencimiento
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Datos del producto (solo los que tiene) */}
                        <dl className="grid gap-1.5 text-xs">
                            {details
                                .filter((d) => d.value)
                                .map((d) => (
                                    <div key={d.label} className="flex items-center gap-2">
                                        <d.icon className="text-primary size-3.5 shrink-0" />
                                        <dt className="text-muted-foreground w-20 shrink-0">{d.label}</dt>
                                        <dd className="num min-w-0 truncate font-medium">{d.value}</dd>
                                    </div>
                                ))}
                        </dl>

                        {/* Para qué sirve */}
                        {line.indications.length > 0 && (
                            <div className="grid gap-1.5">
                                <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase">
                                    <Stethoscope className="size-3.5" /> Sirve para
                                </p>
                                <div className="flex flex-wrap gap-1">
                                    {line.indications.map((indication) => (
                                        <span
                                            key={indication}
                                            className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[11px] font-medium"
                                        >
                                            {indication}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Presentaciones a la venta con su precio */}
                        <div className="grid gap-1.5">
                            <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase">
                                <Package className="size-3.5" /> Precios
                            </p>
                            <ul className="divide-y rounded-lg border text-xs">
                                {presentations.map((p) => (
                                    <li key={p.presentation_id} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                                        <span className="min-w-0 truncate">{p.presentation_name}</span>
                                        <span className="num shrink-0 font-semibold">
                                            {p.promo_discount ? (
                                                <>
                                                    <span className="text-muted-foreground/70 mr-1 font-normal line-through">
                                                        {money(p.sale_price)}
                                                    </span>
                                                    <span className="text-emerald-700 dark:text-emerald-400">{money(priceOf(p, 1))}</span>
                                                </>
                                            ) : (
                                                money(p.sale_price)
                                            )}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Stock y vencimiento en esta sucursal */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-muted/50 rounded-lg px-2.5 py-2">
                                <p className="text-muted-foreground">Stock aquí</p>
                                <p className="num font-semibold">
                                    {line.stock_units.toLocaleString('es')} {baseUnitWord(presentations, line.stock_units)}
                                </p>
                            </div>
                            <div className="bg-muted/50 rounded-lg px-2.5 py-2">
                                <p className="text-muted-foreground">Vence primero</p>
                                <p className="num font-semibold">{line.next_expiry ? formatDay(line.next_expiry) : 'Sin vencimiento'}</p>
                            </div>
                        </div>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
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
        </div>
    );
}

/** Motivos frecuentes del descuento general (quedan guardados en la venta). "Otro" deja escribir uno. */
const DISCOUNT_REASONS = ['Redondeo', 'Cliente frecuente', 'Tercera edad', 'Cortesía'];

/**
 * DESCUENTO GENERAL de la venta (el "descuento adicional" de una factura; permiso ventas.descontar). Se escribe el monto
 * en Bs; los botones de % son un atajo opcional. Tope: limit % del subtotal. El servidor lo vuelve a revisar al cobrar
 * (permiso, tope, motivo y que la venta no quede por debajo del costo).
 */
function GeneralDiscountDialog({
    base,
    current,
    limit,
    onApply,
    onReset,
    onClose,
}: {
    /** Subtotal de la venta: los productos ya con su promoción */
    base: number;
    current: GeneralDiscount | null;
    limit: number;
    onApply: (discount: GeneralDiscount) => void;
    onReset: () => void;
    onClose: () => void;
}) {
    const maxAmount = round((base * limit) / 100);
    const [value, setValue] = useState(current ? String(current.amount) : '');
    const [reason, setReason] = useState(current?.reason ?? '');
    const [otherReason, setOtherReason] = useState(!!current && !DISCOUNT_REASONS.includes(current.reason));

    const amount = round(Math.max(0, Number(value) || 0));
    const percent = base > 0 ? (amount / base) * 100 : 0;
    const overLimit = amount > maxAmount;
    const canApply = amount > 0 && !overLimit && reason.trim() !== '';
    const apply = () => {
        if (canApply) onApply({ amount, reason: reason.trim() });
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className="max-w-md gap-0 p-0"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
                        e.preventDefault();
                        apply();
                    }
                }}
            >
                <div className="flex items-center gap-3 border-b px-5 py-4 pr-12">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                        <BadgePercent className="size-5" />
                    </span>
                    <div className="min-w-0">
                        <DialogTitle className="text-base">Descuento a la venta</DialogTitle>
                        <DialogDescription className="text-xs">
                            Sobre el subtotal de {money(base)} (los productos ya con su promoción).
                        </DialogDescription>
                    </div>
                </div>

                <div className="grid gap-4 px-5 py-4">
                    {/* Cuánto: el monto en Bs; los % son un atajo */}
                    <div className="grid gap-2">
                        <label htmlFor="general-discount" className="text-sm font-medium">
                            Descuento en Bs
                        </label>
                        <div className="relative">
                            <Input
                                id="general-discount"
                                type="number"
                                min={0}
                                step="0.01"
                                inputMode="decimal"
                                autoFocus
                                placeholder="0.00"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                className={cn(
                                    'num h-11 pr-20 text-right text-lg font-semibold',
                                    overLimit && 'border-red-400 focus-visible:ring-red-300',
                                )}
                            />
                            <span className="num text-muted-foreground pointer-events-none absolute top-1/2 right-9 -translate-y-1/2 text-xs">
                                = {round(percent)}%
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-muted-foreground text-xs">o elige:</span>
                            {[5, 10, 15, 20]
                                .filter((p) => p <= limit)
                                .map((p) => {
                                    const quickAmount = round((base * p) / 100);
                                    return (
                                        <QuickAmount
                                            key={p}
                                            label={`${p}%`}
                                            onClick={() => setValue(String(quickAmount))}
                                            highlight={amount > 0 && amount === quickAmount}
                                        />
                                    );
                                })}
                        </div>
                        {overLimit && (
                            <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                                <TriangleAlert className="size-3.5" /> El descuento máximo es {money(maxAmount)} ({limit}%).
                            </p>
                        )}
                    </div>

                    {/* Por qué */}
                    <div className="grid gap-2">
                        <span className="text-sm font-medium">Motivo</span>
                        <div className="flex flex-wrap gap-1.5">
                            {[...DISCOUNT_REASONS, 'Otro…'].map((r) => {
                                const isOther = r === 'Otro…';
                                const selected = isOther ? otherReason : !otherReason && reason === r;
                                return (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => {
                                            setOtherReason(isOther);
                                            setReason(isOther ? '' : r);
                                        }}
                                        className={cn(
                                            'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                                            selected
                                                ? 'border-primary bg-primary text-primary-foreground'
                                                : 'text-muted-foreground hover:border-primary/40 hover:bg-primary/5',
                                        )}
                                    >
                                        {r}
                                    </button>
                                );
                            })}
                        </div>
                        {otherReason && (
                            <Input
                                value={reason}
                                maxLength={100}
                                autoFocus
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Escribe el motivo"
                            />
                        )}
                    </div>

                    {/* Así queda */}
                    <dl className="bg-muted/40 grid gap-1 rounded-xl border p-3 text-sm">
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Subtotal</dt>
                            <dd className="num">{money(base)}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Descuento {amount > 0 && `(${round(percent)}%)`}</dt>
                            <dd className={cn('num', amount > 0 ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                                {money(Math.min(amount, base))}
                            </dd>
                        </div>
                        <div className="mt-0.5 flex justify-between border-t pt-1.5">
                            <dt className="font-semibold">Total</dt>
                            <dd className="num text-base font-bold">{money(Math.max(0, base - amount))}</dd>
                        </div>
                    </dl>
                </div>

                <div className="bg-muted/40 flex items-center justify-between gap-2 border-t px-5 py-3">
                    {current ? (
                        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={onReset}>
                            <Undo2 /> Quitar descuento
                        </Button>
                    ) : (
                        <span />
                    )}
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="button" className="btn-brand" disabled={!canApply} onClick={apply}>
                            Aplicar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/** Las 3 formas de cobrar como pestañas: Efectivo, QR y Mixto (QR + efectivo). Los nombres salen de config/farmacia.php. */
function PayModePicker({ value, labels, onChange }: { value: PayMode; labels: Record<string, string>; onChange: (value: PayMode) => void }) {
    const modes: { key: PayMode; label: string; icons: LucideIcon[] }[] = [
        { key: 'efectivo', label: labels.efectivo ?? 'Efectivo', icons: [Banknote] },
        { key: 'qr', label: labels.qr ?? 'QR', icons: [QrCode] },
        { key: 'mixto', label: 'Mixto', icons: [QrCode, Banknote] },
    ];

    return (
        <div role="radiogroup" aria-label="Forma de pago" className="bg-muted/60 grid grid-cols-3 gap-1 rounded-lg p-1">
            {modes.map(({ key, label, icons }) => {
                const selected = key === value;
                return (
                    <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onChange(key)}
                        className={cn(
                            'flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-all duration-150',
                            selected ? 'bg-card text-primary shadow-sm ring-1 ring-black/5' : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <span className="flex -space-x-0.5">
                            {icons.map((Icon, i) => (
                                <Icon key={i} className="size-3.5" />
                            ))}
                        </span>
                        {label}
                    </button>
                );
            })}
        </div>
    );
}

/** Monto en Bs en una fila: nombre a la izquierda, campo a la derecha. */
function MoneyField({
    label,
    value,
    onChange,
    inputRef,
    invalid,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    inputRef?: React.Ref<HTMLInputElement>;
    invalid?: boolean;
}) {
    return (
        <label className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground text-sm">{label}</span>
            <span className="relative w-36">
                <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs">Bs</span>
                <Input
                    ref={inputRef}
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0.00"
                    aria-label={label}
                    aria-invalid={invalid}
                    className={cn('num h-9 pl-8 text-right font-semibold', invalid && 'border-red-400 focus-visible:ring-red-300')}
                />
            </span>
        </label>
    );
}

function QuickAmount({ label, onClick, highlight }: { label: string; onClick: () => void; highlight?: boolean }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'num rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 transition-colors active:scale-95',
                highlight ? 'bg-primary/10 text-primary ring-primary/20 hover:bg-primary/15' : 'bg-card ring-border hover:bg-muted',
            )}
        >
            {label}
        </button>
    );
}
