/** Pie de la página pública: llamado a escribir, enlaces y contacto. El teléfono y WhatsApp salen de config/demo.php. */
import { AppLogoMark } from '@/components/shared/app-logo';
import { HygieiaSeal } from '@/components/shared/hygieia-seal';
import { Link } from '@inertiajs/react';
import { MapPin, MessageCircle, Phone } from 'lucide-react';

interface FooterProps {
    name: string;
    description: string;
    phone: string | null;
    whatsappUrl: string | null;
}

const columns = [
    {
        title: 'Sistema',
        links: [
            { href: '#modulos', label: 'Módulos' },
            { href: '#venta', label: 'Cómo se vende' },
            { href: '#comprobante', label: 'Comprobante' },
            { href: '#funciones', label: 'Funciones' },
        ],
    },
    {
        title: 'Conoce más',
        links: [
            { href: '#equipo', label: 'Para tu equipo' },
            { href: '#preguntas', label: 'Preguntas frecuentes' },
        ],
    },
];

export function SiteFooter({ name, description, phone, whatsappUrl }: FooterProps) {
    return (
        <footer className="bg-brand-navy relative overflow-hidden text-white">
            <div aria-hidden="true" className="absolute -right-16 -bottom-24 hidden opacity-[0.07] lg:block">
                <HygieiaSeal className="h-[34rem]" />
            </div>

            <div className="relative mx-auto max-w-[100rem] px-6 pt-14 pb-8 lg:px-12">
                {whatsappUrl && (
                    <div className="flex flex-col items-start justify-between gap-5 border-b border-white/15 pb-10 md:flex-row md:items-center">
                        <div>
                            <h2 className="font-display text-3xl leading-tight font-semibold tracking-[-0.02em] text-balance">
                                ¿Tienes una farmacia? Hablemos
                            </h2>
                            <p className="mt-2 text-lg text-white/80">Escríbenos y te mostramos cómo funcionaría en tu negocio.</p>
                        </div>
                        <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="pub-lift inline-flex h-13 shrink-0 items-center gap-2 rounded-md bg-white px-7 text-base font-semibold text-slate-900"
                        >
                            <MessageCircle className="size-5" /> Escribir por WhatsApp
                        </a>
                    </div>
                )}

                <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)]">
                    <div>
                        <span className="flex items-center gap-3">
                            <AppLogoMark className="size-11" />
                            <span className="font-display text-2xl font-bold">{name}</span>
                        </span>
                        <p className="mt-4 max-w-sm leading-relaxed text-white/80">
                            {description}: punto de venta, lotes, caja, compras y sucursales en un solo lugar.
                        </p>
                    </div>

                    {columns.map(({ title, links }) => (
                        <nav key={title} aria-label={title}>
                            <h2 className="font-display text-lg font-bold">{title}</h2>
                            <ul className="mt-4 space-y-2.5 text-white/80">
                                {links.map(({ href, label }) => (
                                    <li key={href}>
                                        <a href={href} className="pub-link hover:text-white">
                                            {label}
                                        </a>
                                    </li>
                                ))}
                                {title === 'Conoce más' && (
                                    <li>
                                        <Link href={route('login')} className="pub-link hover:text-white">
                                            Iniciar sesión
                                        </Link>
                                    </li>
                                )}
                            </ul>
                        </nav>
                    ))}

                    <div>
                        <h2 className="font-display text-lg font-bold">Contacto</h2>
                        <ul className="mt-4 space-y-3">
                            {whatsappUrl && phone && (
                                <li>
                                    <a href={whatsappUrl} target="_blank" rel="noreferrer" className="group flex items-center gap-3">
                                        <span className="group-hover:bg-primary flex size-10 items-center justify-center rounded-lg bg-white/10 transition-colors">
                                            <MessageCircle className="size-5" />
                                        </span>
                                        <span>
                                            <span className="block text-sm text-white/70">WhatsApp</span>
                                            <span className="block font-semibold tabular-nums">{phone}</span>
                                        </span>
                                    </a>
                                </li>
                            )}
                            {phone && (
                                <li>
                                    <a href={`tel:${phone.replaceAll(' ', '')}`} className="group flex items-center gap-3">
                                        <span className="group-hover:bg-primary flex size-10 items-center justify-center rounded-lg bg-white/10 transition-colors">
                                            <Phone className="size-5" />
                                        </span>
                                        <span>
                                            <span className="block text-sm text-white/70">Teléfono</span>
                                            <span className="block font-semibold tabular-nums">{phone}</span>
                                        </span>
                                    </a>
                                </li>
                            )}
                            <li className="flex items-center gap-3">
                                <span className="flex size-10 items-center justify-center rounded-lg bg-white/10">
                                    <MapPin className="size-5" />
                                </span>
                                <span>
                                    <span className="block text-sm text-white/70">Ubicación</span>
                                    <span className="block font-semibold">Bolivia</span>
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>

                <p className="flex flex-wrap justify-between gap-2 border-t border-white/15 pt-6 pr-16 text-sm text-white/70">
                    <span>
                        © {new Date().getFullYear()} {name}. Todos los derechos reservados.
                    </span>
                    <span>
                        Desarrollado por{' '}
                        <a href="https://soluciondigital.dev" target="_blank" rel="noreferrer" className="font-medium text-white hover:underline">
                            soluciondigital.dev
                        </a>
                    </span>
                </p>
            </div>
        </footer>
    );
}
