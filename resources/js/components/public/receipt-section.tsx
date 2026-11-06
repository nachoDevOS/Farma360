/**
 * Comprobante de venta. Usa el mismo SaleTicket que sale por la impresora, con una venta de ejemplo: si cambia el ticket, cambia aquí.
 * El papel sale de la impresora al bajar por la página (app.css → .pub-print); si el navegador no lo permite, se ve completo.
 */
import { SaleTicket } from '@/components/admin/sales/sale-ticket';
import { stagger } from '@/components/public/effects';
import { type Sale } from '@/types/admin/pharmacy';
import { MapPin, Printer, QrCode, ReceiptText } from 'lucide-react';

const details = [
    { icon: ReceiptText, title: 'Detalle completo', text: 'Producto, empaque, precio, descuento, lote y vencimiento.' },
    { icon: Printer, title: 'Rollo de 80 mm', text: 'Para impresora térmica, con el largo justo de cada venta.' },
    { icon: QrCode, title: 'Con código QR', text: 'Trae el comprobante, la fecha y el total, y se lee sin internet.' },
    { icon: MapPin, title: 'De tu sucursal', text: 'Con nombre, dirección, teléfono y quién atendió.' },
];

const product = (name: string, concentration: string) => ({ name, concentration, presentations: [] });

const exampleSale = {
    number: 'V-000012',
    status: 'completada',
    created_at: '2026-11-05T15:30:00',
    customer_name: 'Ana Rojas',
    customer_document: '4455667',
    branch: { name: 'Farmacia Central', address: 'Av. 6 de Agosto #123', phone: '70000000' },
    registered_by: { name: 'Luis Rojas' },
    subtotal: '11.95',
    discount: '0.00',
    total: '11.95',
    cash_received: '50.00',
    change: '38.05',
    payments: [{ id: 1, method: 'efectivo', amount: '11.95', reference: null }],
    items: [
        {
            id: 1,
            product: product('Dolofen', '500 mg'),
            presentation: { id: 1, name: 'Blíster', package: 'blíster' },
            batch: { batch_number: 'DOL-2401', expires_at: '2026-12-01' },
            units: 10,
            factor: 10,
            list_price: '4.50',
            discount_amount: '1.35',
            total: '3.15',
        },
        {
            id: 2,
            product: product('Dolofen', '500 mg'),
            presentation: { id: 2, name: 'Tableta', package: 'tableta' },
            batch: { batch_number: 'DOL-2401', expires_at: '2026-12-01' },
            units: 2,
            factor: 1,
            list_price: '0.50',
            discount_amount: '0.30',
            total: '0.70',
        },
        {
            id: 3,
            product: product('Alergin', '10 mg'),
            presentation: { id: 3, name: 'Caja', package: 'caja' },
            batch: { batch_number: 'LOR-09', expires_at: '2027-01-30' },
            units: 10,
            factor: 10,
            list_price: '9.00',
            discount_amount: '0.90',
            total: '8.10',
        },
    ],
} as unknown as Sale;

/** El comprobante de ejemplo con su papel cortado. Se usa aquí y en la portada. */
export function ExampleReceipt({ className = '' }: { className?: string }) {
    return (
        <div className={`pub-paper bg-white pt-3 text-black shadow-2xl shadow-black/50 ${className}`}>
            <SaleTicket sale={exampleSale} paymentMethods={{ efectivo: 'Efectivo' }} />
        </div>
    );
}

export function ReceiptSection() {
    return (
        <section id="comprobante" className="bg-brand-navy relative scroll-mt-20 overflow-hidden px-6 py-20 text-white">
            <div
                aria-hidden="true"
                className="pub-drift absolute top-1/2 right-0 size-[60rem] translate-x-1/4 -translate-y-1/2 rounded-full"
                style={{ background: 'radial-gradient(closest-side, color-mix(in oklab, var(--primary) 34%, transparent), transparent)' }}
            />
            <div className="relative mx-auto grid max-w-[100rem] items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
                <div>
                    <h2 className="font-display text-3xl leading-tight font-semibold tracking-[-0.02em] text-balance sm:text-[2.5rem]">
                        Un comprobante claro en cada venta
                    </h2>
                    <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/85">
                        Al cobrar, imprime el comprobante con un clic. Tu cliente se lleva todo el detalle de su compra, y tú quedas con el registro.
                    </p>
                    <ul className="mt-8 grid gap-4 sm:grid-cols-2">
                        {details.map(({ icon: Icon, title, text }, index) => (
                            <li key={title} style={stagger(index % 2)} className="pub-reveal pub-lift rounded-xl bg-white/[0.07] p-5">
                                <Icon className="size-6" />
                                <span className="font-display mt-3 block text-lg font-bold">{title}</span>
                                <span className="mt-1 block text-white/80">{text}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-6 text-white/75">No es factura: es un comprobante interno, sin valor fiscal.</p>
                </div>

                <div className="mx-auto w-[22rem] max-w-full" aria-label="Ejemplo de comprobante de venta" role="img">
                    <div className="relative z-10 flex h-16 items-start justify-end rounded-t-2xl rounded-b-md bg-slate-200 p-3 shadow-xl shadow-black/40">
                        <span className="bg-primary size-2.5 rounded-full" />
                        <span className="absolute inset-x-6 bottom-2 h-1.5 rounded-full bg-slate-900" />
                    </div>
                    <div className="-mt-2 overflow-hidden px-6 pb-8">
                        <ExampleReceipt className="pub-print" />
                    </div>
                </div>
            </div>
        </section>
    );
}
