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
import { BatchPromoBadge, ExpiryBadge, PromoBadge } from '@/components/admin/common/doc-status';
import { PageHeader } from '@/components/admin/common/page-header';
import { ActionButton, RowActions } from '@/components/admin/common/row-actions';
import { SimpleSelect } from '@/components/admin/common/simple-select';
import { Panel, PanelHeader } from '@/components/admin/dashboard/panel';
import InputError from '@/components/shared/input-error';
import { Pagination } from '@/components/shared/pagination';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCan } from '@/hooks/use-can';
import AdminLayout from '@/layouts/admin/admin-layout';
import { money } from '@/lib/format';
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
                                <Th align="right">Costo c/u</Th>
                                <Th align="right">Precio c/u</Th>
                                <Th align="right">Descuento</Th>
                                <Th>Aprobó</Th>
                                {can('promociones.crear') && <Th align="right">Acciones</Th>}
                            </>
                        }
                    >
                        {active.data.map((p) => (
                            <tr key={p.promotion_id}>
                                <BatchCells row={p} />
                                <Td align="right">
                                    <BatchPromoBadge percent={p.discount_percent} presentations={p.presentation_discounts} />
                                    <p className="text-muted-foreground text-xs">
                                        {promotedPrices(p)}
                                        {p.below_cost && <span className="text-red-600"> · bajo costo</span>}
                                    </p>
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
                        {active.data.length === 0 && <EmptyRow colSpan={9} text="No hay promociones vigentes." />}
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

/** Precio con descuento de lo que está en promoción: el de cada presentación con su % o, si es todo el lote, el de una unidad. */
function promotedPrices(promo: ActivePromo) {
    if (promo.presentation_discounts.length === 0) {
        return money(discounted(promo.unit_price, Number(promo.discount_percent)));
    }

    return promo.presentation_discounts
        .map((chosen) => {
            const presentation = promo.presentations.find((p) => p.id === chosen.id);
            return presentation ? money(discounted(presentation.sale_price, Number(chosen.pivot.discount_percent))) : null;
        })
        .filter(Boolean)
        .join(' · ');
}

function BatchCells({ row }: { row: BatchRow }) {
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
            <Td align="right">{money(row.unit_cost)}</Td>
            <Td align="right">{row.unit_price === null ? '—' : money(row.unit_price)}</Td>
        </>
    );
}

function ApplyDialog({ row, onClose, canApproveBelowCost }: { row: ApplyingRow | null; onClose: () => void; canApproveBelowCost: boolean }) {
    const { data, setData, post, processing, errors, clearErrors } = useForm({
        batch_id: 0,
        discount_percent: '',
        // [id de presentación => %]. Vacío = discount_percent para todo el lote
        presentation_discounts: {} as Record<number, string>,
    });

    useEffect(() => {
        if (!row) return;
        clearErrors();
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
    const wholeBatch = chosen.length === 0;
    const isChosen = (p: SellablePresentation) => data.presentation_discounts[p.id] !== undefined;
    /** % que lleva esa presentación. 0 = sin descuento */
    const percentOf = (p: SellablePresentation) => Number((wholeBatch ? data.discount_percent : data.presentation_discounts[p.id]) || 0);
    const isBelowCost = (p: SellablePresentation) =>
        row !== null && percentOf(p) > 0 && (p.sale_price / p.factor) * (1 - percentOf(p) / 100) < row.unit_cost;
    const belowCost = presentations.some(isBelowCost);
    const missingPercent = wholeBatch ? !Number(data.discount_percent) : chosen.some((percent) => !Number(percent));
    const firstError = Object.values(errors)[0];

    const setPresentationPercent = (id: number, percent: string) =>
        setData('presentation_discounts', { ...data.presentation_discounts, [id]: percent });

    const togglePresentation = (id: number, checked: boolean) => {
        const others = Object.fromEntries(Object.entries(data.presentation_discounts).filter(([other]) => Number(other) !== id));
        setData('presentation_discounts', checked ? { ...others, [id]: data.discount_percent } : others);
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('admin.promotions.apply'), { preserveScroll: true, onSuccess: () => onClose() });
    };

    return (
        <Dialog open={row !== null} onOpenChange={(value) => !value && onClose()}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={submit} className="grid gap-4">
                    <DialogHeader>
                        <DialogTitle>Promoción para el lote {row?.batch_number}</DialogTitle>
                        <DialogDescription>
                            {row?.product_name} · {row?.days_left != null ? `vence en ${row.days_left} días` : 'sin vencimiento'} · {row?.stock}{' '}
                            {row?.base_unit}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2">
                        <Label>Aplicar a</Label>
                        <div className="divide-y rounded-lg border">
                            <div className="flex min-h-12 items-center gap-2.5 px-3 py-2 text-sm">
                                <label className="flex flex-1 cursor-pointer items-center gap-2.5">
                                    {canChoose && <Checkbox checked={wholeBatch} onCheckedChange={() => setData('presentation_discounts', {})} />}
                                    <span className="font-medium">Todo el lote</span>
                                </label>
                                {wholeBatch && (
                                    <PercentInput
                                        label="Descuento de todo el lote"
                                        value={data.discount_percent}
                                        onChange={(value) => setData('discount_percent', value)}
                                        autoFocus
                                    />
                                )}
                            </div>
                            {presentations.map((p) => (
                                <div key={p.id} className="flex min-h-12 items-center gap-2.5 px-3 py-2 text-sm">
                                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                                        {canChoose && (
                                            <Checkbox
                                                checked={isChosen(p)}
                                                onCheckedChange={(checked) => togglePresentation(p.id, checked === true)}
                                            />
                                        )}
                                        <span className="min-w-0">
                                            {p.name}
                                            <span className="text-muted-foreground block text-xs">
                                                Costo {money((row?.unit_cost ?? 0) * p.factor)}
                                            </span>
                                        </span>
                                    </label>
                                    {isChosen(p) && (
                                        <PercentInput
                                            label={`Descuento de ${p.name}`}
                                            value={data.presentation_discounts[p.id]}
                                            onChange={(value) => setPresentationPercent(p.id, value)}
                                        />
                                    )}
                                    <span className="num w-20 shrink-0 text-right">
                                        {percentOf(p) > 0 ? (
                                            <>
                                                <span className="text-muted-foreground block text-xs line-through">{money(p.sale_price)}</span>
                                                <span className={`font-semibold ${isBelowCost(p) ? 'text-red-600' : 'text-emerald-600'}`}>
                                                    {money(discounted(p.sale_price, percentOf(p)))}
                                                </span>
                                            </>
                                        ) : (
                                            money(p.sale_price)
                                        )}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <InputError message={firstError} />
                    </div>
                    {belowCost && (
                        <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                            {canApproveBelowCost
                                ? 'Se venderá por debajo del costo. Quedará registrado que lo aprobaste.'
                                : 'Quedaría por debajo del costo: necesitas el permiso para aprobarlo. Baja el descuento o pide a un administrador.'}
                        </p>
                    )}
                    <DialogFooter>
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
