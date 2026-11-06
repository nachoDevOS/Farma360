/*
 * PÁGINA: Detalle de venta  (ruta /admin/sales/{id})
 * Datos: SaleController@show. Anular: SaleController@cancel (pide motivo). Imprimir: solo el ticket (ver TicketPrint).
 *
 * Se lee como el punto de venta que la registró. Arriba, una portada con el número, el estado y el total; debajo quién vendió,
 * en qué caja y en qué sucursal. A la izquierda los productos, como en el carrito, con lote y vencimiento.
 * A la derecha el cobro (Subtotal → Descuento → Total, con qué pagó, recibido y cambio) y el cliente.
 */
import { ReasonDialog } from '@/components/admin/common/confirm-dialog';
import { DocStatus, ExpiryBadge, PromoBadge } from '@/components/admin/common/doc-status';
import { StoredImage } from '@/components/admin/common/image-upload';
import { Panel, PanelHeader } from '@/components/admin/dashboard/panel';
import { countOf } from '@/components/admin/products/presentation-levels';
import { printTicket, TicketPrint } from '@/components/admin/sales/sale-ticket';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import AdminLayout from '@/layouts/admin/admin-layout';
import { formatDate, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Sale, type SaleItem, type SalePayment } from '@/types/admin/pharmacy';
import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    BadgePercent,
    Ban,
    Banknote,
    CreditCard,
    FileText,
    Landmark,
    type LucideIcon,
    Mail,
    Package,
    Phone,
    Pill,
    Printer,
    QrCode,
    Receipt,
    ShoppingBag,
    ShoppingCart,
    Store,
    User,
    UserRound,
    Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';

const dateTime: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };

/** Ícono y color de cada medio de pago de config/farmacia.php. */
const paymentStyles: Record<string, { icon: LucideIcon; tile: string; bar: string }> = {
    efectivo: { icon: Banknote, tile: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' },
    qr: { icon: QrCode, tile: 'bg-primary/10 text-primary', bar: 'bg-primary' },
    tarjeta: { icon: CreditCard, tile: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', bar: 'bg-violet-500' },
    transferencia: { icon: Landmark, tile: 'bg-sky-500/10 text-sky-600 dark:text-sky-400', bar: 'bg-sky-500' },
};

interface Props {
    sale: Sale;
    paymentMethods: Record<string, string>;
}

export default function SaleShow({ sale, paymentMethods }: Props) {
    const can = useCan();
    const [cancelling, setCancelling] = useState(false);
    const canCancel = can('ventas.anular') && sale.status === 'completada' && sale.cash_session?.status === 'abierta';
    const items = sale.items ?? [];
    const promotions = items.reduce((sum, item) => sum + Number(item.discount_amount), 0);

    // Botón "Imprimir" de la franja del POS: se quita ?imprimir de la dirección para que recargar o volver no imprima otra vez
    useEffect(() => {
        const url = new URL(window.location.href);
        if (!url.searchParams.has('imprimir')) {
            return;
        }

        url.searchParams.delete('imprimir');
        window.history.replaceState(window.history.state, '', url);
        printTicket();
    }, []);

    return (
        <AdminLayout
            breadcrumbs={[
                { title: 'Ventas', href: route('admin.sales.index') },
                { title: sale.number, href: '#' },
            ]}
        >
            <Head title={`Venta ${sale.number}`} />
            <div className="flex w-full flex-1 flex-col gap-5 p-4 md:p-8">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button asChild variant="outline" size="sm">
                        <Link href={route('admin.sales.index')}>
                            <ArrowLeft /> Volver a ventas
                        </Link>
                    </Button>
                    <div className="flex flex-wrap gap-2">
                        {canCancel && (
                            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setCancelling(true)}>
                                <Ban /> Anular
                            </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={printTicket}>
                            <Printer /> Imprimir
                        </Button>
                        {can('ventas.crear') && (
                            <Button asChild size="sm" className="btn-brand">
                                <Link href={route('admin.pos')}>
                                    <ShoppingCart /> Nueva venta
                                </Link>
                            </Button>
                        )}
                    </div>
                </div>

                <SaleCover sale={sale} saved={promotions + Number(sale.discount)} />

                {sale.status === 'anulada' && (
                    <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm">
                        <Ban className="mt-0.5 size-4 shrink-0 text-red-600" />
                        <p>
                            Anulada el {formatDate(sale.cancelled_at!, dateTime)} por {sale.cancelled_by?.name ?? '—'}. Motivo:{' '}
                            <strong>{sale.cancel_reason}</strong>. El stock volvió a sus lotes.
                        </p>
                    </div>
                )}

                <div className="grid items-start gap-5 xl:grid-cols-[1fr_24rem]">
                    <SoldProducts items={items} />
                    <div className="grid gap-5 xl:sticky xl:top-4">
                        <PaymentSummary sale={sale} promotions={promotions} paymentMethods={paymentMethods} />
                        <CustomerCard sale={sale} />
                    </div>
                </div>
            </div>

            <TicketPrint sale={sale} paymentMethods={paymentMethods} />
            <ReasonDialog
                open={cancelling}
                onClose={() => setCancelling(false)}
                title={`Anular venta ${sale.number}`}
                url={route('admin.sales.cancel', sale.id)}
            />
        </AdminLayout>
    );
}

/** Portada: número, estado y total sobre el color del tema; debajo quién vendió, la caja y la sucursal. */
function SaleCover({ sale, saved }: { sale: Sale; saved: number }) {
    const cancelled = sale.status === 'anulada';
    const branchContact = [sale.branch.address, sale.branch.phone && `Tel. ${sale.branch.phone}`].filter(Boolean).join(' · ');

    return (
        <section className="surface animate-in fade-in slide-in-from-bottom-1 overflow-hidden rounded-2xl duration-300">
            <div aria-hidden className={cn('h-1', cancelled ? 'bg-red-500' : 'bg-emerald-500')} />
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                        <Receipt className="size-4" />
                    </span>
                    <h1 className="font-display num text-lg font-bold">{sale.number}</h1>
                    <DocStatus status={sale.status} className="bg-muted rounded-full px-2.5 py-0.5 text-xs font-medium" />
                    <span className="text-muted-foreground text-[13px] first-letter:uppercase">
                        {formatDate(sale.created_at, { dateStyle: 'full', timeStyle: 'short' })}
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {saved > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            <BadgePercent className="size-3.5" /> El cliente ahorró {money(saved)}
                        </span>
                    )}
                    <p className="flex items-baseline gap-2">
                        <span className="text-muted-foreground text-[13px]">{cancelled ? 'Total anulado' : 'Total cobrado'}</span>
                        <span className={cn('font-display num text-xl font-bold', cancelled ? 'text-muted-foreground line-through' : 'text-primary')}>
                            {money(sale.total)}
                        </span>
                    </p>
                </div>
            </div>

            <dl className="grid divide-y border-t md:grid-cols-3 md:divide-x md:divide-y-0">
                <CoverFact icon={User} label="Vendió" value={sale.registered_by?.name ?? '—'} hint={sale.registerRole} />
                <CoverFact icon={Wallet} label="Caja" value={sale.cash_session?.cash_register?.name ?? '—'} />
                <CoverFact icon={Store} label="Sucursal" value={sale.branch.name} hint={branchContact} />
            </dl>
        </section>
    );
}

function CoverFact({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint?: string | null }) {
    return (
        <div className="flex min-w-0 items-center gap-3 px-5 py-3">
            <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Icon className="size-4" />
            </span>
            <div className="min-w-0">
                <dt className="text-muted-foreground text-xs">{label}</dt>
                <dd className="truncate text-[15px] font-semibold">{value}</dd>
                {hint && <dd className="text-muted-foreground truncate text-xs">{hint}</dd>}
            </div>
        </div>
    );
}

/** Lo vendido como en el carrito: una fila por producto, con cada empaque y el lote del que salió. */
function SoldProducts({ items }: { items: SaleItem[] }) {
    const productIds = [...new Set(items.map((item) => item.product.id))];

    return (
        <Panel className="min-w-0 overflow-hidden">
            <PanelHeader
                icon={ShoppingBag}
                title="Productos vendidos"
                aside={
                    <span className="bg-primary/10 text-primary num rounded-full px-2 py-0.5 text-xs font-semibold">
                        {productIds.length} {productIds.length === 1 ? 'producto' : 'productos'}
                    </span>
                }
            />
            <ul className="divide-y">
                {productIds.map((productId, index) => (
                    <SoldProduct key={productId} position={index + 1} lines={items.filter((item) => item.product.id === productId)} />
                ))}
            </ul>
        </Panel>
    );
}

function SoldProduct({ position, lines }: { position: number; lines: SaleItem[] }) {
    const { product } = lines[0];
    const total = lines.reduce((sum, line) => sum + Number(line.total), 0);
    const saved = lines.reduce((sum, line) => sum + Number(line.discount_amount), 0);

    return (
        <li className="grid gap-3 px-5 py-4">
            <div className="flex min-w-0 items-start gap-3">
                <span className="bg-primary/10 text-primary num mt-3 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
                    {position}
                </span>
                <StoredImage path={product.image} alt={product.name} fallback={<Pill className="size-4" />} className="size-12 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-1.5 leading-tight">
                        <span className="text-[15px] font-semibold">{product.name}</span>
                        {product.concentration && <span className="text-muted-foreground text-sm">{product.concentration}</span>}
                    </p>
                    {(product.generic_name || product.laboratory) && (
                        <p className="text-muted-foreground mt-1 truncate text-xs">
                            {[product.generic_name, product.laboratory?.name].filter(Boolean).join(' · ')}
                        </p>
                    )}
                </div>
                <div className="shrink-0 text-right">
                    <p className="num text-base font-bold">{money(total)}</p>
                    {saved > 0 && <p className="num text-xs font-medium text-emerald-600 dark:text-emerald-400">Ahorró {money(saved)}</p>}
                </div>
            </div>

            <ul className="grid gap-1.5 sm:pl-[5.25rem]">
                {lines.map((line) => (
                    <SoldLine key={line.id} line={line} />
                ))}
            </ul>
        </li>
    );
}

/** Un empaque vendido: "1 caja × Bs 9,00 → Bs 8,10 −10%" y a la derecha el lote con su vencimiento. */
function SoldLine({ line }: { line: SaleItem }) {
    const quantity = line.units / line.factor;
    const hasPromotion = Number(line.discount_amount) > 0;

    return (
        <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span className="bg-background inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs shadow-xs">
                <Package className="text-primary size-3.5" />
                <span className="num font-semibold">{line.presentation?.package ? countOf(quantity, line.presentation.package) : quantity}</span>
                <span className="num text-muted-foreground">×</span>
                {hasPromotion ? (
                    <>
                        <span className="num text-muted-foreground/70 line-through">{money(line.list_price)}</span>
                        <span className="num font-semibold text-emerald-600 dark:text-emerald-400">{money(Number(line.total) / quantity)}</span>
                        <PromoBadge percent={line.discount_percent} />
                    </>
                ) : (
                    <span className="num font-medium">{money(line.list_price)}</span>
                )}
            </span>
            <span className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground num">Lote {line.batch.batch_number}</span>
                <ExpiryBadge date={line.batch.expires_at} emptyLabel="Sin vencimiento" />
            </span>
        </li>
    );
}

/** Como en el punto de venta: Subtotal → Descuento → Total; después con qué pagó y cuánto se le devolvió. */
function PaymentSummary({ sale, promotions, paymentMethods }: { sale: Sale; promotions: number; paymentMethods: Record<string, string> }) {
    const paid = sale.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

    return (
        <Panel>
            <PanelHeader icon={CreditCard} title="Cobro" />
            <div className="grid gap-4 p-5">
                <dl className="grid gap-2 text-sm">
                    <SummaryLine label="Subtotal" value={money(sale.subtotal)} />
                    <div>
                        <SummaryLine label="Descuento" value={money(sale.discount)} highlight={Number(sale.discount) > 0} />
                        {sale.discount_reason && <p className="text-muted-foreground text-xs">{sale.discount_reason}</p>}
                    </div>
                    <div className="mt-1 flex items-baseline justify-between border-t pt-2.5">
                        <dt className="font-semibold">Total</dt>
                        <dd className="num font-display text-2xl font-bold tracking-tight">{money(sale.total)}</dd>
                    </div>
                    {promotions > 0 && (
                        <p className="text-right text-xs text-emerald-600 dark:text-emerald-400">
                            Ahorro por promociones: {money(promotions)} (ya en el subtotal)
                        </p>
                    )}
                </dl>

                <div className="grid gap-2 border-t pt-4">
                    <p className="text-muted-foreground text-xs font-medium">Con qué pagó</p>
                    {sale.payments.length > 1 && (
                        <div className="bg-muted flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                            {sale.payments.map((payment) => (
                                <span
                                    key={payment.id}
                                    className={paymentStyleOf(payment).bar}
                                    style={{ width: `${(Number(payment.amount) / paid) * 100}%` }}
                                />
                            ))}
                        </div>
                    )}
                    {sale.payments.map((payment) => (
                        <PaymentLine key={payment.id} payment={payment} label={paymentMethods[payment.method] ?? payment.method} />
                    ))}
                </div>

                {Number(sale.cash_received) > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-muted/60 rounded-lg px-3 py-2">
                            <p className="text-muted-foreground text-xs">Efectivo recibido</p>
                            <p className="num font-semibold">{money(sale.cash_received)}</p>
                        </div>
                        <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-emerald-700 dark:text-emerald-400">
                            <p className="text-xs">Cambio</p>
                            <p className="num font-semibold">{money(sale.change)}</p>
                        </div>
                    </div>
                )}
            </div>
        </Panel>
    );
}

function paymentStyleOf(payment: SalePayment) {
    return paymentStyles[payment.method] ?? paymentStyles.efectivo;
}

function PaymentLine({ payment, label }: { payment: SalePayment; label: string }) {
    const { icon: Icon, tile } = paymentStyleOf(payment);

    return (
        <div className="flex items-center gap-3">
            <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', tile)}>
                <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{label}</p>
                {payment.reference && <p className="text-muted-foreground truncate text-xs">Operación {payment.reference}</p>}
            </div>
            <span className="num font-semibold">{money(payment.amount)}</span>
        </div>
    );
}

function SummaryLine({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className={cn('num font-medium', highlight && 'text-emerald-600 dark:text-emerald-400')}>{value}</dd>
        </div>
    );
}

/** El cliente, y la receta si la hubo. Sin cliente, una sola línea en vez de una lista de campos vacíos. */
function CustomerCard({ sale }: { sale: Sale }) {
    const { customer } = sale;
    const name = sale.customer_name || 'S/N';
    const isAnonymous = !customer && !sale.customer_document && name === 'S/N';

    return (
        <Panel>
            <PanelHeader icon={UserRound} title="Cliente" />
            <div className="grid gap-3 p-5">
                {isAnonymous ? (
                    <p className="text-muted-foreground text-sm">Venta sin cliente: salió a nombre de S/N.</p>
                ) : (
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full font-semibold">
                            {name.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                            <p className="truncate font-semibold">{name}</p>
                            {sale.customer_document && (
                                <p className="text-muted-foreground num text-xs">
                                    {customer?.document_type ?? 'CI/NIT'} {sale.customer_document}
                                </p>
                            )}
                        </div>
                    </div>
                )}
                {customer?.phone && <ContactLine icon={Phone} text={customer.phone} />}
                {customer?.email && <ContactLine icon={Mail} text={customer.email} />}
                {sale.prescription_number && (
                    <div className="flex items-start gap-2.5 rounded-lg bg-amber-500/10 px-3 py-2 text-amber-800 dark:text-amber-300">
                        <FileText className="mt-0.5 size-4 shrink-0" />
                        <div className="min-w-0 text-sm">
                            <p className="font-medium">Receta {sale.prescription_number}</p>
                            {sale.prescription_doctor && <p className="text-xs">{sale.prescription_doctor}</p>}
                        </div>
                    </div>
                )}
            </div>
        </Panel>
    );
}

function ContactLine({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
    return (
        <p className="text-muted-foreground flex min-w-0 items-center gap-2 text-sm">
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{text}</span>
        </p>
    );
}
