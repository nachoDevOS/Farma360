/**
 * Barra de la tabla de auditoría (se usa en pages/admin/activity/index.tsx).
 * Usa la barra común TableToolbar ("Mostrar N registros" + buscador) y le suma el filtro por tipo de acción.
 */
import { ALL, TableToolbar } from '@/components/admin/common/table-toolbar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type ActivityFilters } from '@/types/admin/activity';

interface ActivityToolbarProps {
    filters: ActivityFilters;
    /** Grupos disponibles, vienen de ActivityLog::GROUPS en Laravel. Ej: { auth: 'Accesos' } */
    groups: Record<string, string>;
    onFilter: (changes: Partial<ActivityFilters>) => void;
}

export function ActivityToolbar({ filters, groups, onFilter }: ActivityToolbarProps) {
    return (
        <TableToolbar
            perPage={Number(filters.per_page ?? 15)}
            onPerPageChange={(n) => onFilter({ per_page: String(n) })}
            search={filters.search ?? ''}
            onSearch={(search) => onFilter({ search })}
            searchPlaceholder="Buscar por descripción, usuario o IP..."
        >
            <Select value={filters.group ?? ALL} onValueChange={(group) => onFilter({ group })}>
                <SelectTrigger className="h-9 w-44">
                    <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL}>Todas las acciones</SelectItem>
                    {Object.entries(groups).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                            {label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </TableToolbar>
    );
}
