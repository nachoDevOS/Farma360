/** Grilla con los módulos del sistema, los mismos del menú. */
import { stagger } from '@/components/public/effects';
import { SectionHeading } from '@/components/public/section-heading';
import { ArrowLeftRight, ChartColumn, ClipboardList, Package, Percent, ShieldCheck, ShoppingCart, Wallet } from 'lucide-react';

const modules = [
    {
        icon: ShoppingCart,
        title: 'Punto de venta',
        text: 'Lector de códigos, búsqueda por síntoma, descuentos y cobro en efectivo, QR o pago mixto.',
    },
    { icon: Package, title: 'Inventario por lotes', text: 'Stock por sucursal, lotes con vencimiento, stock mínimo y ajustes con registro.' },
    { icon: Wallet, title: 'Caja y turnos', text: 'Apertura contando billetes, ingresos, egresos, retiros y cierre con diferencia.' },
    { icon: ClipboardList, title: 'Compras', text: 'Compras por proveedor y factura. Cada producto entra como un lote con su costo.' },
    { icon: ArrowLeftRight, title: 'Sucursales', text: 'Cada sucursal con su stock y sus cajas, con transferencias de envío y recepción.' },
    { icon: Percent, title: 'Promociones', text: 'Descuentos por lote para vender lo que está por vencer antes de perderlo.' },
    { icon: ChartColumn, title: 'Reportes', text: 'Ventas, costo, ganancia bruta, productos más vendidos y formas de pago.' },
    { icon: ShieldCheck, title: 'Usuarios y permisos', text: 'Roles a medida para decidir qué ve y qué puede hacer cada persona.' },
];

export function ModuleGrid() {
    return (
        <section id="modulos" className="pub-section scroll-mt-20 bg-[#f4f6f9] px-4 py-10 sm:px-6 lg:py-12">
            <SectionHeading title="Módulos del sistema" text="Todo lo que necesita una farmacia para vender, controlar su stock y cerrar el día." />
            <div className="mx-auto mt-6 grid max-w-[88rem] gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {modules.map(({ icon: Icon, title, text }, index) => (
                    <article
                        key={title}
                        style={stagger(index % 4)}
                        className="pub-reveal pub-spot pub-lift group flex gap-3 rounded-xl bg-white p-4 shadow-sm shadow-slate-900/5"
                    >
                        <span className="pub-icon bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                            <Icon className="size-5" />
                        </span>
                        <div>
                            <h3 className="font-display font-bold text-slate-900">{title}</h3>
                            <p className="mt-0.5 text-sm leading-snug text-slate-600">{text}</p>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}
