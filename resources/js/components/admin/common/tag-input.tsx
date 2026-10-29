/**
 * CAMPO DE ETIQUETAS: se escribe una palabra o frase y con Enter (o coma) queda como etiqueta.
 * Sugiere las que ya existen mientras escribes y muestra atajos para agregar las más comunes con un clic.
 *
 *   <TagInput value={data.indications} onChange={(v) => setData('indications', v)} suggestions={['Fiebre', 'Tos seca']} />
 *
 * Las etiquetas nuevas se crean en el servidor al guardar (ver Indication::idsFor).
 */
import { cn } from '@/lib/utils';
import { Plus, X } from 'lucide-react';
import { useId, useState } from 'react';

interface TagInputProps {
    value: string[];
    onChange: (value: string[]) => void;
    /** Etiquetas que ya existen (se sugieren al escribir) */
    suggestions?: string[];
    /** Cuántas sugerencias mostrar como atajo debajo del campo (0 = ninguna) */
    quickPicks?: number;
    placeholder?: string;
    id?: string;
    invalid?: boolean;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function TagInput({
    value,
    onChange,
    suggestions = [],
    quickPicks = 8,
    placeholder = 'Escribe y presiona Enter…',
    id,
    invalid,
}: TagInputProps) {
    const [text, setText] = useState('');
    const listId = useId();

    const add = (raw: string) => {
        const tag = raw.trim().replace(/\s+/g, ' ');
        if (!tag || value.some((v) => same(v, tag))) return setText('');
        // Si ya existe con otras mayúsculas, se usa como está escrita en el catálogo
        onChange([...value, suggestions.find((s) => same(s, tag)) ?? tag]);
        setText('');
    };

    const remove = (tag: string) => onChange(value.filter((v) => v !== tag));

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(text);
        } else if (e.key === 'Backspace' && text === '' && value.length > 0) {
            remove(value[value.length - 1]);
        }
    };

    const available = suggestions.filter((s) => !value.some((v) => same(v, s)));

    return (
        <div className="grid gap-2">
            <div
                className={cn(
                    'border-input bg-card focus-within:border-ring focus-within:ring-ring/20 dark:bg-background/60 flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5 shadow-xs transition-[border-color,box-shadow] focus-within:ring-3',
                    invalid && 'border-destructive',
                )}
            >
                {value.map((tag) => (
                    <span
                        key={tag}
                        className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-xs font-medium"
                    >
                        {tag}
                        <button
                            type="button"
                            onClick={() => remove(tag)}
                            className="hover:bg-primary/15 rounded-full p-0.5"
                            aria-label={`Quitar ${tag}`}
                        >
                            <X className="size-3" />
                        </button>
                    </span>
                ))}
                <input
                    id={id}
                    list={listId}
                    value={text}
                    onChange={(e) => {
                        // Elegir una opción de la lista del navegador la agrega de una vez
                        const next = e.target.value;
                        if (available.some((s) => s === next)) add(next);
                        else setText(next);
                    }}
                    onKeyDown={onKeyDown}
                    onBlur={() => add(text)}
                    placeholder={value.length === 0 ? placeholder : ''}
                    className="placeholder:text-muted-foreground min-w-32 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
                />
                <datalist id={listId}>
                    {available.map((s) => (
                        <option key={s} value={s} />
                    ))}
                </datalist>
            </div>

            {quickPicks > 0 && available.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {available.slice(0, quickPicks).map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => add(s)}
                            className="text-muted-foreground hover:border-primary/40 hover:text-primary inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-0.5 text-xs transition-colors"
                        >
                            <Plus className="size-3" /> {s}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
