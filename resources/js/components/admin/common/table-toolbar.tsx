/**
 * BARRA DE ARRIBA DE LAS TABLAS: "Mostrar [10] registros" + filtros a la izquierda, buscador a la derecha.
 * La usa Usuarios; cualquier tabla nueva puede usarla igual.
 *
 * Uso:
 *   <TableToolbar
 *       perPage={Number(filters.per_page ?? 10)}
 *       onPerPageChange={(n) => applyFilters({ per_page: String(n) })}
 *       search={filters.search ?? ''}
 *       onSearch={(search) => applyFilters({ search })}
 *       searchPlaceholder="Buscar..."
 *   >
 *       ...selectores de filtro propios de la tabla (opcional)...
 *   </TableToolbar>
 *
 * Todo se resuelve en el SERVIDOR (Laravel): la tabla solo recibe la página que se está viendo.
 *
 * BUSCADOR: no busca con cada letra. Busca cuando:
 *   - se presiona Enter, o
 *   - se deja de escribir durante SEARCH_DELAY (3 segundos). Si se sigue escribiendo, la cuenta vuelve a empezar.
 */
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CornerDownLeft, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/** Opciones de "Mostrar N registros". Deben coincidir con PER_PAGE_OPTIONS en app/Http/Controllers/Controller.php */
export const PER_PAGE_OPTIONS = [10, 15, 25, 50, 100];

/** Milisegundos sin escribir antes de buscar solo (3 segundos). */
const SEARCH_DELAY = 3000;

/** Valor de la opción "Todos" en los selectores de filtro (significa: sin filtro). */
export const ALL = 'all';

interface TableToolbarProps {
    perPage: number;
    onPerPageChange: (perPage: number) => void;
    /** Búsqueda actual (la que ya se aplicó, viene de los filtros de la URL) */
    search: string;
    /** Se llama al presionar Enter o tras 3 s sin escribir, con el texto a buscar */
    onSearch: (value: string) => void;
    searchPlaceholder?: string;
    /** Filtros propios de cada tabla (ej: rol, estado) */
    children?: React.ReactNode;
}

export function TableToolbar({ perPage, onPerPageChange, search, onSearch, searchPlaceholder = 'Buscar...', children }: TableToolbarProps) {
    // Lo que el usuario está escribiendo (todavía no buscado)
    const [text, setText] = useState(search);
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Si la búsqueda cambia desde afuera (ej: al volver atrás en el navegador), el campo se actualiza
    useEffect(() => setText(search), [search]);

    // Espera 3 s sin escribir; cada letra nueva reinicia la espera
    useEffect(() => {
        if (text === search) return;
        timer.current = setTimeout(() => onSearch(text.trim()), SEARCH_DELAY);
        return () => clearTimeout(timer.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text]);

    // Enter: busca al instante (cancela la espera)
    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        clearTimeout(timer.current);
        if (text.trim() !== search) onSearch(text.trim());
    };

    const pending = text.trim() !== search;

    return (
        <div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Izquierda: cuántos registros mostrar + filtros */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <span>Mostrar</span>
                    <Select value={String(perPage)} onValueChange={(value) => onPerPageChange(Number(value))}>
                        <SelectTrigger className="h-9 w-[4.5rem]" aria-label="Registros por página">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PER_PAGE_OPTIONS.map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                    {n}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <span>registros</span>
                </div>
                {children}
            </div>

            {/* Derecha: buscador (busca con Enter o tras 3 s sin escribir) */}
            <div className="relative w-full lg:w-80">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={searchPlaceholder}
                    className="h-9 pr-16 pl-9"
                    aria-label="Buscar (presiona Enter)"
                />
                {/* Aviso "Enter" mientras hay texto sin buscar */}
                {pending && (
                    <kbd className="text-muted-foreground bg-muted pointer-events-none absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium">
                        Enter <CornerDownLeft className="size-3" />
                    </kbd>
                )}
            </div>
        </div>
    );
}
