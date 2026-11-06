/** Marco de ventana de navegador para mostrar capturas reales del sistema en la página pública. */
export function BrowserFrame({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`overflow-hidden rounded-2xl shadow-[0_24px_60px_-20px_rgb(11_27_51/0.55)] ring-1 ring-slate-900/15 ${className}`}>
            <div aria-hidden="true" className="bg-brand-navy flex items-center gap-1.5 px-4 py-2.5">
                <span className="size-2.5 rounded-full bg-white/30" />
                <span className="size-2.5 rounded-full bg-white/30" />
                <span className="size-2.5 rounded-full bg-white/30" />
            </div>
            {children}
        </div>
    );
}
