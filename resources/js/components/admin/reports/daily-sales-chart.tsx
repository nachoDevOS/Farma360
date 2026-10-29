/**
 * GRÁFICO "Ventas por día" (pages/admin/reports/index.tsx). HTML + CSS, sin librerías.
 *
 * Muestra TODOS los días del rango (los días sin ventas quedan como una rayita gris), así se ve
 * el ritmo real del negocio. Encima de cada barra va el monto; al pasar el mouse, el detalle.
 * Con rangos muy largos (más de 62 días) solo se muestran los días con ventas.
 */
import { formatDay, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface Day {
    day: string;
    count: number;
    total: number;
}

/** Lista de fechas "Y-m-d" desde `from` hasta `to` (inclusive). */
function daysBetween(from: string, to: string): string[] {
    const days: string[] = [];
    const [y1, m1, d1] = from.split('-').map(Number);
    const [y2, m2, d2] = to.split('-').map(Number);
    const cursor = new Date(y1, m1 - 1, d1);
    const end = new Date(y2, m2 - 1, d2);
    while (cursor <= end && days.length <= 62) {
        days.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`);
        cursor.setDate(cursor.getDate() + 1);
    }
    return days;
}

const short = (n: number) => (n >= 1000 ? `${(n / 1000).toLocaleString('es', { maximumFractionDigits: 1 })}k` : Math.round(n).toLocaleString('es'));

export function DailySalesChart({ data, from, to }: { data: Day[]; from: string; to: string }) {
    const [hover, setHover] = useState<string | null>(null);
    const byDay = new Map(data.map((d) => [d.day.slice(0, 10), d]));
    const range = daysBetween(from, to);
    const days: Day[] = range.length > 62 ? data : range.map((day) => byDay.get(day) ?? { day, count: 0, total: 0 });
    const max = Math.max(1, ...days.map((d) => d.total));
    const total = data.reduce((s, d) => s + d.total, 0);
    const best = data.reduce<Day | null>((b, d) => (!b || d.total > b.total ? d : b), null);
    const current = hover ? days.find((d) => d.day === hover) : null;

    if (data.length === 0) {
        return <p className="text-muted-foreground p-10 text-center text-sm">Sin ventas en el período.</p>;
    }

    return (
        <div className="grid gap-4 p-5">
            {/* Línea de resumen: cambia al pasar el mouse por una barra */}
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
                {current ? (
                    <>
                        <span className="font-medium">{formatDay(current.day)}</span>
                        <span className="num">
                            {money(current.total)} <span className="text-muted-foreground">· {current.count} ventas</span>
                        </span>
                    </>
                ) : (
                    <>
                        <span className="num">
                            <span className="text-muted-foreground">Promedio por día con ventas </span>
                            <span className="font-medium">{money(total / data.length)}</span>
                        </span>
                        {best && (
                            <span className="num">
                                <span className="text-muted-foreground">Mejor día </span>
                                <span className="font-medium">
                                    {formatDay(best.day)} · {money(best.total)}
                                </span>
                            </span>
                        )}
                    </>
                )}
            </div>

            <div className="flex h-52 items-end gap-1 overflow-x-auto pt-5" onMouseLeave={() => setHover(null)}>
                {days.map((d) => {
                    const empty = d.total === 0;
                    const isBest = best?.day === d.day;
                    return (
                        <div
                            key={d.day}
                            className="flex h-full min-w-6 flex-1 flex-col items-center justify-end gap-1.5"
                            onMouseEnter={() => setHover(d.day)}
                        >
                            {!empty && (
                                <span className={cn('num text-[10px] font-medium', hover === d.day ? 'text-foreground' : 'text-muted-foreground')}>
                                    {short(d.total)}
                                </span>
                            )}
                            <div
                                className={cn(
                                    'w-full max-w-9 rounded-t-md transition-colors',
                                    empty ? 'bg-muted h-1 rounded-md' : hover === d.day ? 'bg-primary' : isBest ? 'bg-primary/90' : 'bg-primary/55',
                                )}
                                style={empty ? undefined : { height: `${Math.max(4, (d.total / max) * 100)}%` }}
                            />
                            <span className={cn('num text-[10px]', hover === d.day ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
                                {d.day.slice(8, 10)}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
