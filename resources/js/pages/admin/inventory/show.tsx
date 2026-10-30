/*
 * PÁGINA: Inventario de un producto  (ruta /admin/inventory/{producto}?branch=)
 * Lotes (con vencimiento, costo y promoción), kardex y ajustes manuales.
 * Datos: InventoryController@show · Ajustes: InventoryController@adjust
 */
import { DataTable, Detail, EmptyRow, Td, Th } from '@/components/admin/common/data-table';
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
import { formatDate, money, today } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Paginated } from '@/types';
import { type Batch, type Option, type Product, type StockMovement } from '@/types/admin/pharmacy';
import { Head, router, useForm } from '@inertiajs/react';
import { Boxes, LoaderCircle, Minus, PackageX, Plus } from 'lucide-react';
import { FormEventHandler, useEffect, useState } from 'react';

interface Props {
    product: Product;
    branches: Option[];
    branchId: number;
    stock: number;
    batches: Batch[];
    movements: Paginated<StockMovement>;
    movementTypes: Record<string, string>;
}

type Mode = 'new' | 'in' | 'out' | 'writeoff';

const modeTitles: Record<Mode, string> = {
    new: 'Ingreso sin compra (inventario inicial)',
    in: 'Ajuste de entrada',
    out: 'Ajuste de salida',
    writeoff: 'Baja por vencimiento o daño',
};

export default function InventoryShow({ product, branches, branchId, stock, batches, movements, movementTypes }: Props) {
    const can = useCan();
    const [adjust, setAdjust] = useState<{ mode: Mode; batch: Batch | null } | null>(null);

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
                    description={[product.generic_name, product.pharmaceutical_form, product.laboratory?.name].filter(Boolean).join(' · ')}
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

                <Panel className="grid gap-4 p-5 sm:grid-cols-4">
                    <Detail label="Stock en la sucursal">
                        <span className={cn('num text-lg', stock <= product.min_stock && 'text-red-600')}>
                            {stock.toLocaleString('es')} {product.base_unit}
                        </span>
                    </Detail>
                    <Detail label="Stock mínimo">{product.min_stock.toLocaleString('es')}</Detail>
                    <Detail label="Presentaciones">
                        {product.presentations.map((p) => `${p.name} (${p.is_sellable ? money(p.sale_price) : 'solo compra'})`).join(' · ')}
                    </Detail>
                    <Detail label="Control">
                        {product.is_controlled ? 'Controlado' : product.requires_prescription ? 'Con receta' : 'Venta libre'}
                    </Detail>
                </Panel>

                <Panel className="overflow-hidden">
                    <PanelHeader title="Lotes" description="Se venden primero los que vencen antes (FEFO). Los vencidos no se pueden vender." />
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

                <Panel className="overflow-hidden">
                    <PanelHeader title="Kardex" description="Cada entrada y salida del producto en esta sucursal. No se edita ni se borra." />
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
    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        mode: 'new' as Mode,
        batch_id: '',
        product_id: String(product.id),
        branch_id: String(branchId),
        batch_number: '',
        expires_at: '',
        unit_cost: '',
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

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('admin.inventory.adjust'), { preserveScroll: true, onSuccess: () => onClose() });
    };

    const mode = adjust?.mode ?? 'new';

    return (
        <Dialog open={adjust !== null} onOpenChange={(value) => !value && onClose()}>
            <DialogContent className="sm:max-w-lg">
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
                    {mode === 'new' && (
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="grid gap-2">
                                <Label>Lote</Label>
                                <Input value={data.batch_number} onChange={(e) => setData('batch_number', e.target.value)} />
                                <InputError message={errors.batch_number} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Vencimiento</Label>
                                <Input type="date" min={today()} value={data.expires_at} onChange={(e) => setData('expires_at', e.target.value)} />
                                <InputError message={errors.expires_at} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Costo por {product.base_unit}</Label>
                                <Input
                                    type="number"
                                    step="0.0001"
                                    min={0}
                                    value={data.unit_cost}
                                    onChange={(e) => setData('unit_cost', e.target.value)}
                                />
                                <InputError message={errors.unit_cost} />
                            </div>
                        </div>
                    )}
                    <div className="grid gap-2">
                        <Label>Cantidad ({product.base_unit})</Label>
                        <Input type="number" min={1} value={data.quantity} onChange={(e) => setData('quantity', e.target.value)} autoFocus />
                        <InputError message={errors.quantity} />
                    </div>
                    <div className="grid gap-2">
                        <Label>Motivo</Label>
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
