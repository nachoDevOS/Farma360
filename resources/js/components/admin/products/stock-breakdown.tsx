/**
 * STOCK DESGLOSADO bajo el número, para contar el estante: "= 2 cajas + 8 blísteres + 7 tabletas".
 * No muestra nada si no hay qué desglosar (sin stock o menos que el empaque más chico).
 * Lo usan Inventario, Productos y la ficha del producto.
 *
 *   <StockBreakdown units={287} product={product} />
 */
import { stockBreakdown } from '@/components/admin/products/presentation-levels';
import { cn } from '@/lib/utils';
import { type Product } from '@/types/admin/pharmacy';

export function StockBreakdown({
    units,
    product,
    className,
}: {
    units: number;
    product: Pick<Product, 'presentations' | 'base_unit'>;
    className?: string;
}) {
    const text = stockBreakdown(units, product.presentations ?? [], product.base_unit);
    if (!text) return null;
    return <span className={cn('text-foreground/80 block text-xs font-normal whitespace-normal', className)}>= {text}</span>;
}
