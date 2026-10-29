/**
 * FILTROS DE UNA LISTA que viajan en la URL (?search=…&status=…&per_page=25).
 * Laravel los lee, filtra en la base de datos y devuelve la página pedida.
 *
 * Uso:
 *   const applyFilters = useFilters('admin.sales.index', filters);
 *   applyFilters({ status: 'anulada' });   // ALL o '' = quitar ese filtro
 */
import { ALL } from '@/components/admin/common/table-toolbar';
import { router } from '@inertiajs/react';
import { useCallback } from 'react';

export function useFilters<T extends object>(routeName: string, filters: T) {
    return useCallback(
        (changes: Partial<T>) => {
            const next = { ...filters, ...changes } as Record<string, unknown>;
            // Al cambiar un filtro se vuelve a la página 1
            delete next.page;
            const query = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== ALL));
            router.get(route(routeName), query as Record<string, string>, { preserveState: true, preserveScroll: true, replace: true });
        },
        [routeName, filters],
    );
}
