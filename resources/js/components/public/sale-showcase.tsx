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
        <section id="venta" className="scroll-mt-20 bg-white px-6 py-20">
            <SectionHeading
                title="Una venta en segundos"
                text="Míralo de principio a fin: una venta real en la demostración, con datos de ejemplo."
            />

            <div className="pub-reveal mx-auto mt-12 grid max-w-[88rem] items-center gap-8 rounded-3xl bg-[#f4f6f9] p-5 sm:p-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <SaleVideo />
                <ol className="space-y-5">
                    {steps.map(({ title, text }, index) => (
                        <li key={title} className="flex gap-4">
                            <span className="bg-primary flex size-9 shrink-0 items-center justify-center rounded-full font-bold text-white">
                                {index + 1}
                            </span>
                            <span>
                                <span className="font-display block text-lg font-bold text-slate-900">{title}</span>
                                <span className="text-slate-600">{text}</span>
                            </span>
                        </li>
                    ))}
                </ol>
            </div>

            <div className="mx-auto mt-8 grid max-w-[88rem] gap-5 md:grid-cols-2 lg:grid-cols-3">
                {features.map(({ icon: Icon, tag, title, text }, index) => (
                    <article
                        key={title}
                        style={stagger(index % 3)}
                        className="pub-reveal pub-spot pub-lift group rounded-2xl border border-slate-200 bg-white p-6"
                    >
                        <div className="flex items-center justify-between">
                            <span className="pub-icon bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                                <Icon className="size-5" />
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{tag}</span>
                        </div>
                        <h3 className="font-display mt-4 text-lg font-bold text-slate-900">{title}</h3>
                        <p className="mt-2 leading-relaxed text-slate-600">{text}</p>
                    </article>
                ))}
            </div>
        </section>
    );
}
