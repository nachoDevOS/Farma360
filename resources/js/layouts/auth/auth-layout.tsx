/**
 * MARCO DE LOGIN / REGISTRO / RECUPERAR CONTRASEÑA: mitad izquierda con la marca (siempre oscura) y mitad derecha con el formulario.
 */
import { AppLogoMark } from '@/components/shared/app-logo';
import { FlashToast } from '@/components/shared/flash-toast';
import { Link } from '@inertiajs/react';
import { BarChart3, ShieldCheck, Users } from 'lucide-react';

interface AuthLayoutProps {
    children: React.ReactNode;
    title?: string;
    description?: string;
}

// Lo que trae el sistema (lado izquierdo). Cámbialo por lo que ofrece el sistema de cada cliente.
const features = [
    { icon: Users, title: 'Usuarios y roles', text: 'Crea roles a medida y decide qué puede ver y hacer cada uno.' },
    { icon: ShieldCheck, title: 'Auditoría', text: 'Cada acceso y cada cambio queda registrado con fecha, usuario e IP.' },
    { icon: BarChart3, title: 'Indicadores', text: 'Registros, cuentas activas y verificación, de un vistazo.' },
];

export default function AuthLayout({ children, title, description }: AuthLayoutProps) {
    return (
        <div className="bg-background grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            {/* Lado izquierdo: la marca (siempre oscuro) */}
            <div className="dark bg-sidebar text-sidebar-foreground relative hidden flex-col justify-between border-r p-10 lg:flex xl:p-12">
                <Link href={route('home')} className="flex items-center gap-3 text-white">
                    <AppLogoMark className="size-9" />
                    <span className="font-display text-base font-semibold">Panel Admin</span>
                </Link>

                <div className="max-w-md space-y-10">
                    <h2 className="font-display text-[2rem] leading-[1.15] font-semibold text-balance text-white">
                        Gestión de usuarios, permisos y auditoría en un solo lugar.
                    </h2>
                    <ul className="space-y-6">
                        {features.map(({ icon: Icon, title, text }) => (
                            <li key={title} className="flex gap-4">
                                <span className="border-sidebar-border text-sidebar-primary flex size-9 shrink-0 items-center justify-center rounded-lg border">
                                    <Icon className="size-4" />
                                </span>
                                <div className="space-y-0.5">
                                    <p className="text-sm font-medium text-white">{title}</p>
                                    <p className="text-sidebar-foreground/70 text-sm leading-relaxed">{text}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                <p className="text-sidebar-foreground/50 text-xs">© {new Date().getFullYear()} Panel Admin</p>
            </div>

            {/* Lado derecho: el formulario (login, registro…) llega como children */}
            <div className="flex items-center justify-center p-6 sm:p-10">
                <div className="w-full max-w-sm space-y-8">
                    <Link href={route('home')} className="flex items-center gap-3 lg:hidden">
                        <AppLogoMark className="size-9" />
                        <span className="font-display text-base font-semibold">Panel Admin</span>
                    </Link>
                    <div className="space-y-1.5">
                        <h1 className="font-display text-2xl font-semibold">{title}</h1>
                        <p className="text-muted-foreground text-sm">{description}</p>
                    </div>
                    {children}
                    <p className="text-muted-foreground text-center text-xs">
                        Desarrollado por{' '}
                        <a
                            href="https://www.soluciondigital.dev/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground font-medium hover:underline"
                        >
                            soluciondigital.dev
                        </a>
                    </p>
                </div>
            </div>
            <FlashToast />
        </div>
    );
}
