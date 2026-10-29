/**
 * PÁGINA: Roles y permisos (ruta /admin/roles).
 * Los datos los envía app/Http/Controllers/Admin/RoleController.php (método index).
 * PAGINACIÓN DEL LADO DEL SERVIDOR: la tabla recibe solo la página pedida (igual que Usuarios).
 * Las piezas visuales están en components/admin/roles/.
 */
import { DataTable, EmptyRow, Td, Th } from '@/components/admin/common/data-table';
import { PageHeader } from '@/components/admin/common/page-header';
import { ActionButton, RowActions } from '@/components/admin/common/row-actions';
import { TableToolbar } from '@/components/admin/common/table-toolbar';
import { DeleteRoleDialog } from '@/components/admin/roles/delete-role-dialog';
import { Pagination } from '@/components/shared/pagination';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { useFilters } from '@/hooks/use-filters';
import AdminLayout from '@/layouts/admin/admin-layout';
import { type BreadcrumbItem, type Paginated } from '@/types';
import { type RoleFilters, type RoleSummary } from '@/types/admin/roles';
import { Head, Link, router } from '@inertiajs/react';
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Administración', href: '/admin/roles' },
    { title: 'Roles y permisos', href: '/admin/roles' },
];

interface Props {
    roles: Paginated<RoleSummary>;
    filters: RoleFilters;
    /** Cuántos permisos existen en total (para mostrar "5 de 10") */
    totalPermissions: number;
}

export default function RolesIndex({ roles, filters, totalPermissions }: Props) {
    const can = useCan();
    const [deleting, setDeleting] = useState<RoleSummary | null>(null);
    const showActions = can('roles.editar') || can('roles.eliminar');
    // Cambia los filtros de la URL y Laravel devuelve la página pedida
    const applyFilters = useFilters('admin.roles.index', filters);

    return (
        <AdminLayout breadcrumbs={breadcrumbs}>
            <Head title="Roles y permisos" />
            <div className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                <PageHeader
                    icon={ShieldCheck}
                    title="Roles y permisos"
                    description="Cada usuario tiene un rol. El rol decide qué pantallas ve y qué acciones puede hacer."
                    actions={
                        can('roles.crear') && (
                            <Button asChild className="btn-brand">
                                <Link href={route('admin.roles.create')}>
                                    <Plus /> Nuevo rol
                                </Link>
                            </Button>
                        )
                    }
                />

                <div className="surface overflow-hidden rounded-xl">
                    <TableToolbar
                        perPage={Number(filters.per_page ?? 10)}
                        onPerPageChange={(n) => applyFilters({ per_page: String(n) })}
                        search={filters.search ?? ''}
                        onSearch={(search) => applyFilters({ search })}
                        searchPlaceholder="Buscar rol…"
                    />

                    <DataTable
                        head={
                            <>
                                <Th>Rol</Th>
                                <Th>Usuarios</Th>
                                <Th>Permisos</Th>
                                {showActions && <Th align="right">Acciones</Th>}
                            </>
                        }
                    >
                        {roles.data.map((role) => {
                            const ratio = totalPermissions ? Math.round((role.permissions_count / totalPermissions) * 100) : 0;
                            return (
                                <tr key={role.id}>
                                    <Td>
                                        <div className="min-w-0">
                                            <p className="truncate font-medium">{role.name}</p>
                                            {role.is_super_admin && (
                                                <p className="text-muted-foreground text-xs">Acceso total. No se puede editar ni eliminar.</p>
                                            )}
                                        </div>
                                    </Td>
                                    <Td>
                                        {/* Enlace a Usuarios filtrado por este rol */}
                                        {can('usuarios.ver') ? (
                                            <Link
                                                href={route('admin.users.index', { role: role.name })}
                                                className="num hover:text-primary font-medium hover:underline"
                                            >
                                                {role.users_count} {role.users_count === 1 ? 'usuario' : 'usuarios'}
                                            </Link>
                                        ) : (
                                            <span className="num">
                                                {role.users_count} {role.users_count === 1 ? 'usuario' : 'usuarios'}
                                            </span>
                                        )}
                                    </Td>
                                    <Td>
                                        {/* Barra con la proporción de permisos que tiene el rol */}
                                        <div className="flex items-center gap-3">
                                            <div className="bg-muted h-1.5 w-24 overflow-hidden rounded-full">
                                                <div className="bg-primary h-full rounded-full" style={{ width: `${ratio}%` }} />
                                            </div>
                                            <span className="text-muted-foreground num text-xs">
                                                {role.permissions_count} de {totalPermissions}
                                            </span>
                                        </div>
                                    </Td>
                                    {showActions && (
                                        <Td>
                                            <RowActions>
                                                {can('roles.editar') && (
                                                    <ActionButton
                                                        icon={Pencil}
                                                        label="Editar permisos"
                                                        onClick={() => router.visit(route('admin.roles.edit', role.id))}
                                                        disabled={role.is_super_admin}
                                                        disabledReason="El Super Admin siempre tiene todos los permisos"
                                                    />
                                                )}
                                                {can('roles.eliminar') && (
                                                    <ActionButton
                                                        icon={Trash2}
                                                        label="Eliminar"
                                                        tone="danger"
                                                        onClick={() => setDeleting(role)}
                                                        disabled={role.is_super_admin || role.users_count > 0}
                                                        disabledReason={
                                                            role.is_super_admin
                                                                ? 'El Super Admin no se puede eliminar'
                                                                : 'Tiene usuarios asignados: cámbiales el rol primero'
                                                        }
                                                    />
                                                )}
                                            </RowActions>
                                        </Td>
                                    )}
                                </tr>
                            );
                        })}
                        {roles.data.length === 0 && <EmptyRow colSpan={showActions ? 4 : 3} text="No hay roles con esa búsqueda." />}
                    </DataTable>

                    <Pagination paginator={roles} itemName="roles" />
                </div>
            </div>

            <DeleteRoleDialog role={deleting} onClose={() => setDeleting(null)} />
        </AdminLayout>
    );
}
