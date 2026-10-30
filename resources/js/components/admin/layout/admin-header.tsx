/**
 * BARRA SUPERIOR del panel: plegar menú, migas de pan, buscador (Ctrl+K), tema y menú del usuario.
 */
import { UserAvatar } from '@/components/admin/common/user-badges';
import { Breadcrumbs } from '@/components/admin/layout/breadcrumbs';
import { CommandMenu } from '@/components/admin/layout/command-menu';
import { UserMenuContent } from '@/components/admin/layout/user-menu-content';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAppearance } from '@/hooks/use-appearance';
import { type BreadcrumbItem as BreadcrumbItemType, type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { Moon, Sun } from 'lucide-react';

/** Botón ☀️ / 🌙 que cambia entre modo claro y oscuro. */
function ThemeToggle() {
    const { appearance, updateAppearance } = useAppearance();
    const isDark = appearance === 'dark' || (appearance === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    return (
        <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground size-8"
            onClick={() => updateAppearance(isDark ? 'light' : 'dark')}
            aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
            {isDark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </Button>
    );
}

/** Avatar del usuario arriba a la derecha: abre Ajustes / Cerrar sesión. */
function HeaderUser() {
    const { auth } = usePage<SharedData>().props;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="hover:bg-muted data-[state=open]:bg-muted flex items-center gap-2 rounded-full p-0.5 transition-colors md:rounded-md md:py-1 md:pr-2 md:pl-1"
                    aria-label="Menú del usuario"
                >
                    <UserAvatar name={auth.user.name} avatar={auth.user.avatar} className="size-7 text-[11px]" />
                    <span className="hidden max-w-32 truncate text-sm font-medium md:inline">{auth.user.name.split(' ')[0]}</span>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-56 rounded-lg" align="end">
                <UserMenuContent user={auth.user} />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function AdminHeader({ breadcrumbs = [] }: { breadcrumbs?: BreadcrumbItemType[] }) {
    return (
        <header className="bg-background/85 sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4 backdrop-blur-md md:rounded-t-xl">
            <div className="flex min-w-0 items-center gap-2">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground -ml-1" />
                <div className="bg-border mx-1 h-5 w-px" />
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>
            <div className="flex items-center gap-1.5">
                <CommandMenu />
                <ThemeToggle />
                <div className="bg-border mx-1 h-5 w-px" />
                <HeaderUser />
            </div>
        </header>
    );
}
