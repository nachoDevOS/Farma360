/**
 * TIPOS GENERALES: describen la "forma" de los datos que llegan de Laravel.
 * TypeScript los usa para avisarte si escribes mal un campo (ej: user.nmae).
 */
import { LucideIcon } from 'lucide-react';

/**
 * Usuario logueado + sus permisos (lo envía HandleInertiaRequests.php).
 * permissions = lista del catálogo config/roles.php, ej: ['usuarios.ver', 'roles.ver'].
 * Para consultarlos usa el hook useCan() (hooks/use-can.ts), no esta lista directo.
 */
export interface Auth {
    user: User;
    permissions: string[];
}

/** Un paso de las "migas de pan" del header: Administración > Usuarios */
export interface BreadcrumbItem {
    title: string;
    href: string;
}

/** Un enlace del menú lateral (título, URL, ícono de lucide-react y permiso necesario para verlo). */
export interface NavItem {
    title: string;
    url: string;
    icon?: LucideIcon | null;
    /** Si se indica, la opción solo aparece para quien tiene ese permiso (ej: 'usuarios.ver') */
    permission?: string;
}

/** Avisos temporales de éxito / error que manda Laravel con ->with(). */
export interface Flash {
    success?: string | null;
    error?: string | null;
}

/** Datos que reciben TODAS las páginas. Uso: const { auth } = usePage<SharedData>().props; */
export interface SharedData {
    name: string;
    quote: { message: string; author: string };
    auth: Auth;
    flash: Flash;
    [key: string]: unknown;
}

/** Un usuario tal como llega desde Laravel (modelo App\Models\User). */
export interface User {
    id: number;
    name: string;
    email: string;
    /** Nombre del rol, ej: "Supervisor". Los roles se crean en Administración → Roles */
    role: string | null;
    is_active: boolean;
    /** Sucursal donde trabaja (null = todas) */
    branch_id: number | null;
    branch?: { id: number; name: string } | null;
    last_login_at: string | null;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown; // Permite que Laravel envíe campos extra sin que TypeScript se queje
}

/** Un botón de la paginación (1, 2, ›…). */
export interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

/** Resultado de ->paginate() de Laravel. T = tipo de cada fila (ej: Paginated<User>). */
export interface Paginated<T> {
    data: T[];
    links: PaginationLink[];
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
    total: number;
}
