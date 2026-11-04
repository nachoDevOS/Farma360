/*
 * PÁGINA: Ventas  (ruta /admin/sales)
 * Datos: app/Http/Controllers/Admin/SaleController.php -> index()
 *
 * La flecha junto al número despliega los productos y el cobro. A la derecha: ver el detalle, imprimir el comprobante y anular
 * (SaleController@cancel, pide motivo). La venta anulada sale de la lista; solo se ve con el filtro de estado "Anulada".
 */
import { ReasonDialog } from '@/components/admin/common/confirm-dialog';
import { DataTable, Detail, EmptyRow, Td, Th } from '@/components/admin/common/data-table';
import { DocStatus, statusOptions } from '@/components/admin/common/doc-status';
import { PageHeader } from '@/components/admin/common/page-header';
import { PaymentBreakdown } from '@/components/admin/common/payment-breakdown';
import { ActionButton, RowActions } from '@/components/admin/common/row-actions';
import { SimpleSelect } from '@/components/admin/common/simple-select';
import { TableToolbar } from '@/components/admin/common/table-toolbar';
import { SaleItemsTable } from '@/components/admin/sales/sale-items-table';
import { TicketPrint } from '@/components/admin/sales/sale-ticket';
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
import { Head, Link, router } from '@inertiajs/react';
import { ChevronRight, Eye, Printer, Receipt, ShoppingCart, Trash2 } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';

interface Props {
    sales: Paginated<Sale>;
    filters: ListFilters;
    branches: Option[];
    paymentMethods: Record<string, string>;
}

export default function SalesIndex({ sales, filters, branches, paymentMethods }: Props) {
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    // Venta que se está mandando a la impresora (null = ninguna)
    const [printing, setPrinting] = useState<Sale | null>(null);
    // Venta que se está por anular (null = ninguna)
    const [cancelling, setCancelling] = useState<Sale | null>(null);
    const toggle = (id: number) =>
        setExpanded((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    const columns = 9;

    useEffect(() => {
        if (printing) {
            window.addEventListener('afterprint', () => setPrinting(null), { once: true });
            window.print();
        }
    }, [printing]);

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
                            options={statusOptions(['anulada'])}
                            value={filters.status}
                            allLabel="Completadas"
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
                                <Th align="right">Acciones</Th>
                            </>
                        }
                    >
                        {sales.data.map((sale) => {
                            const isOpen = expanded.has(sale.id);
                            return (
                                <Fragment key={sale.id}>
                                    <tr className={cn(sale.status === 'anulada' && 'opacity-60', isOpen && 'bg-muted/40')}>
                                        <Td>
                                            <button
                                                type="button"
                                                onClick={() => toggle(sale.id)}
                                                aria-expanded={isOpen}
                                                aria-label={isOpen ? 'Ocultar detalle' : 'Ver detalle'}
                                                className="hover:bg-muted inline-flex items-center gap-1 rounded-md py-1 pr-2 pl-1 text-left"
                                            >
                                                <ChevronRight
                                                    className={cn(
                                                        'text-muted-foreground size-4 shrink-0 transition-transform',
                                                        isOpen && 'text-primary rotate-90',
                                                    )}
                                                />
                                                <span className="num font-medium">{sale.number}</span>
                                            </button>
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
                                            <PaymentBreakdown payments={sale.payments} labels={paymentMethods} />
                                        </Td>
                                        <Td align="right" className="font-medium">
                                            {money(sale.total)}
                                        </Td>
                                        <Td>
                                            <DocStatus status={sale.status} />
                                        </Td>
                                        <Td align="right">
                                            <RowActions>
                                                <ActionButton
                                                    icon={Eye}
                                                    label="Ver detalle de la venta"
                                                    onClick={() => router.visit(route('admin.sales.show', sale.id))}
                                                />
                                                <ActionButton icon={Printer} label="Imprimir comprobante" onClick={() => setPrinting(sale)} />
                                                {can('ventas.anular') && (
                                                    <ActionButton
                                                        icon={Trash2}
                                                        label="Anular venta"
                                                        tone="danger"
                                                        onClick={() => setCancelling(sale)}
                                                        disabled={whyNotCancellable(sale) !== null}
                                                        disabledReason={whyNotCancellable(sale) ?? undefined}
                                                    />
                                                )}
                                            </RowActions>
                                        </Td>
                                    </tr>
                                    {isOpen && (
                                        <tr className="bg-muted/40 hover:bg-muted/40!">
                                            <td colSpan={columns} className="px-4 pt-1 pb-4">
                                                <SaleDetail sale={sale} paymentMethods={paymentMethods} />
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                        {sales.data.length === 0 && <EmptyRow colSpan={columns} text="No hay ventas con estos filtros." />}
                    </DataTable>
                    <Pagination paginator={sales} itemName="ventas" />
                    {printing && <TicketPrint sale={printing} paymentMethods={paymentMethods} />}
                </div>
            </div>

            {cancelling && (
                <ReasonDialog
                    open
                    onClose={() => setCancelling(null)}
                    title={`Anular venta ${cancelling.number}`}
                    url={route('admin.sales.cancel', cancelling.id)}
                />
            )}
        </AdminLayout>
    );
}

/** Por qué no se puede anular esta venta (null = sí se puede). Mismas reglas que SaleService::cancel. */
function whyNotCancellable(sale: Sale): string | null {
    if (sale.status !== 'completada') {
        return 'Esta venta ya está anulada';
    }
    return sale.cash_session?.status === 'abierta' ? null : 'El turno de caja de esta venta ya se cerró';
}

/** Detalle desplegable: los productos vendidos, de qué lote salieron y cómo se cobró. */
function SaleDetail({ sale, paymentMethods }: { sale: Sale; paymentMethods: Record<string, string> }) {
    const qrReference = sale.payments.find((payment) => payment.reference)?.reference;
    return (
        <div className="bg-card overflow-x-auto rounded-lg border">
            <SaleItemsTable sale={sale} />
            <dl className="bg-muted/30 grid gap-x-8 gap-y-3 border-t px-4 py-3 sm:grid-cols-2 xl:grid-cols-4">
                <Detail label="Subtotal">{money(sale.subtotal)}</Detail>
                {Number(sale.discount) > 0 && (
                    <Detail label="Descuento general">
                        {money(sale.discount)}
                        {sale.discount_reason && ` · ${sale.discount_reason}`}
                    </Detail>
                )}
                <Detail label="Cobrado">
                    <PaymentBreakdown payments={sale.payments} labels={paymentMethods} />
                </Detail>
                <Detail label="Efectivo recibido">{money(sale.cash_received)}</Detail>
                <Detail label="Cambio">{money(sale.change)}</Detail>
                {qrReference && <Detail label="N° de operación del QR">{qrReference}</Detail>}
                {sale.prescription_number && (
                    <Detail label="Receta">
                        {sale.prescription_number} · {sale.prescription_doctor}
                    </Detail>
                )}
                {sale.status === 'anulada' && (
                    <Detail label="Anulada">
                        {sale.cancelled_by?.name}
                        {sale.cancelled_at && `, ${formatDate(sale.cancelled_at, { dateStyle: 'short', timeStyle: 'short' })}`} · {sale.cancel_reason}
                    </Detail>
                )}
            </dl>
        </div>
    );
}
