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
import {
    ArrowLeftRight,
    BadgePercent,
    BarChart3,
    Boxes,
    Building2,
    ClipboardList,
    Coins,
    Contact,
    LayoutGrid,
    Palette,
    Pill,
    Receipt,
    Settings,
    ShieldCheck,
    ShoppingCart,
    Truck,
    Users,
    Wallet,
} from 'lucide-react';

// Grupo "Plataforma": lo ve todo usuario logueado
const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        url: '/dashboard',
        icon: LayoutGrid,
    },
];

// Grupo "Ventas": el día a día del mostrador
const salesNavItems: NavItem[] = [
    { title: 'Punto de venta', url: '/admin/pos', icon: ShoppingCart, permission: 'ventas.crear' },
    { title: 'Mi caja', url: '/admin/cash', icon: Wallet, permission: 'caja.ver' },
    { title: 'Ventas', url: '/admin/sales', icon: Receipt, permission: 'ventas.ver' },
    { title: 'Clientes', url: '/admin/customers', icon: Contact, permission: 'clientes.ver' },
];

// Grupo "Inventario": productos, compras, stock, transferencias y promociones
const inventoryNavItems: NavItem[] = [
    { title: 'Productos', url: '/admin/products', icon: Pill, permission: 'productos.ver' },
    { title: 'Inventario', url: '/admin/inventory', icon: Boxes, permission: 'inventario.ver' },
    { title: 'Compras', url: '/admin/purchases', icon: ClipboardList, permission: 'compras.ver' },
    { title: 'Transferencias', url: '/admin/transfers', icon: ArrowLeftRight, permission: 'transferencias.ver' },
    { title: 'Promociones', url: '/admin/promotions', icon: BadgePercent, permission: 'promociones.ver' },
    { title: 'Proveedores', url: '/admin/suppliers', icon: Truck, permission: 'proveedores.ver' },
];

// Grupo "Administración": cada opción pide su permiso
const adminNavItems: NavItem[] = [
    { title: 'Reportes', url: '/admin/reports', icon: BarChart3, permission: 'reportes.ver' },
    { title: 'Sucursales', url: '/admin/branches', icon: Building2, permission: 'sucursales.ver' },
    { title: 'Cajas y billetes', url: '/admin/cash-registers', icon: Coins, permission: 'caja.editar' },
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
                <NavMain label="Ventas" items={salesNavItems} />
                <NavMain label="Inventario" items={inventoryNavItems} />
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
