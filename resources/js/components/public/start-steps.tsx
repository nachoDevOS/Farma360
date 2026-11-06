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
        <section className="pub-section bg-white px-4 pb-10 sm:px-6 lg:pb-12">
            <SectionHeading title="Empezar es simple" text="Sin instalar programas: es un sistema web." />
            <ol className="mx-auto mt-6 grid max-w-[76rem] gap-3 md:grid-cols-3">
                {steps.map(({ icon: Icon, title, text }, index) => (
                    <li
                        key={title}
                        style={stagger(index)}
                        className="pub-reveal pub-spot pub-lift group flex gap-3 rounded-xl border border-slate-200 bg-white p-4"
                    >
                        <span className="pub-icon bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                            <Icon className="size-5" />
                        </span>
                        <div className="flex-1">
                            <h3 className="font-display font-semibold text-slate-900">{title}</h3>
                            <p className="mt-0.5 text-sm leading-snug text-slate-600">{text}</p>
                        </div>
                        <span aria-hidden="true" className="font-display text-3xl font-semibold text-slate-200">
                            {index + 1}
                        </span>
                    </li>
                ))}
            </ol>
        </section>
    );
}
