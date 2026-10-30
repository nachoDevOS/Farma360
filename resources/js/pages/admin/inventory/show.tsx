/*
 * PÁGINA: Inventario de un producto  (ruta /admin/inventory/{producto}?branch=)
 * Indicadores (stock con su desglose, valor del stock, próximo vencimiento, stock en otras sucursales), presentaciones
 * con "Alcanza para" y, en pestañas (una a la vez): Lotes (vencimiento, costo, promoción, ajustes) · Movimientos (kardex)
 * · Gráficos (stock-charts.tsx).
 * "Ingreso sin compra" (inventario inicial) se carga por presentación, como una compra: 3 Caja x100 a Bs 40 → 300 tabletas.
 * Datos: InventoryController@show · Ajustes: InventoryController@adjust
 */
import { DataTable, EmptyRow, Td, Th } from '@/components/admin/common/data-table';
import { ExpiryBadge, PromoBadge } from '@/components/admin/common/doc-status';
import { PageHeader } from '@/components/admin/common/page-header';
import { QuantityInput } from '@/components/admin/common/quantity-input';
import { ActionButton, RowActions } from '@/components/admin/common/row-actions';
import { SegmentedControl } from '@/components/admin/common/segmented-control';
import { SimpleSelect } from '@/components/admin/common/simple-select';
import { StatCard, StatGrid } from '@/components/admin/common/stat-card';
import { Panel, PanelHeader } from '@/components/admin/dashboard/panel';
import { StockCharts, type StockDay } from '@/components/admin/inventory/stock-charts';
import { plural } from '@/components/admin/products/presentation-levels';
import { PresentationsTable, StockScopeBadge } from '@/components/admin/products/product-row-detail';
import { StockBreakdown } from '@/components/admin/products/stock-breakdown';
import InputError from '@/components/shared/input-error';
import { Pagination } from '@/components/shared/pagination';
import { Button } from '@/components/ui/button';
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
import { Boxes, CalendarClock, Eye, Layers, LoaderCircle, Minus, PackageX, Pencil, Plus, Wallet, Warehouse, X } from 'lucide-react';
import { FormEventHandler, useEffect, useState } from 'react';

interface Props {
    product: Product;
    branches: Option[];
    branchId: number;
    stock: number;
    batches: Batch[];
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
}

type Mode = 'new' | 'in' | 'out' | 'writeoff';

const modeTitles: Record<Mode, string> = {
    new: 'Ingreso sin compra (inventario inicial)',
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
}: Props) {
    const can = useCan();
    const [adjust, setAdjust] = useState<{ mode: Mode; batch: Batch | null } | null>(null);
    // Una sección a la vez (la paginación del kardex conserva la pestaña elegida)
    const [tab, setTab] = useState<'lotes' | 'kardex' | 'graficos'>('lotes');

    const units = plural(product.base_unit);
    const branchName = branches.find((b) => b.id === branchId)?.name ?? 'Esta sucursal';
    const lots = batches.filter((b) => b.quantity > 0);
    const nextExpiry = lots.map((b) => b.expires_at.slice(0, 10)).sort()[0] ?? null;
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
                                <SimpleSelect
                                    className="w-52"
                                    options={branches}
                                    value={branchId}
                                    onChange={(branch) => router.get(route('admin.inventory.show', { product: product.id, branch }))}
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
                        icon={Boxes}
                        label="Stock en la sucursal"
                        value={`${stock.toLocaleString('es')} ${units}`}
                        tone={product.min_stock === 0 ? 'amber' : stock <= product.min_stock ? 'red' : 'blue'}
                        colorValue={product.min_stock > 0 && stock <= product.min_stock}
                        hint={
                            <>
                                <StockBreakdown units={stock} product={product} className="text-foreground text-xs" />
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
                        icon={Wallet}
                        label="Valor del stock"
                        value={money(stockValue)}
                        tone="violet"
                        hint={stock > 0 ? `Costo promedio ${money(stockValue / stock)} c/${product.base_unit.toLowerCase()}` : 'Sin stock'}
                    />
                    <StatCard
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
                                description="Se venden primero los que vencen antes (FEFO). Los vencidos no se pueden vender."
                            />
                            <DataTable
                                head={
                                    <>
                                        <Th>Lote</Th>
                                        <Th>Vencimiento</Th>
                                        <Th align="right">Cantidad</Th>
                                        <Th align="right">Costo c/u</Th>
                                        <Th>Promoción</Th>
                                        {can('inventario.ajustar') && <Th align="right">Ajustar</Th>}
                                    </>
                                }
                            >
                                {batches.map((batch) => (
                                    <tr key={batch.id} className={cn(batch.quantity === 0 && 'opacity-50')}>
                                        <Td className="num font-medium">{batch.batch_number}</Td>
                                        <Td>
                                            <ExpiryBadge date={batch.expires_at} />
                                        </Td>
                                        <Td align="right">{batch.quantity.toLocaleString('es')}</Td>
                                        <Td align="right">{money(batch.unit_cost)}</Td>
                                        <Td>{batch.active_promotion ? <PromoBadge percent={batch.active_promotion.discount_percent} /> : '—'}</Td>
                                        {can('inventario.ajustar') && (
                                            <Td align="right">
                                                <RowActions>
                                                    <ActionButton
                                                        icon={Plus}
                                                        label="Entrada"
                                                        tone="success"
                                                        onClick={() => setAdjust({ mode: 'in', batch })}
                                                    />
                                                    <ActionButton
                                                        icon={Minus}
                                                        label="Salida"
                                                        tone="warning"
                                                        onClick={() => setAdjust({ mode: 'out', batch })}
                                                        disabled={batch.quantity === 0}
                                                    />
                                                    <ActionButton
                                                        icon={PackageX}
                                                        label="Dar de baja"
                                                        tone="danger"
                                                        onClick={() => setAdjust({ mode: 'writeoff', batch })}
                                                        disabled={batch.quantity === 0}
                                                    />
                                                </RowActions>
                                            </Td>
                                        )}
                                    </tr>
                                ))}
                                {batches.length === 0 && <EmptyRow colSpan={6} text="No hay lotes en esta sucursal." />}
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

            <AdjustDialog product={product} branchId={branchId} adjust={adjust} onClose={() => setAdjust(null)} />
        </AdminLayout>
    );
}

function AdjustDialog({
    product,
    branchId,
    adjust,
    onClose,
}: {
    product: Product;
    branchId: number;
    adjust: { mode: Mode; batch: Batch | null } | null;
    onClose: () => void;
}) {
    // Ingreso sin compra: por defecto la presentación más grande que se compra (normalmente la caja)
    const defaultPresentation = String(
        ([...product.presentations].reverse().find((p) => p.is_purchasable) ?? product.presentations.at(-1))?.id ?? '',
    );
    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        mode: 'new' as Mode,
        batch_id: '',
        product_id: String(product.id),
        branch_id: String(branchId),
        batch_number: '',
        expires_at: '',
        // Solo en "Ingreso sin compra": líneas por presentación (1 caja + 5 blísteres) y el costo de compra de UNA presentación
        items: [{ product_presentation_id: defaultPresentation, quantity: '' }],
        cost: '',
        cost_presentation_id: defaultPresentation,
        // En los demás ajustes: cantidad en unidades base
        quantity: '',
        note: '',
    });

    useEffect(() => {
        if (!adjust) return;
        reset();
        clearErrors();
        setData((d) => ({ ...d, mode: adjust.mode, batch_id: adjust.batch ? String(adjust.batch.id) : '', branch_id: String(branchId) }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [adjust]);

    const err = errors as Record<string, string | undefined>;
    const unitsLabel = plural(product.base_unit);
    const factorOf = (id: string) => product.presentations.find((p) => String(p.id) === id)?.factor ?? 0;
    const presentationOptions = product.presentations.map((p) => ({ id: p.id as number, name: p.name }));
    const units = data.items.reduce((sum, item) => sum + Number(item.quantity || 0) * factorOf(item.product_presentation_id), 0);
    const costFactor = factorOf(data.cost_presentation_id);
    const unitCost = costFactor > 0 && data.cost !== '' ? Number(data.cost) / costFactor : null;
    const costPresentation = product.presentations.find((p) => String(p.id) === data.cost_presentation_id);
    const unused = product.presentations.filter((p) => !data.items.some((item) => item.product_presentation_id === String(p.id)));

    const setItem = (index: number, patch: Partial<(typeof data.items)[number]>) =>
        setData(
            'items',
            data.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
        );

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('admin.inventory.adjust'), { preserveScroll: true, onSuccess: () => onClose() });
    };

    const mode = adjust?.mode ?? 'new';

    return (
        <Dialog open={adjust !== null} onOpenChange={(value) => !value && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                <form onSubmit={submit} className="grid gap-4">
                    <DialogHeader>
                        <DialogTitle>{modeTitles[mode]}</DialogTitle>
                        <DialogDescription>
                            {adjust?.batch
                                ? `Lote ${adjust.batch.batch_number} · hay ${adjust.batch.quantity} ${product.base_unit}.`
                                : 'Crea un lote nuevo con su vencimiento y costo.'}{' '}
                            Queda registrado en el kardex con tu usuario.
                        </DialogDescription>
                    </DialogHeader>
                    {mode === 'new' ? (
                        <>
                            {/* Qué hay en el estante, por presentación: 1 caja + 5 blísteres */}
                            <div className="grid gap-2">
                                <Label>Qué ingresa</Label>
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
                            </div>

                            {/* Costo de compra (no el precio de venta) de una presentación: el sistema saca el de cada unidad */}
                            <div className="grid gap-2">
                                <Label>Costo de compra</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min={0}
                                        value={data.cost}
                                        onChange={(e) => setData('cost', e.target.value)}
                                        placeholder="0,00"
                                        className="w-28 shrink-0"
                                        aria-label="Costo de compra"
                                    />
                                    <span className="text-muted-foreground shrink-0 text-sm">por</span>
                                    <SimpleSelect
                                        options={presentationOptions}
                                        value={data.cost_presentation_id}
                                        onChange={(value) => setData('cost_presentation_id', value)}
                                        className="h-9 min-w-0 flex-1"
                                    />
                                </div>
                                <p className="text-muted-foreground text-xs">
                                    Lo que te costó {costPresentation ? `cada ${costPresentation.package.toLowerCase()}` : ''} al comprarlo, no el
                                    precio de venta. Sirve para calcular la ganancia.
                                </p>
                                <InputError message={err.cost ?? err.cost_presentation_id} />
                            </div>

                            {units > 0 && (
                                <p className="bg-muted/50 rounded-md px-3 py-2 text-sm">
                                    Entran{' '}
                                    <span className="font-semibold">
                                        {units.toLocaleString('es')} {unitsLabel}
                                    </span>
                                    {unitCost !== null && (
                                        <>
                                            {' '}
                                            · {money(unitCost)} c/{product.base_unit.toLowerCase()} · total{' '}
                                            <span className="font-semibold">{money(unitCost * units)}</span>
                                        </>
                                    )}
                                </p>
                            )}

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label>
                                        Lote <span className="text-muted-foreground font-normal">(opcional)</span>
                                    </Label>
                                    <Input
                                        value={data.batch_number}
                                        onChange={(e) => setData('batch_number', e.target.value)}
                                        placeholder="Si lo dejas vacío: SL-…"
                                    />
                                    <InputError message={errors.batch_number} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Vencimiento</Label>
                                    <Input
                                        type="date"
                                        min={today()}
                                        value={data.expires_at}
                                        onChange={(e) => setData('expires_at', e.target.value)}
                                    />
                                    <InputError message={errors.expires_at} />
                                </div>
                            </div>
                        </>
                    ) : (
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
                    )}
                    <div className="grid gap-2">
                        <Label>Motivo {mode === 'new' && <span className="text-muted-foreground font-normal">(opcional)</span>}</Label>
                        <Input
                            value={data.note}
                            onChange={(e) => setData('note', e.target.value)}
                            placeholder={
                                mode === 'writeoff' ? 'Vencido / dañado / roto' : mode === 'new' ? 'Inventario inicial' : 'Corrección de conteo'
                            }
                        />
                        <InputError message={errors.note} />
                    </div>
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
                            Registrar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** Días que faltan para una fecha "Y-m-d" (negativo = ya pasó). */
function daysUntil(date: string): number {
    const [y, m, d] = date.split('-').map(Number);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((new Date(y, m - 1, d).getTime() - start.getTime()) / 86_400_000);
}
