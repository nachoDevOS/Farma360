/**
 * PIEZAS DE TABLA con el mismo estilo que la tabla de usuarios.
 *
 *   <DataTable head={<><Th>Producto</Th><Th align="right">Total</Th></>}>
 *       {rows.map((r) => <tr key={r.id}><Td>…</Td><Td align="right">…</Td></tr>)}
 *       {rows.length === 0 && <EmptyRow colSpan={2} text="No hay ventas." />}
 *   </DataTable>
 *
 * EN CELULAR (menos de 768 px) cada fila se muestra como una tarjeta: la primera celda arriba (el nombre),
 * el resto como "ETIQUETA  valor" (la etiqueta sale sola de la cabecera) y los botones de acción abajo.
 * Las columnas con `hidden md:table-cell` no se muestran en celular. Los estilos están en app.css → .table-stack
 * stack={false}: la tabla se desplaza de costado en celular (útil en tablas con campos para escribir).
 */
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';

export function DataTable({
    head,
    children,
    className,
    stack = true,
}: {
    head: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    stack?: boolean;
}) {
    const tableRef = useRef<HTMLTableElement>(null);
    useStackedLabels(tableRef, stack);

    return (
        <div className={cn('overflow-x-auto', className)}>
            <table ref={tableRef} className={cn('w-full text-[13px]', stack && 'table-stack')}>
                <thead className="text-muted-foreground bg-muted/60 border-b text-left text-[11px] font-semibold tracking-wider uppercase">
                    <tr>{head}</tr>
                </thead>
                <tbody className="[&>tr:hover]:bg-muted/50 divide-y [&>tr]:transition-colors">{children}</tbody>
            </table>
        </div>
    );
}

/**
 * Copia el título de cada columna a sus celdas (data-label) para la vista de tarjetas en celular.
 * La columna "Acciones" (o sin título) queda sin etiqueta y sus botones van alineados a la derecha.
 * Sirve también para tablas hechas a mano: <table ref={ref} className="table-stack"> + useStackedLabels(ref).
 */
export function useStackedLabels(tableRef: React.RefObject<HTMLTableElement | null>, enabled = true) {
    useLayoutEffect(() => {
        const table = tableRef.current;
        if (!enabled || !table) return;

        const label = () => {
            const labels: string[] = [];
            table.querySelectorAll('thead tr:first-child th').forEach((th) => {
                const text = (th.textContent ?? '').trim();
                const value = /^acci/i.test(text) ? '' : text;
                for (let i = 0; i < (th as HTMLTableCellElement).colSpan; i++) labels.push(value);
            });
            table.querySelectorAll('tbody tr').forEach((tr) => {
                let column = 0;
                Array.from(tr.children).forEach((cell) => {
                    const text = labels[column] ?? '';
                    if (cell.getAttribute('data-label') !== text) cell.setAttribute('data-label', text);
                    column += (cell as HTMLTableCellElement).colSpan || 1;
                });
            });
        };

        label();
        // Si cambian las filas (filtros, paginación) se vuelven a etiquetar
        const observer = new MutationObserver(label);
        observer.observe(table, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [tableRef, enabled]);
}

type Align = 'left' | 'right' | 'center';
const alignClass: Record<Align, string> = { left: 'text-left', right: 'text-right', center: 'text-center' };

export function Th({ children, align = 'left', className }: { children?: React.ReactNode; align?: Align; className?: string }) {
    return <th className={cn('px-4 py-3 whitespace-nowrap', alignClass[align], className)}>{children}</th>;
}

export function Td({
    children,
    align = 'left',
    className,
    colSpan,
}: {
    children?: React.ReactNode;
    align?: Align;
    className?: string;
    colSpan?: number;
}) {
    return (
        <td colSpan={colSpan} className={cn('px-4 py-2.5', alignClass[align], align === 'right' && 'num whitespace-nowrap', className)}>
            {children}
        </td>
    );
}

export function EmptyRow({ colSpan, text = 'Sin resultados.' }: { colSpan: number; text?: string }) {
    return (
        <tr>
            <td colSpan={colSpan} className="px-4 py-14 text-center" data-empty>
                <div className="mx-auto flex max-w-xs flex-col items-center gap-2">
                    <div className="bg-muted flex size-11 items-center justify-center rounded-full">
                        <Search className="text-muted-foreground size-5" />
                    </div>
                    <p className="text-muted-foreground text-sm">{text}</p>
                </div>
            </td>
        </tr>
    );
}

/** Dato "etiqueta: valor" para las cabeceras de detalle (compra, venta, transferencia). */
export function Detail({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="min-w-0">
            <p className="text-muted-foreground text-xs">{label}</p>
            <div className="mt-0.5 text-sm font-medium">{children}</div>
        </div>
    );
}
