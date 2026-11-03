/**
 * CUÁNTO QUEDA DE LO QUE ENTRÓ (un lote, lo de una compra): "30 de 30 tabletas", porcentaje, barra con color
 * (verde = bastante, ámbar = 25% o menos, gris = agotado) y en palabras qué pasó.
 *
 *   <StockLeft left={batch.stock} total={batch.received_quantity} unit="tableta" />
 *   <StockLeft left={24} total={30} unit="tableta" pkg={{ package: 'blíster', factor: 10 }} />  → "quedan 2 blísteres"… solo si da justo
 *
 * Dice "salieron" (no "se vendieron"): el stock también baja por transferencias, ajustes y bajas.
 */
import { countOf, plural } from '@/components/admin/products/presentation-levels';
import { cn } from '@/lib/utils';

export function StockLeft({
    left,
    total,
    unit,
    pkg = null,
    className,
}: {
    left: number;
    total: number;
    /** Unidad base en singular: "tableta" */
    unit: string;
    /** Empaque para decir "quedan 2 cajas" cuando lo que queda da justo */
    pkg?: { package: string; factor: number } | null;
    className?: string;
}) {
    const percent = total > 0 ? Math.min(100, (left / total) * 100) : 0;
    const out = Math.max(0, total - left);
    const tone = left === 0 ? 'empty' : percent <= 25 ? 'low' : 'ok';
    const packages = pkg && pkg.factor > 1 && left > 0 && left % pkg.factor === 0 ? countOf(left / pkg.factor, pkg.package) : null;

    return (
        <div className={cn('w-44 text-left text-xs', className)}>
            <div className="flex items-baseline justify-between gap-2">
                <span className="num">
                    <span className="text-foreground text-sm font-semibold">{left.toLocaleString('es')}</span>
                    <span className="text-muted-foreground">
                        {' '}
                        de {total.toLocaleString('es')} {total === 1 ? unit.toLowerCase() : plural(unit)}
                    </span>
                </span>
                <span
                    className={cn(
                        'num font-semibold',
                        tone === 'ok' && 'text-emerald-600 dark:text-emerald-400',
                        tone === 'low' && 'text-amber-600 dark:text-amber-400',
                        tone === 'empty' && 'text-muted-foreground',
                    )}
                >
                    {Math.round(percent)}%
                </span>
            </div>
            <div className="bg-muted mt-1 h-1.5 overflow-hidden rounded-full">
                <div
                    className={cn(
                        'h-full rounded-full transition-[width] duration-700 ease-out',
                        tone === 'ok' && 'bg-gradient-to-r from-emerald-500 to-teal-400',
                        tone === 'low' && 'bg-gradient-to-r from-amber-500 to-orange-400',
                    )}
                    style={{ width: `${percent}%` }}
                />
            </div>
            <p className="text-muted-foreground mt-1">
                {left === 0 ? (
                    <span className="font-medium">Agotado: salió todo</span>
                ) : out === 0 ? (
                    <>Nada salió aún{packages && <> · {packages}</>}</>
                ) : (
                    <>
                        Salieron <span className="num text-foreground/80 font-medium">{out.toLocaleString('es')}</span>
                        {packages && <> · quedan {packages}</>}
                    </>
                )}
            </p>
        </div>
    );
}
