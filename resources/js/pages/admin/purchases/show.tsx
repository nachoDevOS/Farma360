/*
 * PÁGINA: Detalle de compra  (ruta /admin/purchases/{id})
 * Datos: PurchaseController@show. Anular: PurchaseController@cancel (pide motivo).
 */
import { ReasonDialog } from '@/components/admin/common/confirm-dialog';
import { DataTable, Detail, Td, Th } from '@/components/admin/common/data-table';
import { DocStatus, ExpiryBadge } from '@/components/admin/common/doc-status';
import { PageHeader } from '@/components/admin/common/page-header';
import { Panel } from '@/components/admin/dashboard/panel';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import AdminLayout from '@/layouts/admin/admin-layout';
import { formatDate, formatDay, money } from '@/lib/format';
import { type Purchase } from '@/types/admin/pharmacy';
import { Head } from '@inertiajs/react';
import { Ban, ClipboardList } from 'lucide-react';
import { useState } from 'react';

export default function PurchaseShow({ purchase }: { purchase: Purchase }) {
    const can = useCan();
    const [cancelling, setCancelling] = useState(false);

    return (
        <AdminLayout
            breadcrumbs={[
                { title: 'Compras', href: route('admin.purchases.index') },
                { title: purchase.number, href: '#' },
            ]}
        >
            <Head title={`Compra ${purchase.number}`} />
            <div className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                <PageHeader
                    icon={ClipboardList}
                    title={`Compra ${purchase.number}`}
                    description={<DocStatus status={purchase.status} />}
                    actions={
                        can('compras.anular') &&
                        purchase.status === 'registrada' && (
                            <Button variant="outline" size="sm" onClick={() => setCancelling(true)}>
                                <Ban /> Anular compra
                            </Button>
                        )
                    }
                />

                {purchase.status === 'anulada' && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm">
                        Anulada el {formatDate(purchase.cancelled_at!, { dateStyle: 'medium', timeStyle: 'short' })} por {purchase.cancelled_by?.name}
                        . Motivo: <strong>{purchase.cancel_reason}</strong>
                    </div>
                )}

                <Panel className="grid gap-4 p-5 sm:grid-cols-3 lg:grid-cols-6">
                    <Detail label="Proveedor">{purchase.supplier.name}</Detail>
                    <Detail label="NIT">{purchase.supplier.nit || '—'}</Detail>
                    <Detail label="Sucursal">{purchase.branch.name}</Detail>
                    <Detail label="Factura / nota">{purchase.invoice_number || '—'}</Detail>
                    <Detail label="Fecha">{formatDay(purchase.purchased_at)}</Detail>
                    <Detail label="Registró">{purchase.registered_by?.name ?? '—'}</Detail>
                </Panel>

                <Panel className="overflow-hidden">
                    <DataTable
                        head={
                            <>
                                <Th>Producto</Th>
                                <Th>Lote</Th>
                                <Th>Vencimiento</Th>
                                <Th align="right">Cantidad</Th>
                                <Th align="right">Unidades</Th>
                                <Th align="right">Costo</Th>
                                <Th align="right">Subtotal</Th>
                            </>
                        }
                    >
                        {purchase.items?.map((item) => (
                            <tr key={item.id}>
                                <Td>
                                    <p className="font-medium">
                                        {item.product.name} {item.product.concentration}
                                    </p>
                                    <p className="text-muted-foreground text-xs">{item.presentation?.name}</p>
                                </Td>
                                <Td className="num">{item.batch_number}</Td>
                                <Td>
                                    <ExpiryBadge date={item.expires_at} />
                                </Td>
                                <Td align="right">{item.quantity}</Td>
                                <Td align="right">{item.units.toLocaleString('es')}</Td>
                                <Td align="right">
                                    {money(item.cost)}
                                    <p className="text-muted-foreground text-xs">{money(item.unit_cost)} c/u</p>
                                </Td>
                                <Td align="right" className="font-medium">
                                    {money(item.subtotal)}
                                </Td>
                            </tr>
                        ))}
                        <tr className="bg-muted/30">
                            <Td colSpan={6} className="text-right font-medium">
                                Total
                            </Td>
                            <Td align="right" className="text-base font-semibold">
                                {money(purchase.total)}
                            </Td>
                        </tr>
                    </DataTable>
                </Panel>
            </div>

            <ReasonDialog
                open={cancelling}
                onClose={() => setCancelling(false)}
                title={`Anular compra ${purchase.number}`}
                description="Se descuenta del stock todo lo que entró con esta compra. Solo es posible si esos lotes todavía no se vendieron ni transfirieron."
                url={route('admin.purchases.cancel', purchase.id)}
            />
        </AdminLayout>
    );
}
