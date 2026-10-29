/**
 * PIEZAS DE TABLA con el mismo estilo que la tabla de usuarios.
 *
 *   <DataTable head={<><Th>Producto</Th><Th align="right">Total</Th></>}>
 *       {rows.map((r) => <tr key={r.id}><Td>…</Td><Td align="right">…</Td></tr>)}
 *       {rows.length === 0 && <EmptyRow colSpan={2} text="No hay ventas." />}
 *   </DataTable>
 */
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';

export function DataTable({ head, children, className }: { head: React.ReactNode; children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('overflow-x-auto', className)}>
            <table className="w-full text-[13px]">
                <thead className="text-muted-foreground bg-muted/60 border-b text-left text-[11px] font-semibold tracking-wider uppercase">
                    <tr>{head}</tr>
                </thead>
                <tbody className="[&>tr:hover]:bg-muted/50 divide-y [&>tr]:transition-colors">{children}</tbody>
            </table>
        </div>
    );
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
            <td colSpan={colSpan} className="px-4 py-14 text-center">
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
