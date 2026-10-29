/**
 * Grupo de opciones del menú lateral (ej: "Plataforma" con Dashboard).
 * Sin `label` se dibuja sin título (así se usa en el pie del menú: Mi perfil, Apariencia).
 * Las opciones con `permission` se ocultan si el usuario no lo tiene; si no queda ninguna, no se dibuja el grupo.
 * Los efectos al pasar el mouse están en app.css → .nav-item
 */
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { useCan } from '@/hooks/use-can';
import { cn } from '@/lib/utils';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';

const navButtonClass =
    'nav-item h-9 text-[13px] hover:text-white data-[active=true]:font-medium [&>svg]:size-[18px] [&>svg]:opacity-80 hover:[&>svg]:opacity-100 data-[active=true]:[&>svg]:opacity-100';

export function NavMain({ items, label, className }: { items: NavItem[]; label?: string; className?: string }) {
    // page.url = URL actual. Se usa para marcar la opción activa
    const page = usePage();
    const can = useCan();
    const visible = items.filter((item) => !item.permission || can(item.permission));

    if (visible.length === 0) return null;

    return (
        <SidebarGroup className={cn('px-2 py-1', className)}>
            {label && (
                <SidebarGroupLabel className="text-sidebar-foreground/50 gap-2 text-[11px] font-semibold tracking-wider uppercase">
                    {label}
                    <span className="bg-sidebar-border h-px flex-1" />
                </SidebarGroupLabel>
            )}
            <SidebarMenu className="gap-0.5">
                {visible.map((item) => (
                    <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                            asChild
                            isActive={page.url.startsWith(item.url)}
                            tooltip={{ children: item.title }}
                            className={navButtonClass}
                        >
                            <Link href={item.url} prefetch>
                                {item.icon && <item.icon />}
                                <span>{item.title}</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}
