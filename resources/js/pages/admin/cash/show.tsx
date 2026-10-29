/*
 * PÁGINA: Detalle de un turno de caja  (ruta /admin/cash/sessions/{id})
 * Arqueo (esperado vs contado), corte de billetes de apertura y cierre, movimientos y ventas.
 * Si quedó "pendiente", alguien con caja.aprobar lo aprueba aquí.
 */
import { CashThumb } from '@/components/admin/cash/bill-counter';
import { DataTable, Detail, EmptyRow, Td, Th } from '@/components/admin/common/data-table';
import { DocStatus } from '@/components/admin/common/doc-status';
import { PageHeader } from '@/components/admin/common/page-header';
import { Panel, PanelHeader } from '@/components/admin/dashboard/panel';
import InputError from '@/components/shared/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AdminLayout from '@/layouts/admin/admin-layout';
import { formatDate, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type CashCount, type CashSession, type CashSummary, type Sale } from '@/types/admin/pharmacy';
import { Head, Link, useForm } from '@inertiajs/react';
import { CheckCircle2, LoaderCircle, Wallet } from 'lucide-react';
import { FormEventHandler } from 'react';

interface Props {
    session: CashSession;
    summary: CashSummary;
    sales: Sale[];
    paymentMethods: Record<string, string>;
    movementTypes: Record<string, string>;
    canApprove: boolean;
}

export default function CashShow({ session, summary, sales, paymentMethods, movementTypes, canApprove }: Props) {
    const when = (date: string | null) => (date ? formatDate(date, { dateStyle: 'medium', timeStyle: 'short' }) : '—');
    const diff = Number(session.difference ?? 0);
    const opening = session.counts?.filter((c) => c.moment === 'apertura') ?? [];
    const closing = session.counts?.filter((c) => c.moment === 'cierre') ?? [];

    return (
        <AdminLayout
            breadcrumbs={[
                { title: 'Turnos de caja', href: route('admin.cash.sessions.index') },
                { title: `Turno #${session.id}`, href: '#' },
            ]}
        >
            <Head title={`Turno de caja #${session.id}`} />
            <div className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                <PageHeader
                    icon={Wallet}
                    title={`${session.cash_register.name} · ${session.branch.name}`}
                    description={<DocStatus status={session.status} />}
                />

                <Panel className="grid gap-4 p-5 sm:grid-cols-3 lg:grid-cols-6">
                    <Detail label="Cajero">{session.user?.name}</Detail>
                    <Detail label="Apertura">{when(session.opened_at)}</Detail>
                    <Detail label="Cierre">{when(session.closed_at)}</Detail>
                    <Detail label="Ventas">
                        {summary.sales_count} · {money(summary.sales_total)}
                    </Detail>
                    {Object.entries(summary.by_method).map(([method, total]) => (
                        <Detail key={method} label={paymentMethods[method] ?? method}>
                            {money(total)}
                        </Detail>
                    ))}
                </Panel>

                <Panel>
                    <PanelHeader
                        title="Arqueo de efectivo"
                        description="Esperado = fondo inicial + ventas en efectivo + ingresos − egresos − retiros."
                    />
                    <div className="grid gap-px overflow-hidden sm:grid-cols-2 lg:grid-cols-4">
                        <Line label="Fondo inicial" value={summary.opening} />
                        <Line label="+ Ventas en efectivo" value={summary.cash_sales} />
                        <Line label="+ Ingresos" value={summary.income} />
                        <Line label="− Egresos y retiros" value={-(summary.expense + summary.withdrawals)} />
                    </div>
                    <div className="grid gap-4 border-t p-5 sm:grid-cols-3">
                        <Detail label="Esperado">
                            <span className="num text-lg">
                                {session.expected_amount === null ? money(summary.expected) : money(session.expected_amount)}
                            </span>
                        </Detail>
                        <Detail label="Contado">
                            <span className="num text-lg">{session.counted_amount === null ? '—' : money(session.counted_amount)}</span>
                        </Detail>
                        <Detail label="Diferencia">
                            <span
                                className={cn(
                                    'num text-lg',
                                    diff < 0 && 'text-red-600',
                                    diff > 0 && 'text-amber-600',
                                    session.difference !== null && diff === 0 && 'text-emerald-600',
                                )}
                            >
                                {session.difference === null
                                    ? '—'
                                    : `${money(diff)} ${diff < 0 ? '(faltante)' : diff > 0 ? '(sobrante)' : '(cuadra)'}`}
                            </span>
                        </Detail>
                        {session.close_note && (
                            <div className="sm:col-span-3">
                                <Detail label="Observación del cajero">{session.close_note}</Detail>
                            </div>
                        )}
                        {session.reviewed_by && (
                            <div className="sm:col-span-3">
                                <Detail label={`Aprobado por ${session.reviewed_by.name} el ${when(session.reviewed_at)}`}>
                                    {session.review_note || '—'}
                                </Detail>
                            </div>
                        )}
                    </div>
                    {canApprove && <ApproveForm sessionId={session.id} />}
                </Panel>

                <div className="grid gap-6 lg:grid-cols-2">
                    <CountTable title="Corte de apertura" counts={opening} />
                    <CountTable title="Corte de cierre" counts={closing} />
                </div>

                <Panel className="overflow-hidden">
                    <PanelHeader title="Movimientos de efectivo" />
                    <DataTable
                        head={
                            <>
                                <Th>Hora</Th>
                                <Th>Tipo</Th>
                                <Th>Motivo</Th>
                                <Th align="right">Monto</Th>
                            </>
                        }
                    >
                        {session.movements?.map((m) => (
                            <tr key={m.id}>
                                <Td className="num text-muted-foreground">{formatDate(m.created_at, { timeStyle: 'short' })}</Td>
                                <Td>{movementTypes[m.type]}</Td>
                                <Td>{m.reason}</Td>
                                <Td align="right">{money(m.amount)}</Td>
                            </tr>
                        ))}
                        {!session.movements?.length && <EmptyRow colSpan={4} text="Sin movimientos." />}
                    </DataTable>
                </Panel>

                <Panel className="overflow-hidden">
                    <PanelHeader title="Ventas del turno" />
                    <DataTable
                        head={
                            <>
                                <Th>N°</Th>
                                <Th>Hora</Th>
                                <Th>Cliente</Th>
                                <Th>Pago</Th>
                                <Th align="right">Total</Th>
                                <Th>Estado</Th>
                            </>
                        }
                    >
                        {sales.map((sale) => (
                            <tr key={sale.id}>
                                <Td>
                                    <Link href={route('admin.sales.show', sale.id)} className="num font-medium hover:underline">
                                        {sale.number}
                                    </Link>
                                </Td>
                                <Td className="num text-muted-foreground">{formatDate(sale.created_at, { timeStyle: 'short' })}</Td>
                                <Td>{sale.customer_name}</Td>
                                <Td className="text-muted-foreground">
                                    {sale.payments.map((p) => paymentMethods[p.method] ?? p.method).join(' + ')}
                                </Td>
                                <Td align="right">{money(sale.total)}</Td>
                                <Td>
                                    <DocStatus status={sale.status} />
                                </Td>
                            </tr>
                        ))}
                        {sales.length === 0 && <EmptyRow colSpan={6} text="Sin ventas." />}
                    </DataTable>
                </Panel>
            </div>
        </AdminLayout>
    );
}

function Line({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex flex-col gap-1 px-5 py-4">
            <span className="text-muted-foreground text-xs">{label}</span>
            <span className="num font-medium">{money(value)}</span>
        </div>
    );
}

function CountTable({ title, counts }: { title: string; counts: CashCount[] }) {
    const total = counts.reduce((sum, c) => sum + Number(c.subtotal), 0);
    return (
        <Panel className="overflow-hidden">
            <PanelHeader title={title} aside={<span className="num text-sm font-semibold">{money(total)}</span>} />
            <DataTable
                head={
                    <>
                        <Th>Valor</Th>
                        <Th align="right">Cantidad</Th>
                        <Th align="right">Subtotal</Th>
                    </>
                }
            >
                {counts.map((c) => (
                    <tr key={c.id}>
                        <Td>
                            <span className="flex items-center gap-3">
                                <CashThumb value={c.value} />
                                <span className="num font-medium">{money(c.value)}</span>
                            </span>
                        </Td>
                        <Td align="right">{c.quantity}</Td>
                        <Td align="right">{money(c.subtotal)}</Td>
                    </tr>
                ))}
                {counts.length === 0 && <EmptyRow colSpan={3} text="Sin conteo." />}
            </DataTable>
        </Panel>
    );
}

function ApproveForm({ sessionId }: { sessionId: number }) {
    const { data, setData, post, processing, errors } = useForm({ note: '' });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('admin.cash.sessions.approve', sessionId), { preserveScroll: true });
    };

    return (
        <form onSubmit={submit} className="flex flex-col gap-2 border-t bg-amber-500/5 p-5 sm:flex-row sm:items-start">
            <div className="flex-1">
                <Input value={data.note} onChange={(e) => setData('note', e.target.value)} placeholder="Comentario de la revisión (opcional)" />
                <InputError message={errors.note} />
            </div>
            <Button type="submit" className="btn-brand" disabled={processing}>
                {processing ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 />}
                Aprobar cierre
            </Button>
        </form>
    );
}
