/**
 * Pieza del Dashboard (se usa en pages/admin/dashboard.tsx).
 */
import { cn } from '@/lib/utils';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

export interface Kpi {
    label: string;
    value: number;
    /** Texto chico debajo del número */
    hint: string;
    /** Variación en % contra el período anterior (opcional) */
    trend?: number | null;
    /** Proporción 0–100 que se dibuja como barra fina (opcional) */
    ratio?: number;
}

// Divisores entre celdas: 1 columna en móvil, 2 en tablet, 4 en escritorio
const cellBorders = ['', 'border-t sm:border-t-0 sm:border-l', 'border-t xl:border-t-0 xl:border-l', 'border-t sm:border-l xl:border-t-0'];

/** Franja de indicadores: una sola tarjeta dividida en celdas, una por métrica. */
export function KpiStrip({ items }: { items: Kpi[] }) {
    return (
        <div className="surface grid overflow-hidden rounded-xl sm:grid-cols-2 xl:grid-cols-4">
            {items.map((kpi, i) => (
                <div key={kpi.label} className={cn('flex flex-col gap-3 p-5', cellBorders[i])}>
                    <p className="text-muted-foreground text-sm">{kpi.label}</p>
                    <div className="flex items-baseline gap-2.5">
                        <p className="font-display num text-3xl leading-none font-semibold">{kpi.value.toLocaleString('es')}</p>
                        {kpi.trend !== undefined && kpi.trend !== null && <Trend value={kpi.trend} />}
                    </div>
                    {kpi.ratio !== undefined ? (
                        <div className="space-y-1.5">
                            <div className="bg-muted h-1 overflow-hidden rounded-full">
                                <div className="bg-primary h-full rounded-full" style={{ width: `${kpi.ratio}%` }} />
                            </div>
                            <p className="text-muted-foreground text-xs">{kpi.hint}</p>
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-xs">{kpi.hint}</p>
                    )}
                </div>
            ))}
        </div>
    );
}

/** Variación porcentual: verde si sube, rojo si baja. */
function Trend({ value }: { value: number }) {
    const up = value >= 0;
    return (
        <span
            className={cn(
                'num inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium',
                up ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-500/10 text-red-700 dark:text-red-400',
            )}
        >
            {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(value)}%
        </span>
    );
}
