/*
 * PÁGINA: Ver una caja  (ruta /admin/cash-registers/{id}, botón "Ver caja" de la lista de Cajas)
 * Datos: app/Http/Controllers/Admin/CashRegisterController.php -> show()
 *
 * Arriba el turno que está abierto ahora (quién, desde cuándo, cuánto lleva), los números de la caja y su historial de turnos,
 * paginado en el servidor. El detalle de cada turno es la pantalla de siempre (cash/show.tsx), que pide caja.aprobar o ser su cajero.
 */
import { DataTable, Detail, EmptyRow, Td, Th } from '@/components/admin/common/data-table';
import { DocStatus, statusOptions } from '@/components/admin/common/doc-status';
import { PageHeader } from '@/components/admin/common/page-header';
import { ActionButton, RowActions } from '@/components/admin/common/row-actions';
import { SimpleSelect } from '@/components/admin/common/simple-select';
import { StatCard, StatGrid } from '@/components/admin/common/stat-card';
import { ALL } from '@/components/admin/common/table-toolbar';
import { Panel, PanelHeader } from '@/components/admin/dashboard/panel';
import { Pagination } from '@/components/shared/pagination';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import AdminLayout from '@/layouts/admin/admin-layout';
import { formatDate, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Paginated } from '@/types';
import { type CashSession, type CashSummary, type ListFilters, type Option } from '@/types/admin/pharmacy';
import { Head, Link, router } from '@inertiajs/react';
import { BadgeDollarSign, ClipboardCheck, Eye, History, Monitor, Scale, Wallet } from 'lucide-react';

/** Un turno del historial: lo de siempre más lo que vendió. */
type RegisterSession = Omit<CashSession, 'cash_register' | 'branch'> & {
    sales_count: number;
    sales_total: string | null;
};

interface Props {
    register: { id: number; name: string; is_active: boolean; branch: Option };
    current: RegisterSession | null;
    /** expected llega null si el que mira es el cajero de ese turno y el cierre es ciego */
    summary: (Omit<CashSummary, 'expected'> & { expected: number | null }) | null;
    stats: { sessions: number; month_sales: number; pending: number; difference: number };
    sessions: Paginated<RegisterSession>;
    filters: ListFilters;
    paymentMethods: Record<string, string>;
}

const when = (date: string | null) => (date ? formatDate(date, { dateStyle: 'short', timeStyle: 'short' }) : '—');

export default function CashRegisterShow({ register, current, summary, stats, sessions, filters, paymentMethods }: Props) {
    const can = useCan();
    const canOpenSession = can('caja.aprobar');

    const filterByStatus = (status: string) =>
        router.get(route('admin.cash-registers.show', register.id), status === ALL ? {} : { status }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });

    return (
        <AdminLayout
            breadcrumbs={[
                { title: 'Cajas', href: route('admin.cash-registers.index') },
                { title: register.name, href: '#' },
            ]}
        >
            <Head title={`${register.name} · ${register.branch.name}`} />
            <div className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                <PageHeader
                    icon={Monitor}
                    title={`${register.name} · ${register.branch.name}`}
                    description={register.is_active ? 'Caja activa' : 'Caja desactivada: no se puede abrir un turno'}
                />

                <Panel className="overflow-hidden">
                    <div className={cn('h-1', current ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
                    {current && summary ? (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
                                <div className="flex min-w-0 items-center gap-3">
                                    <Wallet className="text-primary size-5 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="flex items-center gap-2 text-sm font-semibold">
                                            Turno abierto <DocStatus status={current.status} />
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                            {current.user?.name} · desde {when(current.opened_at)}
                                        </p>
                                    </div>
                                </div>
                                {canOpenSession && (
                                    <Button asChild size="sm" variant="outline">
                                        <Link href={route('admin.cash.sessions.show', current.id)}>Ver turno</Link>
                                    </Button>
                                )}
                            </div>
                            <div className="grid gap-4 p-5 sm:grid-cols-3 lg:grid-cols-6">
                                <Detail label="Apertura">{money(summary.opening)}</Detail>
                                <Detail label="Ventas">
                                    {summary.sales_count} · {money(summary.sales_total)}
                                </Detail>
                                {Object.entries(summary.by_method).map(([method, total]) => (
                                    <Detail key={method} label={paymentMethods[method] ?? method}>
                                        {money(total)}
                                    </Detail>
                                ))}
                                {summary.expected !== null && (
                                    <Detail label="Efectivo esperado">
                                        <span className="font-semibold">{money(summary.expected)}</span>
                                    </Detail>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center gap-3 px-5 py-4">
                            <Wallet className="text-muted-foreground size-5 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold">Sin turno abierto</p>
                                <p className="text-muted-foreground text-xs">Nadie está trabajando en esta caja ahora.</p>
                            </div>
                        </div>
                    )}
                </Panel>

                <StatGrid>
                    <StatCard icon={History} label="Turnos" value={stats.sessions.toLocaleString('es')} compact />
                    <StatCard icon={BadgeDollarSign} label="Ventas del mes" value={money(stats.month_sales)} tone="green" compact />
                    <StatCard
                        icon={ClipboardCheck}
                        label="Cierres por aprobar"
                        value={stats.pending}
                        tone={stats.pending > 0 ? 'amber' : 'blue'}
                        compact
                    />
                    <StatCard
                        icon={Scale}
                        label="Diferencia acumulada"
                        value={money(stats.difference)}
                        tone={stats.difference < 0 ? 'red' : 'blue'}
                        hint="Faltantes y sobrantes de los arqueos"
                        compact
                    />
                </StatGrid>

                <Panel className="overflow-hidden">
                    <PanelHeader
                        icon={History}
                        title="Historial de turnos"
                        description="Aperturas, cierres y diferencias del arqueo."
                        aside={
                            <SimpleSelect
                                className="w-44"
                                options={statusOptions(['abierta', 'pendiente', 'cerrada'])}
                                value={filters.status}
                                allLabel="Todos los estados"
                                onChange={filterByStatus}
                            />
                        }
                    />
                    <DataTable
                        head={
                            <>
                                <Th>Cajero</Th>
                                <Th>Apertura</Th>
                                <Th>Cierre</Th>
                                <Th align="right">Ventas</Th>
                                <Th align="right">Esperado</Th>
                                <Th align="right">Contado</Th>
                                <Th align="right">Diferencia</Th>
                                <Th>Estado</Th>
                                {canOpenSession && <Th align="right">Acciones</Th>}
                            </>
                        }
                    >
                        {sessions.data.map((session) => {
                            const difference = Number(session.difference ?? 0);
                            return (
                                <tr key={session.id}>
                                    <Td className="font-medium">{session.user?.name}</Td>
                                    <Td className="num text-muted-foreground whitespace-nowrap">{when(session.opened_at)}</Td>
                                    <Td className="num text-muted-foreground whitespace-nowrap">{when(session.closed_at)}</Td>
                                    <Td align="right">
                                        {money(session.sales_total ?? 0)}
                                        <p className="text-muted-foreground text-xs">
                                            {session.sales_count} {session.sales_count === 1 ? 'venta' : 'ventas'}
                                        </p>
                                    </Td>
                                    <Td align="right">{session.expected_amount === null ? '—' : money(session.expected_amount)}</Td>
                                    <Td align="right">{session.counted_amount === null ? '—' : money(session.counted_amount)}</Td>
                                    <Td
                                        align="right"
                                        className={cn('font-medium', difference < 0 && 'text-red-600', difference > 0 && 'text-amber-600')}
                                    >
                                        {session.difference === null ? '—' : money(difference)}
                                    </Td>
                                    <Td>
                                        <DocStatus status={session.status} />
                                    </Td>
                                    {canOpenSession && (
                                        <Td align="right">
                                            <RowActions>
                                                <ActionButton
                                                    icon={Eye}
                                                    label="Ver turno"
                                                    onClick={() => router.visit(route('admin.cash.sessions.show', session.id))}
                                                />
                                            </RowActions>
                                        </Td>
                                    )}
                                </tr>
                            );
                        })}
                        {sessions.data.length === 0 && <EmptyRow colSpan={canOpenSession ? 9 : 8} text="Esta caja todavía no tiene turnos." />}
                    </DataTable>
                    <Pagination paginator={sessions} itemName="turnos" />
                </Panel>
            </div>
        </AdminLayout>
    );
}
