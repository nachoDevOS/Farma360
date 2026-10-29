/**
 * Pieza del Dashboard (se usa en pages/admin/dashboard.tsx).
 */
import { type MonthlyRegistration } from '@/types/admin/dashboard';
import { useState } from 'react';

/**
 * Gráfico de barras por mes (HTML + CSS, sin librerías).
 * El mes actual va en azul fuerte, el resto en azul suave. Línea punteada = promedio.
 * Al pasar el mouse sobre una columna se muestra el detalle.
 */
export function RegistrationsChart({ data }: { data: MonthlyRegistration[] }) {
    const [hover, setHover] = useState<number | null>(null);

    const max = Math.max(4, ...data.map((d) => d.total));
    // Máximo redondeado a múltiplo de 4 para que las líneas guía sean números enteros
    const niceMax = Math.ceil(max / 4) * 4;
    const ticks = [4, 3, 2, 1, 0].map((i) => (niceMax / 4) * i);
    const average = data.length ? data.reduce((s, d) => s + d.total, 0) / data.length : 0;
    const peak = data.reduce((best, d, i) => (d.total > (data[best]?.total ?? -1) ? i : best), 0);
    const current = data.length - 1;
    const pct = (n: number) => (n / niceMax) * 100;

    return (
        <div className="flex gap-3">
            {/* Eje Y */}
            <div className="text-muted-foreground num relative h-56 w-6 shrink-0 text-right text-[11px]">
                {ticks.map((t) => (
                    <span key={t} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: `${100 - pct(t)}%` }}>
                        {t}
                    </span>
                ))}
            </div>

            <div className="min-w-0 flex-1">
                <div className="relative h-56" onMouseLeave={() => setHover(null)}>
                    {/* Líneas guía */}
                    {ticks.map((t) => (
                        <div
                            key={t}
                            className={`absolute inset-x-0 border-t ${t === 0 ? 'border-foreground/25' : 'border-border/70 border-dashed'}`}
                            style={{ top: `${100 - pct(t)}%` }}
                        />
                    ))}

                    {/* Promedio */}
                    {average > 0 && (
                        <div
                            className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-amber-500/80"
                            style={{ top: `${100 - pct(average)}%` }}
                        >
                            <span className="bg-card text-muted-foreground num absolute right-0 -translate-y-1/2 rounded px-1.5 text-[11px]">
                                Prom. {average.toFixed(1)}
                            </span>
                        </div>
                    )}

                    {/* Columnas */}
                    <div className="absolute inset-0 flex items-end gap-1.5 sm:gap-2.5">
                        {data.map((d, i) => {
                            const isCurrent = i === current;
                            const showLabel = (isCurrent || i === peak) && d.total > 0;
                            const prev = data[i - 1]?.total;
                            return (
                                <div
                                    key={d.month + i}
                                    className="group relative flex h-full flex-1 cursor-default items-end justify-center"
                                    onMouseEnter={() => setHover(i)}
                                >
                                    {/* Fondo de la columna al pasar el mouse */}
                                    <div
                                        className={`bg-muted absolute inset-x-0 inset-y-0 rounded-md transition-opacity ${hover === i ? 'opacity-100' : 'opacity-0'}`}
                                    />
                                    <div
                                        className={`relative w-full max-w-10 rounded-t-[4px] transition-[height,background-color] duration-500 ease-out ${
                                            isCurrent ? 'bg-primary' : hover === i ? 'bg-primary/70' : 'bg-primary/35'
                                        }`}
                                        style={{ height: `${pct(d.total)}%`, minHeight: d.total > 0 ? 3 : 0 }}
                                    >
                                        {showLabel && hover !== i && (
                                            <span className="num text-foreground absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] font-semibold">
                                                {d.total}
                                            </span>
                                        )}
                                    </div>

                                    {/* Detalle al pasar el mouse */}
                                    {hover === i && (
                                        <div
                                            className="bg-popover text-popover-foreground pointer-events-none absolute z-20 w-max rounded-md border px-2.5 py-1.5 text-xs shadow-md"
                                            style={{ bottom: `calc(${pct(d.total)}% + 8px)` }}
                                        >
                                            <p className="text-muted-foreground">
                                                {d.month}
                                                {isCurrent && ' · mes actual'}
                                            </p>
                                            <p className="num font-semibold">
                                                {d.total}{' '}
                                                <span className="text-muted-foreground font-normal">{d.total === 1 ? 'registro' : 'registros'}</span>
                                            </p>
                                            {prev !== undefined && (
                                                <p className="text-muted-foreground num">
                                                    {d.total === prev
                                                        ? 'Igual que el mes anterior'
                                                        : `${d.total > prev ? '+' : ''}${d.total - prev} vs. mes anterior`}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Eje X */}
                <div className="mt-2 flex gap-1.5 sm:gap-2.5">
                    {data.map((d, i) => (
                        <span
                            key={d.month + i}
                            className={`flex-1 text-center text-[11px] ${i === current ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}
                        >
                            {d.month}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
