/*
 * PÁGINA: Historial de turnos de caja  (ruta /admin/cash/sessions)
 * Cada cajero ve los suyos; con el permiso caja.aprobar se ven todos los de sus sucursales.
 */
import { DataTable, EmptyRow, Td, Th } from '@/components/admin/common/data-table';
import { DocStatus, statusOptions } from '@/components/admin/common/doc-status';
import { PageHeader } from '@/components/admin/common/page-header';
import { SimpleSelect } from '@/components/admin/common/simple-select';
import { Pagination } from '@/components/shared/pagination';
import { useFilters } from '@/hooks/use-filters';
import AdminLayout from '@/layouts/admin/admin-layout';
import { formatDate, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Paginated } from '@/types';
import { type CashSession, type ListFilters } from '@/types/admin/pharmacy';
import { Head, Link } from '@inertiajs/react';
import { History } from 'lucide-react';

export default function CashSessions({ sessions, filters }: { sessions: Paginated<CashSession>; filters: ListFilters }) {
    const applyFilters = useFilters('admin.cash.sessions.index', filters);
    const when = (date: string | null) => (date ? formatDate(date, { dateStyle: 'short', timeStyle: 'short' }) : '—');

    return (
        <AdminLayout
            breadcrumbs={[
                { title: 'Mi caja', href: route('admin.cash.index') },
                { title: 'Historial', href: route('admin.cash.sessions.index') },
            ]}
        >
            <Head title="Turnos de caja" />
            <div className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                <PageHeader
                    icon={History}
                    title="Turnos de caja"
                    description="Aperturas, cierres y diferencias del arqueo."
                    actions={
                        <SimpleSelect
                            className="w-56"
                            options={statusOptions(['abierta', 'pendiente', 'cerrada'])}
                            value={filters.status}
                            allLabel="Todos los estados"
                            onChange={(status) => applyFilters({ status })}
                        />
                    }
                />
                <div className="surface overflow-hidden rounded-xl">
                    <DataTable
                        head={
                            <>
                                <Th>Caja</Th>
                                <Th>Cajero</Th>
                                <Th>Apertura</Th>
                                <Th>Cierre</Th>
                                <Th align="right">Esperado</Th>
                                <Th align="right">Contado</Th>
                                <Th align="right">Diferencia</Th>
                                <Th>Estado</Th>
                            </>
                        }
                    >
                        {sessions.data.map((s) => {
                            const diff = Number(s.difference ?? 0);
                            return (
                                <tr key={s.id}>
                                    <Td>
                                        <Link href={route('admin.cash.sessions.show', s.id)} className="font-medium hover:underline">
                                            {s.cash_register.name}
                                        </Link>
                                        <p className="text-muted-foreground text-xs">{s.branch.name}</p>
                                    </Td>
                                    <Td>{s.user?.name}</Td>
                                    <Td className="num text-muted-foreground whitespace-nowrap">{when(s.opened_at)}</Td>
                                    <Td className="num text-muted-foreground whitespace-nowrap">{when(s.closed_at)}</Td>
                                    <Td align="right">{s.expected_amount === null ? '—' : money(s.expected_amount)}</Td>
                                    <Td align="right">{s.counted_amount === null ? '—' : money(s.counted_amount)}</Td>
                                    <Td align="right" className={cn('font-medium', diff < 0 && 'text-red-600', diff > 0 && 'text-amber-600')}>
                                        {s.difference === null ? '—' : money(diff)}
                                    </Td>
                                    <Td>
                                        <DocStatus status={s.status} />
                                    </Td>
                                </tr>
                            );
                        })}
                        {sessions.data.length === 0 && <EmptyRow colSpan={8} text="Todavía no hay turnos." />}
                    </DataTable>
                    <Pagination paginator={sessions} itemName="turnos" />
                </div>
            </div>
        </AdminLayout>
    );
}
