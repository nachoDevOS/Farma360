/**
 * Funciones en un solo panel con pestañas: cada una con cuatro puntos concretos y su captura real.
 * Las capturas quedan cargadas una sobre otra, para cambiar sin parpadeos.
 */
import { BrowserFrame } from '@/components/public/browser-frame';
import { SectionHeading } from '@/components/public/section-heading';
import { cn } from '@/lib/utils';
import {
    ArrowLeftRight,
    CalendarClock,
    ChartColumn,
    ClipboardList,
    Contact,
    Package,
    Percent,
    Pill,
    Receipt,
    ShieldCheck,
    Truck,
    Wallet,
} from 'lucide-react';
import { useState } from 'react';

const blocks = [
    {
        icon: Receipt,
        tab: 'Ventas',
        title: 'Todas tus ventas, a la mano',
        text: 'Encuentra cualquier venta en segundos y vuelve a imprimir su comprobante.',
        items: [
            ['Filtros', 'Por sucursal, estado y fecha.'],
            ['Búsqueda', 'Por número, cliente o CI/NIT.'],
            ['Reimpresión', 'El comprobante cuando lo pidan.'],
            ['Anulación', 'Con motivo, y el stock vuelve al lote.'],
        ],
        image: 'ventas',
        alt: 'Lista de ventas realizadas',
    },
    {
        icon: Package,
        tab: 'Inventario',
        title: 'Sabe qué tienes y cuánto vale',
        text: 'Mira tu stock por sucursal y hasta cuándo te alcanza cada producto.',
        items: [
            ['Stock por sucursal', 'Cada local ve lo suyo.'],
            ['Valor al costo', 'Cuánto tienes invertido.'],
            ['Stock mínimo', 'Alerta cuando queda poco.'],
            ['Ajustes', 'Corrige con registro del cambio.'],
        ],
        image: 'inventario',
        alt: 'Inventario con stock y valor',
    },
    {
        icon: CalendarClock,
        tab: 'Vencimientos',
        title: 'Reduce pérdidas por vencimiento',
        text: 'El sistema descuenta primero el lote que vence antes y te avisa a tiempo.',
        items: [
            ['Salida por lote', 'Primero lo que vence antes.'],
            ['Aviso a 90 días', 'Lotes por vencer a la vista.'],
            ['Vencidos', 'No se pueden vender.'],
            ['Trazabilidad', 'Movimientos de cada lote.'],
        ],
        image: 'lotes',
        alt: 'Detalle de un producto con sus lotes',
    },
    {
        icon: Pill,
        tab: 'Productos',
        title: 'Tu catálogo completo y ordenado',
        text: 'Cada producto con lo que una farmacia necesita saber para venderlo.',
        items: [
            ['Genérico y laboratorio', 'Para ofrecer alternativas.'],
            ['Usos y síntomas', 'Búsqueda por lo que duele.'],
            ['Presentaciones', 'Cada una con su precio.'],
            ['Controlados', 'Marca los que piden receta.'],
        ],
        image: 'productos',
        alt: 'Catálogo de productos',
    },
    {
        icon: ClipboardList,
        tab: 'Compras',
        title: 'Cada compra entra con su lote y su costo',
        text: 'Registra lo que llega del proveedor y queda sumado al stock sin escribirlo dos veces.',
        items: [
            ['Por proveedor', 'Con número de factura.'],
            ['Costo por lote', 'Para saber la ganancia real.'],
            ['Queda en stock', 'Cuánto queda de cada compra.'],
            ['Anulación', 'Con motivo, sin perder historial.'],
        ],
        image: 'compras',
        alt: 'Lista de compras a proveedores',
    },
    {
        icon: Truck,
        tab: 'Proveedores',
        title: 'Tus proveedores en un solo lugar',
        text: 'Ten a mano quién te vende y cómo contactarlo.',
        items: [
            ['Razón social y NIT', 'Datos para tus compras.'],
            ['Contacto', 'Persona y teléfono.'],
            ['Activo o inactivo', 'Sin perder su historial.'],
            ['Búsqueda', 'Lo encuentras al instante.'],
        ],
        image: 'proveedores',
        alt: 'Lista de proveedores',
    },
    {
        icon: ArrowLeftRight,
        tab: 'Transferencias',
        title: 'Mueve mercadería entre sucursales',
        text: 'Envía productos sin perderlos de vista, desde que salen hasta que llegan.',
        items: [
            ['Envío', 'Sale del stock al enviar.'],
            ['Recepción', 'Entra al confirmar en destino.'],
            ['Por lote', 'Se sabe qué lote viajó.'],
            ['Estado', 'En camino o recibida.'],
        ],
        image: 'transferencias',
        alt: 'Transferencias entre sucursales',
    },
    {
        icon: Wallet,
        tab: 'Caja',
        title: 'Una caja que cuadra',
        text: 'Cada cajero responde por su turno, y al cerrar sabes cuánto debe haber.',
        items: [
            ['Apertura', 'Se cuenta billete por billete.'],
            ['Movimientos', 'Ingresos, egresos y retiros con motivo.'],
            ['Cierre', 'Muestra la diferencia con lo contado.'],
            ['Historial', 'Todos los turnos por caja.'],
        ],
        image: 'caja',
        alt: 'Turno de caja con sus totales',
    },
    {
        icon: Contact,
        tab: 'Clientes',
        title: 'Conoce a quién le vendes',
        text: 'Guarda a tus clientes y úsalos en la venta sin volver a escribir sus datos.',
        items: [
            ['Con NIT o CI', 'Datos para el comprobante.'],
            ['Búsqueda al vender', 'Lo eliges desde el punto de venta.'],
            ['Sin registrar', 'La venta sale a S/N.'],
            ['Teléfono y correo', 'Para ubicarlos.'],
        ],
        image: 'clientes',
        alt: 'Lista de clientes',
    },
    {
        icon: Percent,
        tab: 'Promociones',
        title: 'Vende lo que está por vencer',
        text: 'Pon descuentos a los lotes en riesgo antes de perderlos, cuidando tu costo.',
        items: [
            ['Sugerencias', 'Lotes por vencer sin promoción.'],
            ['Precio final', 'Lo ves antes de aplicar.'],
            ['Por lote', 'Solo baja ese lote.'],
            ['Automático', 'El punto de venta la aplica solo.'],
        ],
        image: 'promociones',
        alt: 'Promociones por vencimiento de lote',
    },
    {
        icon: ChartColumn,
        tab: 'Reportes',
        title: 'Decide con tus números',
        text: 'Elige un período y mira cómo va la farmacia, sin armar planillas.',
        items: [
            ['Ventas y ganancia', 'Total vendido, costo y margen.'],
            ['Más vendidos', 'Productos con su ganancia.'],
            ['Por día', 'Mira tus mejores días.'],
            ['Formas de pago', 'Cuánto entró por cada una.'],
        ],
        image: 'reportes',
        alt: 'Reportes de ventas y ganancia',
    },
    {
        icon: ShieldCheck,
        tab: 'Permisos',
        title: 'Cada quien ve lo suyo',
        text: 'Decide qué puede ver y hacer cada persona, y sabe siempre quién hizo qué.',
        items: [
            ['Roles listos', 'Regente, cajero y almacenero.'],
            ['Roles a medida', 'Crea los que necesites.'],
            ['Por acción', 'Ver, crear, editar o anular.'],
            ['Nada se borra', 'Queda quién y el motivo.'],
        ],
        image: 'roles',
        alt: 'Roles y permisos de usuarios',
    },
];

export function DetailBlocks() {
    const [activeIndex, setActiveIndex] = useState(0);
    const { icon: ActiveIcon, title, text, items } = blocks[activeIndex];

    return (
        <section id="funciones" className="pub-section scroll-mt-20 bg-[#f4f6f9] px-4 py-10 sm:px-6 lg:py-12">
            <SectionHeading title="Todas las funciones de tu farmacia" text="Elige una y mira cómo se ve en el sistema." />

            <div className="pub-reveal mx-auto mt-5 max-w-[76rem]">
                <div
                    role="tablist"
                    aria-label="Funciones"
                    className="flex gap-1.5 overflow-x-auto pb-1.5 lg:flex-wrap lg:justify-center lg:overflow-visible"
                >
                    {blocks.map(({ icon: Icon, tab }, index) => (
                        <button
                            key={tab}
                            type="button"
                            role="tab"
                            id={`funcion-${index}`}
                            aria-selected={activeIndex === index}
                            aria-controls="funcion-panel"
                            onClick={() => setActiveIndex(index)}
                            className={cn(
                                'flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors duration-200',
                                activeIndex === index ? 'bg-brand-navy text-white' : 'bg-white text-slate-700 hover:bg-slate-200',
                            )}
                        >
                            <Icon className="size-4" />
                            {tab}
                        </button>
                    ))}
                </div>

                <div
                    id="funcion-panel"
                    role="tabpanel"
                    aria-labelledby={`funcion-${activeIndex}`}
                    className="mt-2 grid items-center gap-4 rounded-2xl bg-white p-4 shadow-sm shadow-slate-900/5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6 lg:p-5"
                >
                    <div key={activeIndex} className="pub-swap">
                        <span className="bg-primary flex size-9 items-center justify-center rounded-lg text-white">
                            <ActiveIcon className="size-4" />
                        </span>
                        <h3 className="font-display mt-2.5 text-xl leading-tight font-bold tracking-[-0.02em] text-balance text-slate-900 sm:text-2xl">
                            {title}
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{text}</p>
                        <ul className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                            {items.map(([name, detail]) => (
                                <li key={name} className="border-l-2 border-slate-200 pl-3">
                                    <span className="block text-sm font-semibold text-slate-900">{name}</span>
                                    <span className="text-sm text-slate-600">{detail}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <BrowserFrame className="bg-brand-navy">
                        <div className="relative aspect-[8/5]">
                            {blocks.map(({ image, alt }, index) => (
                                <img
                                    key={image}
                                    src={`/images/landing/${image}.jpg`}
                                    alt={activeIndex === index ? alt : ''}
                                    loading="lazy"
                                    className={cn(
                                        'absolute inset-0 size-full object-cover object-top transition-opacity duration-300',
                                        activeIndex !== index && 'opacity-0',
                                    )}
                                />
                            ))}
                        </div>
                    </BrowserFrame>
                </div>
            </div>
        </section>
    );
}
