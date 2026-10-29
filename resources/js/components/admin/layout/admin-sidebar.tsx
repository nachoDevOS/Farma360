/**
 * MENÚ LATERAL del panel. Para agregar una opción, súmala a una de estas listas.
 * Íconos disponibles: https://lucide.dev/icons
 *
 * permission: la opción solo aparece para quien tiene ese permiso (config/roles.php).
 * Si un grupo se queda sin opciones visibles, el grupo entero no se muestra.
 */
import { NavMain } from '@/components/admin/layout/nav-main';
import { NavUser } from '@/components/admin/layout/nav-user';
import AppLogo from '@/components/shared/app-logo';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import { History, LayoutGrid, Palette, Settings, ShieldCheck, Users } from 'lucide-react';

// Grupo "Plataforma": lo ve todo usuario logueado
const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        url: '/dashboard',
        icon: LayoutGrid,
    },
];

// Grupo "Administración": cada opción pide su permiso
const adminNavItems: NavItem[] = [
    {
        title: 'Usuarios',
        url: '/admin/users',
        icon: Users,
        permission: 'usuarios.ver',
    },
    {
        title: 'Roles y permisos',
        url: '/admin/roles',
        icon: ShieldCheck,
        permission: 'roles.ver',
    },
    {
        title: 'Auditoría',
        url: '/admin/activity',
        icon: History,
        permission: 'auditoria.ver',
    },
];

// Enlaces de abajo del menú
const footerNavItems: NavItem[] = [
    {
        title: 'Mi perfil',
        url: '/settings/profile',
        icon: Settings,
    },
    {
        title: 'Apariencia',
        url: '/settings/appearance',
        icon: Palette,
    },
];

export function AdminSidebar() {
    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            size="lg"
                            asChild
                            className="group-data-[collapsible=icon]:overflow-visible group-data-[collapsible=icon]:p-0! hover:bg-transparent"
                        >
                            <Link href="/dashboard" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain label="Plataforma" items={mainNavItems} />
                <NavMain label="Administración" items={adminNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavMain items={footerNavItems} className="mt-auto" />
                {/* Botón del usuario (abre Ajustes / Cerrar sesión) */}
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
