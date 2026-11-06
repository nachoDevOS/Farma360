import { SectionHeading } from '@/components/public/section-heading';

/** Opiniones de clientes reales (config/demo.php → testimonials). Si no hay ninguna, la sección no se muestra. */
export interface Testimonial {
    quote: string;
    name: string;
    pharmacy: string;
}

export function Testimonials({ testimonials }: { testimonials: Testimonial[] }) {
    if (testimonials.length === 0) {
        return null;
    }

    return (
        <section className="bg-[#f4f6f9] px-6 py-20">
            <SectionHeading title="Lo que dicen las farmacias" text="Opiniones de quienes ya trabajan con el sistema." />
            <div className="mx-auto mt-12 grid max-w-[88rem] gap-5 md:grid-cols-2 lg:grid-cols-3">
                {testimonials.map(({ quote, name, pharmacy }) => (
                    <figure key={name} className="pub-reveal rounded-2xl bg-white p-6 sm:p-8">
                        <blockquote className="text-lg leading-relaxed text-slate-800">“{quote}”</blockquote>
                        <figcaption className="mt-5 text-sm">
                            <span className="block font-semibold text-slate-900">{name}</span>
                            <span className="text-slate-600">{pharmacy}</span>
                        </figcaption>
                    </figure>
                ))}
            </div>
        </section>
    );
}
