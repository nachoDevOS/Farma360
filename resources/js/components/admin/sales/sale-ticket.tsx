/*
 * TICKET de una venta, el que sale por la impresora: rollo de 80 mm, en negro y con letra de impresora térmica, ordenado como
 * la factura de rollo de Bolivia. NO es una factura: el sistema no está conectado al SIAT, por eso dice que no tiene valor
 * fiscal y no lleva CUF, NIT de la empresa ni las leyendas de la factura.
 * Muestra el nombre del sistema (APP_NAME de .env, prop compartida "name") y un QR con los datos del comprobante, que se leen sin internet.
 * Queda fuera de la pantalla y no se ve (ver app.css → .print-only). Para imprimir: printTicket().
 * Justo antes de imprimir, TicketPrint mide el ticket y le da al papel ese largo exacto: sale en una hoja, sin espacio sobrante.
 */
import { describeLevels, levelsOf } from '@/components/admin/common/package-chain';
import { countOf } from '@/components/admin/products/presentation-levels';
import { amountInWords, formatDate, formatDay, money } from '@/lib/format';
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
                <p className="text-[15px] tracking-wide">Comprobante de venta</p>
                <p className="mt-1.5 text-[18px] leading-tight normal-case">{appName}</p>
                <p>{sale.branch.name}</p>
                {sale.branch.address && <p>{sale.branch.address}</p>}
                {sale.branch.phone && <p>Tel. {sale.branch.phone}</p>}
            </div>
            <TicketDivider />
            <div className="text-center">
                <p>Comprobante N°</p>
                <p className="text-[15px]">{sale.number}</p>
                {sale.status === 'anulada' && <p className="mt-1 border py-0.5 tracking-widest">Venta anulada</p>}
            </div>
            <TicketDivider />
            <p>Nombre/Razón social: {sale.customer_name}</p>
            {sale.customer_document && <p>NIT/CI/CEX: {sale.customer_document}</p>}
            {sale.prescription_number && (
                <p>
                    Receta: {sale.prescription_number} · {sale.prescription_doctor}
                </p>
            )}
            <p>Fecha de emisión: {date}</p>
            <p>Atendió: {sale.registered_by?.name}</p>
            <TicketDivider />
            <p className="mb-1.5 text-center">Detalle</p>
            <ul className="grid gap-2">
                {sale.items?.map((item) => (
                    <li key={item.id}>
                        <p>
                            {item.product.name} {item.product.concentration}
                        </p>
                        <TicketLevels item={item} />
                        <p className="text-[11px]">
                            Lote {item.batch.batch_number} · {item.batch.expires_at ? `vence ${formatDay(item.batch.expires_at)}` : 'sin vencimiento'}
                        </p>
                        {/* Como en la factura de rollo: cantidad X precio - descuento = importe de la línea */}
                        <TicketRow
                            label={
                                <>
                                    {item.presentation?.package
                                        ? countOf(item.units / item.factor, item.presentation.package)
                                        : `${item.units / item.factor} ${item.presentation?.name ?? ''}`}{' '}
                                    X {money(item.list_price, false)} - {money(item.discount_amount, false)}
                                </>
                            }
                        >
                            {money(item.total, false)}
                        </TicketRow>
                    </li>
                ))}
            </ul>
            <TicketDivider />
            <TicketTotal label="Subtotal">{sale.subtotal}</TicketTotal>
            <TicketTotal label={`Descuento${sale.discount_reason ? ` (${sale.discount_reason})` : ''}`}>{sale.discount}</TicketTotal>
            <TicketTotal label="Total" className="text-[15px]">
                {sale.total}
            </TicketTotal>
            {sale.payments.map((p) => (
                <TicketTotal key={p.id} label={`${paymentMethods[p.method] ?? p.method}${p.reference ? ` (${p.reference})` : ''}`}>
                    {p.method === 'efectivo' ? sale.cash_received : p.amount}
                </TicketTotal>
            ))}
            {Number(sale.change) > 0 && <TicketTotal label="Cambio">{sale.change}</TicketTotal>}
            <p className="mt-2">Son: {amountInWords(sale.total)}</p>
            <TicketDivider />
            <p className="text-center text-[11px]">Este comprobante no es una factura y no es válido para crédito fiscal</p>
            <QRCodeSVG value={qrText} size={96} level="M" marginSize={0} fgColor="#000" bgColor="#fff" className="mx-auto mt-2.5" />
            <p className="mt-2.5 text-center">Gracias por su compra</p>
            <p className="mt-2 text-center text-[9px] tracking-wide normal-case">soluciondigital.dev</p>
        </div>
    );
}

function TicketDivider() {
    return <div className="my-2 border-t border-dashed" />;
}

/** Fila de totales alineada a la derecha, como en la factura de rollo: "SUBTOTAL Bs 9,90". */
function TicketTotal({ label, className, children }: { label: string; className?: string; children: string | null | undefined }) {
    return (
        <div className={cn('flex justify-end gap-3', className)}>
            <span>
                {label} <span className="normal-case">Bs</span>
            </span>
            <span className="min-w-[62px] text-right">{money(children, false)}</span>
        </div>
    );
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
