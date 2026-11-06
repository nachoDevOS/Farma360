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
        <section className="pub-section bg-[#f4f6f9] px-4 py-10 sm:px-6 lg:py-12">
            <SectionHeading title="Lo que dicen las farmacias" text="Opiniones de quienes ya trabajan con el sistema." />
            <div className="mx-auto mt-6 grid max-w-[88rem] gap-3 md:grid-cols-2 lg:grid-cols-3">
                {testimonials.map(({ quote, name, pharmacy }) => (
                    <figure key={name} className="pub-reveal rounded-xl bg-white p-4 sm:p-5">
                        <blockquote className="leading-relaxed text-slate-800">“{quote}”</blockquote>
                        <figcaption className="mt-3 text-sm">
                            <span className="block font-semibold text-slate-900">{name}</span>
                            <span className="text-slate-600">{pharmacy}</span>
                        </figcaption>
                    </figure>
                ))}
            </div>
        </section>
    );
}
