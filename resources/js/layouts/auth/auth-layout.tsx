/**
 * MARCO DE LOGIN / REGISTRO / RECUPERAR CONTRASEÑA: pantalla azul noche, con la copa de Higía a la izquierda y el formulario en una
 * tarjeta a la derecha. Es igual en tema claro y oscuro; solo la tarjeta sigue el tema. En el celular la copa queda pequeña, arriba.
 */
import { AppLogoMark } from '@/components/shared/app-logo';
import { DevelopedBy } from '@/components/shared/developed-by';
import { FlashToast } from '@/components/shared/flash-toast';
import { HygieiaSeal } from '@/components/shared/hygieia-seal';
import { type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';

interface AuthLayoutProps {
    children: React.ReactNode;
    title?: string;
    description?: string;
}

const SYSTEM_DESCRIPTION = 'Sistema de Inventario y Ventas de Farmacia';

export default function AuthLayout({ children, title, description }: AuthLayoutProps) {
    const { name } = usePage<SharedData>().props;

    return (
        <div className="bg-brand-navy selection:bg-primary/20 relative grid min-h-dvh items-center gap-6 overflow-hidden p-4 sm:p-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10 lg:p-12">
            <div
                aria-hidden="true"
                className="absolute top-1/2 left-1/4 size-[70rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ background: 'radial-gradient(closest-side, color-mix(in oklab, var(--primary) 34%, transparent), transparent)' }}
            />

            <aside className="relative flex flex-col items-center text-center text-white">
                <HygieiaSeal className="h-32 sm:h-40 lg:h-[62dvh] lg:max-h-[38rem]" />
                <div className="mt-8 hidden lg:block">
                    <p className="font-display mx-auto max-w-lg text-3xl leading-[1.12] font-semibold tracking-[-0.02em] text-balance xl:text-4xl">
                        Ventas, inventario y caja de tu farmacia en un solo lugar.
                    </p>
                    <p className="mx-auto mt-3 max-w-md text-white/80">Vende rápido, cuida tus vencimientos y cierra la caja sin sorpresas.</p>
                </div>
            </aside>

            <main className="bg-card text-card-foreground relative mx-auto w-full max-w-md rounded-2xl p-7 shadow-2xl shadow-black/40 sm:p-10">
                <Link href={route('home')} className="flex items-center gap-3 rounded-lg">
                    <AppLogoMark className="size-10" />
                    <span>
                        <span className="font-display block text-base leading-tight font-semibold">{name}</span>
                        <span className="text-muted-foreground block text-xs">{SYSTEM_DESCRIPTION}</span>
                    </span>
                </Link>

                <div className="mt-9 mb-7 space-y-2">
                    <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">{title}</h1>
                    <p className="text-muted-foreground">{description}</p>
                </div>
                {children}

                <div className="mt-8">
                    <DevelopedBy />
                </div>
            </main>
            <FlashToast />
        </div>
    );
}
