/**
 * DETALLE DE UN PRODUCTO: el desplegable de la lista (pages/admin/products/index.tsx) y las tablas que
 * también usa la ficha completa (pages/admin/products/show.tsx).
 *
 *   <ProductRowDetail product={product} />                      → desplegable de la fila (3 bloques)
 *   <PresentationsTable product={product} unitCost={0.35} />     → presentaciones; con unitCost agrega la ganancia
 *   <BranchStockTable product={product} inventoryLink />         → stock por sucursal; con enlace a sus lotes
 */
import { Detail } from '@/components/admin/common/data-table';
import { plural } from '@/components/admin/products/presentation-levels';
import { StockBreakdown } from '@/components/admin/products/stock-breakdown';
import { formatDate, formatDay, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Presentation, type Product } from '@/types/admin/pharmacy';
import { Link } from '@inertiajs/react';
import { Check, Minus } from 'lucide-react';

export function ProductRowDetail({ product }: { product: Product }) {
    return (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Block title="Presentaciones">
                <PresentationsTable product={product} />
            </Block>

            <Block title="Stock por sucursal">
                <BranchStockTable product={product} />
            </Block>

            <Block title="Datos">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    <Detail label="Código de barras">{product.barcode || '—'}</Detail>
                    <Detail label="Registro sanitario">{product.health_registry || '—'}</Detail>
                    <Detail label="Unidad base">{product.base_unit}</Detail>
                    <Detail label="Venta">
                        <SaleType product={product} />
                    </Detail>
                    <div className="col-span-2">
                        <Detail label="Para qué sirve">
                            <span className="font-normal">{product.description || '—'}</span>
                        </Detail>
                    </div>
                    <Detail label="Registrado por">
                        <RegisteredBy product={product} />
                    </Detail>
                    <Detail label="Fecha de registro">{product.created_at ? formatDate(product.created_at) : '—'}</Detail>
                    <Detail label="Última modificación">{product.updated_at ? formatDate(product.updated_at) : '—'}</Detail>
                </div>
            </Block>
        </div>
    );
}

/** "10 blísteres", "10 tabletas" o "Unidad base". */
function containsText(product: Product, p: Presentation): string {
    if (!p.parent_id) return 'Unidad base';
    const inner = product.presentations.find((other) => other.id === p.parent_id);
    return `${p.contains} ${plural(inner?.parent_id ? inner.package : product.base_unit)}`;
}

const th = 'py-1.5 pr-3 text-[10px] font-semibold tracking-wider uppercase';

/**
 * Presentaciones del producto. Con unitCost (costo de una unidad base en la última compra) agrega
 * el costo de cada presentación y la ganancia sobre el precio de venta.
 */
export function PresentationsTable({ product, unitCost, className }: { product: Product; unitCost?: number | null; className?: string }) {
    const withCost = unitCost !== undefined && unitCost !== null;
    return (
        <div className="overflow-x-auto">
            <table className={cn('w-full text-xs', className)}>
                <thead className="text-muted-foreground">
                    <tr className="border-b">
                        <th className={cn(th, 'text-left')}>Presentación</th>
                        <th className={cn(th, 'text-left')}>Contiene</th>
                        <th className={cn(th, 'text-right')}>Unidades</th>
                        <th className={cn(th, 'text-right')}>Precio</th>
                        <th className={cn(th, 'text-right')}>c/{product.base_unit.toLowerCase()}</th>
                        {withCost && <th className={cn(th, 'text-right')}>Costo</th>}
                        {withCost && <th className={cn(th, 'text-right')}>Ganancia</th>}
                        <th className={cn(th, 'text-center')}>Vende</th>
                        <th className={cn(th, 'text-center')}>Compra</th>
                        <th className={cn(th, 'pr-0 text-left')}>Código</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {product.presentations.map((p) => {
                        const price = p.is_sellable && p.sale_price ? Number(p.sale_price) : null;
                        const cost = withCost ? unitCost * p.factor : null;
                        const margin = price && cost !== null ? ((price - cost) / price) * 100 : null;
                        return (
                            <tr key={p.id}>
                                <td className="py-1.5 pr-3 font-medium">{p.name}</td>
                                <td className="text-muted-foreground py-1.5 pr-3">{containsText(product, p)}</td>
                                <td className="num py-1.5 pr-3 text-right">{p.factor}</td>
                                <td className="num py-1.5 pr-3 text-right">{price !== null ? money(price) : '—'}</td>
                                <td className="num text-muted-foreground py-1.5 pr-3 text-right">{price !== null ? money(price / p.factor) : '—'}</td>
                                {withCost && <td className="num text-muted-foreground py-1.5 pr-3 text-right">{money(cost)}</td>}
                                {withCost && (
                                    <td
                                        className={cn(
                                            'num py-1.5 pr-3 text-right font-medium',
                                            margin !== null && (margin < 0 ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400'),
                                        )}
                                    >
                                        {margin !== null ? `${margin.toFixed(1)}%` : '—'}
                                    </td>
                                )}
                                <td className="py-1.5 pr-3">
                                    <YesNo value={p.is_sellable} />
                                </td>
                                <td className="py-1.5 pr-3">
                                    <YesNo value={p.is_purchasable} />
                                </td>
                                <td className="text-muted-foreground py-1.5">{p.barcode || '—'}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

/** Stock por sucursal (lotes con stock). inventoryLink: enlace a los lotes y kardex de cada sucursal. */
export function BranchStockTable({ product, inventoryLink, className }: { product: Product; inventoryLink?: boolean; className?: string }) {
    const stocks = product.branch_stock ?? [];
    const total = stocks.reduce((sum, s) => sum + s.stock, 0);

    return (
        <div>
            {stocks.length === 0 ? (
                <p className="text-muted-foreground text-xs">Sin stock en ninguna sucursal.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className={cn('w-full text-xs', className)}>
                        <thead className="text-muted-foreground">
                            <tr className="border-b">
                                <th className={cn(th, 'text-left')}>Sucursal</th>
                                <th className={cn(th, 'text-right')}>Stock</th>
                                <th className={cn(th, 'text-right')}>Lotes</th>
                                <th className={cn(th, inventoryLink ? 'text-right' : 'pr-0 text-right')}>Vence</th>
                                {inventoryLink && <th className={cn(th, 'pr-0')} />}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {stocks.map((s) => (
                                <tr key={s.branch_id}>
                                    <td className="py-1.5 pr-3 font-medium">{s.branch ?? '—'}</td>
                                    <td className={cn('num py-1.5 pr-3 text-right', s.stock <= product.min_stock && 'font-semibold text-red-600')}>
                                        {s.stock.toLocaleString('es')}
                                        <StockBreakdown units={s.stock} product={product} />
                                    </td>
                                    <td className="num py-1.5 pr-3 text-right">{s.batches}</td>
                                    <td
                                        className={cn(
                                            'py-1.5 text-right whitespace-nowrap',
                                            inventoryLink && 'pr-3',
                                            expiresSoon(s.next_expiry) && 'font-semibold text-red-600',
                                        )}
                                    >
                                        {formatDay(s.next_expiry)}
                                    </td>
                                    {inventoryLink && (
                                        <td className="py-1.5 text-right whitespace-nowrap">
                                            <Link
                                                href={route('admin.inventory.show', { product: product.id, branch: s.branch_id })}
                                                className="text-primary hover:underline"
                                            >
                                                Ver lotes
                                            </Link>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <p className="text-muted-foreground mt-2 text-xs">
                Total <span className="text-foreground num font-semibold">{total.toLocaleString('es')}</span> {plural(product.base_unit)} · mínimo por
                sucursal <span className="num">{product.min_stock.toLocaleString('es')}</span>
            </p>
        </div>
    );
}

/** Libre · Con receta · Controlado */
export function SaleType({ product }: { product: Product }) {
    if (product.is_controlled) return <span className="text-red-600">Controlado</span>;
    if (product.requires_prescription) return <span className="text-amber-600">Con receta</span>;
    return <>Libre</>;
}

/** "Juan Pérez · Administrador" */
export function RegisteredBy({ product }: { product: Product }) {
    return (
        <>
            {product.registered_by?.name ?? '—'}
            {product.registerRole && <span className="text-muted-foreground font-normal"> · {product.registerRole}</span>}
        </>
    );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-card min-w-0 rounded-lg border p-3">
            <p className="mb-2 text-xs font-semibold">{title}</p>
            {children}
        </div>
    );
}

function YesNo({ value }: { value: boolean }) {
    return value ? (
        <Check className="mx-auto size-4 text-emerald-600" aria-label="Sí" />
    ) : (
        <Minus className="text-muted-foreground mx-auto size-4" aria-label="No" />
    );
}

/** Vencido o vence en 30 días o menos. */
function expiresSoon(date: string | null): boolean {
    if (!date) return false;
    const [y, m, d] = date.split('-').map(Number);
    return (new Date(y, m - 1, d).getTime() - Date.now()) / 86_400_000 <= 30;
}
