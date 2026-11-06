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
        <section id="por-que" className="scroll-mt-20 bg-white px-6 pt-20 pb-16">
            <div className="pub-reveal mx-auto max-w-3xl text-center">
                <h2 className="font-display text-3xl leading-tight font-semibold tracking-[-0.02em] text-balance text-slate-900 sm:text-[2.5rem]">
                    ¿Te cansaste de llevar tu farmacia en <span className="pub-mark">cuaderno y Excel</span>?
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-slate-600">
                    Cada remedio que vence, cada venta sin anotar y cada boliviano que no cuadra es dinero que se va. Y sin datos, ni te enteras.
                </p>
            </div>

            <div className="mx-auto mt-12 max-w-[84rem] overflow-hidden rounded-3xl shadow-xl shadow-slate-900/10">
                <div aria-hidden="true" className="hidden grid-cols-[13rem_minmax(0,4fr)_minmax(0,6fr)] lg:grid">
                    <span className="bg-[#f4f6f9]" />
                    <span className="font-display bg-[#f4f6f9] p-5 text-lg font-semibold text-slate-500">Con cuaderno o Excel</span>
                    <span className="font-display bg-brand-navy p-5 text-lg font-semibold text-white">Con {name}</span>
                </div>

                <ul>
                    {comparisons.map(({ icon: Icon, topic, manual, system, advantage }, index) => (
                        <li
                            key={topic}
                            className="grid border-t border-slate-200 lg:grid-cols-[13rem_minmax(0,4fr)_minmax(0,6fr)] lg:border-slate-200/70"
                        >
                            <div className="flex items-center gap-3 bg-[#f4f6f9] px-5 pt-5 lg:pb-5">
                                <span className="text-primary flex size-10 shrink-0 items-center justify-center rounded-xl bg-white">
                                    <Icon className="size-5" />
                                </span>
                                <h3 className="font-display text-lg font-semibold text-slate-900">{topic}</h3>
                            </div>
                            <p className="bg-[#f4f6f9] px-5 pt-3 pb-5 leading-relaxed text-slate-600 lg:flex lg:items-center lg:py-5">
                                <span>
                                    <span className="block text-sm font-semibold text-slate-500 lg:hidden">Con cuaderno o Excel</span>
                                    {manual}
                                </span>
                            </p>
                            <div className="bg-brand-navy flex items-start gap-3 p-5 text-white">
                                <span
                                    style={stagger(index)}
                                    className="pub-pop bg-primary mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full"
                                >
                                    <Check className="size-4" strokeWidth={3} />
                                </span>
                                <span className="grid w-full gap-x-6 gap-y-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-center">
                                    <span className="leading-relaxed text-white/90">
                                        <span className="block text-sm font-semibold text-white/70 lg:hidden">Con {name}</span>
                                        {system}
                                    </span>
                                    <strong className="font-display font-semibold">{advantage}</strong>
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
