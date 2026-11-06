/**
 * MARCO DE LOGIN / REGISTRO / RECUPERAR CONTRASEÑA: mitad izquierda con la marca (siempre oscura) y mitad derecha con el formulario.
 */
import { AppLogoMark } from '@/components/shared/app-logo';
import { DevelopedBy } from '@/components/shared/developed-by';
import { FlashToast } from '@/components/shared/flash-toast';
import { type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { CalendarClock, ShoppingCart, Wallet } from 'lucide-react';

interface AuthLayoutProps {
    children: React.ReactNode;
    title?: string;
    description?: string;
}

const SYSTEM_DESCRIPTION = 'Sistema de Inventario y Ventas de Farmacia';

// Lo que trae el sistema (lado izquierdo). Cámbialo por lo que ofrece el sistema de cada cliente.
const features = [
    { icon: ShoppingCart, title: 'Venta rápida', text: 'Busca por nombre, síntoma o código de barras y cobra en segundos.' },
    { icon: CalendarClock, title: 'Lotes y vencimientos', text: 'Sale primero lo que vence antes y el stock queda al día con cada venta.' },
    { icon: Wallet, title: 'Caja clara', text: 'Cada turno registra quién vendió y cuánto debe haber en caja.' },
];

export default function AuthLayout({ children, title, description }: AuthLayoutProps) {
    const { name } = usePage<SharedData>().props;

    return (
        <div className="bg-background grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            {/* Lado izquierdo: la marca (siempre oscuro) */}
            <div className="dark bg-sidebar text-sidebar-foreground relative hidden flex-col justify-between overflow-hidden border-r p-10 lg:flex xl:p-12">
                {/* El mismo dibujo de cápsulas y jeringa del menú lateral */}
                <div
                    aria-hidden="true"
                    className="absolute inset-y-0 right-0 w-1/2 bg-contain bg-right bg-no-repeat opacity-60"
                    style={{
                        backgroundImage: "url('/images/sidebar-bg.svg')",
                        maskImage: 'linear-gradient(to right, transparent 25%, black 75%)',
                    }}
                />

                <Link href={route('home')} className="relative flex items-center gap-3 text-white">
                    <AppLogoMark className="size-10" />
                    <span>
                        <span className="font-display block text-base leading-tight font-semibold">{name}</span>
                        <span className="text-sidebar-foreground/70 block text-xs">{SYSTEM_DESCRIPTION}</span>
                    </span>
                </Link>

                <div className="relative max-w-md space-y-10">
                    <h2 className="font-display text-[2rem] leading-[1.15] font-semibold text-balance text-white">
                        Ventas, inventario y caja de tu farmacia en un solo lugar.
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

                <p className="text-sidebar-foreground/50 relative text-xs">
                    © {new Date().getFullYear()} {name}
                </p>
            </div>

            {/* Lado derecho: el formulario (login, registro…) llega como children */}
            <div className="flex items-center justify-center p-6 sm:p-10">
                <div className="w-full max-w-sm space-y-8">
                    <Link href={route('home')} className="flex items-center gap-3 lg:hidden">
                        <AppLogoMark className="size-10" />
                        <span>
                            <span className="font-display block text-base leading-tight font-semibold">{name}</span>
                            <span className="text-muted-foreground block text-xs">{SYSTEM_DESCRIPTION}</span>
                        </span>
                    </Link>
                    <div className="space-y-1.5">
                        <h1 className="font-display text-2xl font-semibold">{title}</h1>
                        <p className="text-muted-foreground text-sm">{description}</p>
                    </div>
                    {children}
                    <DevelopedBy />
                </div>
            </div>
            <FlashToast />
        </div>
    );
}
