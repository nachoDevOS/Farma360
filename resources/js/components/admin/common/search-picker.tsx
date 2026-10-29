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
 */
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { LoaderCircle, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface SearchPickerProps<T> {
    url: (query: string) => string;
    onPick: (item: T) => void;
    renderItem: (item: T) => React.ReactNode;
    itemKey: (item: T) => string | number;
    placeholder?: string;
    /** Mínimo de letras para buscar */
    minLength?: number;
    className?: string;
    autoFocus?: boolean;
    /** Para enfocar el buscador desde afuera (ej: después de agregar un producto) */
    inputRef?: React.Ref<HTMLInputElement>;
}

export function SearchPicker<T>({
    url,
    onPick,
    renderItem,
    itemKey,
    placeholder = 'Buscar…',
    minLength = 2,
    className,
    autoFocus,
    inputRef,
}: SearchPickerProps<T>) {
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
                const data = response.ok ? ((await response.json()) as T[]) : [];
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
                className="h-10 pr-9 pl-9"
                autoFocus={autoFocus}
                autoComplete="off"
            />
            {loading && <LoaderCircle className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />}
            {open && query.trim().length >= minLength && !loading && (
                <div className="bg-popover text-popover-foreground absolute z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-md border shadow-lg">
                    {results.length === 0 ? (
                        <p className="text-muted-foreground px-3 py-4 text-center text-sm">Sin resultados</p>
                    ) : (
                        results.map((item, i) => (
                            <button
                                type="button"
                                key={itemKey(item)}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => pick(item)}
                                onMouseEnter={() => setActive(i)}
                                className={cn('block w-full px-3 py-2 text-left text-sm', i === active && 'bg-muted')}
                            >
                                {renderItem(item)}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
