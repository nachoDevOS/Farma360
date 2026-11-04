/*
 * TICKET de una venta, el que sale por la impresora.
 * Queda afuera de la página y no se ve en pantalla: basta con window.print() (ver app.css → .print-only).
 */
import { describeLevels, levelsOf } from '@/components/admin/common/package-chain';
import { countOf } from '@/components/admin/products/presentation-levels';
import { formatDate, formatDay, money } from '@/lib/format';
import { type Sale, type SaleItem } from '@/types/admin/pharmacy';
import { createPortal } from 'react-dom';

interface TicketProps {
    sale: Sale;
    paymentMethods: Record<string, string>;
}

function SaleTicket({ sale, paymentMethods }: TicketProps) {
    return (
        <div className="surface mx-auto w-full max-w-md rounded-xl p-6 font-mono text-sm print:border-0 print:shadow-none">
            <div className="text-center">
                <p className="font-sans text-base font-semibold">{sale.branch.name}</p>
                {sale.branch.address && <p className="text-muted-foreground text-xs">{sale.branch.address}</p>}
                {sale.branch.phone && <p className="text-muted-foreground text-xs">Tel. {sale.branch.phone}</p>}
                <p className="mt-3 font-semibold">COMPROBANTE {sale.number}</p>
                {sale.status === 'anulada' && <p className="font-semibold text-red-600 dark:text-red-400">VENTA ANULADA</p>}
                <p className="text-muted-foreground text-xs">{formatDate(sale.created_at, { dateStyle: 'short', timeStyle: 'short' })}</p>
            </div>
            <div className="my-3 border-t border-dashed" />
            <p>Cliente: {sale.customer_name}</p>
            {sale.customer_document && <p>CI/NIT: {sale.customer_document}</p>}
            {sale.prescription_number && (
                <p>
                    Receta: {sale.prescription_number} · {sale.prescription_doctor}
                </p>
            )}
            <div className="my-3 border-t border-dashed" />
            <ul className="grid gap-2">
                {sale.items?.map((item) => (
                    <li key={item.id}>
                        <p className="font-sans font-medium">
                            {item.product.name} {item.product.concentration}
                        </p>
                        <div className="text-muted-foreground flex justify-between text-xs">
                            <span>
                                {item.presentation?.package
                                    ? countOf(item.units / item.factor, item.presentation.package)
                                    : `${item.units / item.factor} ${item.presentation?.name ?? ''}`}{' '}
                                × {money(item.list_price, false)}
                            </span>
                            {/* Como en una factura: cantidad × precio − descuento = subtotal de la línea */}
                            <span className="text-foreground">{money(item.total, false)}</span>
                        </div>
                        {Number(item.discount_amount) > 0 && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                Descuento por vencimiento {Number(item.discount_percent)}%: {money(item.discount_amount, false)}
                            </p>
                        )}
                        <TicketLevels item={item} />
                        <p className="text-muted-foreground text-[11px]">
                            Lote {item.batch.batch_number} · {item.batch.expires_at ? `vence ${formatDay(item.batch.expires_at)}` : 'sin vencimiento'}
                        </p>
                    </li>
                ))}
            </ul>
            <div className="my-3 border-t border-dashed" />
            <div className="flex justify-between text-xs">
                <span>Subtotal</span>
                <span>{money(sale.subtotal, false)}</span>
            </div>
            {Number(sale.discount) > 0 && (
                <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                    <span>Descuento{sale.discount_reason && ` (${sale.discount_reason})`}</span>
                    <span>{money(sale.discount, false)}</span>
                </div>
            )}
            <div className="flex justify-between text-base font-semibold">
                <span>TOTAL</span>
                <span>{money(sale.total)}</span>
            </div>
            {sale.payments.map((p) => (
                <div key={p.id} className="text-muted-foreground flex justify-between text-xs">
                    <span>
                        {paymentMethods[p.method] ?? p.method}
                        {p.reference && ` (${p.reference})`}
                    </span>
                    <span>{money(p.method === 'efectivo' ? sale.cash_received : p.amount, false)}</span>
                </div>
            ))}
            {Number(sale.change) > 0 && (
                <div className="flex justify-between text-xs">
                    <span>Cambio</span>
                    <span>{money(sale.change, false)}</span>
                </div>
            )}
            <div className="my-3 border-t border-dashed" />
            <p className="text-muted-foreground text-center text-xs">Atendió: {sale.registered_by?.name}</p>
            <p className="text-muted-foreground text-center text-xs">¡Gracias por su compra!</p>
        </div>
    );
}

/** El ticket listo para window.print(): no se ve en pantalla. */
export function TicketPrint({ sale, paymentMethods }: TicketProps) {
    return createPortal(
        <div className="print-only">
            <SaleTicket sale={sale} paymentMethods={paymentMethods} />
        </div>,
        document.body,
    );
}

/** Línea del ticket con lo que trae el empaque vendido: "Cada caja contiene 3 blísteres y cada blíster contiene 10 tabletas (30 tabletas en total)". */
function TicketLevels({ item }: { item: SaleItem }) {
    const text = describeLevels(levelsOf(item.product.presentations ?? [], item.presentation?.id));
    return text ? <p className="text-muted-foreground text-[11px]">{text}</p> : null;
}
