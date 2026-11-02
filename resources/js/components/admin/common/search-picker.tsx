/**
 * BUSCADOR CON SUGERENCIAS: escribe → pide resultados a Laravel (JSON) → eliges uno.
 * Lo usan compras, transferencias, punto de venta y clientes.
 *
 * Uso:
 *   <SearchPicker<ProductLookup>
 *       url={(q) => route('admin.products.search', { q, branch_id })}
 *       onPick={(item) => addItem(item)}
 *       renderItem={(item) => <span>{item.product_name}</span>}
 *       itemKey={(item) => item.presentation_id}
 *   />
 *
 * Busca 300 ms después de dejar de escribir (no con cada letra). Enter elige el primero
 * (útil con lector de código de barras, que "escribe" el código y presiona Enter).
 *
 * Para agrupar lo que llega (ej: un producto con sus presentaciones) usar mapResults; renderItem recibe
 * pick para que un botón dentro del resultado elija algo distinto: renderItem={(group, pick) => …}.
 */
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { LoaderCircle, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface SearchPickerProps<T, R = T> {
    url: (query: string) => string;
    onPick: (item: T) => void;
    /** pick: para elegir desde un botón dentro del resultado (cierra la lista igual que un clic en la fila) */
    renderItem: (item: T, pick: (item: T) => void) => React.ReactNode;
    /** Convierte lo que responde Laravel antes de mostrarlo (ej: agrupar presentaciones por producto) */
    mapResults?: (data: R[]) => T[];
    itemKey: (item: T) => string | number;
    placeholder?: string;
    /** Mínimo de letras para buscar */
    minLength?: number;
    className?: string;
    /** Clases extra para la lista de resultados (ej: más alto si cada resultado ocupa varias líneas) */
    listClassName?: string;
    autoFocus?: boolean;
    /** Para enfocar el buscador desde afuera (ej: después de agregar un producto) */
    inputRef?: React.Ref<HTMLInputElement>;
    /** Clases extra del campo (ej: más alto en el punto de venta) */
    inputClassName?: string;
}

export function SearchPicker<T, R = T>({
    url,
    onPick,
    renderItem,
    mapResults,
    itemKey,
    placeholder = 'Buscar…',
    minLength = 2,
    className,
    listClassName,
    autoFocus,
    inputRef,
    inputClassName,
}: SearchPickerProps<T, R>) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<T[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const request = useRef(0);

    useEffect(() => {
        const text = query.trim();
        if (text.length < minLength) {
            setResults([]);
            return;
        }
        const id = ++request.current;
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const response = await fetch(url(text), { headers: { Accept: 'application/json' } });
                const raw = response.ok ? ((await response.json()) as R[]) : [];
                const data = mapResults ? mapResults(raw) : (raw as unknown as T[]);
                // Solo la última búsqueda cuenta (si escribiste más rápido que la respuesta)
                if (id === request.current) {
                    setResults(data);
                    setActive(0);
                    setOpen(true);
                }
            } finally {
                if (id === request.current) setLoading(false);
            }
        }, 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query]);

    const pick = (item: T) => {
        onPick(item);
        setQuery('');
        setResults([]);
        setOpen(false);
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (results[active]) pick(results[active]);
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    return (
        <div className={cn('relative', className)}>
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                onFocus={() => results.length > 0 && setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                placeholder={placeholder}
                className={cn('h-10 pr-9 pl-9', inputClassName)}
                autoFocus={autoFocus}
                autoComplete="off"
            />
            {loading && <LoaderCircle className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />}
            {open && query.trim().length >= minLength && !loading && (
                <div
                    role="listbox"
                    className={cn(
                        'bg-popover text-popover-foreground absolute z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-md border shadow-lg',
                        listClassName,
                    )}
                >
                    {results.length === 0 ? (
                        <p className="text-muted-foreground px-3 py-4 text-center text-sm">Sin resultados</p>
                    ) : (
                        results.map((item, i) => (
                            // div y no button: el resultado puede tener sus propios botones adentro (renderItem con pick)
                            <div
                                role="option"
                                aria-selected={i === active}
                                key={itemKey(item)}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => pick(item)}
                                onMouseEnter={() => setActive(i)}
                                className={cn('block w-full cursor-pointer px-3 py-2 text-left text-sm', i === active && 'bg-muted')}
                            >
                                {renderItem(item, pick)}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
