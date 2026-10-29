/*
 * PÁGINA: Transferencias  (ruta /admin/transfers)
 * Datos: app/Http/Controllers/Admin/TransferController.php -> index()
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
import { formatDate } from '@/lib/format';
import { type Paginated } from '@/types';
import { type ListFilters, type Transfer } from '@/types/admin/pharmacy';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeftRight, ArrowRight, Plus } from 'lucide-react';

export default function TransfersIndex({ transfers, filters }: { transfers: Paginated<Transfer>; filters: ListFilters }) {
    const can = useCan();
    const applyFilters = useFilters('admin.transfers.index', filters);

    return (
        <AdminLayout breadcrumbs={[{ title: 'Transferencias', href: route('admin.transfers.index') }]}>
            <Head title="Transferencias" />
            <div className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                <PageHeader
                    icon={ArrowLeftRight}
                    title="Transferencias"
                    description="Envíos de mercadería entre sucursales. El stock sale al enviar y entra al recibir."
                    actions={
                        can('transferencias.crear') && (
                            <Button asChild size="sm" className="btn-brand">
                                <Link href={route('admin.transfers.create')}>
                                    <Plus /> Nueva transferencia
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
                        searchPlaceholder="N° de transferencia…"
                    >
                        <SimpleSelect
                            className="w-44"
                            options={statusOptions(['enviada', 'recibida', 'anulada'])}
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
                                <Th>Origen → Destino</Th>
                                <Th align="right">Lotes</Th>
                                <Th align="right">Unidades</Th>
                                <Th>Estado</Th>
                            </>
                        }
                    >
                        {transfers.data.map((t) => (
                            <tr key={t.id}>
                                <Td>
                                    <Link href={route('admin.transfers.show', t.id)} className="num font-medium hover:underline">
                                        {t.number}
                                    </Link>
                                </Td>
                                <Td className="num text-muted-foreground whitespace-nowrap">
                                    {formatDate(t.created_at, { dateStyle: 'medium', timeStyle: 'short' })}
                                </Td>
                                <Td>
                                    <span className="inline-flex items-center gap-2">
                                        {t.from_branch.name} <ArrowRight className="text-muted-foreground size-3.5" /> {t.to_branch.name}
                                    </span>
                                </Td>
                                <Td align="right">{t.items_count}</Td>
                                <Td align="right">{Number(t.units ?? 0).toLocaleString('es')}</Td>
                                <Td>
                                    <DocStatus status={t.status} />
                                </Td>
                            </tr>
                        ))}
                        {transfers.data.length === 0 && <EmptyRow colSpan={6} text="No hay transferencias." />}
                    </DataTable>
                    <Pagination paginator={transfers} itemName="transferencias" />
                </div>
            </div>
        </AdminLayout>
    );
}
