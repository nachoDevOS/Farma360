/** Cómo se vende: video real con los pasos al lado, y debajo lo que hace el punto de venta. */
import { stagger } from '@/components/public/effects';
import { SaleVideo } from '@/components/public/sale-video';
import { SectionHeading } from '@/components/public/section-heading';
import { Boxes, Calculator, FileText, Percent, Search, Volume2 } from 'lucide-react';

const steps = [
    { title: 'Busca', text: 'Por nombre, genérico, síntoma o con el lector.' },
    { title: 'Cobra', text: 'Escribe lo recibido y el sistema calcula el cambio.' },
    { title: 'Sigue', text: 'Queda listo para el siguiente cliente.' },
];

const features = [
    {
        icon: Search,
        tag: 'Búsqueda',
        title: 'Encuentra por síntoma',
        text: 'Si el cliente dice "dolor de cabeza", el sistema muestra qué le puedes ofrecer.',
    },
    {
        icon: Boxes,
        tag: 'Empaques',
        title: 'Arma el empaque solo',
        text: 'Escribes 12 tabletas y entrega 1 blíster más 2 tabletas, al precio correcto.',
    },
    { icon: Calculator, tag: 'Cobro', title: 'Cambio calculado', text: 'Efectivo, QR o mixto, con billetes rápidos para cobrar en un toque.' },
    {
        icon: FileText,
        tag: 'Controlados',
        title: 'Pide la receta',
        text: 'En productos controlados exige número de receta y médico antes de vender.',
    },
    {
        icon: Percent,
        tag: 'Promociones',
        title: 'Aplica descuentos solo',
        text: 'Si el lote tiene promoción, el precio baja sin que el cajero haga nada.',
    },
    { icon: Volume2, tag: 'Aviso', title: 'Te confirma la venta', text: 'Aviso en pantalla con el total y el cambio, y sonido de caja al cobrar.' },
];

export function SaleShowcase() {
    return (
        <section id="venta" className="pub-section scroll-mt-20 bg-white px-4 py-10 sm:px-6 lg:py-12">
            <SectionHeading
                title="Una venta en segundos"
                text="Míralo de principio a fin: una venta real en la demostración, con datos de ejemplo."
            />

            <div className="pub-reveal mx-auto mt-6 grid max-w-[72rem] items-center gap-5 rounded-2xl bg-[#f4f6f9] p-3 sm:p-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <SaleVideo />
                <ol className="space-y-3">
                    {steps.map(({ title, text }, index) => (
                        <li key={title} className="flex gap-3">
                            <span className="bg-primary flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white">
                                {index + 1}
                            </span>
                            <span>
                                <span className="font-display block font-bold text-slate-900">{title}</span>
                                <span className="block text-sm leading-snug text-slate-600">{text}</span>
                            </span>
                        </li>
                    ))}
                </ol>
            </div>

            <div className="mx-auto mt-3 grid max-w-[72rem] gap-3 md:grid-cols-2 lg:grid-cols-3">
                {features.map(({ icon: Icon, tag, title, text }, index) => (
                    <article
                        key={title}
                        style={stagger(index % 3)}
                        className="pub-reveal pub-spot pub-lift group flex gap-3 rounded-xl border border-slate-200 bg-white p-4"
                    >
                        <span className="pub-icon bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                            <Icon className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                                <h3 className="font-display font-bold text-slate-900">{title}</h3>
                                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{tag}</span>
                            </div>
                            <p className="mt-0.5 text-sm leading-snug text-slate-600">{text}</p>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}
