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
import { countOf, packageSummary, plural } from '@/components/admin/products/presentation-levels';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import AdminLayout from '@/layouts/admin/admin-layout';
import { formatDate, formatDay, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Presentation, type Purchase, type PurchaseItem } from '@/types/admin/pharmacy';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Ban, Boxes, ChevronRight, ClipboardList, Eye, Info, Store, Truck, Wallet } from 'lucide-react';
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
/**
 * Cuánto queda en stock de lo que entró con esta compra: "30 de 30 tabletas · 1 caja", barra con color
 * (verde = casi todo, ámbar = poco, gris = agotado) y en palabras qué pasó: nada salió, salieron N o agotado.
 */
function StockLeft({
    left,
    units,
    percent,
    unit,
    pkg,
}: {
    left: number;
    units: number;
    percent: number;
    unit: string;
    pkg: { package: string; factor: number } | null;
}) {
    const out = units - left;
    const tone = left === 0 ? 'empty' : percent <= 25 ? 'low' : 'ok';
    const packages = pkg && left > 0 && left % pkg.factor === 0 ? countOf(left / pkg.factor, pkg.package) : null;

    return (
        <div className="w-44 text-xs">
            <div className="flex items-baseline justify-between gap-2">
                <span className="num">
                    <span className="text-foreground text-sm font-semibold">{left.toLocaleString('es')}</span>
                    <span className="text-muted-foreground">
                        {' '}
                        de {units.toLocaleString('es')} {plural(unit)}
                    </span>
                </span>
                <span
                    className={cn(
                        'num font-semibold',
                        tone === 'ok' && 'text-emerald-600 dark:text-emerald-400',
                        tone === 'low' && 'text-amber-600 dark:text-amber-400',
                        tone === 'empty' && 'text-muted-foreground',
                    )}
                >
                    {Math.round(percent)}%
                </span>
            </div>
            <div className="bg-muted mt-1 h-1.5 overflow-hidden rounded-full">
                <div
                    className={cn(
                        'h-full rounded-full transition-[width] duration-700 ease-out',
                        tone === 'ok' && 'bg-gradient-to-r from-emerald-500 to-teal-400',
                        tone === 'low' && 'bg-gradient-to-r from-amber-500 to-orange-400',
                    )}
                    style={{ width: `${percent}%` }}
                />
            </div>
            <p className="text-muted-foreground mt-1">
                {left === 0 ? (
                    <span className="font-medium">Agotado: salió todo</span>
                ) : out === 0 ? (
                    <>Nada salió aún{packages && <> · {packages}</>}</>
                ) : (
                    <>
                        Salieron <span className="num text-foreground/80 font-medium">{out.toLocaleString('es')}</span>
                        {packages && <> · quedan {packages}</>}
                    </>
                )}
            </p>
        </div>
    );
}

type ItemLevel = { package: string; count: number; unit: string };

/** Cómo viene el empaque comprado, de afuera hacia adentro: cada caja contiene 3 blísteres, cada blíster contiene 10 tabletas. */
function levelsOf(presentations: Presentation[], presentationId: number | undefined): ItemLevel[] {
    const levels: ItemLevel[] = [];
    let level = presentations.find((p) => p.id === presentationId);
    while (level?.parent_id) {
        const inner = presentations.find((p) => p.id === level?.parent_id);
        if (!inner || !level.contains) break;
        levels.push({
            package: level.package.toLowerCase(),
            count: level.contains,
            unit: level.contains === 1 ? inner.package.toLowerCase() : plural(inner.package),
        });
        level = inner;
    }
    return levels;
}

/**
 * Detalle de un producto de la compra (fila desplegada): qué es y cómo viene el empaque, y a cuánto se vende
 * cada presentación con el costo de esta compra (ganancia en Bs y %) y cuánto dejaría vender lo que queda.
 */
function ItemDetail({ item, left, unit }: { item: PurchaseItem; left: number; unit: string }) {
    const presentations = item.product.presentations ?? [];
    const levels = levelsOf(presentations, item.presentation?.id);
    const unitCost = Number(item.unit_cost);
    const prices = presentations
        .filter((p) => p.is_sellable && p.sale_price)
        .map((p) => {
            const cost = unitCost * p.factor;
            const price = Number(p.sale_price);
            return {
                id: p.id ?? p.name,
                name: p.name,
                factor: p.factor,
                cost,
                price,
                profit: price - cost,
                margin: price > 0 ? ((price - cost) / price) * 100 : 0,
            };
        });
    const smallest = prices[0];
    const facts = [
        { label: 'Genérico', value: item.product.generic_name },
        { label: 'Laboratorio', value: item.product.laboratory?.name },
        { label: 'Forma', value: item.product.pharmaceutical_form },
    ].filter((fact) => fact.value);

    return (
        <div className="animate-in fade-in slide-in-from-top-1 grid gap-3 duration-200 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <section className="bg-card ring-border rounded-lg p-4 ring-1">
                <h4 className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wider uppercase">Producto</h4>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                    {facts.map((fact) => (
                        <Fragment key={fact.label}>
                            <dt className="text-muted-foreground">{fact.label}</dt>
                            <dd className="min-w-0 font-medium break-words">{fact.value}</dd>
                        </Fragment>
                    ))}
                    <dt className="text-muted-foreground">Empaque</dt>
                    <dd>
                        {levels.length === 0 ? (
                            <span>Unidad suelta ({unit})</span>
                        ) : (
                            <ul className="grid gap-0.5">
                                {levels.map((level, i) => (
                                    <li key={i} className="flex items-center gap-1.5">
                                        <ChevronRight className="text-muted-foreground size-3 shrink-0" />
                                        <span>
                                            cada {level.package} contiene <span className="num font-semibold">{level.count}</span> {level.unit}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </dd>
                </dl>
            </section>

            <section className="bg-card ring-border rounded-lg p-4 ring-1">
                <h4 className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wider uppercase">Precios con el costo de esta compra</h4>
                {prices.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Este producto no tiene presentaciones a la venta.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-muted-foreground text-xs">
                                <th className="pb-1.5 text-left font-medium">Se vende por</th>
                                <th className="pb-1.5 text-right font-medium">Te cuesta</th>
                                <th className="pb-1.5 text-right font-medium">Precio</th>
                                <th className="pb-1.5 text-right font-medium">Ganas</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {prices.map((row) => (
                                <tr key={row.id}>
                                    <td className="py-1.5">{row.name}</td>
                                    <td className="num text-muted-foreground py-1.5 text-right">{money(row.cost)}</td>
                                    <td className="num py-1.5 text-right font-medium">{money(row.price)}</td>
                                    <td className="py-1.5 text-right">
                                        <span
                                            className={cn(
                                                'num font-semibold',
                                                row.profit < 0
                                                    ? 'text-red-600'
                                                    : row.margin < 15
                                                      ? 'text-amber-600'
                                                      : 'text-emerald-700 dark:text-emerald-400',
                                            )}
                                        >
                                            {money(row.profit)}
                                        </span>
                                        <span className="num text-muted-foreground ml-1 text-xs">({Math.round(row.margin)}%)</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {smallest && left > 0 && (
                    <p className="bg-primary/5 text-foreground/80 mt-3 rounded-md px-3 py-2 text-xs">
                        Si vendes las <span className="num font-semibold">{left.toLocaleString('es')}</span> {plural(unit)} que quedan al precio de «
                        {smallest.name}»: entran <span className="num font-semibold">{money((smallest.price / smallest.factor) * left)}</span> y ganas{' '}
                        <span className="num font-semibold text-emerald-700 dark:text-emerald-400">
                            {money(((smallest.price - smallest.cost) / smallest.factor) * left)}
                        </span>
                        .
                    </p>
                )}
            </section>
        </div>
    );
}

function ItemsTable({ purchase }: { purchase: Purchase }) {
    const can = useCan();
    const items = purchase.items ?? [];
    const cancelled = purchase.status === 'anulada';
    const [open, setOpen] = useState<Set<number>>(new Set(items.length === 1 ? [items[0].id] : []));
    const toggle = (id: number) =>
        setOpen((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    const columns = can('inventario.ver') ? 8 : 7;
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
                        <Th>Queda en stock</Th>
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
                    const isOpen = open.has(item.id);
                    return (
                        <Fragment key={item.id}>
                            <tr className={cn(isOpen && 'bg-muted/40')}>
                                <Td>
                                    <button
                                        type="button"
                                        onClick={() => toggle(item.id)}
                                        aria-expanded={isOpen}
                                        aria-label={isOpen ? 'Ocultar detalle del producto' : 'Ver detalle del producto'}
                                        className="hover:bg-muted -ml-1 flex items-start gap-1 rounded-md py-1 pr-2 pl-1 text-left"
                                    >
                                        <ChevronRight
                                            className={cn(
                                                'text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform duration-200',
                                                isOpen && 'text-primary rotate-90',
                                            )}
                                        />
                                        <span>
                                            <span className="block font-medium">
                                                {item.product.name}{' '}
                                                <span className="text-muted-foreground font-normal">{item.product.concentration}</span>
                                            </span>
                                            {item.presentation && (
                                                <span className="text-muted-foreground block text-xs">
                                                    {packageSummary(item.presentation.package, item.presentation.factor, unit)}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                </Td>
                                <Td>
                                    <span className="num font-medium">{item.batch_number}</span>
                                    <span className="mt-0.5 block">
                                        <ExpiryBadge date={item.expires_at} emptyLabel="Sin vencimiento" />
                                    </span>
                                </Td>
                                <Td align="right">
                                    <span className="num font-medium">
                                        {item.presentation ? countOf(item.quantity, item.presentation.package) : item.quantity}
                                    </span>
                                    <span className="text-foreground/80 block text-xs">
                                        = {item.units.toLocaleString('es')} {plural(unit)}
                                    </span>
                                </Td>
                                <Td align="right">
                                    <span className="num font-medium">{money(item.cost)}</span>
                                    <span className="text-foreground/80 num block text-xs">
                                        {money(unitCost)} c/{unit}
                                    </span>
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
                                        <StockLeft
                                            left={left}
                                            units={item.units}
                                            percent={percent}
                                            unit={unit}
                                            pkg={item.presentation && item.presentation.factor > 1 ? item.presentation : null}
                                        />
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
                                                    router.visit(
                                                        route('admin.inventory.show', { product: item.product.id, branch: purchase.branch.id }),
                                                    )
                                                }
                                            />
                                        </RowActions>
                                    </Td>
                                )}
                            </tr>
                            {isOpen && (
                                <tr className="bg-muted/40 hover:bg-muted/40!">
                                    <td colSpan={columns} className="px-4 pt-1 pb-4">
                                        <ItemDetail item={item} left={cancelled ? 0 : left} unit={unit} />
                                    </td>
                                </tr>
                            )}
                        </Fragment>
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
                «Ganancia»: precio de venta de una unidad contra lo que costó en esta compra.
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
                                    <ExpiryBadge date={lot.expires_at} emptyLabel="Sin vencimiento" />
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
