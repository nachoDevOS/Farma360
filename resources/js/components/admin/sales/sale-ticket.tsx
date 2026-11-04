/*
 * TICKET de una venta, el que sale por la impresora: rollo de 80 mm, en negro y con letra de impresora térmica, como un
 * comprobante de banco. Arriba va el nombre del sistema (APP_NAME de .env, prop compartida "name") y abajo un QR con los
 * datos del comprobante, que se leen sin internet.
 * Queda fuera de la pantalla y no se ve (ver app.css → .print-only). Para imprimir: printTicket().
 * Justo antes de imprimir, TicketPrint mide el ticket y le da al papel ese largo exacto: sale en una hoja, sin espacio sobrante.
 */
import { describeLevels, levelsOf } from '@/components/admin/common/package-chain';
import { countOf } from '@/components/admin/products/presentation-levels';
import { formatDate, formatDay, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { type Sale, type SaleItem } from '@/types/admin/pharmacy';
import { usePage } from '@inertiajs/react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const TICKET_WIDTH_MM = 80;
const MM_PER_PX = 25.4 / 96;

interface TicketProps {
    sale: Sale;
    paymentMethods: Record<string, string>;
}

/** Abre la ventana de impresión con la letra del ticket ya descargada: la primera vez todavía no llegó. */
export function printTicket(): void {
    const print = () => window.print();
    document.fonts.load('12px "Share Tech Mono"').then(print, print);
}

function SaleTicket({ sale, paymentMethods }: TicketProps) {
    const { name: appName } = usePage<SharedData>().props;
    const date = formatDate(sale.created_at, { dateStyle: 'short', timeStyle: 'short' });
    const qrText = [appName, `Comprobante ${sale.number}`, `Fecha ${date}`, `Total ${money(sale.total)}`, sale.status === 'anulada' && 'ANULADA']
        .filter(Boolean)
        .join('\n');

    return (
        <div className="font-ticket px-[4mm] py-[5mm] text-[12.5px] leading-[1.35] uppercase">
            <div className="text-center">
                <p className="text-[18px] leading-tight normal-case">{appName}</p>
                <p className="mt-0.5">{sale.branch.name}</p>
                {sale.branch.address && <p>{sale.branch.address}</p>}
                {sale.branch.phone && <p>Tel. {sale.branch.phone}</p>}
            </div>
            <TicketDivider />
            <div className="text-center">
                <p>Comprobante de venta</p>
                <p className="text-[15px] tracking-wider">{sale.number}</p>
                {sale.status === 'anulada' && <p className="mt-1.5 border py-0.5 tracking-widest">Venta anulada</p>}
            </div>
            <TicketDivider />
            <TicketRow label="Fecha">{date}</TicketRow>
            <TicketRow label="Cliente">{sale.customer_name}</TicketRow>
            {sale.customer_document && <TicketRow label="CI/NIT">{sale.customer_document}</TicketRow>}
            {sale.prescription_number && (
                <TicketRow label="Receta">
                    {sale.prescription_number} · {sale.prescription_doctor}
                </TicketRow>
            )}
            <TicketRow label="Atendió">{sale.registered_by?.name}</TicketRow>
            <TicketDivider />
            <TicketRow label="Detalle" className="mb-1.5">
                Importe
            </TicketRow>
            <ul className="grid gap-2">
                {sale.items?.map((item) => (
                    <li key={item.id}>
                        <p>
                            {item.product.name} {item.product.concentration}
                        </p>
                        <TicketRow
                            label={
                                <>
                                    {item.presentation?.package
                                        ? countOf(item.units / item.factor, item.presentation.package)
                                        : `${item.units / item.factor} ${item.presentation?.name ?? ''}`}{' '}
                                    x {money(item.list_price, false)}
                                </>
                            }
                        >
                            {money(item.subtotal, false)}
                        </TicketRow>
                        {Number(item.discount_amount) > 0 && (
                            <TicketRow label={`Dcto. vencimiento ${Number(item.discount_percent)}%`}>-{money(item.discount_amount, false)}</TicketRow>
                        )}
                        <TicketLevels item={item} />
                        <p className="text-[11px]">
                            Lote {item.batch.batch_number} · {item.batch.expires_at ? `vence ${formatDay(item.batch.expires_at)}` : 'sin vencimiento'}
                        </p>
                    </li>
                ))}
            </ul>
            <TicketDivider />
            <TicketRow label="Subtotal">{money(sale.subtotal, false)}</TicketRow>
            <TicketRow label={`Descuento${sale.discount_reason ? ` (${sale.discount_reason})` : ''}`}>
                {Number(sale.discount) > 0 ? `-${money(sale.discount, false)}` : money(0, false)}
            </TicketRow>
            <TicketRow label="Total" className="mt-1 text-[15px]">
                <span className="normal-case">{money(sale.total)}</span>
            </TicketRow>
            <TicketDivider />
            {sale.payments.map((p) => (
                <TicketRow key={p.id} label={`${paymentMethods[p.method] ?? p.method}${p.reference ? ` (${p.reference})` : ''}`}>
                    {money(p.method === 'efectivo' ? sale.cash_received : p.amount, false)}
                </TicketRow>
            ))}
            {Number(sale.change) > 0 && <TicketRow label="Cambio">{money(sale.change, false)}</TicketRow>}
            <TicketDivider />
            <QRCodeSVG value={qrText} size={96} level="M" marginSize={0} fgColor="#000" bgColor="#fff" className="mx-auto mt-3" />
            <p className="mt-3 text-center">Gracias por su compra</p>
        </div>
    );
}

function TicketDivider() {
    return <div className="my-2 border-t border-dashed" />;
}

/** Fila del ticket: dato a la izquierda y valor o importe a la derecha. */
function TicketRow({ label, className, children }: { label: React.ReactNode; className?: string; children: React.ReactNode }) {
    return (
        <div className={cn('flex justify-between gap-3', className)}>
            <span>{label}</span>
            <span className="text-right">{children}</span>
        </div>
    );
}

/** El ticket listo para printTicket(): no se ve en pantalla. */
export function TicketPrint({ sale, paymentMethods }: TicketProps) {
    const ticket = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const paper = document.createElement('style');
        document.head.append(paper);

        const fitPaperToTicket = () => {
            const heightInMm = Math.ceil((ticket.current?.offsetHeight ?? 0) * MM_PER_PX) + 2;
            paper.textContent = `@page { size: ${TICKET_WIDTH_MM}mm ${heightInMm}mm; margin: 0; }`;
        };
        window.addEventListener('beforeprint', fitPaperToTicket);

        return () => {
            window.removeEventListener('beforeprint', fitPaperToTicket);
            paper.remove();
        };
    }, []);

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
    return text ? <p className="text-[11px]">{text}</p> : null;
}
