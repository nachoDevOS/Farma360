/*
 * PÁGINA: Ventas  (ruta /admin/sales)
 * Datos: app/Http/Controllers/Admin/SaleController.php -> index()
 */
import { DataTable, EmptyRow, Td, Th } from '@/components/admin/common/data-table';
import { DocStatus, statusOptions } from '@/components/admin/common/doc-status';
import { PageHeader } from '@/components/admin/common/page-header';
import { SimpleSelect } from '@/components/admin/common/simple-select';
import { TableToolbar } from '@/components/admin/common/table-toolbar';
import { Pagination } from '@/components/shared/pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCan } from '@/hooks/use-can';
import { useFilters } from '@/hooks/use-filters';
import AdminLayout from '@/layouts/admin/admin-layout';
import { formatDate, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Paginated } from '@/types';
import { type ListFilters, type Option, type Sale } from '@/types/admin/pharmacy';
import { Head, Link } from '@inertiajs/react';
import { Receipt, ShoppingCart } from 'lucide-react';

interface Props {
    sales: Paginated<Sale>;
    filters: ListFilters;
    branches: Option[];
    paymentMethods: Record<string, string>;
}

export default function SalesIndex({ sales, filters, branches, paymentMethods }: Props) {
    const can = useCan();
    const applyFilters = useFilters('admin.sales.index', filters);

    return (
        <AdminLayout breadcrumbs={[{ title: 'Ventas', href: route('admin.sales.index') }]}>
            <Head title="Ventas" />
            <div className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                <PageHeader
                    icon={Receipt}
                    title="Ventas"
                    description="Ventas realizadas. Una venta no se elimina: se anula y el stock vuelve a sus lotes."
                    actions={
                        can('ventas.crear') && (
                            <Button asChild size="sm" className="btn-brand">
                                <Link href={route('admin.pos')}>
                                    <ShoppingCart /> Punto de venta
                                </Link>
                            </Button>
                        )
                    }
                />

                <div className="surface overflow-hidden rounded-xl">
                    <TableToolbar
                        perPage={Number(filters.per_page ?? 10)}
                        onPerPageChange={(n) => applyFilters({ per_page: String(n) })}
                        search={filters.search ?? ''}
                        onSearch={(search) => applyFilters({ search })}
                        searchPlaceholder="N° de venta, cliente o CI/NIT…"
                    >
                        {branches.length > 1 && (
                            <SimpleSelect
                                className="w-48"
                                options={branches}
                                value={filters.branch}
                                allLabel="Todas las sucursales"
                                onChange={(branch) => applyFilters({ branch })}
                            />
                        )}
                        <SimpleSelect
                            className="w-40"
                            options={statusOptions(['completada', 'anulada'])}
                            value={filters.status}
                            allLabel="Todos los estados"
                            onChange={(status) => applyFilters({ status })}
                        />
                        <Input
                            type="date"
                            className="h-9 w-40"
                            value={filters.from ?? ''}
                            onChange={(e) => applyFilters({ from: e.target.value })}
                            aria-label="Desde"
                        />
                        <Input
                            type="date"
                            className="h-9 w-40"
                            value={filters.to ?? ''}
                            onChange={(e) => applyFilters({ to: e.target.value })}
                            aria-label="Hasta"
                        />
                    </TableToolbar>
                    <DataTable
                        head={
                            <>
                                <Th>N°</Th>
                                <Th>Fecha</Th>
                                <Th>Cliente</Th>
                                <Th>Sucursal</Th>
                                <Th>Vendedor</Th>
                                <Th>Pago</Th>
                                <Th align="right">Total</Th>
                                <Th>Estado</Th>
                            </>
                        }
                    >
                        {sales.data.map((sale) => (
                            <tr key={sale.id} className={cn(sale.status === 'anulada' && 'opacity-60')}>
                                <Td>
                                    <Link href={route('admin.sales.show', sale.id)} className="num font-medium hover:underline">
                                        {sale.number}
                                    </Link>
                                </Td>
                                <Td className="num text-muted-foreground whitespace-nowrap">
                                    {formatDate(sale.created_at, { dateStyle: 'short', timeStyle: 'short' })}
                                </Td>
                                <Td>
                                    {sale.customer_name}
                                    {sale.customer_document && <p className="text-muted-foreground text-xs">{sale.customer_document}</p>}
                                </Td>
                                <Td className="text-muted-foreground">{sale.branch.name}</Td>
                                <Td className="text-muted-foreground">{sale.registered_by?.name}</Td>
                                <Td className="text-muted-foreground">
                                    {sale.payments.map((p) => paymentMethods[p.method] ?? p.method).join(' + ')}
                                </Td>
                                <Td align="right" className="font-medium">
                                    {money(sale.total)}
                                </Td>
                                <Td>
                                    <DocStatus status={sale.status} />
                                </Td>
                            </tr>
                        ))}
                        {sales.data.length === 0 && <EmptyRow colSpan={8} text="No hay ventas con estos filtros." />}
                    </DataTable>
                    <Pagination paginator={sales} itemName="ventas" />
                </div>
            </div>
        </AdminLayout>
    );
}
