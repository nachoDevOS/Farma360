/**
 * AYUDANTES DE LOS GRÁFICOS hechos a mano (inventory/stock-charts.tsx, products/product-charts.tsx).
 *   useWidth()   → ancho real del contenedor, para dibujar en píxeles sin deformar las líneas
 *   niceMax(110) → 120: máximo "redondo" del eje, con 4 divisiones limpias
 *   compact(1500)→ "1,5K"
 *   shortDay('2026-10-30') → "30 oct"
 *   <ChartCard title="…" description="…">…</ChartCard> → tarjeta con título de un gráfico
 */
import { formatDay } from '@/lib/format';
import { useLayoutEffect, useRef, useState } from 'react';

/** Ancho real del contenedor (los gráficos se dibujan en píxeles para que las líneas no se deformen). */
export function useWidth<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [width, setWidth] = useState(0);
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
        observer.observe(element);
        setWidth(element.getBoundingClientRect().width);
        return () => observer.disconnect();
    }, []);
    return [ref, width] as const;
}

/** Máximo "redondo" para el eje (4 divisiones con números limpios). */
export function niceMax(value: number): number {
    if (value <= 4) return 4;
    const step = Math.pow(10, Math.floor(Math.log10(value / 4)));
    // Pasos finos (110 → 120, no 200) para no dejar aire de más arriba
    const nice = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * step).find((s) => s * 4 >= value) ?? step * 10;
    return nice * 4;
}

export const compact = (n: number) =>
    Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString('es', { maximumFractionDigits: 1 })}K` : n.toLocaleString('es');
export const shortDay = (date: string) => formatDay(date).replace(/ \d{4}$/, '');

/** Tarjeta de un gráfico: título, descripción y el gráfico. */
export function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
    return (
        <div className="surface min-w-0 rounded-xl">
            <div className="border-b px-5 py-4">
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-muted-foreground text-xs">{description}</p>
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}
