/**
 * TIPOS DEL MÓDULO DE USUARIOS (pages/admin/users y components/admin/users).
 */

/** Filtros de la lista de usuarios. Viajan en la URL: /admin/users?search=ana&role=Supervisor */
export interface UserFilters {
    search?: string;
    role?: string;
    status?: string;
    sort?: string;
    direction?: 'asc' | 'desc';
    /** Registros por página ("Mostrar N registros"): 10, 15, 25, 50 o 100 */
    per_page?: string;
}

/** Campos del formulario para crear / editar un usuario. */
export type UserForm = {
    name: string;
    email: string;
    /** Nombre del rol elegido, ej: "Operador" */
    role: string;
    is_active: boolean;
    /** Sucursal donde trabaja ('' = todas) */
    branch_id: string;
    password: string;
    password_confirmation: string;
};
