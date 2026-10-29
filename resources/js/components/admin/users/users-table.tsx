/**
 * Pieza de Gestión de usuarios (se usa en pages/admin/users/index.tsx).
 */
import { SUPER_ADMIN } from '@/components/admin/common/role-colors';
import { ActionButton, RowActions } from '@/components/admin/common/row-actions';
import { RoleBadge, StatusBadge, UserAvatar } from '@/components/admin/common/user-badges';
import { SortHeader } from '@/components/admin/users/sort-header';
import { useCan } from '@/hooks/use-can';
import { formatDate, relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type SharedData, type User } from '@/types';
import { type UserFilters } from '@/types/admin/users';
import { usePage } from '@inertiajs/react';
import { Pencil, Power, Search, Trash2 } from 'lucide-react';

interface UsersTableProps {
    users: User[];
    filters: UserFilters;
    onSort: (column: string) => void;
    onEdit: (user: User) => void;
    onToggle: (user: User) => void;
    onDelete: (user: User) => void;
}

/** Tabla con una fila por usuario y botones de acción (editar / activar / eliminar). */
export function UsersTable({ users, filters, onSort, onEdit, onToggle, onDelete }: UsersTableProps) {
    // Usuario logueado: para marcar "Tú" y bloquear acciones sobre uno mismo
    const { auth } = usePage<SharedData>().props;
    // Permisos: cada botón aparece solo si el rol lo permite
    const can = useCan();
    const iAmSuperAdmin = auth.user.role === SUPER_ADMIN;
    // ¿Muestro la columna de acciones? Solo si puede hacer al menos una
    const showActions = can('usuarios.editar') || can('usuarios.eliminar');
    // La cuenta de un Super Admin solo la puede tocar otro Super Admin (igual que UserPolicy en Laravel)
    const isProtected = (user: User) => user.role === SUPER_ADMIN && !iAmSuperAdmin;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
                <thead className="text-muted-foreground bg-muted/60 border-b text-left text-[11px] font-semibold tracking-wider uppercase [&_th]:py-2.5">
                    <tr>
                        <th className="px-4 py-3">
                            <SortHeader label="Usuario" column="name" filters={filters} onSort={onSort} />
                        </th>
                        <th className="px-4 py-3">Rol</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="hidden px-4 py-3 md:table-cell">
                            <SortHeader label="Último acceso" column="last_login_at" filters={filters} onSort={onSort} />
                        </th>
                        <th className="hidden px-4 py-3 lg:table-cell">
                            <SortHeader label="Registro" column="created_at" filters={filters} onSort={onSort} />
                        </th>
                        {showActions && <th className="px-4 py-3 text-right">Acciones</th>}
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {/* Una fila por usuario */}
                    {users.map((user) => (
                        <tr key={user.id} className={cn('hover:bg-muted/50 transition-colors', !user.is_active && 'opacity-60')}>
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <UserAvatar name={user.name} className="size-8" />
                                    <div className="min-w-0">
                                        <p className="text-foreground flex items-center gap-2 truncate font-medium">
                                            {user.name}
                                            {/* Etiqueta "Tú" en tu propia fila */}
                                            {user.id === auth.user.id && (
                                                <span className="text-muted-foreground bg-muted rounded px-1.5 text-[11px] font-medium">Tú</span>
                                            )}
                                        </p>
                                        <p className="text-muted-foreground truncate text-xs">
                                            {user.email}
                                            {!user.email_verified_at && <span className="ml-1">· sin verificar</span>}
                                        </p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-4 py-3">
                                <RoleBadge role={user.role} />
                            </td>
                            <td className="px-4 py-3">
                                <StatusBadge active={user.is_active} />
                            </td>
                            <td className="text-muted-foreground hidden px-4 py-3 whitespace-nowrap md:table-cell">
                                {relativeTime(user.last_login_at)}
                            </td>
                            <td className="text-muted-foreground num hidden px-4 py-3 whitespace-nowrap lg:table-cell">
                                {formatDate(user.created_at)}
                            </td>
                            {showActions && (
                                <td className="px-4 py-3 text-right">
                                    <RowActions>
                                        {can('usuarios.editar') && (
                                            <>
                                                <ActionButton
                                                    icon={Pencil}
                                                    label="Editar"
                                                    onClick={() => onEdit(user)}
                                                    disabled={isProtected(user)}
                                                    disabledReason="Solo un Super Admin puede modificar esta cuenta"
                                                />
                                                <ActionButton
                                                    icon={Power}
                                                    label={user.is_active ? 'Desactivar' : 'Activar'}
                                                    tone={user.is_active ? 'warning' : 'success'}
                                                    onClick={() => onToggle(user)}
                                                    disabled={user.id === auth.user.id || isProtected(user)}
                                                    disabledReason={
                                                        user.id === auth.user.id
                                                            ? 'No puedes desactivar tu propia cuenta'
                                                            : 'Solo un Super Admin puede modificar esta cuenta'
                                                    }
                                                />
                                            </>
                                        )}
                                        {can('usuarios.eliminar') && (
                                            <ActionButton
                                                icon={Trash2}
                                                label="Eliminar"
                                                tone="danger"
                                                onClick={() => onDelete(user)}
                                                disabled={user.id === auth.user.id || isProtected(user)}
                                                disabledReason={
                                                    user.id === auth.user.id
                                                        ? 'No puedes eliminar tu propia cuenta'
                                                        : 'Solo un Super Admin puede modificar esta cuenta'
                                                }
                                            />
                                        )}
                                    </RowActions>
                                </td>
                            )}
                        </tr>
                    ))}
                    {/* Mensaje cuando ningún usuario coincide con los filtros */}
                    {users.length === 0 && (
                        <tr>
                            <td colSpan={showActions ? 6 : 5} className="px-4 py-16 text-center">
                                <div className="mx-auto flex max-w-xs flex-col items-center gap-2">
                                    <div className="bg-muted flex size-12 items-center justify-center rounded-full">
                                        <Search className="text-muted-foreground size-5" />
                                    </div>
                                    <p className="font-medium">Sin resultados</p>
                                    <p className="text-muted-foreground text-sm">Ningún usuario coincide con los filtros aplicados.</p>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
