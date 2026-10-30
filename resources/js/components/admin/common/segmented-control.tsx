/**
 * CONTROL SEGMENTADO: botones pegados para elegir UNA opción. Sirve de pestañas de una ficha
 * (Lotes · Movimientos · Gráficos) o de selector chico (Últimos 30 / 90 días).
 *
 *   <SegmentedControl
 *       label="Secciones"
 *       options={[{ value: 'lotes', label: 'Lotes', count: 3 }, { value: 'kardex', label: 'Movimientos' }]}
 *       value={tab}
 *       onChange={setTab}
 *   />
 *
 * count: número chico al lado del texto (ej: cuántos lotes hay).
 */
import { cn } from '@/lib/utils';

interface Option<T extends string | number> {
    value: T;
    label: string;
    count?: number;
}

export function SegmentedControl<T extends string | number>({
    options,
    value,
    onChange,
    label,
    className,
}: {
    options: Option<T>[];
    value: T;
    onChange: (value: T) => void;
    /** Nombre del grupo para lectores de pantalla */
    label: string;
    className?: string;
}) {
    return (
        <div role="tablist" aria-label={label} className={cn('bg-muted inline-flex flex-wrap rounded-md p-0.5', className)}>
            {options.map((option) => {
                const active = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded px-3 py-1 text-[13px] font-medium transition-colors',
                            active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {option.label}
                        {option.count !== undefined && (
                            <span className={cn('num rounded px-1.5 text-[11px]', active ? 'bg-muted' : 'bg-background/60')}>{option.count}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
