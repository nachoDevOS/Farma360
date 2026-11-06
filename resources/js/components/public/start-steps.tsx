/** Marketing: cómo empezar, sin promesas de plazos ni de precios. */
import { stagger } from '@/components/public/effects';
import { SectionHeading } from '@/components/public/section-heading';
import { MessageCircle, MonitorPlay, ShoppingCart } from 'lucide-react';

const steps = [
    { icon: MessageCircle, title: 'Escríbenos', text: 'Cuéntanos cómo es tu farmacia y cuántas sucursales tienes.' },
    { icon: MonitorPlay, title: 'Mira cómo funciona', text: 'Te mostramos el sistema y resolvemos tus dudas.' },
    { icon: ShoppingCart, title: 'Deja el cuaderno', text: 'Empieza a vender con todo registrado desde la primera venta.' },
];

export function StartSteps() {
    return (
        <section className="bg-white px-6 py-20">
            <SectionHeading title="Empezar es simple" text="Sin instalar programas: es un sistema web." />
            <ol className="mx-auto mt-12 grid max-w-[76rem] gap-8 md:grid-cols-3">
                {steps.map(({ icon: Icon, title, text }, index) => (
                    <li
                        key={title}
                        style={stagger(index)}
                        className="pub-reveal pub-spot pub-lift group rounded-2xl border border-slate-200 bg-white p-6"
                    >
                        <div className="flex items-center justify-between">
                            <span className="pub-icon bg-primary/10 text-primary flex size-12 items-center justify-center rounded-xl">
                                <Icon className="size-6" />
                            </span>
                            <span aria-hidden="true" className="font-display text-4xl font-semibold text-slate-200">
                                {index + 1}
                            </span>
                        </div>
                        <h3 className="font-display mt-4 text-xl font-semibold text-slate-900">{title}</h3>
                        <p className="mt-2 leading-relaxed text-slate-600">{text}</p>
                    </li>
                ))}
            </ol>
        </section>
    );
}
