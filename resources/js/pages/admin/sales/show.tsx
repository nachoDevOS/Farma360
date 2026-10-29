/*
 * PÁGINA: Comprobante de venta  (ruta /admin/sales/{id})
 * Botón Imprimir: imprime solo el ticket (ver clase print:hidden). Anular: SaleController@cancel.
 */
import { ReasonDialog } from '@/components/admin/common/confirm-dialog';
import { DocStatus, PromoBadge } from '@/components/admin/common/doc-status';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import AdminLayout from '@/layouts/admin/admin-layout';
import { formatDate, formatDay, money } from '@/lib/format';
import { type Sale } from '@/types/admin/pharmacy';
import { Head, Link } from '@inertiajs/react';
import { Ban, Printer, ShoppingCart } from 'lucide-react';
import { useState } from 'react';

export default function SaleShow({ sale, paymentMethods }: { sale: Sale; paymentMethods: Record<string, string> }) {
    const can = useCan();
    const [cancelling, setCancelling] = useState(false);
    const canCancel = can('ventas.anular') && sale.status === 'completada' && sale.cash_session?.status === 'abierta';

    return (
        <AdminLayout
            breadcrumbs={[
                { title: 'Ventas', href: route('admin.sales.index') },
                { title: sale.number, href: '#' },
            ]}
        >
            <Head title={`Venta ${sale.number}`} />
            <div className="flex w-full flex-1 flex-col items-center gap-6 p-4 md:p-8">
                <div className="flex w-full max-w-md flex-wrap justify-between gap-2 print:hidden">
                    <DocStatus status={sale.status} />
                    <div className="flex gap-2">
                        {canCancel && (
                            <Button variant="outline" size="sm" onClick={() => setCancelling(true)}>
                                <Ban /> Anular
                            </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => window.print()}>
                            <Printer /> Imprimir
                        </Button>
                        {can('ventas.crear') && (
                            <Button asChild size="sm" className="btn-brand">
                                <Link href={route('admin.pos')}>
                                    <ShoppingCart /> Nueva venta
                                </Link>
                            </Button>
                        )}
                    </div>
                </div>

                {sale.status === 'anulada' && (
                    <div className="w-full max-w-md rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm">
                        Anulada el {formatDate(sale.cancelled_at!, { dateStyle: 'medium', timeStyle: 'short' })} por {sale.cancelled_by?.name}.
                        Motivo: <strong>{sale.cancel_reason}</strong>
                    </div>
                )}

                {/* TICKET */}
                <div className="surface w-full max-w-md rounded-xl p-6 font-mono text-sm print:border-0 print:shadow-none">
                    <div className="text-center">
                        <p className="font-sans text-base font-semibold">{sale.branch.name}</p>
                        {sale.branch.address && <p className="text-muted-foreground text-xs">{sale.branch.address}</p>}
                        {sale.branch.phone && <p className="text-muted-foreground text-xs">Tel. {sale.branch.phone}</p>}
                        <p className="mt-3 font-semibold">COMPROBANTE {sale.number}</p>
                        <p className="text-muted-foreground text-xs">{formatDate(sale.created_at, { dateStyle: 'short', timeStyle: 'short' })}</p>
                    </div>
                    <div className="my-3 border-t border-dashed" />
                    <p>Cliente: {sale.customer_name}</p>
                    {sale.customer_document && <p>CI/NIT: {sale.customer_document}</p>}
                    {sale.prescription_number && (
                        <p>
                            Receta: {sale.prescription_number} · {sale.prescription_doctor}
                        </p>
                    )}
                    <div className="my-3 border-t border-dashed" />
                    <ul className="grid gap-2">
                        {sale.items?.map((item) => (
                            <li key={item.id}>
                                <p className="font-sans font-medium">
                                    {item.product.name} {item.product.concentration}
                                </p>
                                <div className="text-muted-foreground flex justify-between text-xs">
                                    <span>
                                        {item.units / item.factor} {item.presentation?.name} × {money(item.list_price, false)}
                                        {Number(item.discount_percent) > 0 && <PromoBadge percent={item.discount_percent} className="ml-1" />}
                                    </span>
                                    <span className="text-foreground">{money(item.subtotal, false)}</span>
                                </div>
                                <p className="text-muted-foreground text-[11px]">
                                    Lote {item.batch.batch_number} · vence {formatDay(item.batch.expires_at)}
                                </p>
                            </li>
                        ))}
                    </ul>
                    <div className="my-3 border-t border-dashed" />
                    <div className="flex justify-between text-base font-semibold">
                        <span>TOTAL</span>
                        <span>{money(sale.total)}</span>
                    </div>
                    {sale.payments.map((p) => (
                        <div key={p.id} className="text-muted-foreground flex justify-between text-xs">
                            <span>
                                {paymentMethods[p.method] ?? p.method}
                                {p.reference && ` (${p.reference})`}
                            </span>
                            <span>{money(p.method === 'efectivo' ? sale.cash_received : p.amount, false)}</span>
                        </div>
                    ))}
                    {Number(sale.change) > 0 && (
                        <div className="flex justify-between text-xs">
                            <span>Cambio</span>
                            <span>{money(sale.change, false)}</span>
                        </div>
                    )}
                    <div className="my-3 border-t border-dashed" />
                    <p className="text-muted-foreground text-center text-xs">Atendió: {sale.registered_by?.name}</p>
                    <p className="text-muted-foreground text-center text-xs">¡Gracias por su compra!</p>
                </div>
            </div>

            <ReasonDialog
                open={cancelling}
                onClose={() => setCancelling(false)}
                title={`Anular venta ${sale.number}`}
                description="El stock vuelve a los mismos lotes y la venta deja de contar en la caja. Queda registrado quién la anuló."
                url={route('admin.sales.cancel', sale.id)}
            />
        </AdminLayout>
    );
}
