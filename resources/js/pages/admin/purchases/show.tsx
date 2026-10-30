/*
 * PÁGINA: Detalle de compra  (ruta /admin/purchases/{id})
 * Datos: PurchaseController@show. Anular: PurchaseController@cancel (pide motivo).
 *
 * Arriba: total, proveedor, sucursal y cuánto de lo comprado sigue en stock. Pestañas (una a la vez):
 * - Productos: cada ítem con lote y vencimiento, lo que se compró, el costo contra la compra anterior (subió / bajó),
 *   la ganancia contra el precio de venta, cuánto queda en el lote y el ojo para ver su inventario.
 * - Lotes: qué pasó con cada lote de la compra (registro completo, inventory/batch-detail.tsx). Solo con inventario.ver.
 * - Datos: proveedor, factura, quién la registró y, si se anuló, quién, cuándo y por qué.
 */
import { ReasonDialog } from '@/components/admin/common/confirm-dialog';
import { DataTable, Detail, Td, Th } from '@/components/admin/common/data-table';
import { DocStatus, ExpiryBadge } from '@/components/admin/common/doc-status';
import { PageHeader } from '@/components/admin/common/page-header';
import { ActionButton, RowActions } from '@/components/admin/common/row-actions';
import { SegmentedControl } from '@/components/admin/common/segmented-control';
import { StatCard, StatGrid } from '@/components/admin/common/stat-card';
import { Panel, PanelHeader } from '@/components/admin/dashboard/panel';
import { BatchDetail, BatchOrigin, type BatchWithDetail } from '@/components/admin/inventory/batch-detail';
import { plural } from '@/components/admin/products/presentation-levels';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import AdminLayout from '@/layouts/admin/admin-layout';
import { formatDate, formatDay, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Purchase, type PurchaseItem } from '@/types/admin/pharmacy';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Ban, Boxes, ChevronRight, ClipboardList, Eye, Info, Store, Truck, Wallet } from 'lucide-react';
import { Fragment, useState } from 'react';

interface Props {
    purchase: Purchase;
    /** Lotes de la compra con su registro (vacío sin inventario.ver) */
    lots: BatchWithDetail[];
    movementTypes: Record<string, string>;
}

const dateTime: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };

export default function PurchaseShow({ purchase, lots, movementTypes }: Props) {
    const can = useCan();
    const [cancelling, setCancelling] = useState(false);
    const [tab, setTab] = useState<'productos' | 'lotes' | 'datos'>('productos');
    const items = purchase.items ?? [];
    const cancelled = purchase.status === 'anulada';
    const bought = items.reduce((sum, i) => sum + i.units, 0);
    const left = items.reduce((sum, i) => sum + Math.min(i.units, i.remaining ?? 0), 0);
    const leftValue = items.reduce((sum, i) => sum + Math.min(i.units, i.remaining ?? 0) * Number(i.unit_cost), 0);
    const percentLeft = bought > 0 ? (left / bought) * 100 : 0;

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
                    description={
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <DocStatus status={purchase.status} />
                            <span>
                                · {purchase.supplier.name} · {formatDay(purchase.purchased_at)}
                                {purchase.invoice_number && ` · Factura ${purchase.invoice_number}`}
                            </span>
                        </span>
                    }
                    actions={
                        <>
                            <Button asChild variant="outline" size="sm">
                                <Link href={route('admin.purchases.index')}>
                                    <ArrowLeft /> Volver
                                </Link>
                            </Button>
                            {can('compras.anular') && purchase.status === 'registrada' && (
                                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setCancelling(true)}>
                                    <Ban /> Anular compra
                                </Button>
                            )}
                        </>
                    }
                />

                {cancelled && (
                    <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm">
                        <Ban className="mt-0.5 size-4 shrink-0 text-red-600" />
                        <p>
                            Anulada el {formatDate(purchase.cancelled_at!, dateTime)} por {purchase.cancelled_by?.name ?? '—'}. Motivo:{' '}
                            <strong>{purchase.cancel_reason}</strong>. Lo que entró con esta compra se descontó del stock.
                        </p>
                    </div>
                )}

                <StatGrid>
                    <StatCard
                        compact
                        icon={Wallet}
                        tone="blue"
                        label="Total de la compra"
                        value={money(purchase.total)}
                        hint={`${items.length} ${items.length === 1 ? 'producto' : 'productos'} · ${bought.toLocaleString('es')} unidades`}
                    />
                    <StatCard
                        compact
                        icon={Truck}
                        tone="violet"
                        label="Proveedor"
                        value={purchase.supplier.name}
                        hint={
                            [purchase.supplier.nit && `NIT ${purchase.supplier.nit}`, purchase.supplier.phone].filter(Boolean).join(' · ') ||
                            'Sin NIT'
                        }
                    />
                    <StatCard
                        compact
                        icon={Store}
                        tone="slate"
                        label="Recibido en"
                        value={purchase.branch.name}
                        hint={`${formatDay(purchase.purchased_at)} · registró ${purchase.registered_by?.name ?? '—'}`}
                    />
                    <StatCard
                        compact
                        icon={Boxes}
                        tone={cancelled ? 'slate' : 'green'}
                        label="Queda en stock"
                        value={cancelled ? '—' : `${Math.round(percentLeft)}%`}
                        hint={
                            cancelled
                                ? 'Compra anulada'
                                : `${left.toLocaleString('es')} de ${bought.toLocaleString('es')} unidades · ${money(leftValue)}`
                        }
                    />
                </StatGrid>

                <div className="grid gap-3">
                    <SegmentedControl
                        label="Secciones de la compra"
                        value={tab}
                        onChange={setTab}
                        className="w-fit"
                        options={[
                            { value: 'productos', label: 'Productos', count: items.length },
                            ...(lots.length > 0 ? [{ value: 'lotes' as const, label: 'Lotes', count: lots.length }] : []),
                            { value: 'datos', label: 'Datos' },
                        ]}
                    />

                    {tab === 'productos' && <ItemsTable purchase={purchase} />}
                    {tab === 'lotes' && <LotsList purchase={purchase} lots={lots} movementTypes={movementTypes} />}
                    {tab === 'datos' && <PurchaseData purchase={purchase} />}
                </div>
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

/** "▲ +25% que la compra anterior" en rojo (subió), "▼ −10%" en verde (bajó). */
function CostChange({ item }: { item: PurchaseItem }) {
    if (item.previous_unit_cost === null || item.previous_unit_cost === undefined) {
        return <span className="text-muted-foreground block text-[11px]">Primera compra</span>;
    }
    const change = item.previous_unit_cost > 0 ? ((Number(item.unit_cost) - item.previous_unit_cost) / item.previous_unit_cost) * 100 : 0;
    if (Math.abs(change) < 0.5) {
        return <span className="text-muted-foreground block text-[11px]">Igual que la compra anterior</span>;
    }
    const up = change > 0;
    const Icon = up ? ArrowUpRight : ArrowDownRight;
    return (
        <span
            className={cn(
                'flex items-center justify-end gap-0.5 text-[11px] font-medium',
                up ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400',
            )}
            title={`Antes: ${money(item.previous_unit_cost)} c/u`}
        >
            <Icon className="size-3" />
            {up ? '+' : '−'}
            {Math.abs(Math.round(change))}% vs anterior
        </span>
    );
}

function ItemsTable({ purchase }: { purchase: Purchase }) {
    const can = useCan();
    const items = purchase.items ?? [];
    const cancelled = purchase.status === 'anulada';
    return (
        <Panel className="overflow-hidden">
            <DataTable
                head={
                    <>
                        <Th>Producto</Th>
                        <Th>Lote</Th>
                        <Th align="right">Compró</Th>
                        <Th align="right">Costo</Th>
                        <Th align="right">Ganancia</Th>
                        <Th>Queda</Th>
                        <Th align="right">Subtotal</Th>
                        {can('inventario.ver') && <Th align="right">Ver</Th>}
                    </>
                }
            >
                {items.map((item) => {
                    const unitCost = Number(item.unit_cost);
                    const margin = item.sale_unit_price ? ((item.sale_unit_price - unitCost) / item.sale_unit_price) * 100 : null;
                    const left = Math.min(item.units, item.remaining ?? 0);
                    const percent = item.units > 0 ? (left / item.units) * 100 : 0;
                    const unit = item.product.base_unit?.toLowerCase() ?? 'unidad';
                    return (
                        <tr key={item.id}>
                            <Td>
                                <p className="font-medium">
                                    {item.product.name} <span className="text-muted-foreground font-normal">{item.product.concentration}</span>
                                </p>
                                <p className="text-muted-foreground text-xs">{item.presentation?.name}</p>
                            </Td>
                            <Td>
                                <span className="num font-medium">{item.batch_number}</span>
                                <span className="mt-0.5 block">
                                    <ExpiryBadge date={item.expires_at} />
                                </span>
                            </Td>
                            <Td align="right">
                                <span className="num font-medium">{item.quantity}</span>
                                <span className="text-muted-foreground"> × {item.presentation?.name ?? '—'}</span>
                                <span className="text-foreground/80 block text-xs">
                                    = {item.units.toLocaleString('es')} {plural(unit)}
                                </span>
                            </Td>
                            <Td align="right">
                                <span className="num font-medium">{money(item.cost)}</span>
                                <span className="text-foreground/80 num block text-xs">
                                    {money(unitCost)} c/{unit}
                                </span>
                                <CostChange item={item} />
                            </Td>
                            <Td align="right">
                                {margin === null ? (
                                    <span className="text-muted-foreground text-xs">No se vende suelto</span>
                                ) : (
                                    <>
                                        <span
                                            className={cn(
                                                'num font-semibold',
                                                margin < 0
                                                    ? 'text-red-600'
                                                    : margin < 15
                                                      ? 'text-amber-600'
                                                      : 'text-emerald-700 dark:text-emerald-400',
                                            )}
                                        >
                                            {Math.round(margin)}%
                                        </span>
                                        <span className="text-muted-foreground num block text-[11px]">
                                            vende a {money(item.sale_unit_price)} c/{unit}
                                        </span>
                                    </>
                                )}
                            </Td>
                            <Td>
                                {cancelled ? (
                                    <span className="text-muted-foreground text-xs">Anulada</span>
                                ) : (
                                    <div className="w-32">
                                        <span className="num text-xs">
                                            <span className="font-semibold">{left.toLocaleString('es')}</span>
                                            <span className="text-muted-foreground"> de {item.units.toLocaleString('es')}</span>
                                        </span>
                                        <div className="bg-muted mt-1 h-1.5 overflow-hidden rounded-full">
                                            <div className="bg-chart-1 h-full rounded-full" style={{ width: `${percent}%` }} />
                                        </div>
                                    </div>
                                )}
                            </Td>
                            <Td align="right" className="num font-semibold">
                                {money(item.subtotal)}
                            </Td>
                            {can('inventario.ver') && (
                                <Td align="right">
                                    <RowActions>
                                        <ActionButton
                                            icon={Eye}
                                            label="Ver inventario del producto en esta sucursal"
                                            onClick={() =>
                                                router.visit(route('admin.inventory.show', { product: item.product.id, branch: purchase.branch.id }))
                                            }
                                        />
                                    </RowActions>
                                </Td>
                            )}
                        </tr>
                    );
                })}
                <tr className="bg-muted/30">
                    <Td colSpan={6} className="text-right font-medium">
                        Total
                    </Td>
                    <Td align="right" className="num text-base font-bold">
                        {money(purchase.total)}
                    </Td>
                    {can('inventario.ver') && <Td />}
                </tr>
            </DataTable>
            <p className="text-muted-foreground border-t px-5 py-3 text-xs">
                «Ganancia»: precio de venta de una unidad contra lo que costó en esta compra. «vs anterior»: el costo por unidad comparado con la
                compra anterior del mismo producto (rojo = subió).
            </p>
        </Panel>
    );
}

function LotsList({ purchase, lots, movementTypes }: { purchase: Purchase; lots: BatchWithDetail[]; movementTypes: Record<string, string> }) {
    const [open, setOpen] = useState<Set<number>>(new Set(lots.length === 1 ? [lots[0].id] : []));
    const toggle = (id: number) =>
        setOpen((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    const itemOf = (lot: BatchWithDetail) => (purchase.items ?? []).find((i) => i.batch_id === lot.id);

    return (
        <Panel className="overflow-hidden">
            <PanelHeader
                icon={Boxes}
                title="Qué pasó con lo comprado"
                description="Cada lote que entró con esta compra: cuánto se vendió, transfirió, ajustó o dio de baja. Toca un lote para ver su historial."
            />
            <DataTable
                head={
                    <>
                        <Th>Lote</Th>
                        <Th>Producto</Th>
                        <Th>Vence</Th>
                        <Th align="right">Entró → Queda</Th>
                        <Th>Origen</Th>
                    </>
                }
            >
                {lots.map((lot) => {
                    const item = itemOf(lot);
                    const isOpen = open.has(lot.id);
                    return (
                        <Fragment key={lot.id}>
                            <tr className={cn(isOpen && 'bg-muted/40')}>
                                <Td className="w-px">
                                    <button
                                        type="button"
                                        onClick={() => toggle(lot.id)}
                                        aria-expanded={isOpen}
                                        aria-label={isOpen ? 'Ocultar registro del lote' : 'Ver registro del lote'}
                                        className="hover:bg-muted inline-flex items-center gap-1 rounded-md py-1 pr-2 pl-1 whitespace-nowrap"
                                    >
                                        <ChevronRight
                                            className={cn('text-muted-foreground size-4 transition-transform', isOpen && 'text-primary rotate-90')}
                                        />
                                        <span className="num font-medium">{lot.batch_number}</span>
                                    </button>
                                </Td>
                                <Td className="font-medium">{item ? `${item.product.name} ${item.product.concentration ?? ''}` : '—'}</Td>
                                <Td>
                                    <ExpiryBadge date={lot.expires_at} />
                                </Td>
                                <Td align="right" className="num">
                                    <span className="text-muted-foreground">{lot.initial.toLocaleString('es')} → </span>
                                    <span className="font-semibold">{lot.quantity.toLocaleString('es')}</span>
                                </Td>
                                <Td>
                                    <BatchOrigin batch={lot} />
                                </Td>
                            </tr>
                            {isOpen && (
                                <tr className="bg-muted/40 hover:bg-muted/40!">
                                    <td colSpan={5} className="px-4 pt-1 pb-4">
                                        <BatchDetail
                                            batch={lot}
                                            units={plural(item?.product.base_unit ?? 'unidad')}
                                            movementTypes={movementTypes}
                                            onSeeAll={() =>
                                                item &&
                                                router.visit(route('admin.inventory.show', { product: item.product.id, branch: purchase.branch.id }))
                                            }
                                        />
                                    </td>
                                </tr>
                            )}
                        </Fragment>
                    );
                })}
            </DataTable>
        </Panel>
    );
}

function PurchaseData({ purchase }: { purchase: Purchase }) {
    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
                <PanelHeader icon={Info} title="Datos de la compra" aside={<DocStatus status={purchase.status} />} />
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-5">
                    <Detail label="Número">{purchase.number}</Detail>
                    <Detail label="Factura / nota">{purchase.invoice_number || '—'}</Detail>
                    <Detail label="Fecha de compra">{formatDay(purchase.purchased_at)}</Detail>
                    <Detail label="Sucursal">{purchase.branch.name}</Detail>
                    <Detail label="Proveedor">{purchase.supplier.name}</Detail>
                    <Detail label="NIT">{purchase.supplier.nit || '—'}</Detail>
                    <Detail label="Teléfono del proveedor">{purchase.supplier.phone || '—'}</Detail>
                    <Detail label="Total">{money(purchase.total)}</Detail>
                    {purchase.note && (
                        <div className="col-span-2">
                            <Detail label="Nota">{purchase.note}</Detail>
                        </div>
                    )}
                </div>
            </Panel>
            <Panel>
                <PanelHeader icon={ClipboardList} title="Registro" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-5">
                    <Detail label="Registró">
                        {purchase.registered_by?.name ?? '—'}
                        {purchase.registerRole && <span className="text-muted-foreground font-normal"> · {purchase.registerRole}</span>}
                    </Detail>
                    <Detail label="Fecha de registro">{formatDate(purchase.created_at, dateTime)}</Detail>
                    {purchase.status === 'anulada' && (
                        <>
                            <Detail label="Anuló">{purchase.cancelled_by?.name ?? '—'}</Detail>
                            <Detail label="Fecha de anulación">{purchase.cancelled_at ? formatDate(purchase.cancelled_at, dateTime) : '—'}</Detail>
                            <div className="col-span-2">
                                <Detail label="Motivo">{purchase.cancel_reason ?? '—'}</Detail>
                            </div>
                        </>
                    )}
                </div>
            </Panel>
        </div>
    );
}
