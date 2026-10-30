/*
 * PÁGINA: Inventario  (ruta /admin/inventory)
 * Stock de cada producto en la sucursal elegida, con alertas de stock bajo y vencimientos.
 * Datos: app/Http/Controllers/Admin/InventoryController.php -> index()
 */
import { DataTable, EmptyRow, Td, Th } from '@/components/admin/common/data-table';
import { ExpiryBadge } from '@/components/admin/common/doc-status';
import { PageHeader } from '@/components/admin/common/page-header';
import { SimpleSelect } from '@/components/admin/common/simple-select';
import { StatCard, StatGrid } from '@/components/admin/common/stat-card';
import { TableToolbar } from '@/components/admin/common/table-toolbar';
import { StockBreakdown } from '@/components/admin/products/stock-breakdown';
import { Pagination } from '@/components/shared/pagination';
import { useFilters } from '@/hooks/use-filters';
import AdminLayout from '@/layouts/admin/admin-layout';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Paginated } from '@/types';
import { type ListFilters, type Option, type Product } from '@/types/admin/pharmacy';
import { Head, Link } from '@inertiajs/react';
import { AlertTriangle, Boxes, CalendarClock, Wallet } from 'lucide-react';

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

export default function InventoryIndex({ products, filters, branches, alertDays, totals }: Props) {
    const applyFilters = useFilters('admin.inventory.index', filters);

    return (
        <AdminLayout breadcrumbs={[{ title: 'Inventario', href: route('admin.inventory.index') }]}>
            <Head title="Inventario" />
            <div className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                <PageHeader
                    icon={Boxes}
                    title="Inventario"
                    description="Stock por sucursal. Abre un producto para ver sus lotes, el kardex y hacer ajustes."
                    actions={
                        branches.length > 1 && (
                            <SimpleSelect
                                className="w-56"
                                options={branches}
                                value={filters.branch}
                                onChange={(branch) => applyFilters({ branch })}
                            />
                        )
                    }
                />

                <StatGrid cols={3}>
                    <StatCard
                        icon={Wallet}
                        tone="blue"
                        label="Valor del inventario (al costo)"
                        value={money(totals.value)}
                        hint="Stock de la sucursal × costo de cada lote"
                    />
                    <StatCard
                        icon={CalendarClock}
                        tone="amber"
                        colorValue={totals.expiring > 0}
                        label={`Lotes por vencer (${alertDays} días)`}
                        value={totals.expiring}
                        hint="Clic para verlos · conviene ponerlos en promoción"
                        onClick={() => applyFilters({ alert: 'expiring' })}
                    />
                    <StatCard
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
                                <Th>Producto</Th>
                                <Th align="right">Stock</Th>
                                <Th align="right">Mínimo</Th>
                                <Th>Próximo vencimiento</Th>
                                <Th align="right">Valor</Th>
                            </>
                        }
                    >
                        {products.data.map((product) => {
                            const stock = Number(product.stock ?? 0);
                            const low = stock <= product.min_stock;
                            return (
                                <tr key={product.id}>
                                    <Td>
                                        <Link
                                            href={route('admin.inventory.show', { product: product.id, branch: filters.branch })}
                                            className="font-medium hover:underline"
                                        >
                                            {product.name} {product.concentration}
                                        </Link>
                                        <p className="text-muted-foreground text-xs">{product.generic_name ?? product.pharmaceutical_form ?? '—'}</p>
                                    </Td>
                                    <Td align="right">
                                        <span className={cn('font-medium', low && 'text-red-600')}>{stock.toLocaleString('es')}</span>{' '}
                                        <span className="text-muted-foreground text-xs">{product.base_unit}</span>
                                        <StockBreakdown units={stock} product={product} />
                                    </Td>
                                    <Td align="right" className="text-muted-foreground">
                                        {product.min_stock.toLocaleString('es')}
                                    </Td>
                                    <Td>
                                        <ExpiryBadge date={product.next_expiry} alertDays={alertDays} />
                                    </Td>
                                    <Td align="right">{money(product.stock_value)}</Td>
                                </tr>
                            );
                        })}
                        {products.data.length === 0 && <EmptyRow colSpan={5} />}
                    </DataTable>
                    <Pagination paginator={products} itemName="productos" />
                </div>
            </div>
        </AdminLayout>
    );
}
