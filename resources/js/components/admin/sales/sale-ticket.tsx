/*
 * TICKET de una venta, el que sale por la impresora: rollo de 80 mm, todo en negro porque la térmica no imprime grises.
 * Arriba va el nombre del sistema (APP_NAME de .env, prop compartida "name") y debajo los datos de la sucursal.
 * Queda fuera de la pantalla y no se ve: basta con window.print() (ver app.css → .print-only).
 * TicketPrint mide el ticket y le da al papel ese largo exacto, así sale en una sola hoja sin espacio sobrante.
 */
import { describeLevels, levelsOf } from '@/components/admin/common/package-chain';
import { countOf } from '@/components/admin/products/presentation-levels';
import { formatDate, formatDay, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { type Sale, type SaleItem } from '@/types/admin/pharmacy';
import { usePage } from '@inertiajs/react';
import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const TICKET_WIDTH_MM = 80;
const MM_PER_PX = 25.4 / 96;

interface TicketProps {
    sale: Sale;
    paymentMethods: Record<string, string>;
}

function SaleTicket({ sale, paymentMethods }: TicketProps) {
    const { name: appName } = usePage<SharedData>().props;

    return (
        <div className="px-[4mm] py-[5mm] font-sans text-[12px] leading-snug">
            <div className="text-center">
                <p className="text-[19px] leading-tight font-bold tracking-tight">{appName}</p>
                <p className="mt-0.5 font-semibold">{sale.branch.name}</p>
                {sale.branch.address && <p className="text-[11px]">{sale.branch.address}</p>}
                {sale.branch.phone && <p className="text-[11px]">Tel. {sale.branch.phone}</p>}
            </div>
            {sale.status === 'anulada' && <p className="mt-2.5 border-2 py-1 text-center text-[13px] font-bold tracking-widest">VENTA ANULADA</p>}
            <TicketDivider />
            <div className="grid gap-0.5">
                <TicketRow label="Comprobante" className="font-bold">
                    {sale.number}
                </TicketRow>
                <TicketRow label="Fecha">{formatDate(sale.created_at, { dateStyle: 'short', timeStyle: 'short' })}</TicketRow>
                <TicketRow label="Cliente">{sale.customer_name}</TicketRow>
                {sale.customer_document && <TicketRow label="CI/NIT">{sale.customer_document}</TicketRow>}
                {sale.prescription_number && (
                    <TicketRow label="Receta">
                        {sale.prescription_number} · {sale.prescription_doctor}
                    </TicketRow>
                )}
                <TicketRow label="Atendió">{sale.registered_by?.name}</TicketRow>
            </div>
            <TicketDivider />
            <TicketRow label="Detalle" className="border-b pb-1 text-[10px] font-bold tracking-wider uppercase">
                Importe
            </TicketRow>
            <ul className="mt-2 grid gap-2.5">
                {sale.items?.map((item) => (
                    <li key={item.id}>
                        <p className="font-bold">
                            {item.product.name} {item.product.concentration}
                        </p>
                        <TicketRow
                            label={
                                <>
                                    {item.presentation?.package
                                        ? countOf(item.units / item.factor, item.presentation.package)
                                        : `${item.units / item.factor} ${item.presentation?.name ?? ''}`}{' '}
                                    × {money(item.list_price, false)}
                                </>
                            }
                        >
                            {money(item.subtotal, false)}
                        </TicketRow>
                        {Number(item.discount_amount) > 0 && (
                            <TicketRow label={`Dcto. vencimiento ${Number(item.discount_percent)}%`}>−{money(item.discount_amount, false)}</TicketRow>
                        )}
                        <TicketLevels item={item} />
                        <p className="text-[10px]">
                            Lote {item.batch.batch_number} · {item.batch.expires_at ? `vence ${formatDay(item.batch.expires_at)}` : 'sin vencimiento'}
                        </p>
                    </li>
                ))}
            </ul>
            <TicketDivider />
            <div className="grid gap-0.5">
                <TicketRow label="Subtotal">{money(sale.subtotal, false)}</TicketRow>
                <TicketRow label={`Descuento${sale.discount_reason ? ` (${sale.discount_reason})` : ''}`}>
                    {Number(sale.discount) > 0 ? `−${money(sale.discount, false)}` : money(0, false)}
                </TicketRow>
            </div>
            <TicketRow label="TOTAL" className="my-2 items-baseline border-y-2 py-1.5 text-[16px] font-bold">
                {money(sale.total)}
            </TicketRow>
            <div className="grid gap-0.5">
                {sale.payments.map((p) => (
                    <TicketRow key={p.id} label={`${paymentMethods[p.method] ?? p.method}${p.reference ? ` (${p.reference})` : ''}`}>
                        {money(p.method === 'efectivo' ? sale.cash_received : p.amount, false)}
                    </TicketRow>
                ))}
                {Number(sale.change) > 0 && <TicketRow label="Cambio">{money(sale.change, false)}</TicketRow>}
            </div>
            <p className="mt-4 text-center font-semibold">¡Gracias por su compra!</p>
        </div>
    );
}

function TicketDivider() {
    return <div className="my-2.5 border-t border-dashed" />;
}

/** Fila del ticket: dato a la izquierda y valor o importe a la derecha. */
function TicketRow({ label, className, children }: { label: React.ReactNode; className?: string; children: React.ReactNode }) {
    return (
        <div className={cn('flex justify-between gap-3', className)}>
            <span>{label}</span>
            <span className="text-right tabular-nums">{children}</span>
        </div>
    );
}

/** El ticket listo para window.print(): no se ve en pantalla. */
export function TicketPrint({ sale, paymentMethods }: TicketProps) {
    const ticket = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const heightInMm = Math.ceil((ticket.current?.offsetHeight ?? 0) * MM_PER_PX) + 2;
        const paper = document.createElement('style');
        paper.textContent = `@page { size: ${TICKET_WIDTH_MM}mm ${heightInMm}mm; margin: 0; }`;
        document.head.append(paper);

        return () => paper.remove();
    }, [sale]);

    return createPortal(
        <div ref={ticket} className="print-only" style={{ width: `${TICKET_WIDTH_MM}mm` }}>
            <SaleTicket sale={sale} paymentMethods={paymentMethods} />
        </div>,
        document.body,
    );
}

/** Línea del ticket con lo que trae el empaque vendido: "Cada caja contiene 3 blísteres y cada blíster contiene 10 tabletas (30 tabletas en total)". */
function TicketLevels({ item }: { item: SaleItem }) {
    const text = describeLevels(levelsOf(item.product.presentations ?? [], item.presentation?.id));
    return text ? <p className="text-[10px]">{text}</p> : null;
}
