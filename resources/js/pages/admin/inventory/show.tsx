/*
 * PÁGINA: Inventario de un producto  (ruta /admin/inventory/{producto}?branch=)
 * Indicadores (stock con su desglose, valor del stock, próximo vencimiento, stock en otras sucursales), presentaciones
 * con "Alcanza para" y, en pestañas (una a la vez): Lotes (origen, vencimiento, cuánto entró y cuánto queda, costo,
 * promoción, ajustes; cada fila se despliega con el registro completo del lote: batch-detail.tsx) · Movimientos (kardex)
 * · Gráficos (stock-charts.tsx).
 * "Ingreso sin compra" (inventario inicial) se carga por presentación, como una compra: 3 Caja x100 a Bs 40 → 300 tabletas.
 * La sucursal se elige arriba a la derecha con el mismo botón de la ficha del producto (common/branch-menu.tsx):
 * cada sucursal con su stock y un punto rojo si está bajo el mínimo.
 * Datos: InventoryController@show · Ajustes: InventoryController@adjust
 */
import { BranchMenu } from '@/components/admin/common/branch-menu';
import { DataTable, EmptyRow, Td, Th } from '@/components/admin/common/data-table';
import { ExpiryBadge, PromoBadge } from '@/components/admin/common/doc-status';
import { PageHeader } from '@/components/admin/common/page-header';
import { QuantityInput } from '@/components/admin/common/quantity-input';
import { ActionButton, RowActions } from '@/components/admin/common/row-actions';
import { SegmentedControl } from '@/components/admin/common/segmented-control';
import { SimpleSelect } from '@/components/admin/common/simple-select';
import { StatCard, StatGrid } from '@/components/admin/common/stat-card';
import { StockLeft } from '@/components/admin/common/stock-left';
import { Panel, PanelHeader } from '@/components/admin/dashboard/panel';
import { BatchDetail, BatchOrigin, type BatchWithDetail } from '@/components/admin/inventory/batch-detail';
import { StockCharts, type StockDay } from '@/components/admin/inventory/stock-charts';
import { plural } from '@/components/admin/products/presentation-levels';
import { PresentationsTable, StockScopeBadge } from '@/components/admin/products/product-row-detail';
import { StockBreakdown } from '@/components/admin/products/stock-breakdown';
import InputError from '@/components/shared/input-error';
import { Pagination } from '@/components/shared/pagination';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCan } from '@/hooks/use-can';
import AdminLayout from '@/layouts/admin/admin-layout';
import { formatDate, formatDay, money, today } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Paginated } from '@/types';
import { type Batch, type Option, type Product, type StockMovement } from '@/types/admin/pharmacy';
import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowRight,
    Boxes,
    CalendarClock,
    ChevronRight,
    Eye,
    Layers,
    Lightbulb,
    LoaderCircle,
    Minus,
    PackageX,
    Pencil,
    Plus,
    Wallet,
    Warehouse,
    X,
} from 'lucide-react';
import { FormEventHandler, Fragment, useEffect, useState } from 'react';

interface Props {
    product: Product;
    branches: Option[];
    branchId: number;
    stock: number;
    /** Lotes con su registro (origen, cuenta e historial). Ver InventoryController@batchDetails */
    batches: BatchWithDetail[];
    movements: Paginated<StockMovement>;
    movementTypes: Record<string, string>;
    /** Últimos 90 días del stock en la sucursal, un día por fila (para los gráficos) */
    history: StockDay[];
    /** Costo de lo que hay en la sucursal (Σ unidades × costo del lote) */
    stockValue: number;
    /** Stock del producto en las demás sucursales (allowed = el usuario puede abrirla) */
    otherBranches: { id: number; name: string; stock: number; allowed: boolean }[];
    /** Días antes del vencimiento en que se avisa (config farmacia.expiry_alert_days) */
    alertDays: number;
    /** Último costo por unidad base registrado del producto (sugerencia en el ingreso sin compra). Null = nunca tuvo lotes */
    lastUnitCost: number | null;
}

type Mode = 'new' | 'in' | 'out' | 'writeoff';

const modeTitles: Record<Mode, string> = {
    new: 'Ingreso sin compra',
    in: 'Ajuste de entrada',
    out: 'Ajuste de salida',
    writeoff: 'Baja por vencimiento o daño',
};

export default function InventoryShow({
    product,
    branches,
    branchId,
    stock,
    batches,
    movements,
    movementTypes,
    history,
    stockValue,
    otherBranches,
    alertDays,
    lastUnitCost,
}: Props) {
    const can = useCan();
    const [adjust, setAdjust] = useState<{ mode: Mode; batch: Batch | null } | null>(null);
    // Lotes desplegados (registro completo)
    const [openBatches, setOpenBatches] = useState<Set<number>>(new Set());
    const toggleBatch = (id: number) =>
        setOpenBatches((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    // Sucursal a la que se está cambiando (el botón la muestra y su ícono gira mientras carga)
    const [switchingTo, setSwitchingTo] = useState<number | null>(null);
    const chooseBranch = (branch: number | null) =>
        router.get(
            route('admin.inventory.show', { product: product.id, branch }),
            {},
            { preserveScroll: true, onStart: () => setSwitchingTo(branch), onFinish: () => setSwitchingTo(null) },
        );
    // Una sección a la vez (la paginación del kardex conserva la pestaña elegida)
    const [tab, setTab] = useState<'lotes' | 'kardex' | 'graficos'>('lotes');

    const units = plural(product.base_unit);
    const branchName = branches.find((b) => b.id === branchId)?.name ?? 'Esta sucursal';
    const lots = batches.filter((b) => b.stock > 0);
    const nextExpiry = lots.flatMap((b) => (b.expires_at ? [b.expires_at.slice(0, 10)] : [])).sort()[0] ?? null;
    const daysLeft = nextExpiry ? daysUntil(nextExpiry) : null;
    const otherTotal = otherBranches.reduce((sum, b) => sum + b.stock, 0);
    const control = product.is_controlled ? 'Controlado' : product.requires_prescription ? 'Con receta' : 'Venta libre';

    return (
        <AdminLayout
            breadcrumbs={[
                { title: 'Inventario', href: route('admin.inventory.index', { branch: branchId }) },
                { title: product.name, href: '#' },
            ]}
        >
            <Head title={`Inventario · ${product.name}`} />
            <div className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                <PageHeader
                    icon={Boxes}
                    title={`${product.name} ${product.concentration ?? ''}`}
                    description={[product.generic_name, product.pharmaceutical_form, product.laboratory?.name, control].filter(Boolean).join(' · ')}
                    actions={
                        <>
                            {branches.length > 1 && (
                                <BranchMenu
                                    note="Lotes, movimientos y gráficos son de la sucursal elegida."
                                    current={switchingTo ?? branchId}
                                    loading={switchingTo !== null}
                                    onChoose={chooseBranch}
                                    options={branches.map((b) => {
                                        const branchStock = b.id === branchId ? stock : (otherBranches.find((o) => o.id === b.id)?.stock ?? 0);
                                        const low = product.min_stock > 0 && branchStock <= product.min_stock;
                                        return {
                                            id: Number(b.id),
                                            name: b.name,
                                            detail: `Stock ${branchStock.toLocaleString('es')} ${units}${branchStock === 0 ? '' : low ? ' · bajo el mínimo' : ''}`,
                                            dot: branchStock === 0 ? 'slate' : low ? 'red' : 'green',
                                        };
                                    })}
                                />
                            )}
                            {can('inventario.ajustar') && (
                                <Button size="sm" className="btn-brand" onClick={() => setAdjust({ mode: 'new', batch: null })}>
                                    <Plus /> Ingreso sin compra
                                </Button>
                            )}
                        </>
                    }
                />

                <StatGrid>
                    <StatCard
                        compact
                        icon={Boxes}
                        label="Stock en la sucursal"
                        value={`${stock.toLocaleString('es')} ${units}`}
                        tone={product.min_stock === 0 ? 'amber' : stock <= product.min_stock ? 'red' : 'blue'}
                        colorValue={product.min_stock > 0 && stock <= product.min_stock}
                        hint={
                            <>
                                <StockBreakdown units={stock} product={product} />
                                {product.min_stock === 0 ? (
                                    <span className="text-amber-700 dark:text-amber-400">Sin stock mínimo configurado</span>
                                ) : stock <= product.min_stock ? (
                                    <span className="text-red-600">Bajo el mínimo ({product.min_stock.toLocaleString('es')})</span>
                                ) : (
                                    `Mínimo ${product.min_stock.toLocaleString('es')}`
                                )}
                            </>
                        }
                    />
                    <StatCard
                        compact
                        icon={Wallet}
                        label="Valor del stock"
                        value={money(stockValue)}
                        tone="violet"
                        hint={stock > 0 ? `Costo promedio ${money(stockValue / stock)} c/${product.base_unit.toLowerCase()}` : 'Sin stock'}
                    />
                    <StatCard
                        compact
                        icon={CalendarClock}
                        label="Próximo vencimiento"
                        value={nextExpiry ? formatDay(nextExpiry) : '—'}
                        tone={daysLeft === null ? 'slate' : daysLeft < 0 ? 'red' : daysLeft <= alertDays ? 'amber' : 'green'}
                        colorValue={daysLeft !== null && daysLeft <= alertDays}
                        hint={
                            daysLeft === null
                                ? 'Sin lotes con stock'
                                : `${daysLeft < 0 ? `Vencido hace ${-daysLeft} días` : daysLeft === 0 ? 'Vence hoy' : `En ${daysLeft} días`} · ${lots.length} ${lots.length === 1 ? 'lote' : 'lotes'}`
                        }
                    />
                    <StatCard
                        compact
                        icon={Warehouse}
                        label="En otras sucursales"
                        value={`${otherTotal.toLocaleString('es')} ${units}`}
                        tone="slate"
                        hint={
                            otherBranches.length === 0 ? (
                                'No hay otras sucursales'
                            ) : (
                                <span className="flex flex-wrap gap-x-2">
                                    {otherBranches.map((b) => (
                                        <span key={b.id}>
                                            {b.allowed ? (
                                                <Link
                                                    href={route('admin.inventory.show', { product: product.id, branch: b.id })}
                                                    className="text-primary hover:underline"
                                                >
                                                    {b.name}
                                                </Link>
                                            ) : (
                                                b.name
                                            )}
                                            : <span className="num">{b.stock.toLocaleString('es')}</span>
                                        </span>
                                    ))}
                                </span>
                            )
                        }
                    />
                </StatGrid>

                <Panel>
                    <PanelHeader
                        icon={Layers}
                        title="Presentaciones"
                        description="«Alcanza para»: cuántas completas alcanzan con el stock de esta sucursal. Precios y códigos: en «Ver producto»."
                        aside={
                            <div className="flex flex-wrap items-center gap-2">
                                <StockScopeBadge label={branchName} />
                                <Button asChild variant="outline" size="sm">
                                    <Link href={route('admin.products.show', { product: product.id, branch: branchId })}>
                                        <Eye /> Ver producto
                                    </Link>
                                </Button>
                                {can('productos.editar') && (
                                    <Button asChild variant="outline" size="sm">
                                        <Link href={route('admin.products.edit', product.id)}>
                                            <Pencil /> Editar
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        }
                    />
                    <div className="p-5">
                        <PresentationsTable product={product} stock={stock} stockScope={branchName} compact className="text-[13px]" />
                    </div>
                </Panel>

                <div className="grid gap-3">
                    <SegmentedControl
                        label="Secciones del inventario"
                        value={tab}
                        onChange={setTab}
                        className="w-fit"
                        options={[
                            { value: 'lotes', label: 'Lotes', count: lots.length },
                            { value: 'kardex', label: 'Movimientos', count: movements.total },
                            { value: 'graficos', label: 'Gráficos' },
                        ]}
                    />

                    {tab === 'lotes' && (
                        <Panel className="overflow-hidden">
                            <PanelHeader
                                title="Lotes"
                                description="Se venden primero los que vencen antes (FEFO). Los vencidos no se pueden vender. Toca un lote para ver de dónde vino y todo lo que pasó con él."
                            />
                            <DataTable
                                head={
                                    <>
                                        <Th>Lote</Th>
                                        <Th>Origen</Th>
                                        <Th>Vencimiento</Th>
                                        <Th>Queda en stock</Th>
                                        <Th align="right">Costo c/u</Th>
                                        <Th>Promoción</Th>
                                        {can('inventario.ajustar') && <Th align="right">Ajustar</Th>}
                                    </>
                                }
                            >
                                {batches.map((batch) => {
                                    const isOpen = openBatches.has(batch.id);
                                    return (
                                        <Fragment key={batch.id}>
                                            <tr className={cn(batch.stock === 0 && !isOpen && 'opacity-50', isOpen && 'bg-muted/40')}>
                                                <Td className="w-px">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleBatch(batch.id)}
                                                        aria-expanded={isOpen}
                                                        aria-label={isOpen ? 'Ocultar registro del lote' : 'Ver registro del lote'}
                                                        className="hover:bg-muted inline-flex items-center gap-1 rounded-md py-1 pr-2 pl-1 whitespace-nowrap"
                                                    >
                                                        <ChevronRight
                                                            className={cn(
                                                                'text-muted-foreground size-4 transition-transform',
                                                                isOpen && 'text-primary rotate-90',
                                                            )}
                                                        />
                                                        <span className="num font-medium">{batch.batch_number}</span>
                                                    </button>
                                                </Td>
                                                <Td>
                                                    <BatchOrigin batch={batch} />
                                                </Td>
                                                <Td>
                                                    <ExpiryBadge date={batch.expires_at} emptyLabel="Sin vencimiento" />
                                                </Td>
                                                <Td>
                                                    <StockLeft left={batch.stock} total={batch.received_quantity} unit={product.base_unit} />
                                                </Td>
                                                <Td align="right">{money(batch.unit_cost)}</Td>
                                                <Td>
                                                    {batch.active_promotion ? <PromoBadge percent={batch.active_promotion.discount_percent} /> : '—'}
                                                </Td>
                                                {can('inventario.ajustar') && (
                                                    <Td align="right">
                                                        <RowActions>
                                                            <ActionButton
                                                                icon={Plus}
                                                                label="Entrada: al contar hay más de lo que dice el sistema"
                                                                tone="success"
                                                                onClick={() => setAdjust({ mode: 'in', batch })}
                                                            />
                                                            <ActionButton
                                                                icon={Minus}
                                                                label="Salida: al contar faltan unidades"
                                                                tone="warning"
                                                                onClick={() => setAdjust({ mode: 'out', batch })}
                                                                disabled={batch.stock === 0}
                                                            />
                                                            <ActionButton
                                                                icon={PackageX}
                                                                label="Dar de baja: vencido o dañado (pérdida)"
                                                                tone="danger"
                                                                onClick={() => setAdjust({ mode: 'writeoff', batch })}
                                                                disabled={batch.stock === 0}
                                                            />
                                                        </RowActions>
                                                    </Td>
                                                )}
                                            </tr>
                                            {isOpen && (
                                                <tr className="bg-muted/40 hover:bg-muted/40!">
                                                    <td colSpan={can('inventario.ajustar') ? 7 : 6} className="px-4 pt-1 pb-4">
                                                        <BatchDetail
                                                            batch={batch}
                                                            units={units}
                                                            movementTypes={movementTypes}
                                                            onSeeAll={() => setTab('kardex')}
                                                        />
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                                {batches.length === 0 && <EmptyRow colSpan={7} text="No hay lotes en esta sucursal." />}
                            </DataTable>
                        </Panel>
                    )}

                    {tab === 'kardex' && (
                        <Panel className="overflow-hidden">
                            <PanelHeader
                                title="Movimientos (kardex)"
                                description="Cada entrada y salida del producto en esta sucursal. No se edita ni se borra."
                            />
                            <DataTable
                                head={
                                    <>
                                        <Th>Fecha</Th>
                                        <Th>Movimiento</Th>
                                        <Th>Lote</Th>
                                        <Th align="right">Cantidad</Th>
                                        <Th align="right">Saldo</Th>
                                        <Th>Usuario</Th>
                                        <Th>Nota</Th>
                                    </>
                                }
                            >
                                {movements.data.map((m) => (
                                    <tr key={m.id}>
                                        <Td className="num text-muted-foreground whitespace-nowrap">
                                            {formatDate(m.created_at, { dateStyle: 'short', timeStyle: 'short' })}
                                        </Td>
                                        <Td>{movementTypes[m.type] ?? m.type}</Td>
                                        <Td className="num">{m.batch?.batch_number}</Td>
                                        <Td align="right" className={cn('font-medium', m.quantity > 0 ? 'text-emerald-600' : 'text-red-600')}>
                                            {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                                        </Td>
                                        <Td align="right">{m.balance.toLocaleString('es')}</Td>
                                        <Td className="text-muted-foreground">{m.registered_by?.name ?? 'Sistema'}</Td>
                                        <Td className="text-muted-foreground">{m.note ?? '—'}</Td>
                                    </tr>
                                ))}
                                {movements.data.length === 0 && <EmptyRow colSpan={7} text="Sin movimientos." />}
                            </DataTable>
                            <Pagination paginator={movements} itemName="movimientos" />
                        </Panel>
                    )}

                    {tab === 'graficos' && (
                        <StockCharts history={history} minStock={product.min_stock} baseUnit={product.base_unit} movementTypes={movementTypes} />
                    )}
                </div>
            </div>

            <AdjustDialog
                product={product}
                branchId={branchId}
                branchName={branchName}
                stock={stock}
                lastUnitCost={lastUnitCost}
                adjust={adjust}
                onClose={() => setAdjust(null)}
            />
        </AdminLayout>
    );
}

/** Motivos frecuentes del ingreso sin compra (quedan en el kardex). "Otro" deja escribir uno. */
const ENTRY_REASONS = ['Inventario inicial', 'Donación', 'Devolución de cliente', 'Corrección de conteo'];

function AdjustDialog({
    product,
    branchId,
    branchName,
    stock,
    lastUnitCost,
    adjust,
    onClose,
}: {
    product: Product;
    branchId: number;
    branchName: string;
    stock: number;
    lastUnitCost: number | null;
    adjust: { mode: Mode; batch: Batch | null } | null;
    onClose: () => void;
}) {
    // Ingreso sin compra: por defecto la presentación más grande que se compra (normalmente la caja)
    const defaultPresentation = String(
        ([...product.presentations].reverse().find((p) => p.is_purchasable) ?? product.presentations.at(-1))?.id ?? '',
    );
    const { data, setData, post, processing, errors, reset, clearErrors, transform } = useForm({
        mode: 'new' as Mode,
        batch_id: '',
        product_id: String(product.id),
        branch_id: String(branchId),
        batch_number: '',
        expires_at: '',
        no_expiry: false as boolean,
        // Solo en "Ingreso sin compra": líneas por presentación (1 caja + 5 blísteres) y el costo de compra de UNA presentación
        items: [{ product_presentation_id: defaultPresentation, quantity: '' }],
        cost: '',
        cost_presentation_id: defaultPresentation,
        // En los demás ajustes: cantidad en unidades base
        quantity: '',
        note: '',
    });
    // El costo se pide por la misma presentación que la primera línea, hasta que el usuario elija otra
    const [costLinked, setCostLinked] = useState(true);
    const [noLot, setNoLot] = useState(false);
    const [otherReason, setOtherReason] = useState(false);

    useEffect(() => {
        if (!adjust) return;
        reset();
        clearErrors();
        setCostLinked(true);
        setNoLot(false);
        setOtherReason(false);
        setData((d) => ({ ...d, mode: adjust.mode, batch_id: adjust.batch ? String(adjust.batch.id) : '', branch_id: String(branchId) }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [adjust]);

    const err = errors as Record<string, string | undefined>;
    const unitsLabel = plural(product.base_unit);
    const unitName = product.base_unit.toLowerCase();
    const factorOf = (id: string) => product.presentations.find((p) => String(p.id) === id)?.factor ?? 0;
    const presentationOptions = product.presentations.map((p) => ({ id: p.id as number, name: p.name }));
    const units = data.items.reduce((sum, item) => sum + Number(item.quantity || 0) * factorOf(item.product_presentation_id), 0);
    const costFactor = factorOf(data.cost_presentation_id);
    const unitCost = costFactor > 0 && data.cost !== '' ? Number(data.cost) / costFactor : null;
    const costPresentation = product.presentations.find((p) => String(p.id) === data.cost_presentation_id);
    const unused = product.presentations.filter((p) => !data.items.some((item) => item.product_presentation_id === String(p.id)));

    // Precio de venta más bajo por unidad (la presentación que deja menos): contra eso se mide la ganancia
    const salePrices = product.presentations
        .filter((p) => p.is_sellable && p.sale_price !== null && p.factor > 0)
        .map((p) => Number(p.sale_price) / p.factor);
    const unitSalePrice = salePrices.length ? Math.min(...salePrices) : null;
    const profit = unitCost !== null && unitSalePrice !== null ? unitSalePrice - unitCost : null;
    const marginPercent = profit !== null && unitSalePrice ? (profit / unitSalePrice) * 100 : null;
    const margin: 'loss' | 'low' | 'ok' | null = marginPercent === null ? null : marginPercent <= 0 ? 'loss' : marginPercent < 10 ? 'low' : 'ok';

    // Último costo conocido, en la presentación del costo: "Bs 14,50 el blíster"
    const suggestedCost = lastUnitCost !== null && costFactor > 0 ? Math.round(lastUnitCost * costFactor * 100) / 100 : null;

    const setItem = (index: number, patch: Partial<(typeof data.items)[number]>) =>
        setData((d) => {
            const items = d.items.map((item, i) => (i === index ? { ...item, ...patch } : item));
            const followCost = index === 0 && costLinked && patch.product_presentation_id;
            return { ...d, items, cost_presentation_id: followCost ? patch.product_presentation_id! : d.cost_presentation_id };
        });

    const chooseReason = (reason: string | null) => {
        setOtherReason(reason === null);
        setData('note', reason ?? '');
    };

    const mode = adjust?.mode ?? 'new';

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        // Entrada, salida y baja de un lote: solo lo que piden (sin los campos vacíos del ingreso sin compra)
        transform((d) =>
            d.mode === 'new'
                ? { ...d, batch_number: noLot ? '' : d.batch_number, expires_at: d.no_expiry ? '' : d.expires_at }
                : { mode: d.mode, batch_id: d.batch_id, quantity: d.quantity, note: d.note },
        );
        post(route('admin.inventory.adjust'), { preserveScroll: true, onSuccess: () => onClose() });
    };

    // Errores de campos que esta ventana no muestra junto a un campo: se listan abajo, para que nunca falle en silencio
    const shown =
        mode === 'new'
            ? (key: string) =>
                  key.startsWith('items') || ['cost', 'cost_presentation_id', 'batch_number', 'expires_at', 'no_expiry', 'note'].includes(key)
            : (key: string) => ['quantity', 'note'].includes(key);
    const otherErrors = Object.entries(err).filter(([key, message]) => message && !shown(key));

    return (
        <Dialog open={adjust !== null} onOpenChange={(value) => !value && onClose()}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
                <form onSubmit={submit} className="grid gap-5">
                    <DialogHeader>
                        <DialogTitle>{modeTitles[mode]}</DialogTitle>
                        <DialogDescription>
                            {adjust?.batch
                                ? `Lote ${adjust.batch.batch_number} · hay ${adjust.batch.stock} ${product.base_unit}.`
                                : 'Para mercadería que no vino de una compra: inventario inicial, donación, devolución o corrección de conteo.'}{' '}
                            Queda registrado en el kardex con tu usuario.
                        </DialogDescription>
                    </DialogHeader>
                    {mode === 'new' ? (
                        <>
                            {/* Por qué entra: motivos frecuentes como botones (quedan en el kardex) */}
                            <div className="grid gap-2">
                                <Label>
                                    ¿Por qué entra? <span className="text-muted-foreground font-normal">(opcional)</span>
                                </Label>
                                <div className="flex flex-wrap gap-1.5">
                                    {ENTRY_REASONS.map((reason) => (
                                        <ReasonChip
                                            key={reason}
                                            active={!otherReason && data.note === reason}
                                            onClick={() => chooseReason(data.note === reason && !otherReason ? '' : reason)}
                                        >
                                            {reason}
                                        </ReasonChip>
                                    ))}
                                    <ReasonChip active={otherReason} onClick={() => (otherReason ? chooseReason('') : chooseReason(null))}>
                                        Otro…
                                    </ReasonChip>
                                </div>
                                {otherReason && (
                                    <Input
                                        value={data.note}
                                        onChange={(e) => setData('note', e.target.value)}
                                        placeholder="Escribe el motivo"
                                        autoFocus
                                    />
                                )}
                                <InputError message={errors.note} />
                            </div>

                            {/* ① Qué hay en el estante, por presentación: 1 caja + 5 blísteres */}
                            <Step
                                n={1}
                                title="¿Cuánto entra?"
                                aside={
                                    units > 0 && (
                                        <span className="num text-primary font-semibold">
                                            = {units.toLocaleString('es')} {unitsLabel}
                                        </span>
                                    )
                                }
                            >
                                {data.items.map((item, i) => (
                                    <div key={i} className="grid gap-1">
                                        <div className="flex items-start gap-2">
                                            <QuantityInput
                                                min={1}
                                                value={item.quantity}
                                                onChange={(value) => setItem(i, { quantity: value })}
                                                placeholder="Cant."
                                                aria-label="Cantidad"
                                                wrapperClassName="w-24 shrink-0"
                                                autoFocus={i === 0}
                                            />
                                            <SimpleSelect
                                                options={presentationOptions.filter(
                                                    (o) => String(o.id) === item.product_presentation_id || unused.some((p) => p.id === o.id),
                                                )}
                                                value={item.product_presentation_id}
                                                onChange={(value) => setItem(i, { product_presentation_id: value })}
                                                className="h-9 min-w-0 flex-1"
                                            />
                                            {data.items.length > 1 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-600 hover:text-red-700"
                                                    onClick={() =>
                                                        setData(
                                                            'items',
                                                            data.items.filter((_, j) => j !== i),
                                                        )
                                                    }
                                                    aria-label="Quitar línea"
                                                >
                                                    <X className="size-4" />
                                                </Button>
                                            )}
                                        </div>
                                        <InputError message={err[`items.${i}.quantity`] ?? err[`items.${i}.product_presentation_id`]} />
                                    </div>
                                ))}
                                <InputError message={err.items} />
                                {unused.length > 0 && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="w-fit"
                                        onClick={() =>
                                            setData('items', [
                                                ...data.items,
                                                { product_presentation_id: String(unused[unused.length - 1].id), quantity: '' },
                                            ])
                                        }
                                    >
                                        <Plus /> Agregar otra presentación
                                    </Button>
                                )}
                            </Step>

                            {/* ② Costo de compra (no el precio de venta) de una presentación: el sistema saca el de cada unidad */}
                            <Step
                                n={2}
                                title="¿Cuánto costó?"
                                aside={<span className="text-muted-foreground text-xs">el costo, no el precio de venta</span>}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="relative w-32 shrink-0">
                                        <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                                            Bs
                                        </span>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min={0}
                                            value={data.cost}
                                            onChange={(e) => setData('cost', e.target.value)}
                                            placeholder="0,00"
                                            className="num pl-9 text-right"
                                            aria-label="Costo de compra"
                                        />
                                    </div>
                                    <span className="text-muted-foreground shrink-0 text-sm">por</span>
                                    <SimpleSelect
                                        options={presentationOptions}
                                        value={data.cost_presentation_id}
                                        onChange={(value) => {
                                            setCostLinked(false);
                                            setData('cost_presentation_id', value);
                                        }}
                                        className="h-9 min-w-0 flex-1"
                                    />
                                </div>
                                <InputError message={err.cost ?? err.cost_presentation_id} />

                                {/* Sugerencia: el último costo conocido del producto */}
                                {suggestedCost !== null && Number(data.cost) !== suggestedCost && (
                                    <div className="bg-primary/5 ring-primary/15 flex items-center gap-2 rounded-lg px-3 py-2 text-xs ring-1">
                                        <Lightbulb className="text-primary size-4 shrink-0" />
                                        <span className="flex-1">
                                            Último costo registrado: <span className="num font-semibold">{money(suggestedCost)}</span> por{' '}
                                            {costPresentation?.package.toLowerCase()}
                                        </span>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-7"
                                            onClick={() => setData('cost', suggestedCost.toFixed(2))}
                                        >
                                            Usar
                                        </Button>
                                    </div>
                                )}

                                {/* Aviso de ganancia: con pérdida o con margen bajo */}
                                {margin === 'loss' && unitCost !== null && unitSalePrice !== null && (
                                    <MarginAlert tone="red">
                                        <span className="font-semibold">Se vendería con pérdida.</span> Cuesta {money(unitCost)} c/{unitName} y el
                                        precio de venta más bajo es {money(unitSalePrice)} c/{unitName}. Revisa el costo o el precio de venta.
                                    </MarginAlert>
                                )}
                                {margin === 'low' && marginPercent !== null && (
                                    <MarginAlert tone="amber">
                                        <span className="font-semibold">Margen bajo:</span> solo {Math.round(marginPercent)}% de ganancia sobre el
                                        precio de venta.
                                    </MarginAlert>
                                )}
                            </Step>

                            {/* ③ Lote y vencimiento, con casillas claras para "no tiene" */}
                            <Step n={3} title="Lote y vencimiento">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Input
                                            value={noLot ? '' : data.batch_number}
                                            onChange={(e) => setData('batch_number', e.target.value)}
                                            placeholder={noLot ? 'Se genera un código (SL-…)' : 'N° de lote, ej: ABC123'}
                                            disabled={noLot}
                                            aria-label="Número de lote"
                                        />
                                        <CheckOption checked={noLot} onChange={setNoLot}>
                                            No tiene número de lote
                                        </CheckOption>
                                        <InputError message={errors.batch_number} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Input
                                            type="date"
                                            min={today()}
                                            value={data.no_expiry ? '' : data.expires_at}
                                            onChange={(e) => setData('expires_at', e.target.value)}
                                            disabled={data.no_expiry}
                                            aria-label="Fecha de vencimiento"
                                        />
                                        <CheckOption checked={data.no_expiry} onChange={(value) => setData('no_expiry', value)}>
                                            No vence
                                        </CheckOption>
                                        <InputError message={errors.expires_at} />
                                    </div>
                                </div>
                            </Step>

                            {/* Así queda: el stock antes → después, el costo total y la ganancia */}
                            {units > 0 && (
                                <div className="animate-in fade-in slide-in-from-bottom-1 grid gap-2 rounded-xl border bg-gradient-to-br from-emerald-500/5 to-transparent p-4 text-sm duration-300">
                                    <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">Así queda</p>
                                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                                        <span className="text-muted-foreground">Stock en {branchName}</span>
                                        <span className="num">
                                            {stock.toLocaleString('es')} <ArrowRight className="text-muted-foreground inline size-3.5" />{' '}
                                            <span className="text-base font-bold">{(stock + units).toLocaleString('es')}</span> {unitsLabel}{' '}
                                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                (+{units.toLocaleString('es')})
                                            </span>
                                        </span>
                                    </div>
                                    {unitCost !== null && (
                                        <div className="flex items-baseline justify-between gap-2">
                                            <span className="text-muted-foreground">Costo total</span>
                                            <span className="num font-semibold">
                                                {money(unitCost * units)}{' '}
                                                <span className="text-muted-foreground text-xs font-normal">
                                                    ({money(unitCost)} c/{unitName})
                                                </span>
                                            </span>
                                        </div>
                                    )}
                                    {profit !== null && marginPercent !== null && (
                                        <div className="flex items-baseline justify-between gap-2">
                                            <span className="text-muted-foreground">Ganancia por {unitName}</span>
                                            <span
                                                className={cn(
                                                    'num font-semibold',
                                                    margin === 'loss' && 'text-red-600',
                                                    margin === 'low' && 'text-amber-600',
                                                    margin === 'ok' && 'text-emerald-600 dark:text-emerald-400',
                                                )}
                                            >
                                                {money(profit)} ({Math.round(marginPercent)}%)
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="grid gap-2">
                                <Label>Cantidad ({unitsLabel})</Label>
                                <QuantityInput
                                    min={1}
                                    value={data.quantity}
                                    onChange={(value) => setData('quantity', value)}
                                    fractionHint={`Solo números enteros, en ${unitsLabel}.`}
                                    autoFocus
                                />
                                <InputError message={errors.quantity} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Motivo</Label>
                                <Input
                                    value={data.note}
                                    onChange={(e) => setData('note', e.target.value)}
                                    placeholder={mode === 'writeoff' ? 'Vencido / dañado / roto' : 'Corrección de conteo'}
                                />
                                <InputError message={errors.note} />
                            </div>
                        </>
                    )}
                    {otherErrors.length > 0 && (
                        <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                            {otherErrors.map(([key, message]) => (
                                <p key={key}>{message}</p>
                            ))}
                        </div>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={processing}
                            className={mode === 'out' || mode === 'writeoff' ? '' : 'btn-brand'}
                            variant={mode === 'writeoff' ? 'destructive' : 'default'}
                        >
                            {processing && <LoaderCircle className="size-4 animate-spin" />}
                            {mode === 'new' ? (units > 0 ? `Agregar ${units.toLocaleString('es')} ${unitsLabel}` : 'Agregar stock') : 'Registrar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** Paso numerado de la ventana: ① ¿Cuánto entra? */
function Step({ n, title, aside, children }: { n: number; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="grid gap-2">
            <div className="flex items-center gap-2">
                <span className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
                    {n}
                </span>
                <Label>{title}</Label>
                {aside && <span className="ml-auto text-sm">{aside}</span>}
            </div>
            {children}
        </section>
    );
}

/** Botón-etiqueta para elegir el motivo. */
function ReasonChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                active ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary/40 hover:bg-primary/5 text-muted-foreground',
            )}
        >
            {children}
        </button>
    );
}

/** Casilla con su texto: "No vence", "No tiene número de lote". */
function CheckOption({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: React.ReactNode }) {
    return (
        <label className="text-muted-foreground flex w-fit cursor-pointer items-center gap-2 text-xs select-none">
            <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} />
            {children}
        </label>
    );
}

/** Aviso de ganancia junto al costo (rojo = pérdida, ámbar = margen bajo). */
function MarginAlert({ tone, children }: { tone: 'red' | 'amber'; children: React.ReactNode }) {
    return (
        <div
            role="alert"
            className={cn(
                'animate-in fade-in flex items-start gap-2 rounded-lg px-3 py-2 text-xs ring-1 duration-200',
                tone === 'red'
                    ? 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900'
                    : 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
            )}
        >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{children}</span>
        </div>
    );
}

/** Días que faltan para una fecha "Y-m-d" (negativo = ya pasó). */
function daysUntil(date: string): number {
    const [y, m, d] = date.split('-').map(Number);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((new Date(y, m - 1, d).getTime() - start.getTime()) / 86_400_000);
}
