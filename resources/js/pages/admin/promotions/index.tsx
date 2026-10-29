/*
 * PÁGINA: Promociones por vencimiento  (ruta /admin/promotions)
 *
 * 1. Sugeridas: lotes por vencer sin promoción (o con una automática más baja). Se aplican una por una o todas juntas.
 * 2. Vigentes: lotes que hoy se venden con descuento. El punto de venta cobra ese precio solo.
 * 3. Reglas: "si faltan X días o menos → Y% de descuento".
 * Sugeridas y Vigentes vienen PAGINADAS DEL LADO DEL SERVIDOR (cada una con su propio número de página).
 * Datos: app/Http/Controllers/Admin/PromotionController.php
 */
import { ConfirmDialog } from '@/components/admin/common/confirm-dialog';
import { DataTable, EmptyRow, Td, Th } from '@/components/admin/common/data-table';
import { ExpiryBadge, PromoBadge } from '@/components/admin/common/doc-status';
import { PageHeader } from '@/components/admin/common/page-header';
import { ActionButton, RowActions } from '@/components/admin/common/row-actions';
import { SimpleSelect } from '@/components/admin/common/simple-select';
import { Panel, PanelHeader } from '@/components/admin/dashboard/panel';
import InputError from '@/components/shared/input-error';
import { Pagination } from '@/components/shared/pagination';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCan } from '@/hooks/use-can';
import AdminLayout from '@/layouts/admin/admin-layout';
import { money } from '@/lib/format';
import { type Paginated } from '@/types';
import { type Option } from '@/types/admin/pharmacy';
import { Head, router, useForm } from '@inertiajs/react';
import { AlertTriangle, BadgePercent, LoaderCircle, Plus, SlidersHorizontal, Sparkles, Trash2, X } from 'lucide-react';
import { FormEventHandler, useEffect, useState } from 'react';

interface BatchRow {
    batch_id: number;
    batch_number: string;
    product_name: string;
    branch_name: string;
    expires_at: string;
    days_left: number;
    quantity: number;
    base_unit: string;
    unit_cost: number;
    unit_price: number | null;
}

interface Candidate extends BatchRow {
    suggested_discount: number;
    suggested_below_cost: boolean;
    current_discount: string | null;
}

interface ActivePromo extends BatchRow {
    promotion_id: number;
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
    const [applying, setApplying] = useState<(BatchRow & { percent: number }) | null>(null);
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
                                    <PromoBadge percent={p.discount_percent} />
                                    <p className="text-muted-foreground text-xs">
                                        {money(discounted(p.unit_price, Number(p.discount_percent)))}
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
                <ExpiryBadge date={row.expires_at} />
            </Td>
            <Td align="right">
                {row.quantity.toLocaleString('es')} <span className="text-muted-foreground text-xs">{row.base_unit}</span>
            </Td>
            <Td align="right">{money(row.unit_cost)}</Td>
            <Td align="right">{row.unit_price === null ? '—' : money(row.unit_price)}</Td>
        </>
    );
}

function ApplyDialog({
    row,
    onClose,
    canApproveBelowCost,
}: {
    row: (BatchRow & { percent: number }) | null;
    onClose: () => void;
    canApproveBelowCost: boolean;
}) {
    const { data, setData, post, processing, errors, clearErrors } = useForm({ batch_id: 0, discount_percent: '' });

    useEffect(() => {
        if (!row) return;
        clearErrors();
        setData({ batch_id: row.batch_id, discount_percent: String(row.percent) });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [row]);

    const final = row ? discounted(row.unit_price, Number(data.discount_percent || 0)) : null;
    const belowCost = row !== null && final !== null && final < row.unit_cost;

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
                            {row?.product_name} · vence en {row?.days_left} días · {row?.quantity} {row?.base_unit}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2">
                        <Label htmlFor="discount">Descuento (%)</Label>
                        <Input
                            id="discount"
                            type="number"
                            min={1}
                            max={99}
                            step="0.5"
                            value={data.discount_percent}
                            onChange={(e) => setData('discount_percent', e.target.value)}
                            autoFocus
                        />
                        <InputError message={errors.discount_percent} />
                    </div>
                    <div className="bg-muted/40 grid grid-cols-3 gap-2 rounded-lg p-3 text-sm">
                        <div>
                            <p className="text-muted-foreground text-xs">Costo c/u</p>
                            <p className="num font-medium">{money(row?.unit_cost)}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground text-xs">Precio normal</p>
                            <p className="num font-medium">{row?.unit_price === null ? '—' : money(row?.unit_price)}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground text-xs">Precio con promo</p>
                            <p className={`num font-semibold ${belowCost ? 'text-red-600' : 'text-emerald-600'}`}>
                                {final === null ? '—' : money(final)}
                            </p>
                        </div>
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
                        <Button type="submit" className="btn-brand" disabled={processing || (belowCost && !canApproveBelowCost)}>
                            {processing && <LoaderCircle className="size-4 animate-spin" />}
                            Aplicar promoción
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
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
