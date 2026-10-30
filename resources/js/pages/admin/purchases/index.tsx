/*
 * PÁGINA: Compras  (ruta /admin/purchases)
 * Datos: app/Http/Controllers/Admin/PurchaseController.php -> index()
 *
 * Arriba, los números del mes (de la sucursal elegida o de todas): lo comprado contra el mes anterior, cuántas compras,
 * el proveedor principal y las anuladas. La sucursal se elige con el mismo botón de las fichas (BranchMenu).
 * Cada fila: número y factura, fecha, proveedor, sucursal, productos y unidades, total, cuánto de lo comprado sigue en
 * stock (barrita), estado y el ojo para ver la compra. La flecha junto al número despliega sus productos.
 */
import { BranchMenu } from '@/components/admin/common/branch-menu';
import { DataTable, EmptyRow, Td, Th } from '@/components/admin/common/data-table';
import { DocStatus, ExpiryBadge, statusOptions } from '@/components/admin/common/doc-status';
import { PageHeader } from '@/components/admin/common/page-header';
import { ActionButton, RowActions } from '@/components/admin/common/row-actions';
import { SimpleSelect } from '@/components/admin/common/simple-select';
import { StatCard, StatGrid } from '@/components/admin/common/stat-card';
import { TableToolbar } from '@/components/admin/common/table-toolbar';
import { Pagination } from '@/components/shared/pagination';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { useFilters } from '@/hooks/use-filters';
import AdminLayout from '@/layouts/admin/admin-layout';
import { formatDay, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Paginated } from '@/types';
import { type ListFilters, type Option, type Purchase } from '@/types/admin/pharmacy';
import { Head, Link, router } from '@inertiajs/react';
import { Ban, ChevronRight, ClipboardList, Eye, Plus, Receipt, Truck, Wallet } from 'lucide-react';
import { Fragment, useState } from 'react';

interface Props {
    purchases: Paginated<Purchase>;
    filters: ListFilters;
    branches: Option[];
    canSeeAllBranches: boolean;
    /** Números del mes en curso. Ver PurchaseController@monthSummary */
    month: { total: number; previous: number; count: number; cancelled: number; top_supplier: { name: string; total: number } | null };
}

/** Unidades compradas y las que siguen en los lotes de la compra. */
function stockLeft(purchase: Purchase) {
    const items = purchase.items ?? [];
    const bought = items.reduce((sum, i) => sum + i.units, 0);
    const left = items.reduce((sum, i) => sum + Math.min(i.units, i.batch?.quantity ?? 0), 0);
    return { bought, left, percent: bought > 0 ? (left / bought) * 100 : 0 };
}

export default function PurchasesIndex({ purchases, filters, branches, canSeeAllBranches, month }: Props) {
    const can = useCan();
    const applyFilters = useFilters('admin.purchases.index', filters);
    const branchId = filters.branch ? Number(filters.branch) : null;
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const toggle = (id: number) =>
        setExpanded((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    const columns = 9;
    const change = month.previous > 0 ? ((month.total - month.previous) / month.previous) * 100 : null;
    const monthName = new Date().toLocaleDateString('es', { month: 'long' });

    return (
        <AdminLayout breadcrumbs={[{ title: 'Compras', href: route('admin.purchases.index') }]}>
            <Head title="Compras" />
            <div className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                <PageHeader
                    icon={ClipboardList}
                    title="Compras"
                    description="Mercadería recibida de proveedores. Cada ítem entra al stock como un lote con su vencimiento."
                    actions={
                        <>
                            {(canSeeAllBranches || branches.length > 1) && (
                                <BranchMenu
                                    note="La lista y los números del mes son de la sucursal elegida."
                                    current={branchId}
                                    onChoose={(branch) => applyFilters({ branch: branch === null ? '' : String(branch) })}
                                    options={[
                                        ...(canSeeAllBranches ? [{ id: null, name: 'Todas las sucursales' }] : []),
                                        ...branches.map((b) => ({ id: b.id, name: b.name })),
                                    ]}
                                />
                            )}
                            {can('proveedores.ver') && (
                                <Button asChild variant="outline" size="sm">
                                    <Link href={route('admin.suppliers.index')}>
                                        <Truck /> Proveedores
                                    </Link>
                                </Button>
                            )}
                            {can('compras.crear') && (
                                <Button asChild size="sm" className="btn-brand">
                                    <Link href={route('admin.purchases.create')}>
                                        <Plus /> Nueva compra
                                    </Link>
                                </Button>
                            )}
                        </>
                    }
                />

                <StatGrid>
                    <StatCard
                        compact
                        icon={Wallet}
                        tone="blue"
                        label={`Comprado en ${monthName}`}
                        value={money(month.total)}
                        hint={
                            change === null
                                ? 'Sin compras el mes pasado'
                                : `${change >= 0 ? '+' : '−'}${Math.abs(Math.round(change))}% que el mes pasado (${money(month.previous)})`
                        }
                    />
                    <StatCard
                        compact
                        icon={Receipt}
                        tone="violet"
                        label="Compras del mes"
                        value={month.count.toLocaleString('es')}
                        hint={month.count > 0 ? `Promedio ${money(month.total / month.count)} por compra` : 'Ninguna todavía'}
                    />
                    <StatCard
                        compact
                        icon={Truck}
                        tone="green"
                        label="Proveedor principal del mes"
                        value={month.top_supplier?.name ?? '—'}
                        hint={
                            month.top_supplier
                                ? `${money(month.top_supplier.total)} · ${month.total > 0 ? Math.round((month.top_supplier.total / month.total) * 100) : 0}% de lo comprado`
                                : 'Sin compras este mes'
                        }
                    />
                    <StatCard
                        compact
                        icon={Ban}
                        tone={month.cancelled > 0 ? 'red' : 'slate'}
                        colorValue={month.cancelled > 0}
                        label="Anuladas este mes"
                        value={month.cancelled.toLocaleString('es')}
                        hint={month.cancelled > 0 ? 'Clic para verlas' : 'Ninguna'}
                        onClick={month.cancelled > 0 ? () => applyFilters({ status: 'anulada' }) : undefined}
                    />
                </StatGrid>

                <div className="surface overflow-hidden rounded-xl">
                    <TableToolbar
                        perPage={Number(filters.per_page ?? 10)}
                        onPerPageChange={(n) => applyFilters({ per_page: String(n) })}
                        search={filters.search ?? ''}
                        onSearch={(search) => applyFilters({ search })}
                        searchPlaceholder="N° de compra, factura o proveedor…"
                    >
                        <SimpleSelect
                            className="w-40"
                            options={statusOptions(['registrada', 'anulada'])}
                            value={filters.status}
                            allLabel="Todos los estados"
                            onChange={(status) => applyFilters({ status })}
                        />
                    </TableToolbar>
                    <DataTable
                        head={
                            <>
                                <Th>N°</Th>
                                <Th>Fecha</Th>
                                <Th>Proveedor</Th>
                                <Th>Sucursal</Th>
                                <Th align="right">Productos</Th>
                                <Th align="right">Total</Th>
                                <Th>Queda en stock</Th>
                                <Th>Estado</Th>
                                <Th align="right">Acciones</Th>
                            </>
                        }
                    >
                        {purchases.data.map((purchase) => {
                            const isOpen = expanded.has(purchase.id);
                            const left = stockLeft(purchase);
                            const cancelled = purchase.status === 'anulada';
                            return (
                                <Fragment key={purchase.id}>
                                    <tr className={cn(cancelled && 'opacity-60', isOpen && 'bg-muted/40')}>
                                        <Td>
                                            <button
                                                type="button"
                                                onClick={() => toggle(purchase.id)}
                                                aria-expanded={isOpen}
                                                aria-label={isOpen ? 'Ocultar productos' : 'Ver productos'}
                                                className="hover:bg-muted inline-flex items-center gap-1 rounded-md py-1 pr-2 pl-1 text-left"
                                            >
                                                <ChevronRight
                                                    className={cn(
                                                        'text-muted-foreground size-4 shrink-0 transition-transform',
                                                        isOpen && 'text-primary rotate-90',
                                                    )}
                                                />
                                                <span>
                                                    <span className="num block font-medium">{purchase.number}</span>
                                                    {purchase.invoice_number && (
                                                        <span className="text-muted-foreground block text-xs">Fact. {purchase.invoice_number}</span>
                                                    )}
                                                </span>
                                            </button>
                                        </Td>
                                        <Td className="num whitespace-nowrap">{formatDay(purchase.purchased_at)}</Td>
                                        <Td className="font-medium">{purchase.supplier.name}</Td>
                                        <Td className="text-muted-foreground">{purchase.branch.name}</Td>
                                        <Td align="right">
                                            <span className="num font-medium">{purchase.items_count}</span>
                                            <span className="text-muted-foreground block text-[11px]">
                                                {left.bought.toLocaleString('es')} unidades
                                            </span>
                                        </Td>
                                        <Td align="right" className="num font-semibold">
                                            {money(purchase.total)}
                                        </Td>
                                        <Td>
                                            {cancelled ? (
                                                <span className="text-muted-foreground text-xs">—</span>
                                            ) : (
                                                <div className="w-28">
                                                    <div className="flex justify-between text-[11px]">
                                                        <span className="num font-medium">{Math.round(left.percent)}%</span>
                                                        <span className="text-muted-foreground num">
                                                            {left.left.toLocaleString('es')} / {left.bought.toLocaleString('es')}
                                                        </span>
                                                    </div>
                                                    <div className="bg-muted mt-1 h-1.5 overflow-hidden rounded-full">
                                                        <div className="bg-chart-1 h-full rounded-full" style={{ width: `${left.percent}%` }} />
                                                    </div>
                                                </div>
                                            )}
                                        </Td>
                                        <Td>
                                            <DocStatus status={purchase.status} />
                                        </Td>
                                        <Td align="right">
                                            <RowActions>
                                                <ActionButton
                                                    icon={Eye}
                                                    label="Ver compra: productos, lotes y costos"
                                                    onClick={() => router.visit(route('admin.purchases.show', purchase.id))}
                                                />
                                            </RowActions>
                                        </Td>
                                    </tr>
                                    {isOpen && (
                                        <tr className="bg-muted/40 hover:bg-muted/40!">
                                            <td colSpan={columns} className="px-4 pt-1 pb-4">
                                                <PurchaseItems purchase={purchase} />
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                        {purchases.data.length === 0 && <EmptyRow colSpan={columns} text="No hay compras registradas." />}
                    </DataTable>
                    <Pagination paginator={purchases} itemName="compras" />
                </div>
            </div>
        </AdminLayout>
    );
}

/** Detalle desplegable: los productos de la compra y cuánto queda de cada uno. */
function PurchaseItems({ purchase }: { purchase: Purchase }) {
    const cancelled = purchase.status === 'anulada';
    return (
        <div className="bg-card overflow-x-auto rounded-lg border">
            <table className="w-full text-[13px]">
                <thead className="text-muted-foreground text-left text-[11px] tracking-wider uppercase">
                    <tr className="border-b">
                        <th className="px-4 py-2 font-medium">Producto</th>
                        <th className="px-4 py-2 font-medium">Lote</th>
                        <th className="px-4 py-2 font-medium">Vence</th>
                        <th className="px-4 py-2 text-right font-medium">Compró</th>
                        <th className="px-4 py-2 font-medium">Queda</th>
                        <th className="px-4 py-2 text-right font-medium">Subtotal</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {(purchase.items ?? []).map((item) => {
                        const left = Math.min(item.units, item.batch?.quantity ?? 0);
                        const percent = item.units > 0 ? (left / item.units) * 100 : 0;
                        return (
                            <tr key={item.id}>
                                <td className="px-4 py-2">
                                    <p className="font-medium">
                                        {item.product.name} <span className="text-muted-foreground font-normal">{item.product.concentration}</span>
                                    </p>
                                    <p className="text-muted-foreground text-xs">{item.presentation?.name}</p>
                                </td>
                                <td className="num px-4 py-2">{item.batch_number}</td>
                                <td className="px-4 py-2">
                                    <ExpiryBadge date={item.expires_at} />
                                </td>
                                <td className="num px-4 py-2 text-right">
                                    {item.quantity} × {money(item.cost)}
                                    <span className="text-muted-foreground block text-[11px]">{item.units.toLocaleString('es')} unidades</span>
                                </td>
                                <td className="px-4 py-2">
                                    {cancelled ? (
                                        <span className="text-muted-foreground text-xs">Anulada</span>
                                    ) : (
                                        <div className="w-32">
                                            <span className="num text-xs">
                                                <span className="font-semibold">{left.toLocaleString('es')}</span>
                                                <span className="text-muted-foreground"> de {item.units.toLocaleString('es')}</span>
                                            </span>
                                            <div className="bg-muted mt-1 h-1.5 overflow-hidden rounded-full">
                                                <div className="bg-chart-1 h-full rounded-full" style={{ width: `${percent}%` }} />
                                            </div>
                                        </div>
                                    )}
                                </td>
                                <td className="num px-4 py-2 text-right font-medium">{money(item.subtotal)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
