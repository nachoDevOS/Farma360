/**
 * TIPOS DEL MÓDULO DE ROLES (pages/admin/roles y components/admin/roles).
 * Los datos los envía app/Http/Controllers/Admin/RoleController.php
 */

/** Una fila de la lista de roles. */
export interface RoleSummary {
    id: number;
    name: string;
    users_count: number;
    permissions_count: number;
    /** El Super Admin tiene todo y no se puede editar ni eliminar */
    is_super_admin: boolean;
}

/** Filtros de la lista de roles (viajan en la URL). */
export interface RoleFilters {
    search?: string;
    /** Registros por página ("Mostrar N registros"): 10, 15, 25, 50 o 100 */
    per_page?: string;
}

/** Rol que se está editando (null en el formulario de "Nuevo rol"). */
export interface RoleDetail {
    id: number;
    name: string;
    permissions: string[];
    users_count: number;
}

/** Un módulo del catálogo (fila de la tabla de permisos). Viene de config/roles.php */
export interface PermissionModule {
    key: string;
    label: string;
    description: string;
    /** Acciones que tiene este módulo, ej: ['ver', 'crear', 'editar'] */
    actions: string[];
}

/** Catálogo completo: nombres de las acciones (columnas) + módulos (filas). */
export interface PermissionCatalog {
    actions: Record<string, string>;
    modules: PermissionModule[];
}
