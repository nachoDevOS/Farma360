/** Barra superior fija de la página pública. */
import { AppLogoMark } from '@/components/shared/app-logo';
import { Link } from '@inertiajs/react';

const links = [
    { href: '#por-que', label: 'Por qué' },
    { href: '#modulos', label: 'Módulos' },
    { href: '#venta', label: 'Cómo se vende' },
    { href: '#comprobante', label: 'Comprobante' },
    { href: '#funciones', label: 'Funciones' },
    { href: '#equipo', label: 'Equipo' },
    { href: '#preguntas', label: 'Preguntas' },
];

export function SiteHeader({ name, children }: { name: string; children: React.ReactNode }) {
    return (
        <header className="pub-header sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md">
            <div aria-hidden="true" className="pub-progress" />
            <div className="mx-auto flex h-18 max-w-[110rem] items-center justify-between gap-4 px-6 lg:px-12">
                <a href="#inicio" className="flex items-center gap-3">
                    <AppLogoMark className="size-10" />
                    <span className="font-display text-xl font-bold text-slate-900">{name}</span>
                </a>
                <nav className="hidden items-center gap-7 xl:flex">
                    {links.map(({ href, label }) => (
                        <a key={href} href={href} className="pub-link text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
                            {label}
                        </a>
                    ))}
                </nav>
                <div className="flex items-center gap-3">
                    <Link href={route('login')} className="text-sm font-semibold whitespace-nowrap text-slate-700 hover:text-slate-900">
                        Iniciar sesión
                    </Link>
                    <span className="hidden sm:block">{children}</span>
                </div>
            </div>
        </header>
    );
}
