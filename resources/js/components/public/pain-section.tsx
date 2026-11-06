/** Marketing: tema por tema, cómo se trabaja a mano, cómo con el sistema y qué se gana. Solo cosas que el sistema hace hoy. */
import { stagger } from '@/components/public/effects';
import { CalendarClock, ChartColumn, Check, Clock, FileText, Package, Wallet } from 'lucide-react';

const comparisons = [
    {
        icon: FileText,
        topic: 'Ventas',
        manual: 'Anotas cada venta y sumas a mano al final del día.',
        system: 'Cada venta se registra sola, con producto, hora y vendedor.',
        advantage: 'Ninguna venta se pierde',
    },
    {
        icon: Package,
        topic: 'Inventario',
        manual: 'Cuentas estantes y actualizas el Excel cuando hay tiempo.',
        system: 'El stock baja con cada venta y sube con cada compra.',
        advantage: 'Siempre sabes cuánto tienes',
    },
    {
        icon: CalendarClock,
        topic: 'Vencimientos',
        manual: 'Revisas cajas una por una, y a veces ya es tarde.',
        system: 'Te avisa 90 días antes y vende primero el lote que vence antes.',
        advantage: 'Pierdes menos mercadería',
    },
    {
        icon: Wallet,
        topic: 'Caja',
        manual: 'Al cierre falta dinero y nadie sabe por qué.',
        system: 'Cada turno muestra cuánto debe haber y la diferencia con lo contado.',
        advantage: 'Cada cajero responde por su turno',
    },
    {
        icon: Clock,
        topic: 'Atención',
        manual: 'Buscas precios en listas mientras el cliente espera.',
        system: 'Buscas por nombre o síntoma y aparecen precio y stock.',
        advantage: 'Atiendes más rápido',
    },
    {
        icon: ChartColumn,
        topic: 'Ganancias',
        manual: 'Sabes lo que vendiste, pero no cuánto ganaste.',
        system: 'El reporte muestra ventas, costo y ganancia del período que elijas.',
        advantage: 'Decides con números reales',
    },
];

export function PainSection({ name }: { name: string }) {
    return (
        <section id="por-que" className="pub-section scroll-mt-20 bg-white px-4 py-10 sm:px-6 lg:py-12">
            <div className="pub-reveal mx-auto max-w-3xl text-center">
                <h2 className="font-display text-2xl leading-tight font-semibold tracking-[-0.02em] text-balance text-slate-900 sm:text-[2rem]">
                    ¿Te cansaste de llevar tu farmacia en <span className="pub-mark">cuaderno y Excel</span>?
                </h2>
                <p className="mt-2 leading-relaxed text-slate-600">
                    Cada remedio que vence, cada venta sin anotar y cada boliviano que no cuadra es dinero que se va. Y sin datos, ni te enteras.
                </p>
            </div>

            <div className="mx-auto mt-6 max-w-[76rem] overflow-hidden rounded-2xl shadow-xl shadow-slate-900/10">
                <div aria-hidden="true" className="hidden grid-cols-[10rem_minmax(0,4fr)_minmax(0,6fr)] lg:grid">
                    <span className="bg-[#f4f6f9]" />
                    <span className="font-display bg-[#f4f6f9] px-4 py-2.5 font-semibold text-slate-500">Con cuaderno o Excel</span>
                    <span className="font-display bg-brand-navy px-4 py-2.5 font-semibold text-white">Con {name}</span>
                </div>

                <ul>
                    {comparisons.map(({ icon: Icon, topic, manual, system, advantage }, index) => (
                        <li
                            key={topic}
                            className="grid border-t border-slate-200 lg:grid-cols-[10rem_minmax(0,4fr)_minmax(0,6fr)] lg:border-slate-200/70"
                        >
                            <div className="flex items-center gap-2.5 bg-[#f4f6f9] px-4 pt-3 lg:py-2">
                                <span className="text-primary flex size-8 shrink-0 items-center justify-center rounded-lg bg-white">
                                    <Icon className="size-4" />
                                </span>
                                <h3 className="font-display font-semibold text-slate-900">{topic}</h3>
                            </div>
                            <p className="bg-[#f4f6f9] px-4 pt-1.5 pb-3 text-sm leading-snug text-slate-600 lg:flex lg:items-center lg:py-2">
                                <span>
                                    <span className="block text-xs font-semibold text-slate-500 lg:hidden">Con cuaderno o Excel</span>
                                    {manual}
                                </span>
                            </p>
                            <div className="bg-brand-navy flex items-center gap-3 px-4 py-2.5 text-white lg:py-2">
                                <span
                                    style={stagger(index)}
                                    className="pub-pop bg-primary flex size-6 shrink-0 items-center justify-center rounded-full"
                                >
                                    <Check className="size-3.5" strokeWidth={3} />
                                </span>
                                <span className="grid w-full gap-x-6 gap-y-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-center">
                                    <span className="text-sm leading-snug text-white/90">
                                        <span className="block text-xs font-semibold text-white/70 lg:hidden">Con {name}</span>
                                        {system}
                                    </span>
                                    <strong className="font-display text-sm font-semibold">{advantage}</strong>
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
