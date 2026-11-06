/** Título centrado de cada sección de la página pública. */
export function SectionHeading({ title, text }: { title: string; text: string }) {
    return (
        <div className="pub-reveal mx-auto max-w-2xl text-center">
            <h2 className="font-display text-2xl leading-tight font-semibold tracking-[-0.02em] text-balance text-slate-900 sm:text-[2rem]">
                {title}
            </h2>
            <p className="mt-2 leading-relaxed text-slate-600">{text}</p>
        </div>
    );
}
