/*
 * PÁGINA: Compras  (ruta /admin/purchases)
 * Datos: app/Http/Controllers/Admin/PurchaseController.php -> index()
 */
import { DataTable, EmptyRow, Td, Th } from '@/components/admin/common/data-table';
import { DocStatus, statusOptions } from '@/components/admin/common/doc-status';
import { PageHeader } from '@/components/admin/common/page-header';
import { SimpleSelect } from '@/components/admin/common/simple-select';
import { TableToolbar } from '@/components/admin/common/table-toolbar';
import { Pagination } from '@/components/shared/pagination';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { useFilters } from '@/hooks/use-filters';
import AdminLayout from '@/layouts/admin/admin-layout';
import { formatDay, money } from '@/lib/format';
import { type Paginated } from '@/types';
import { type ListFilters, type Option, type Purchase } from '@/types/admin/pharmacy';
import { Head, Link } from '@inertiajs/react';
import { ClipboardList, Plus, Truck } from 'lucide-react';

interface Props {
    purchases: Paginated<Purchase>;
    filters: ListFilters;
    branches: Option[];
}

export default function PurchasesIndex({ purchases, filters, branches }: Props) {
    const can = useCan();
    const applyFilters = useFilters('admin.purchases.index', filters);

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

                <div className="surface overflow-hidden rounded-xl">
                    <TableToolbar
                        perPage={Number(filters.per_page ?? 10)}
                        onPerPageChange={(n) => applyFilters({ per_page: String(n) })}
                        search={filters.search ?? ''}
                        onSearch={(search) => applyFilters({ search })}
                        searchPlaceholder="N° de compra, factura o proveedor…"
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
                                <Th align="right">Ítems</Th>
                                <Th align="right">Total</Th>
                                <Th>Estado</Th>
                            </>
                        }
                    >
                        {purchases.data.map((purchase) => (
                            <tr key={purchase.id}>
                                <Td>
                                    <Link href={route('admin.purchases.show', purchase.id)} className="num font-medium hover:underline">
                                        {purchase.number}
                                    </Link>
                                    {purchase.invoice_number && <p className="text-muted-foreground text-xs">Fact. {purchase.invoice_number}</p>}
                                </Td>
                                <Td className="num whitespace-nowrap">{formatDay(purchase.purchased_at)}</Td>
                                <Td>{purchase.supplier.name}</Td>
                                <Td className="text-muted-foreground">{purchase.branch.name}</Td>
                                <Td align="right">{purchase.items_count}</Td>
                                <Td align="right" className="font-medium">
                                    {money(purchase.total)}
                                </Td>
                                <Td>
                                    <DocStatus status={purchase.status} />
                                </Td>
                            </tr>
                        ))}
                        {purchases.data.length === 0 && <EmptyRow colSpan={7} text="No hay compras registradas." />}
                    </DataTable>
                    <Pagination paginator={purchases} itemName="compras" />
                </div>
            </div>
        </AdminLayout>
    );
}
