/**
 * MARCO DE "MIS AJUSTES": título + menú lateral (Perfil, Contraseña, Apariencia).
 */
import { PageHeader } from '@/components/admin/common/page-header';
import { cn } from '@/lib/utils';
import { type NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import { KeyRound, Palette, UserRound } from 'lucide-react';

// Opciones del menú de ajustes. Para agregar una sección nueva, súmala aquí y crea su página en pages/admin/settings/
const sidebarNavItems: (NavItem & { description: string })[] = [
    {
        title: 'Perfil',
        description: 'Tu nombre y correo',
        url: '/settings/profile',
        icon: UserRound,
    },
    {
        title: 'Contraseña',
        description: 'Cambia tu clave de acceso',
        url: '/settings/password',
        icon: KeyRound,
    },
    {
        title: 'Apariencia',
        description: 'Modo claro u oscuro',
        url: '/settings/appearance',
        icon: Palette,
    },
];

/** Uso: <SettingsLayout> tarjetas de la sección </SettingsLayout> */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    // URL actual, para resaltar la opción activa del menú
    const currentPath = window.location.pathname;

    return (
        <div className="w-full space-y-8 p-4 md:p-8">
            <PageHeader title="Ajustes" description="Elige qué quieres cambiar en el menú de la izquierda." />

            <div className="flex flex-col gap-8 lg:flex-row">
                <aside className="w-full lg:w-64 lg:shrink-0">
                    <nav className="-mx-1 flex gap-1 overflow-x-auto lg:flex-col" aria-label="Secciones de ajustes">
                        {sidebarNavItems.map((item) => {
                            const active = currentPath === item.url;
                            return (
                                <Link
                                    key={item.url}
                                    href={item.url}
                                    prefetch
                                    aria-current={active ? 'page' : undefined}
                                    className={cn(
                                        'flex min-w-max items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                                        active
                                            ? 'border-primary/30 bg-accent text-accent-foreground'
                                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground border-transparent',
                                    )}
                                >
                                    {item.icon && (
                                        <span
                                            className={cn(
                                                'flex size-8 shrink-0 items-center justify-center rounded-md',
                                                active ? 'bg-primary text-primary-foreground' : 'bg-muted',
                                            )}
                                        >
                                            <item.icon className="size-4" />
                                        </span>
                                    )}
                                    <span className="grid leading-tight">
                                        <span className="font-medium">{item.title}</span>
                                        <span className="text-muted-foreground hidden text-xs lg:block">{item.description}</span>
                                    </span>
                                </Link>
                            );
                        })}
                    </nav>
                </aside>

                <div className="min-w-0 flex-1 lg:max-w-3xl">
                    <section className="space-y-6">{children}</section>
                </div>
            </div>
        </div>
    );
}

/** Tarjeta donde va cada bloque de ajustes (formulario, avisos…). */
export function SettingsCard({ className, children }: { className?: string; children: React.ReactNode }) {
    return <div className={cn('surface space-y-6 rounded-xl p-6', className)}>{children}</div>;
}
