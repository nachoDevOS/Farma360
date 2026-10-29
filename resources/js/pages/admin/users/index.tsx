import { PageHeader } from '@/components/admin/common/page-header';
import { ALL } from '@/components/admin/common/table-toolbar';
import { DeleteUserDialog } from '@/components/admin/users/delete-user-dialog';
import { UserFormDialog } from '@/components/admin/users/user-form-dialog';
import { UsersTable } from '@/components/admin/users/users-table';
import { UsersToolbar } from '@/components/admin/users/users-toolbar';
import { Pagination } from '@/components/shared/pagination';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import AdminLayout from '@/layouts/admin/admin-layout';
import { type BreadcrumbItem, type Paginated, type User } from '@/types';
import { type UserFilters } from '@/types/admin/users';
import { Head, router } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';

/*
 * PÁGINA: Gestión de usuarios  (ruta /admin/users, solo administradores)
 * Los datos (props) los envía app/Http/Controllers/Admin/UserController.php -> index()
 * Las piezas visuales están en components/admin/users/.
 */

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Administración', href: '/admin/users' },
    { title: 'Usuarios', href: '/admin/users' },
];

interface Props {
    users: Paginated<User>;
    filters: UserFilters;
    /** Nombres de todos los roles (para el filtro) */
    roles: string[];
    /** Roles que el usuario logueado puede asignar en el formulario */
    assignableRoles: string[];
    /** Sucursales para el formulario */
    branches: { id: number; name: string }[];
}

export default function UsersIndex({ users, filters, roles, assignableRoles, branches }: Props) {
    // Permisos del usuario logueado: deciden qué botones se muestran
    const can = useCan();
    // Estado local de la pantalla (lo que el usuario está haciendo ahora mismo)
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<User | null>(null);
    const [deleting, setDeleting] = useState<User | null>(null);

    // Cambia los filtros de la URL y Laravel devuelve la lista filtrada
    const applyFilters = (changes: Partial<UserFilters>) => {
        const next = { ...filters, ...changes };
        const query = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined && v !== '' && v !== ALL));
        router.get(route('admin.users.index'), query, { preserveState: true, preserveScroll: true, replace: true });
    };

    const sortBy = (column: string) => {
        const direction = filters.sort === column && filters.direction === 'asc' ? 'desc' : 'asc';
        applyFilters({ sort: column, direction });
    };

    const openCreate = () => {
        setEditing(null);
        setFormOpen(true);
    };

    const openEdit = (user: User) => {
        setEditing(user);
        setFormOpen(true);
    };

    const toggleActive = (user: User) => router.patch(route('admin.users.toggle', user.id), {}, { preserveScroll: true });

    return (
        <AdminLayout breadcrumbs={breadcrumbs}>
            <Head title="Usuarios" />
            <div className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                {/* Título + botones */}
                <PageHeader
                    title="Usuarios"
                    description={`${users.total} cuentas registradas. Administra roles, estados y accesos.`}
                    actions={
                        <>
                            {can('usuarios.crear') && (
                                <Button onClick={openCreate} size="sm" className="btn-brand">
                                    <Plus /> Nuevo usuario
                                </Button>
                            )}
                        </>
                    }
                />

                {/* Buscador + tabla + paginación */}
                <div className="surface overflow-hidden rounded-xl">
                    <UsersToolbar filters={filters} roles={roles} onFilter={applyFilters} />
                    <UsersTable
                        users={users.data}
                        filters={filters}
                        onSort={sortBy}
                        onEdit={openEdit}
                        onToggle={toggleActive}
                        onDelete={setDeleting}
                    />
                    <Pagination paginator={users} itemName="usuarios" />
                </div>
            </div>

            {/* Ventanas modales (se muestran solo cuando hacen falta) */}
            <UserFormDialog open={formOpen} onClose={() => setFormOpen(false)} user={editing} roles={assignableRoles} branches={branches} />
            <DeleteUserDialog user={deleting} onClose={() => setDeleting(null)} />
        </AdminLayout>
    );
}
