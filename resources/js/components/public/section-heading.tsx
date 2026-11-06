/** Título centrado de cada sección de la página pública. */
export function SectionHeading({ title, text }: { title: string; text: string }) {
    return (
        <div className="pub-reveal mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl leading-tight font-semibold tracking-[-0.02em] text-balance text-slate-900 sm:text-[2.5rem]">
                {title}
            </h2>
            <p className="mt-3 text-lg leading-relaxed text-slate-600">{text}</p>
        </div>
    );
}
