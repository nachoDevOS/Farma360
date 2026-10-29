/**
 * Pieza de Gestión de usuarios (se usa en pages/admin/users/index.tsx).
 */
import { cn } from '@/lib/utils';
import { type UserFilters } from '@/types/admin/users';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

/** Título de columna clickeable que ordena la tabla (muestra ↑ / ↓). */
export function SortHeader({
    label,
    column,
    filters,
    onSort,
}: {
    label: string;
    column: string;
    filters: UserFilters;
    onSort: (column: string) => void;
}) {
    // ¿Esta columna es la que está ordenando ahora? (por defecto: fecha de registro)
    const active = (filters.sort ?? 'created_at') === column;
    // Ícono: ↕ si no está activa, ↑ ascendente, ↓ descendente
    const Icon = !active ? ArrowUpDown : (filters.direction ?? 'desc') === 'asc' ? ArrowUp : ArrowDown;
    return (
        <button onClick={() => onSort(column)} className={cn('hover:text-foreground inline-flex items-center gap-1 uppercase', active && 'text-foreground')}>
            {label}
            <Icon className={cn('size-3.5', !active && 'opacity-50')} />
        </button>
    );
}
