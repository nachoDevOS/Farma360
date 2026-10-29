/*
 * PÁGINA: Detalle de transferencia  (ruta /admin/transfers/{id})
 * Recibir: TransferController@receive (solo la sucursal destino). Anular: TransferController@cancel (solo el origen, antes de recibir).
 */
import { ConfirmDialog, ReasonDialog } from '@/components/admin/common/confirm-dialog';
import { DataTable, Detail, Td, Th } from '@/components/admin/common/data-table';
import { DocStatus, ExpiryBadge } from '@/components/admin/common/doc-status';
import { PageHeader } from '@/components/admin/common/page-header';
import { Panel } from '@/components/admin/dashboard/panel';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import AdminLayout from '@/layouts/admin/admin-layout';
import { formatDate } from '@/lib/format';
import { type Transfer } from '@/types/admin/pharmacy';
import { Head, router } from '@inertiajs/react';
import { ArrowLeftRight, Ban, PackageCheck } from 'lucide-react';
import { useState } from 'react';

export default function TransferShow({ transfer, canReceive, canCancel }: { transfer: Transfer; canReceive: boolean; canCancel: boolean }) {
    const can = useCan();
    const [receiving, setReceiving] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const when = (date: string | null) => (date ? formatDate(date, { dateStyle: 'medium', timeStyle: 'short' }) : '—');

    return (
        <AdminLayout
            breadcrumbs={[
                { title: 'Transferencias', href: route('admin.transfers.index') },
                { title: transfer.number, href: '#' },
            ]}
        >
            <Head title={`Transferencia ${transfer.number}`} />
            <div className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                <PageHeader
                    icon={ArrowLeftRight}
                    title={`Transferencia ${transfer.number}`}
                    description={<DocStatus status={transfer.status} />}
                    actions={
                        <>
                            {canCancel && can('transferencias.anular') && (
                                <Button variant="outline" size="sm" onClick={() => setCancelling(true)}>
                                    <Ban /> Anular
                                </Button>
                            )}
                            {canReceive && can('transferencias.recibir') && (
                                <Button size="sm" className="btn-brand" onClick={() => setReceiving(true)}>
                                    <PackageCheck /> Recibir mercadería
                                </Button>
                            )}
                        </>
                    }
                />

                {transfer.status === 'anulada' && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm">
                        Anulada el {when(transfer.cancelled_at)} por {transfer.cancelled_by?.name}. Motivo: <strong>{transfer.cancel_reason}</strong>
                    </div>
                )}

                <Panel className="grid gap-4 p-5 sm:grid-cols-3 lg:grid-cols-6">
                    <Detail label="Origen">{transfer.from_branch.name}</Detail>
                    <Detail label="Destino">{transfer.to_branch.name}</Detail>
                    <Detail label="Envió">{transfer.registered_by?.name ?? '—'}</Detail>
                    <Detail label="Enviada">{when(transfer.created_at)}</Detail>
                    <Detail label="Recibió">{transfer.received_by?.name ?? '—'}</Detail>
                    <Detail label="Recibida">{when(transfer.received_at)}</Detail>
                    {transfer.note && (
                        <div className="sm:col-span-3 lg:col-span-6">
                            <Detail label="Nota">{transfer.note}</Detail>
                        </div>
                    )}
                </Panel>

                <Panel className="overflow-hidden">
                    <DataTable
                        head={
                            <>
                                <Th>Producto</Th>
                                <Th>Lote</Th>
                                <Th>Vencimiento</Th>
                                <Th align="right">Cantidad</Th>
                            </>
                        }
                    >
                        {transfer.items?.map((item) => (
                            <tr key={item.id}>
                                <Td className="font-medium">
                                    {item.product.name} {item.product.concentration}
                                </Td>
                                <Td className="num">{item.batch_number}</Td>
                                <Td>
                                    <ExpiryBadge date={item.expires_at} />
                                </Td>
                                <Td align="right">
                                    {item.quantity.toLocaleString('es')}{' '}
                                    <span className="text-muted-foreground text-xs">{item.product.base_unit}</span>
                                </Td>
                            </tr>
                        ))}
                    </DataTable>
                </Panel>
            </div>

            <ConfirmDialog
                open={receiving}
                onClose={() => setReceiving(false)}
                title="¿Recibir la mercadería?"
                description={`Confirma que llegó todo a ${transfer.to_branch.name}. El stock queda disponible en esa sucursal.`}
                confirmLabel="Recibir"
                onConfirm={(done) => router.post(route('admin.transfers.receive', transfer.id), {}, { preserveScroll: true, onFinish: done })}
            />
            <ReasonDialog
                open={cancelling}
                onClose={() => setCancelling(false)}
                title={`Anular ${transfer.number}`}
                description="La mercadería vuelve a los lotes de la sucursal de origen."
                url={route('admin.transfers.cancel', transfer.id)}
            />
        </AdminLayout>
    );
}
