/**
 * Barra de la tabla de usuarios (se usa en pages/admin/users/index.tsx).
 * Usa la barra común TableToolbar ("Mostrar N registros" + buscador) y le suma los filtros de rol y estado.
 */
import { ALL, TableToolbar } from '@/components/admin/common/table-toolbar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type UserFilters } from '@/types/admin/users';

interface UsersToolbarProps {
    filters: UserFilters;
    roles: string[];
    onFilter: (changes: Partial<UserFilters>) => void;
}

export function UsersToolbar({ filters, roles, onFilter }: UsersToolbarProps) {
    return (
        <TableToolbar
            perPage={Number(filters.per_page ?? 10)}
            onPerPageChange={(n) => onFilter({ per_page: String(n) })}
            search={filters.search ?? ''}
            onSearch={(search) => onFilter({ search })}
            searchPlaceholder="Buscar por nombre o correo..."
        >
            <Select value={filters.role ?? ALL} onValueChange={(role) => onFilter({ role })}>
                <SelectTrigger className="h-9 w-40">
                    <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL}>Todos los roles</SelectItem>
                    {roles.map((role) => (
                        <SelectItem key={role} value={role}>
                            {role}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select value={filters.status ?? ALL} onValueChange={(status) => onFilter({ status })}>
                <SelectTrigger className="h-9 w-36">
                    <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL}>Todos los estados</SelectItem>
                    <SelectItem value="active">Activos</SelectItem>
                    <SelectItem value="inactive">Inactivos</SelectItem>
                </SelectContent>
            </Select>
        </TableToolbar>
    );
}
