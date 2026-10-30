/**
 * STOCK POR SUCURSAL, DETALLADO (pages/admin/products/show.tsx → pestaña "Stock por sucursal").
 * Datos: ProductController@show → product.branch_stock (stock, valor, lotes, vencimiento), branchLots (lotes con su
 * registro, BatchHistory) y performance.branches (vendido en 90 días y ritmo de venta).
 *
 *   <BranchStockDetail product={product} lots={branchLots} sales={performance.branches} selected={scope.branchId} … />
 *
 * Arriba, los totales. Una fila por sucursal: stock (con su desglose y en rojo si está bajo el mínimo), valor al costo,
 * lotes, próximo vencimiento, vendido en 90 días y para cuántos días alcanza. Cada sucursal se despliega con sus lotes
 * (origen, vencimiento, entró → queda, costo, valor, promoción) y cada lote con su registro completo (batch-detail.tsx).
 * Sin el permiso inventario.ver no llegan lotes: las filas no se despliegan.
 * Con una sucursal elegida arriba de la página (selected) muestra solo esa, con sus totales y sus lotes ya abiertos;
 * con "Todas", todas las sucursales. La página le pone key={sucursal} para que al cambiar se abra de nuevo.
 */
import { ExpiryBadge, PromoBadge } from '@/components/admin/common/doc-status';
import { BatchDetail, BatchOrigin, type BatchWithDetail } from '@/components/admin/inventory/batch-detail';
import { coverageTone, daysText, type Performance } from '@/components/admin/products/product-performance';
import { StockBreakdown } from '@/components/admin/products/stock-breakdown';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Product } from '@/types/admin/pharmacy';
import { Link, router } from '@inertiajs/react';
import { Boxes, CalendarClock, ChevronRight, Layers, type LucideIcon, Store, Wallet } from 'lucide-react';
import { Fragment, useState } from 'react';

const PILL = {
    slate: 'bg-muted text-foreground/70',
    red: 'bg-red-500/10 text-red-700 dark:text-red-400',
    amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    green: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
};

const th = 'text-muted-foreground px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase';

/** Abrir o cerrar un id en un conjunto (filas desplegadas). */
function useToggleSet(initial: number[]) {
    const [open, setOpen] = useState<Set<number>>(new Set(initial));
    const toggle = (id: number) =>
        setOpen((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    return [open, toggle] as const;
}

export function BranchStockDetail({
    product,
    lots,
    sales,
    selected,
    scopeLabel,
    units,
    movementTypes,
    inventoryLink,
}: {
    product: Product;
    /** Lotes con stock y su registro (vacío sin inventario.ver) */
    lots: BatchWithDetail[];
    /** Vendido en 90 días y ritmo de cada sucursal (Rendimiento) */
    sales: Performance['branches'];
    /** Sucursal elegida arriba de la página (null = todas) */
    selected: number | null;
    /** "Farmacia Central" / "todas las sucursales" */
    scopeLabel: string;
    units: string;
    movementTypes: Record<string, string>;
    /** Enlace "Ver en inventario" de cada sucursal */
    inventoryLink: boolean;
}) {
    const stocks = product.branch_stock ?? [];
    // Sucursales con stock, más las que venden y se quedaron sin stock (eso también hay que verlo)
    const allRows = [
        ...stocks,
        ...sales
            .filter((s) => s.units > 0 && !stocks.some((b) => b.branch_id === s.branch_id))
            .map((s) => ({ branch_id: s.branch_id, branch: s.branch, stock: 0, value: 0, batches: 0, next_expiry: null })),
    ];
    // Solo la sucursal elegida (o todas)
    const rows = selected ? allRows.filter((r) => r.branch_id === selected) : allRows;
    const [openBranches, toggleBranch] = useToggleSet(rows.length === 1 ? [rows[0].branch_id] : []);
    const [openLots, toggleLot] = useToggleSet([]);

    const totalStock = rows.reduce((sum, r) => sum + r.stock, 0);
    const totalValue = rows.reduce((sum, r) => sum + r.value, 0);
    const totalLots = rows.reduce((sum, r) => sum + r.batches, 0);
    const nextExpiry =
        rows
            .map((r) => r.next_expiry)
            .filter(Boolean)
            .sort()[0] ?? null;

    if (rows.length === 0) {
        return (
            <p className="text-muted-foreground p-5 text-sm">
                {selected ? `${scopeLabel} no tiene stock de este producto.` : 'Sin stock en ninguna sucursal.'}
            </p>
        );
    }

    return (
        <div className="grid gap-4 p-5">
            {/* Totales */}
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <Total icon={Boxes} label={selected ? `Stock · ${scopeLabel}` : 'Stock total'} value={`${totalStock.toLocaleString('es')} ${units}`}>
                    <StockBreakdown units={totalStock} product={product} />
                </Total>
                <Total icon={Wallet} label="Valor al costo" value={money(totalValue)}>
                    {totalStock > 0 && <span className="text-muted-foreground text-[11px]">Promedio {money(totalValue / totalStock)} c/u</span>}
                </Total>
                <Total icon={Layers} label="Lotes con stock" value={totalLots.toLocaleString('es')}>
                    <span className="text-muted-foreground text-[11px]">
                        {selected
                            ? scopeLabel
                            : `En ${rows.filter((r) => r.batches > 0).length} ${rows.filter((r) => r.batches > 0).length === 1 ? 'sucursal' : 'sucursales'}`}
                    </span>
                </Total>
                <Total icon={CalendarClock} label="Vence primero" value="">
                    <ExpiryBadge date={nextExpiry} />
                </Total>
            </div>

            <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-[13px]">
                    <thead className="bg-muted/40 border-b">
                        <tr>
                            <th className={th}>Sucursal</th>
                            <th className={cn(th, 'text-right')}>Stock</th>
                            <th className={cn(th, 'text-right')}>Valor al costo</th>
                            <th className={cn(th, 'text-right')}>Lotes</th>
                            <th className={th}>Vence primero</th>
                            <th className={cn(th, 'text-right')}>Vendido 90 días</th>
                            <th className={th}>Alcanza</th>
                            {inventoryLink && <th className={th} />}
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {rows.map((row) => {
                            const sale = sales.find((s) => s.branch_id === row.branch_id);
                            const coverage = sale && sale.daily_rate > 0 ? row.stock / sale.daily_rate : null;
                            const tone = coverage === null ? (row.stock > 0 && sale ? 'amber' : 'slate') : coverageTone(coverage);
                            const branchLots = lots.filter((l) => l.branch_id === row.branch_id);
                            const canOpen = branchLots.length > 0;
                            const isOpen = canOpen && openBranches.has(row.branch_id);
                            const low = product.min_stock > 0 && row.stock <= product.min_stock;
                            return (
                                <Fragment key={row.branch_id}>
                                    <tr className={cn(selected === row.branch_id && 'bg-primary/[0.05]', isOpen && 'bg-muted/40')}>
                                        <td className="px-3 py-2.5">
                                            {canOpen ? (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleBranch(row.branch_id)}
                                                    aria-expanded={isOpen}
                                                    aria-label={isOpen ? 'Ocultar lotes' : 'Ver lotes'}
                                                    className="hover:bg-muted -ml-1 inline-flex items-center gap-1.5 rounded-md py-1 pr-2 pl-1 text-left"
                                                >
                                                    <ChevronRight
                                                        className={cn(
                                                            'text-muted-foreground size-4 shrink-0 transition-transform',
                                                            isOpen && 'text-primary rotate-90',
                                                        )}
                                                    />
                                                    <BranchName name={row.branch} selected={selected === row.branch_id} />
                                                </button>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 pl-6">
                                                    <BranchName name={row.branch} selected={selected === row.branch_id} />
                                                </span>
                                            )}
                                        </td>
                                        <td className="num px-3 py-2.5 text-right">
                                            <span className={cn('font-semibold', low && 'text-red-600')}>{row.stock.toLocaleString('es')}</span>
                                            <StockBreakdown units={row.stock} product={product} />
                                            {low && <span className="block text-[11px] text-red-600">Bajo el mínimo ({product.min_stock})</span>}
                                        </td>
                                        <td className="num px-3 py-2.5 text-right">{money(row.value)}</td>
                                        <td className="num px-3 py-2.5 text-right">{row.batches}</td>
                                        <td className="px-3 py-2.5">
                                            <ExpiryBadge date={row.next_expiry} />
                                        </td>
                                        <td className="num px-3 py-2.5 text-right">
                                            {sale?.units ? (
                                                <>
                                                    {sale.units.toLocaleString('es')}
                                                    <span className="text-muted-foreground block text-[11px]">{money(sale.amount)}</span>
                                                </>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap', PILL[tone])}>
                                                {coverage !== null
                                                    ? daysText(coverage)
                                                    : row.stock === 0
                                                      ? 'Sin stock'
                                                      : sale
                                                        ? 'Sin ventas: stock quieto'
                                                        : 'Sin datos de ventas'}
                                            </span>
                                        </td>
                                        {inventoryLink && (
                                            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                                <Link
                                                    href={route('admin.inventory.show', { product: product.id, branch: row.branch_id })}
                                                    className="text-primary text-xs font-medium hover:underline"
                                                >
                                                    Ir al inventario
                                                </Link>
                                            </td>
                                        )}
                                    </tr>

                                    {/* Lotes de la sucursal */}
                                    {isOpen && (
                                        <tr className="bg-muted/40">
                                            <td colSpan={inventoryLink ? 8 : 7} className="px-3 pt-1 pb-4">
                                                <div className="bg-card overflow-x-auto rounded-lg border">
                                                    <table className="w-full text-[13px]">
                                                        <thead className="border-b">
                                                            <tr>
                                                                <th className={th}>Lote</th>
                                                                <th className={th}>Origen</th>
                                                                <th className={th}>Vence</th>
                                                                <th className={cn(th, 'text-right')}>Entró → Queda</th>
                                                                <th className={cn(th, 'text-right')}>Costo c/u</th>
                                                                <th className={cn(th, 'text-right')}>Valor</th>
                                                                <th className={th}>Promoción</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y">
                                                            {branchLots.map((lot) => {
                                                                const lotOpen = openLots.has(lot.id);
                                                                return (
                                                                    <Fragment key={lot.id}>
                                                                        <tr className={cn(lotOpen && 'bg-muted/30')}>
                                                                            <td className="px-3 py-2">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => toggleLot(lot.id)}
                                                                                    aria-expanded={lotOpen}
                                                                                    aria-label={
                                                                                        lotOpen
                                                                                            ? 'Ocultar registro del lote'
                                                                                            : 'Ver registro del lote'
                                                                                    }
                                                                                    className="hover:bg-muted -ml-1 inline-flex items-center gap-1 rounded-md py-1 pr-2 pl-1 whitespace-nowrap"
                                                                                >
                                                                                    <ChevronRight
                                                                                        className={cn(
                                                                                            'text-muted-foreground size-4 transition-transform',
                                                                                            lotOpen && 'text-primary rotate-90',
                                                                                        )}
                                                                                    />
                                                                                    <span className="num font-medium">{lot.batch_number}</span>
                                                                                </button>
                                                                            </td>
                                                                            <td className="px-3 py-2">
                                                                                <BatchOrigin batch={lot} />
                                                                            </td>
                                                                            <td className="px-3 py-2">
                                                                                <ExpiryBadge date={lot.expires_at} />
                                                                            </td>
                                                                            <td className="num px-3 py-2 text-right whitespace-nowrap">
                                                                                <span className="text-muted-foreground">
                                                                                    {lot.initial.toLocaleString('es')} →{' '}
                                                                                </span>
                                                                                <span className="font-semibold">
                                                                                    {lot.quantity.toLocaleString('es')}
                                                                                </span>
                                                                            </td>
                                                                            <td className="num px-3 py-2 text-right">{money(lot.unit_cost)}</td>
                                                                            <td className="num px-3 py-2 text-right">
                                                                                {money(lot.quantity * Number(lot.unit_cost))}
                                                                            </td>
                                                                            <td className="px-3 py-2">
                                                                                {lot.active_promotion ? (
                                                                                    <PromoBadge percent={lot.active_promotion.discount_percent} />
                                                                                ) : (
                                                                                    <span className="text-muted-foreground">—</span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                        {lotOpen && (
                                                                            <tr className="bg-muted/30">
                                                                                <td colSpan={7} className="px-3 pt-1 pb-3">
                                                                                    <BatchDetail
                                                                                        batch={lot}
                                                                                        units={units}
                                                                                        movementTypes={movementTypes}
                                                                                        onSeeAll={() =>
                                                                                            router.visit(
                                                                                                route('admin.inventory.show', {
                                                                                                    product: product.id,
                                                                                                    branch: row.branch_id,
                                                                                                }),
                                                                                            )
                                                                                        }
                                                                                    />
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                    </Fragment>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <p className="text-muted-foreground text-xs">
                {selected ? 'Toca un lote' : 'Toca una sucursal para ver sus lotes, y un lote'} para ver de dónde vino y todo lo que pasó con él. En
                rojo: bajo el stock mínimo. «Alcanza» usa lo vendido en los últimos 90 días.
            </p>
        </div>
    );
}

function BranchName({ name, selected }: { name: string | null; selected: boolean }) {
    return (
        <span className="flex min-w-0 items-center gap-1.5">
            <Store className="text-muted-foreground size-3.5 shrink-0" />
            <span className="truncate font-medium">{name ?? 'Sucursal eliminada'}</span>
            {selected && <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-semibold">Elegida</span>}
        </span>
    );
}

function Total({ icon: Icon, label, value, children }: { icon: LucideIcon; label: string; value: string; children?: React.ReactNode }) {
    return (
        <div className="min-w-0 rounded-lg border px-3 py-2.5">
            <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                <Icon className="size-3.5" />
                {label}
            </p>
            {value && <p className="num mt-0.5 truncate text-sm font-semibold">{value}</p>}
            <div className="mt-0.5">{children}</div>
        </div>
    );
}
