/*
 * PÁGINA: Inventario  (ruta /admin/inventory)
 * Stock de cada producto en la sucursal elegida, con alertas de stock bajo y vencimientos.
 * Datos: app/Http/Controllers/Admin/InventoryController.php -> index()
 *
 * Cada fila: producto (genérico, laboratorio, categoría, receta), stock con su desglose y estado (sin stock / bajo el
 * mínimo / bien), lotes (con avisos de vencidos y por vencer), próximo vencimiento, vendido en 30 días y para cuántos
 * días alcanza, valor al costo y los botones: ojo = ver la ficha de inventario (lotes, kardex, ajustes) y ver el producto.
 * La flecha junto al ID despliega el detalle: los lotes de la sucursal y el stock en las demás sucursales.
 */
import { BranchMenu } from '@/components/admin/common/branch-menu';
import { DataTable, EmptyRow, Td, Th } from '@/components/admin/common/data-table';
import { ExpiryBadge } from '@/components/admin/common/doc-status';
import { PageHeader } from '@/components/admin/common/page-header';
import { ActionButton, RowActions } from '@/components/admin/common/row-actions';
import { SimpleSelect } from '@/components/admin/common/simple-select';
import { StatCard, StatGrid } from '@/components/admin/common/stat-card';
import { TableToolbar } from '@/components/admin/common/table-toolbar';
import { plural } from '@/components/admin/products/presentation-levels';
import { StockBreakdown } from '@/components/admin/products/stock-breakdown';
import { Pagination } from '@/components/shared/pagination';
import { useCan } from '@/hooks/use-can';
import { useFilters } from '@/hooks/use-filters';
import AdminLayout from '@/layouts/admin/admin-layout';
import { formatDay, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Paginated } from '@/types';
import { type ListFilters, type Option, type Product } from '@/types/admin/pharmacy';
import { Head, Link, router } from '@inertiajs/react';
import { AlertTriangle, Boxes, CalendarClock, ChevronRight, Eye, Layers, Pill, Store, Wallet } from 'lucide-react';
import { Fragment, useState } from 'react';

interface Props {
    products: Paginated<Product>;
    filters: ListFilters & { alert?: string };
    branches: Option[];
    alertDays: number;
    totals: { value: number; expiring: number; expired: number };
}

const alerts = [
    { id: 'low', name: 'Stock bajo (≤ mínimo)' },
    { id: 'expiring', name: 'Por vencer' },
    { id: 'expired', name: 'Con lotes vencidos' },
];

/** Días hasta una fecha "Y-m-d" (negativo = ya pasó). */
function daysUntil(date: string): number {
    const [y, m, d] = date.slice(0, 10).split('-').map(Number);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86_400_000);
}

const PILL = {
    slate: 'bg-muted text-foreground/70',
    red: 'bg-red-500/10 text-red-700 dark:text-red-400',
    amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    green: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
};

export default function InventoryIndex({ products, filters, branches, alertDays, totals }: Props) {
    const applyFilters = useFilters('admin.inventory.index', filters);
    const can = useCan();
    const branchId = Number(filters.branch);
    const branchName = branches.find((b) => b.id === branchId)?.name ?? 'la sucursal';
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const toggle = (id: number) =>
        setExpanded((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    const columns = 8;

    return (
        <AdminLayout breadcrumbs={[{ title: 'Inventario', href: route('admin.inventory.index') }]}>
            <Head title="Inventario" />
            <div className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                <PageHeader
                    icon={Boxes}
                    title="Inventario"
                    description="Stock por sucursal. Toca el ojo de un producto para ver sus lotes, sus movimientos y hacer ajustes."
                    actions={
                        branches.length > 1 && (
                            <BranchMenu
                                note="La lista muestra el stock de la sucursal elegida."
                                current={branchId}
                                onChoose={(branch) => applyFilters({ branch: String(branch) })}
                                options={branches.map((b) => ({ id: b.id, name: b.name }))}
                            />
                        )
                    }
                />

                <StatGrid cols={3}>
                    <StatCard
                        compact
                        icon={Wallet}
                        tone="blue"
                        label="Valor del inventario (al costo)"
                        value={money(totals.value)}
                        hint="Stock de la sucursal × costo de cada lote"
                    />
                    <StatCard
                        compact
                        icon={CalendarClock}
                        tone="amber"
                        colorValue={totals.expiring > 0}
                        label={`Lotes por vencer (${alertDays} días)`}
                        value={totals.expiring}
                        hint="Clic para verlos · conviene ponerlos en promoción"
                        onClick={() => applyFilters({ alert: 'expiring' })}
                    />
                    <StatCard
                        compact
                        icon={AlertTriangle}
                        tone="red"
                        colorValue={totals.expired > 0}
                        label="Lotes vencidos con stock"
                        value={totals.expired}
                        hint="Clic para verlos · hay que darlos de baja"
                        onClick={() => applyFilters({ alert: 'expired' })}
                    />
                </StatGrid>

                <div className="surface overflow-hidden rounded-xl">
                    <TableToolbar
                        perPage={Number(filters.per_page ?? 10)}
                        onPerPageChange={(n) => applyFilters({ per_page: String(n) })}
                        search={filters.search ?? ''}
                        onSearch={(search) => applyFilters({ search })}
                        searchPlaceholder="Producto, genérico, código o síntoma…"
                    >
                        <SimpleSelect
                            className="w-52"
                            options={alerts}
                            value={filters.alert}
                            allLabel="Todos los productos"
                            onChange={(alert) => applyFilters({ alert })}
                        />
                    </TableToolbar>
                    <DataTable
                        head={
                            <>
                                <Th>ID</Th>
                                <Th>Producto</Th>
                                <Th align="right">Stock</Th>
                                <Th>Lotes</Th>
                                <Th>Próximo vencimiento</Th>
                                <Th align="right">Vendido 30 días</Th>
                                <Th align="right">Valor</Th>
                                <Th align="right">Acciones</Th>
                            </>
                        }
                    >
                        {products.data.map((product) => {
                            const stock = Number(product.stock ?? 0);
                            const units = plural(product.base_unit);
                            const lots = product.batches ?? [];
                            const expired = lots.filter((l) => daysUntil(l.expires_at) < 0).length;
                            const expiring = lots.filter((l) => {
                                const days = daysUntil(l.expires_at);
                                return days >= 0 && days <= alertDays;
                            }).length;
                            const sold = product.sold_30 ?? 0;
                            const coverage = sold > 0 ? stock / (sold / 30) : null;
                            const status: { label: string; tone: keyof typeof PILL } =
                                stock === 0
                                    ? { label: 'Sin stock', tone: 'red' }
                                    : product.min_stock > 0 && stock <= product.min_stock
                                      ? { label: `Bajo el mínimo (${product.min_stock})`, tone: 'red' }
                                      : product.min_stock === 0
                                        ? { label: 'Sin mínimo', tone: 'slate' }
                                        : { label: `Mínimo ${product.min_stock}`, tone: 'green' };
                            const isOpen = expanded.has(product.id);
                            const showInventory = () => router.visit(route('admin.inventory.show', { product: product.id, branch: filters.branch }));
                            return (
                                <Fragment key={product.id}>
                                    <tr className={cn(isOpen && 'bg-muted/40')}>
                                        <Td className="w-px">
                                            <button
                                                type="button"
                                                onClick={() => toggle(product.id)}
                                                aria-expanded={isOpen}
                                                aria-label={isOpen ? 'Ocultar detalle' : 'Ver detalle'}
                                                className="hover:bg-muted inline-flex items-center gap-1 rounded-md py-1 pr-2 pl-1 whitespace-nowrap"
                                            >
                                                <ChevronRight
                                                    className={cn(
                                                        'text-muted-foreground size-4 transition-transform',
                                                        isOpen && 'text-primary rotate-90',
                                                    )}
                                                />
                                                <span className="num font-medium">#{product.id}</span>
                                            </button>
                                        </Td>
                                        <Td>
                                            <Link
                                                href={route('admin.inventory.show', { product: product.id, branch: filters.branch })}
                                                className="font-medium hover:underline"
                                            >
                                                {product.name} <span className="text-muted-foreground font-normal">{product.concentration}</span>
                                            </Link>
                                            <p className="text-muted-foreground text-xs">
                                                {[product.generic_name, product.pharmaceutical_form, product.laboratory?.name, product.category?.name]
                                                    .filter(Boolean)
                                                    .join(' · ') || '—'}
                                                {product.is_controlled ? (
                                                    <span className="ml-2 font-medium text-red-600">Controlado</span>
                                                ) : (
                                                    product.requires_prescription && (
                                                        <span className="ml-2 font-medium text-amber-600">Con receta</span>
                                                    )
                                                )}
                                            </p>
                                        </Td>
                                        <Td align="right">
                                            <span className={cn('num font-semibold', status.tone === 'red' && 'text-red-600')}>
                                                {stock.toLocaleString('es')}
                                            </span>{' '}
                                            <span className="text-muted-foreground text-xs">{units}</span>
                                            <StockBreakdown units={stock} product={product} className="mt-0.5 font-medium" />
                                            <span
                                                className={cn('mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium', PILL[status.tone])}
                                            >
                                                {status.label}
                                            </span>
                                        </Td>
                                        <Td>
                                            <span className="num font-medium">{lots.length}</span>{' '}
                                            <span className="text-muted-foreground text-xs">{lots.length === 1 ? 'lote' : 'lotes'}</span>
                                            <span className="mt-1 flex flex-wrap gap-1">
                                                {expired > 0 && (
                                                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', PILL.red)}>
                                                        {expired} vencido{expired === 1 ? '' : 's'}
                                                    </span>
                                                )}
                                                {expiring > 0 && (
                                                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', PILL.amber)}>
                                                        {expiring} por vencer
                                                    </span>
                                                )}
                                            </span>
                                        </Td>
                                        <Td>
                                            <ExpiryBadge date={product.next_expiry} alertDays={alertDays} />
                                        </Td>
                                        <Td align="right">
                                            {sold > 0 ? (
                                                <>
                                                    <span className="num font-medium">{sold.toLocaleString('es')}</span>
                                                    <span
                                                        className={cn(
                                                            'block text-[11px]',
                                                            coverage !== null && coverage < 7
                                                                ? 'text-red-600'
                                                                : coverage !== null && coverage < 30
                                                                  ? 'text-amber-600'
                                                                  : 'text-muted-foreground',
                                                        )}
                                                    >
                                                        alcanza{' '}
                                                        {coverage !== null && coverage >= 365 ? 'más de un año' : `${Math.floor(coverage ?? 0)} días`}
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">Sin ventas</span>
                                            )}
                                        </Td>
                                        <Td align="right">
                                            <span className="num">{money(product.stock_value)}</span>
                                        </Td>
                                        <Td align="right">
                                            <RowActions>
                                                <ActionButton
                                                    icon={Eye}
                                                    label="Ver inventario: lotes, movimientos y ajustes"
                                                    onClick={showInventory}
                                                />
                                                {can('productos.ver') && (
                                                    <ActionButton
                                                        icon={Pill}
                                                        label="Ver producto: precios, compras y rendimiento"
                                                        tone="success"
                                                        onClick={() =>
                                                            router.visit(
                                                                route('admin.products.show', { product: product.id, branch: filters.branch }),
                                                            )
                                                        }
                                                    />
                                                )}
                                            </RowActions>
                                        </Td>
                                    </tr>
                                    {isOpen && (
                                        <tr className="bg-muted/40 hover:bg-muted/40!">
                                            <td colSpan={columns} className="px-4 pt-1 pb-4">
                                                <RowDetail product={product} branchName={branchName} branches={branches} alertDays={alertDays} />
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                        {products.data.length === 0 && <EmptyRow colSpan={columns} />}
                    </DataTable>
                    <Pagination paginator={products} itemName="productos" />
                </div>
            </div>
        </AdminLayout>
    );
}

/** Detalle desplegable de una fila: lotes de la sucursal y stock en las demás. */
function RowDetail({ product, branchName, branches, alertDays }: { product: Product; branchName: string; branches: Option[]; alertDays: number }) {
    const lots = product.batches ?? [];
    const others = product.other_branches ?? [];
    const units = plural(product.base_unit);
    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="bg-card min-w-0 rounded-lg border">
                <p className="flex items-center gap-2 border-b px-4 py-2.5 text-xs font-semibold tracking-wider uppercase">
                    <Layers className="text-muted-foreground size-3.5" /> Lotes en {branchName}
                </p>
                {lots.length === 0 ? (
                    <p className="text-muted-foreground px-4 py-3 text-sm">No hay lotes con stock en esta sucursal.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                            <thead className="text-muted-foreground text-left text-[11px] tracking-wider uppercase">
                                <tr className="border-b">
                                    <th className="px-4 py-2 font-medium">Lote</th>
                                    <th className="px-4 py-2 font-medium">Vence</th>
                                    <th className="px-4 py-2 text-right font-medium">Cantidad</th>
                                    <th className="px-4 py-2 text-right font-medium">Costo c/u</th>
                                    <th className="px-4 py-2 text-right font-medium">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {lots.map((lot) => (
                                    <tr key={lot.id}>
                                        <td className="num px-4 py-2 font-medium">{lot.batch_number}</td>
                                        <td className="px-4 py-2">
                                            <ExpiryBadge date={lot.expires_at} alertDays={alertDays} />
                                            <span className="text-muted-foreground block text-[11px]">{formatDay(lot.expires_at)}</span>
                                        </td>
                                        <td className="num px-4 py-2 text-right">
                                            {lot.quantity.toLocaleString('es')}
                                            <StockBreakdown units={lot.quantity} product={product} />
                                        </td>
                                        <td className="num px-4 py-2 text-right">{money(lot.unit_cost)}</td>
                                        <td className="num px-4 py-2 text-right">{money(lot.quantity * Number(lot.unit_cost))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <div className="bg-card min-w-0 rounded-lg border">
                <p className="flex items-center gap-2 border-b px-4 py-2.5 text-xs font-semibold tracking-wider uppercase">
                    <Store className="text-muted-foreground size-3.5" /> En otras sucursales
                </p>
                {others.length === 0 ? (
                    <p className="text-muted-foreground px-4 py-3 text-sm">Ninguna otra sucursal tiene stock.</p>
                ) : (
                    <ul className="divide-y">
                        {others.map((o) => (
                            <li key={o.branch_id} className="flex items-center justify-between gap-3 px-4 py-2 text-[13px]">
                                {branches.some((b) => b.id === o.branch_id) ? (
                                    <Link
                                        href={route('admin.inventory.show', { product: product.id, branch: o.branch_id })}
                                        className="text-primary truncate font-medium hover:underline"
                                    >
                                        {o.branch}
                                    </Link>
                                ) : (
                                    <span className="truncate font-medium">{o.branch}</span>
                                )}
                                <span className="num shrink-0">
                                    {o.stock.toLocaleString('es')} <span className="text-muted-foreground text-xs">{units}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
