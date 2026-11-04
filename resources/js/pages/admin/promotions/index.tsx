/*
 * PÁGINA: Promociones por vencimiento  (ruta /admin/promotions)
 *
 * 1. Sugeridas: lotes por vencer sin promoción (o con una automática más baja). Se aplican una por una o todas juntas.
 * 2. Vigentes: lotes que hoy se venden con descuento. El punto de venta cobra ese precio solo.
 *    El descuento vale para todo el lote o solo para las presentaciones elegidas, cada una con su % (ej: blíster 10%, caja 20%, tableta nada).
 * 3. Reglas: "si faltan X días o menos → Y% de descuento".
 * Sugeridas y Vigentes vienen PAGINADAS DEL LADO DEL SERVIDOR (cada una con su propio número de página).
 * Datos: app/Http/Controllers/Admin/PromotionController.php
 */
import { ConfirmDialog } from '@/components/admin/common/confirm-dialog';
import { DataTable, EmptyRow, Td, Th } from '@/components/admin/common/data-table';
import { ExpiryBadge, PromoBadge } from '@/components/admin/common/doc-status';
import { PageHeader } from '@/components/admin/common/page-header';
import { ActionButton, RowActions } from '@/components/admin/common/row-actions';
import { SegmentedControl } from '@/components/admin/common/segmented-control';
import { SimpleSelect } from '@/components/admin/common/simple-select';
import { Panel, PanelHeader } from '@/components/admin/dashboard/panel';
import InputError from '@/components/shared/input-error';
import { Pagination } from '@/components/shared/pagination';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCan } from '@/hooks/use-can';
import AdminLayout from '@/layouts/admin/admin-layout';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Paginated } from '@/types';
import { type Option, type PromoPresentation } from '@/types/admin/pharmacy';
import { Head, router, useForm } from '@inertiajs/react';
import { AlertTriangle, BadgePercent, LoaderCircle, Plus, SlidersHorizontal, Sparkles, Trash2, X } from 'lucide-react';
import { FormEventHandler, useEffect, useState } from 'react';

interface SellablePresentation {
    id: number;
    name: string;
    factor: number;
    sale_price: number;
}

interface BatchRow {
    batch_id: number;
    batch_number: string;
    product_name: string;
    branch_name: string;
    expires_at: string | null;
    days_left: number | null;
    /** Unidades base que quedan en el lote */
    stock: number;
    base_unit: string;
    unit_cost: number;
    unit_price: number | null;
    presentations: SellablePresentation[];
}

/** Lote que se está por promocionar. presentation_discounts: las que ya tienen descuento (vacío = todo el lote) */
type ApplyingRow = BatchRow & { percent: number; presentation_discounts?: PromoPresentation[] };

interface Candidate extends BatchRow {
    suggested_discount: number;
    suggested_below_cost: boolean;
    current_discount: string | null;
}

interface ActivePromo extends BatchRow {
    promotion_id: number;
    /** Solo esas tienen descuento, cada una con su %. Vacío = discount_percent para todo el lote */
    presentation_discounts: PromoPresentation[];
    discount_percent: string;
    source: 'regla' | 'manual';
    below_cost: boolean;
    approved_by: string | null;
}

interface Rule {
    id: number;
    days_before: number;
    discount_percent: string;
}

interface Props {
    candidates: Paginated<Candidate>;
    active: Paginated<ActivePromo>;
    rules: Rule[];
    branches: Option[];
    branch: number | null;
}

/** Precio por unidad con el descuento aplicado. */
const discounted = (price: number | null, percent: number) => (price === null ? null : price * (1 - percent / 100));

/** Columnas de la tabla de precios de la ventana de promoción (en el celular cada fila se apila). */
const PRICE_COLUMNS = 'md:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_5.5rem_7rem]';

export default function PromotionsIndex({ candidates, active, rules, branches, branch }: Props) {
    const can = useCan();
    const [applying, setApplying] = useState<ApplyingRow | null>(null);
    const [applyAll, setApplyAll] = useState(false);

    return (
        <AdminLayout breadcrumbs={[{ title: 'Promociones', href: route('admin.promotions.index') }]}>
            <Head title="Promociones por vencimiento" />
            <div className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                <PageHeader
                    icon={BadgePercent}
                    title="Promociones por vencimiento"
                    description="Descuentos a lotes que están por vencer, para venderlos antes de perderlos. El punto de venta los aplica solo."
                    actions={
                        <>
                            {branches.length > 1 && (
                                <SimpleSelect
                                    className="w-52"
                                    options={branches}
                                    value={branch}
                                    allLabel="Todas las sucursales"
                                    onChange={(b) =>
                                        router.get(route('admin.promotions.index'), b === 'all' ? {} : { branch: b }, { preserveScroll: true })
                                    }
                                />
                            )}
                            {can('promociones.crear') && candidates.total > 0 && (
                                <Button size="sm" className="btn-brand" onClick={() => setApplyAll(true)}>
                                    <Sparkles /> Aplicar sugeridas ({candidates.total})
                                </Button>
                            )}
                        </>
                    }
                />

                <Panel className="overflow-hidden">
                    <PanelHeader
                        icon={Sparkles}
                        title="Sugeridas"
                        description="Lotes por vencer según las reglas. Revisa el precio final antes de aplicar."
                    />
                    <DataTable
                        head={
                            <>
                                <Th>Producto / lote</Th>
                                <Th>Vence</Th>
                                <Th align="right">Stock</Th>
                                <Th align="right">Costo c/u</Th>
                                <Th align="right">Precio c/u</Th>
                                <Th align="right">Sugerido</Th>
                                <Th align="right">Precio final</Th>
                                {can('promociones.crear') && <Th align="right">Acción</Th>}
                            </>
                        }
                    >
                        {candidates.data.map((c) => {
                            const final = discounted(c.unit_price, c.suggested_discount);
                            return (
                                <tr key={c.batch_id}>
                                    <BatchCells row={c} />
                                    <Td align="right">
                                        <PromoBadge percent={c.suggested_discount} />
                                        {c.current_discount && <p className="text-muted-foreground text-xs">hoy -{Number(c.current_discount)}%</p>}
                                    </Td>
                                    <Td align="right">
                                        <span className={c.suggested_below_cost ? 'font-semibold text-red-600' : 'font-medium'}>
                                            {final === null ? '—' : money(final)}
                                        </span>
                                        {c.suggested_below_cost && <p className="text-xs text-red-600">bajo el costo</p>}
                                    </Td>
                                    {can('promociones.crear') && (
                                        <Td align="right">
                                            <Button size="sm" variant="outline" onClick={() => setApplying({ ...c, percent: c.suggested_discount })}>
                                                <BadgePercent /> Aplicar
                                            </Button>
                                        </Td>
                                    )}
                                </tr>
                            );
                        })}
                        {candidates.data.length === 0 && <EmptyRow colSpan={9} text="No hay lotes por vencer sin promoción." />}
                    </DataTable>
                    <Pagination paginator={candidates} itemName="lotes" />
                </Panel>

                <Panel className="overflow-hidden">
                    <PanelHeader icon={BadgePercent} title="Vigentes" description="Lotes que hoy se venden con descuento." />
                    <DataTable
                        head={
                            <>
                                <Th>Producto / lote</Th>
                                <Th>Vence</Th>
                                <Th align="right">Stock</Th>
                                <Th>Promoción</Th>
                                <Th>Aprobó</Th>
                                {can('promociones.crear') && <Th align="right">Acciones</Th>}
                            </>
                        }
                    >
                        {active.data.map((p) => (
                            <tr key={p.promotion_id}>
                                <BatchCells row={p} withPrices={false} />
                                <Td className="md:min-w-96">
                                    <PromoLines promo={p} />
                                </Td>
                                <Td className="text-muted-foreground">
                                    {p.approved_by ?? '—'}
                                    <p className="text-xs">{p.source === 'regla' ? 'automática' : 'manual'}</p>
                                </Td>
                                {can('promociones.crear') && (
                                    <Td align="right">
                                        <RowActions>
                                            <ActionButton
                                                icon={BadgePercent}
                                                label="Cambiar descuento"
                                                onClick={() => setApplying({ ...p, percent: Number(p.discount_percent) })}
                                            />
                                            <ActionButton
                                                icon={X}
                                                label="Quitar promoción"
                                                tone="danger"
                                                onClick={() => router.delete(route('admin.promotions.remove', p.batch_id), { preserveScroll: true })}
                                            />
                                        </RowActions>
                                    </Td>
                                )}
                            </tr>
                        ))}
                        {active.data.length === 0 && <EmptyRow colSpan={6} text="No hay promociones vigentes." />}
                    </DataTable>
                    <Pagination paginator={active} itemName="promociones" />
                </Panel>

                <RulesPanel rules={rules} editable={can('promociones.crear')} />
            </div>

            <ApplyDialog row={applying} onClose={() => setApplying(null)} canApproveBelowCost={can('promociones.aprobar')} />
            <ConfirmDialog
                open={applyAll}
                onClose={() => setApplyAll(false)}
                title="¿Aplicar todas las sugeridas?"
                description={
                    can('promociones.aprobar')
                        ? 'Se aplica el descuento sugerido a cada lote de la lista.'
                        : 'Se aplica el descuento sugerido a cada lote. Los que quedarían bajo el costo se saltan (necesitan aprobación).'
                }
                confirmLabel="Aplicar"
                onConfirm={(done) =>
                    router.post(route('admin.promotions.apply-suggested'), { branch_id: branch }, { preserveScroll: true, onFinish: done })
                }
            />
        </AdminLayout>
    );
}

/**
 * Qué tiene descuento en una promoción vigente, una línea por presentación: nombre, precio actual, precio promoción y %.
 * Si es todo el lote va una sola línea, con los precios de una unidad.
 */
function PromoLines({ promo }: { promo: ActivePromo }) {
    const lines =
        promo.presentation_discounts.length > 0
            ? promo.presentation_discounts.map((chosen) => ({
                  id: chosen.id,
                  name: chosen.name,
                  price: promo.presentations.find((p) => p.id === chosen.id)?.sale_price ?? null,
                  percent: Number(chosen.pivot.discount_percent),
              }))
            : [{ id: 0, name: 'Todo el lote', price: promo.unit_price, percent: Number(promo.discount_percent) }];

    return (
        <div className="grid gap-1.5">
            {lines.map((line) => (
                <div key={line.id} className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_3rem] items-center gap-2">
                    <span className="min-w-0">
                        {line.name}
                        {line.id === 0 && <span className="text-muted-foreground block text-xs">por {promo.base_unit}</span>}
                    </span>
                    <span className="num text-muted-foreground text-right text-xs line-through">{line.price === null ? '—' : money(line.price)}</span>
                    <span className="num text-right font-semibold text-emerald-700 dark:text-emerald-400">
                        {line.price === null ? '—' : money(discounted(line.price, line.percent))}
                    </span>
                    <span className="text-right">
                        <PromoBadge percent={line.percent} />
                    </span>
                </div>
            ))}
            {promo.below_cost && <p className="text-xs text-red-600">Bajo el costo de compra</p>}
        </div>
    );
}

/** Columnas del lote. withPrices: costo y precio de una unidad. */
function BatchCells({ row, withPrices = true }: { row: BatchRow; withPrices?: boolean }) {
    return (
        <>
            <Td>
                <p className="font-medium">{row.product_name}</p>
                <p className="text-muted-foreground text-xs">
                    Lote {row.batch_number} · {row.branch_name}
                </p>
            </Td>
            <Td>
                <ExpiryBadge date={row.expires_at} emptyLabel="Sin vencimiento" />
            </Td>
            <Td align="right">
                {row.stock.toLocaleString('es')} <span className="text-muted-foreground text-xs">{row.base_unit}</span>
            </Td>
            {withPrices && (
                <>
                    <Td align="right">{money(row.unit_cost)}</Td>
                    <Td align="right">{row.unit_price === null ? '—' : money(row.unit_price)}</Td>
                </>
            )}
        </>
    );
}

function ApplyDialog({ row, onClose, canApproveBelowCost }: { row: ApplyingRow | null; onClose: () => void; canApproveBelowCost: boolean }) {
    // A qué se le hace el descuento: todo el lote con un solo % o las presentaciones elegidas con su propio %
    const [target, setTarget] = useState<'lote' | 'presentaciones'>('lote');
    const { data, setData, post, processing, errors, clearErrors } = useForm({
        batch_id: 0,
        discount_percent: '',
        // [id de presentación => %]. Vacío = discount_percent para todo el lote
        presentation_discounts: {} as Record<number, string>,
    });

    useEffect(() => {
        if (!row) return;
        clearErrors();
        setTarget(row.presentation_discounts?.length ? 'presentaciones' : 'lote');
        setData({
            batch_id: row.batch_id,
            discount_percent: String(row.percent),
            presentation_discounts: Object.fromEntries(
                (row.presentation_discounts ?? []).map((p) => [p.id, String(Number(p.pivot.discount_percent))]),
            ),
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [row]);

    const presentations = row?.presentations ?? [];
    const canChoose = presentations.length > 1;
    const chosen = Object.values(data.presentation_discounts);
    const wholeBatch = target === 'lote';
    const isChosen = (p: SellablePresentation) => data.presentation_discounts[p.id] !== undefined;
    /** % que lleva esa presentación. 0 = sin descuento */
    const percentOf = (p: SellablePresentation) => Number((wholeBatch ? data.discount_percent : data.presentation_discounts[p.id]) || 0);
    const isBelowCost = (p: SellablePresentation) =>
        row !== null && percentOf(p) > 0 && (p.sale_price / p.factor) * (1 - percentOf(p) / 100) < row.unit_cost;
    const belowCost = presentations.some(isBelowCost);
    /** Cuántas de esa presentación alcanzan con el stock del lote (cajas completas, blísteres completos…) */
    const availableOf = (p: SellablePresentation) => Math.floor((row?.stock ?? 0) / p.factor);
    /** Lo que entra si se venden todas las de esa presentación, ya con su descuento */
    const sellAllTotal = (p: SellablePresentation) => availableOf(p) * (discounted(p.sale_price, percentOf(p)) ?? 0);
    const missingPercent = wholeBatch ? !Number(data.discount_percent) : chosen.length === 0 || chosen.some((percent) => !Number(percent));
    const firstError = Object.values(errors)[0];

    const setPresentationPercent = (id: number, percent: string) =>
        setData('presentation_discounts', { ...data.presentation_discounts, [id]: percent });

    const togglePresentation = (id: number, checked: boolean) => {
        const others = Object.fromEntries(Object.entries(data.presentation_discounts).filter(([other]) => Number(other) !== id));
        setData('presentation_discounts', checked ? { ...others, [id]: data.discount_percent } : others);
    };

    const changeTarget = (value: 'lote' | 'presentaciones') => {
        setTarget(value);
        if (value === 'lote') {
            setData('presentation_discounts', {});
        }
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('admin.promotions.apply'), { preserveScroll: true, onSuccess: () => onClose() });
    };

    return (
        <Dialog open={row !== null} onOpenChange={(value) => !value && onClose()}>
            <DialogContent className="bg-card w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-xl p-0 sm:max-w-3xl sm:rounded-xl">
                <div className="bg-primary h-1" />
                <form onSubmit={submit}>
                    <DialogHeader className="flex-row items-start gap-3.5 space-y-0 px-5 pt-5 pr-11 pb-4 text-left sm:text-left">
                        <div className="bg-primary/10 text-primary ring-primary/15 flex size-10 shrink-0 items-center justify-center rounded-lg ring-1">
                            <BadgePercent className="size-5" />
                        </div>
                        <div className="grid min-w-0 gap-1">
                            <DialogTitle className="text-[15px] leading-snug font-bold">Promoción para el lote {row?.batch_number}</DialogTitle>
                            <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                                <span>{row?.product_name}</span>
                                {row?.days_left != null && (
                                    <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                                        Vence en {row.days_left} días
                                    </span>
                                )}
                                <span className="bg-muted rounded-md px-1.5 py-0.5 text-xs font-medium">
                                    {row?.stock} {row?.base_unit} en el lote
                                </span>
                            </DialogDescription>
                        </div>
                    </DialogHeader>
                    <div className="grid gap-3 px-5 pb-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            {canChoose ? (
                                <SegmentedControl
                                    label="A qué se le hace el descuento"
                                    value={target}
                                    onChange={changeTarget}
                                    options={[
                                        { value: 'lote', label: 'Todo el lote' },
                                        { value: 'presentaciones', label: 'Por presentación' },
                                    ]}
                                />
                            ) : (
                                <p className="text-sm font-medium">Descuento del lote</p>
                            )}
                            {wholeBatch ? (
                                <div className="flex items-center gap-2 text-[13px] font-medium">
                                    Descuento
                                    <PercentInput
                                        label="Descuento de todo el lote"
                                        value={data.discount_percent}
                                        onChange={(value) => setData('discount_percent', value)}
                                        autoFocus
                                    />
                                </div>
                            ) : (
                                <p className="text-muted-foreground text-[13px]">Marca las presentaciones y ponle a cada una su %.</p>
                            )}
                        </div>
                        <div className="overflow-hidden rounded-lg border">
                            <div
                                className={cn(
                                    'bg-muted/50 text-muted-foreground hidden gap-3 border-b px-3 py-2 text-[11px] font-semibold tracking-wider uppercase md:grid',
                                    PRICE_COLUMNS,
                                )}
                            >
                                <span>Presentación</span>
                                <span className="text-right">Costo de compra</span>
                                <span className="text-right">Precio actual</span>
                                <span className="text-right">Descuento</span>
                                <span className="text-right">Precio promoción</span>
                            </div>
                            <div className="divide-y">
                                {presentations.map((p) => {
                                    const cost = (row?.unit_cost ?? 0) * p.factor;
                                    const promotedPrice = discounted(p.sale_price, percentOf(p)) ?? p.sale_price;
                                    const profit = promotedPrice - cost;

                                    return (
                                        <div
                                            key={p.id}
                                            className={cn(
                                                'grid grid-cols-2 items-center gap-x-3 gap-y-2 px-3 py-2.5 text-sm transition-colors',
                                                PRICE_COLUMNS,
                                                percentOf(p) > 0 && 'bg-primary/5',
                                            )}
                                        >
                                            <label
                                                className={cn(
                                                    'col-span-2 flex min-w-0 items-center gap-2.5 md:col-span-1',
                                                    !wholeBatch && 'cursor-pointer',
                                                )}
                                            >
                                                {!wholeBatch && (
                                                    <Checkbox
                                                        checked={isChosen(p)}
                                                        onCheckedChange={(checked) => togglePresentation(p.id, checked === true)}
                                                    />
                                                )}
                                                <span className="min-w-0">
                                                    <span className="block leading-snug font-medium">{p.name}</span>
                                                    <span className="text-muted-foreground block text-xs">
                                                        Hay {availableOf(p)} · Vendiendo todo {money(sellAllTotal(p))}
                                                    </span>
                                                </span>
                                            </label>
                                            <PriceCell label="Costo de compra">{money(cost)}</PriceCell>
                                            <PriceCell label="Precio actual">
                                                <span className={cn(percentOf(p) > 0 && 'text-muted-foreground line-through')}>
                                                    {money(p.sale_price)}
                                                </span>
                                            </PriceCell>
                                            <PriceCell label="Descuento">
                                                {isChosen(p) ? (
                                                    <PercentInput
                                                        label={`Descuento de ${p.name}`}
                                                        value={data.presentation_discounts[p.id]}
                                                        onChange={(value) => setPresentationPercent(p.id, value)}
                                                    />
                                                ) : percentOf(p) > 0 ? (
                                                    <PromoBadge percent={percentOf(p)} />
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </PriceCell>
                                            <PriceCell label="Precio promoción">
                                                {percentOf(p) > 0 ? (
                                                    <>
                                                        <span
                                                            className={cn(
                                                                'inline-block rounded-md px-2 py-0.5 font-bold',
                                                                isBelowCost(p)
                                                                    ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                                                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                                                            )}
                                                        >
                                                            {money(promotedPrice)}
                                                        </span>
                                                        <span
                                                            className={cn(
                                                                'mt-0.5 block text-[11px]',
                                                                profit < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
                                                            )}
                                                        >
                                                            {profit < 0 ? 'Pierdes' : 'Ganas'} {money(Math.abs(profit))}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="text-muted-foreground">Sin promoción</span>
                                                )}
                                            </PriceCell>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <InputError message={firstError} />
                        {belowCost && (
                            <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                                {canApproveBelowCost
                                    ? 'Se venderá por debajo del costo de compra.'
                                    : 'Quedaría por debajo del costo de compra: necesitas el permiso para aprobarlo. Baja el descuento o pide a un administrador.'}
                            </p>
                        )}
                    </div>
                    <DialogFooter className="bg-muted/40 gap-2 border-t px-5 py-3 sm:space-x-0">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit" className="btn-brand" disabled={processing || missingPercent || (belowCost && !canApproveBelowCost)}>
                            {processing && <LoaderCircle className="size-4 animate-spin" />}
                            Aplicar promoción
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** Valor de una fila de precios. En el celular muestra su título; en la computadora lo da la cabecera de la tabla. */
function PriceCell({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="num flex flex-col items-end text-right">
            <span className="text-muted-foreground text-[11px] md:hidden">{label}</span>
            {children}
        </div>
    );
}

/** Casilla chica para el % de descuento. */
function PercentInput({
    label,
    value,
    onChange,
    autoFocus,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    autoFocus?: boolean;
}) {
    return (
        <div className="relative w-20 shrink-0">
            <Input
                aria-label={label}
                type="number"
                min={1}
                max={99}
                step="0.5"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                autoFocus={autoFocus}
                className="h-8 pr-6 text-right"
            />
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs">%</span>
        </div>
    );
}

type RuleRow = { days_before: string; discount_percent: string };

function RulesPanel({ rules, editable }: { rules: Rule[]; editable: boolean }) {
    const initial = () => rules.map((r) => ({ days_before: String(r.days_before), discount_percent: String(Number(r.discount_percent)) }));
    const { data, setData, put, processing, errors, isDirty } = useForm({ rules: initial() as RuleRow[] });
    const err = errors as Record<string, string | undefined>;

    const setRule = (i: number, field: keyof RuleRow, value: string) =>
        setData(
            'rules',
            data.rules.map((r, j) => (j === i ? { ...r, [field]: value } : r)),
        );

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        put(route('admin.promotions.rules'), { preserveScroll: true });
    };

    return (
        <Panel>
            <PanelHeader
                icon={SlidersHorizontal}
                title="Reglas automáticas"
                description="Se usa la regla más ajustada: con 45 días de vida y reglas de 90/60/30 días, aplica la de 60."
            />
            <form onSubmit={submit} className="grid gap-3 p-5">
                {data.rules.map((rule, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                        <span>Si faltan</span>
                        <Input
                            className="h-9 w-20"
                            type="number"
                            min={1}
                            value={rule.days_before}
                            onChange={(e) => setRule(i, 'days_before', e.target.value)}
                            disabled={!editable}
                        />
                        <span>días o menos →</span>
                        <Input
                            className="h-9 w-20"
                            type="number"
                            min={1}
                            max={99}
                            value={rule.discount_percent}
                            onChange={(e) => setRule(i, 'discount_percent', e.target.value)}
                            disabled={!editable}
                        />
                        <span>% de descuento</span>
                        {editable && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                    setData(
                                        'rules',
                                        data.rules.filter((_, j) => j !== i),
                                    )
                                }
                                aria-label="Quitar regla"
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        )}
                        <InputError message={err[`rules.${i}.days_before`] ?? err[`rules.${i}.discount_percent`]} />
                    </div>
                ))}
                {data.rules.length === 0 && <p className="text-muted-foreground text-sm">Sin reglas: no habrá sugerencias automáticas.</p>}
                {editable && (
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setData('rules', [...data.rules, { days_before: '', discount_percent: '' }])}
                        >
                            <Plus /> Agregar regla
                        </Button>
                        <Button type="submit" size="sm" className="btn-brand" disabled={processing || !isDirty}>
                            {processing && <LoaderCircle className="size-4 animate-spin" />}
                            Guardar reglas
                        </Button>
                    </div>
                )}
            </form>
        </Panel>
    );
}
