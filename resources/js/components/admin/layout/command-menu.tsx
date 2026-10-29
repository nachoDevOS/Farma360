/**
 * BUSCADOR RÁPIDO (Ctrl+K / ⌘K): salta a cualquier pantalla o busca usuarios por nombre o correo.
 * Para sumar una pantalla, agrégala a la lista `pages`.
 */
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useCan } from '@/hooks/use-can';
import { router } from '@inertiajs/react';
import {
    type LucideIcon,
    ArrowLeftRight,
    BadgePercent,
    BarChart3,
    Boxes,
    Building2,
    ClipboardList,
    Coins,
    Contact,
    FlaskConical,
    FlaskRound,
    History,
    KeyRound,
    LayoutGrid,
    Palette,
    Pill,
    Receipt,
    Search,
    ShieldCheck,
    ShoppingCart,
    Stethoscope,
    Tags,
    Truck,
    User,
    UserSearch,
    Users,
    Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface CommandItem {
    title: string;
    group: string;
    url: string;
    icon: LucideIcon;
    /** Solo aparece para quien tiene este permiso (config/roles.php) */
    permission?: string;
}

const pages: CommandItem[] = [
    { title: 'Dashboard', group: 'Plataforma', url: '/dashboard', icon: LayoutGrid },
    { title: 'Punto de venta', group: 'Ventas', url: '/admin/pos', icon: ShoppingCart, permission: 'ventas.crear' },
    { title: 'Mi caja', group: 'Ventas', url: '/admin/cash', icon: Wallet, permission: 'caja.ver' },
    { title: 'Turnos de caja', group: 'Ventas', url: '/admin/cash/sessions', icon: History, permission: 'caja.ver' },
    { title: 'Ventas', group: 'Ventas', url: '/admin/sales', icon: Receipt, permission: 'ventas.ver' },
    { title: 'Clientes', group: 'Ventas', url: '/admin/customers', icon: Contact, permission: 'clientes.ver' },
    { title: 'Productos', group: 'Inventario', url: '/admin/products', icon: Pill, permission: 'productos.ver' },
    { title: 'Inventario', group: 'Inventario', url: '/admin/inventory', icon: Boxes, permission: 'inventario.ver' },
    { title: 'Nueva compra', group: 'Inventario', url: '/admin/purchases/create', icon: ClipboardList, permission: 'compras.crear' },
    { title: 'Compras', group: 'Inventario', url: '/admin/purchases', icon: ClipboardList, permission: 'compras.ver' },
    { title: 'Transferencias', group: 'Inventario', url: '/admin/transfers', icon: ArrowLeftRight, permission: 'transferencias.ver' },
    { title: 'Promociones por vencimiento', group: 'Inventario', url: '/admin/promotions', icon: BadgePercent, permission: 'promociones.ver' },
    { title: 'Proveedores', group: 'Inventario', url: '/admin/suppliers', icon: Truck, permission: 'proveedores.ver' },
    { title: 'Categorías', group: 'Catálogo', url: '/admin/categories', icon: Tags, permission: 'productos.ver' },
    { title: 'Laboratorios', group: 'Catálogo', url: '/admin/laboratories', icon: FlaskRound, permission: 'productos.ver' },
    { title: 'Genéricos (principios activos)', group: 'Catálogo', url: '/admin/active-ingredients', icon: FlaskConical, permission: 'productos.ver' },
    { title: 'Usos y síntomas', group: 'Catálogo', url: '/admin/indications', icon: Stethoscope, permission: 'productos.ver' },
    { title: 'Reportes', group: 'Administración', url: '/admin/reports', icon: BarChart3, permission: 'reportes.ver' },
    { title: 'Sucursales', group: 'Administración', url: '/admin/branches', icon: Building2, permission: 'sucursales.ver' },
    { title: 'Cajas', group: 'Administración', url: '/admin/cash-registers', icon: Coins, permission: 'caja.editar' },
    { title: 'Billetes y monedas', group: 'Administración', url: '/admin/denominations', icon: Coins, permission: 'caja.editar' },
    { title: 'Usuarios', group: 'Administración', url: '/admin/users', icon: Users, permission: 'usuarios.ver' },
    { title: 'Roles y permisos', group: 'Administración', url: '/admin/roles', icon: ShieldCheck, permission: 'roles.ver' },
    { title: 'Mi perfil', group: 'Ajustes', url: '/settings/profile', icon: User },
    { title: 'Contraseña', group: 'Ajustes', url: '/settings/password', icon: KeyRound },
    { title: 'Apariencia', group: 'Ajustes', url: '/settings/appearance', icon: Palette },
];

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function CommandMenu() {
    const can = useCan();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    // Atajo de teclado global
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((o) => !o);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        const visible = pages.filter((p) => !p.permission || can(p.permission));
        const matched = q ? visible.filter((p) => `${p.title} ${p.group}`.toLowerCase().includes(q)) : visible;
        // Con texto escrito, quien puede ver usuarios lo puede buscar directo en Usuarios
        if (q && can('usuarios.ver')) {
            matched.push({
                title: `Buscar usuarios: “${query.trim()}”`,
                group: 'Usuarios',
                url: `/admin/users?search=${encodeURIComponent(query.trim())}`,
                icon: UserSearch,
            });
        }
        return matched;
    }, [query, can]);

    useEffect(() => setActive(0), [query]);

    useEffect(() => {
        listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [active]);

    const go = (item?: CommandItem) => {
        if (!item) return;
        setOpen(false);
        setQuery('');
        router.visit(item.url);
    };

    const onInputKey = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            go(results[active]);
        }
    };

    let lastGroup = '';

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 items-center gap-2 rounded-md border px-2.5 text-sm transition-colors sm:w-64"
                aria-label="Buscar"
            >
                <Search className="size-4 shrink-0" />
                <span className="hidden flex-1 text-left sm:inline">Buscar…</span>
                <kbd className="bg-background hidden rounded border px-1.5 font-sans text-[11px] font-medium sm:inline">{isMac ? '⌘' : 'Ctrl'} K</kbd>
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg [&>button:last-child]:hidden">
                    <DialogTitle className="sr-only">Buscador</DialogTitle>
                    <DialogDescription className="sr-only">Escribe para ir a una pantalla o buscar usuarios</DialogDescription>
                    <div className="flex items-center gap-2 border-b px-4">
                        <Search className="text-muted-foreground size-4 shrink-0" />
                        <input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={onInputKey}
                            placeholder="Ir a una pantalla o buscar usuarios…"
                            className="placeholder:text-muted-foreground h-12 flex-1 bg-transparent text-sm outline-none focus-visible:outline-none"
                        />
                        <kbd className="text-muted-foreground rounded border px-1.5 text-[11px] font-medium">Esc</kbd>
                    </div>
                    <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
                        {results.length === 0 && (
                            <p className="text-muted-foreground px-3 py-8 text-center text-sm">Sin resultados para “{query}”.</p>
                        )}
                        {results.map((item, i) => {
                            const showGroup = item.group !== lastGroup;
                            lastGroup = item.group;
                            return (
                                <div key={item.url}>
                                    {showGroup && <p className="text-muted-foreground px-2 pt-2 pb-1 text-xs font-medium">{item.group}</p>}
                                    <button
                                        type="button"
                                        data-index={i}
                                        onMouseMove={() => setActive(i)}
                                        onClick={() => go(item)}
                                        className="data-[active=true]:bg-accent data-[active=true]:text-accent-foreground flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm"
                                        data-active={i === active}
                                    >
                                        <item.icon className="size-4 shrink-0 opacity-70" />
                                        <span className="truncate">{item.title}</span>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    <div className="text-muted-foreground flex gap-4 border-t px-4 py-2 text-[11px]">
                        <span>↑↓ moverse</span>
                        <span>↵ abrir</span>
                        <span>Esc cerrar</span>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
