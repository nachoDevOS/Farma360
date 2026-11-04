/*
 * PÁGINA: Nueva transferencia  (ruta /admin/transfers/create)
 * Igual que el punto de venta: se busca el PRODUCTO, se dice cuánto va y el sistema lo reparte por lotes (primero los que
 * vencen antes), con la ventana TransferProductDialog. A la derecha, la ruta y el resumen del envío.
 * Lo que viaja a Laravel es una fila por lote (mismo número y vencimiento llegan al destino), en unidades base.
 * Envía a TransferController@store → TransferService::send. Búsqueda: InventoryController@batches
 */
import { ConfirmDialog } from '@/components/admin/common/confirm-dialog';
import { ExpiryBadge } from '@/components/admin/common/doc-status';
import { StoredImage } from '@/components/admin/common/image-upload';
import { PageHeader } from '@/components/admin/common/page-header';
import { blockFractionKeys } from '@/components/admin/common/quantity-input';
import { ActionButton, RowActions } from '@/components/admin/common/row-actions';
import { SearchPicker } from '@/components/admin/common/search-picker';
import { SimpleSelect } from '@/components/admin/common/simple-select';
import { Panel, PanelHeader } from '@/components/admin/dashboard/panel';
import { stockBreakdown } from '@/components/admin/products/presentation-levels';
import {
    groupByProduct,
    packagesText,
    TransferProductDialog,
    unitsText,
    type LotQuantities,
    type TransferProduct,
} from '@/components/admin/transfers/transfer-product-dialog';
import InputError from '@/components/shared/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AdminLayout from '@/layouts/admin/admin-layout';
import { money } from '@/lib/format';
import { type BatchLookup, type Option } from '@/types/admin/pharmacy';
import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowLeftRight,
    Beaker,
    Boxes,
    Factory,
    FlaskConical,
    Layers,
    LoaderCircle,
    Minus,
    PackagePlus,
    Pencil,
    Pill,
    Plus,
    Send,
    Tag,
    Trash2,
} from 'lucide-react';
import { FormEventHandler, useRef, useState } from 'react';

/** Una fila por lote. product y batch son solo para mostrar: Laravel lee batch_id y quantity. */
type ItemRow = {
    batch_id: number;
    quantity: number;
    batch: BatchLookup;
    product: TransferProduct;
};

export default function TransferCreate({ fromBranches, toBranches }: { fromBranches: Option[]; toBranches: Option[] }) {
    const { data, setData, post, processing, errors } = useForm({
        from_branch_id: fromBranches.length === 1 ? String(fromBranches[0].id) : '',
        to_branch_id: '',
        note: '',
        items: [] as ItemRow[],
    });
    const err = errors as Record<string, string | undefined>;
    const search = useRef<HTMLInputElement>(null);
    const [choosing, setChoosing] = useState<TransferProduct | null>(null);
    // Sucursal de origen por confirmar: al cambiarla se vacía la lista
    const [nextOrigin, setNextOrigin] = useState<string | null>(null);

    const groups = [...new Set(data.items.map((row) => row.product.product_id))].map((id) =>
        data.items.filter((row) => row.product.product_id === id),
    );
    const totalUnits = data.items.reduce((sum, row) => sum + row.quantity, 0);
    const totalValue = data.items.reduce((sum, row) => sum + row.quantity * row.batch.unit_cost, 0);
    const blocker = !data.from_branch_id
        ? 'Elige la sucursal que envía'
        : !data.to_branch_id
          ? 'Elige la sucursal que recibe'
          : data.items.length === 0
            ? 'Agrega al menos un producto'
            : null;

    const quantitiesOf = (productId: number): LotQuantities =>
        Object.fromEntries(data.items.filter((row) => row.product.product_id === productId).map((row) => [row.batch_id, row.quantity]));
    const isListed = (productId: number) => data.items.some((row) => row.product.product_id === productId);

    const removeProduct = (productId: number) =>
        setData(
            'items',
            data.items.filter((row) => row.product.product_id !== productId),
        );

    /** Reemplaza las filas de un producto por lo que sale de cada lote. Sin nada, sale de la lista. */
    const saveQuantities = (product: TransferProduct, quantities: LotQuantities) => {
        const rows = product.batches.flatMap((batch) =>
            quantities[batch.id] ? [{ batch_id: batch.id, quantity: quantities[batch.id], batch, product }] : [],
        );
        setData('items', [...data.items.filter((row) => row.product.product_id !== product.product_id), ...rows]);
    };

    const confirmQuantities = (quantities: LotQuantities) => {
        if (!choosing) return;
        // El stock del destino puede cambiar si eligen otra sucursal: se muestra solo al buscar
        saveQuantities({ ...choosing, destination_stock: null }, quantities);
        setChoosing(null);
        search.current?.focus();
    };

    const changeOrigin = (branchId: string) => {
        setData((d) => ({ ...d, from_branch_id: branchId, to_branch_id: d.to_branch_id === branchId ? '' : d.to_branch_id, items: [] }));
        setNextOrigin(null);
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('admin.transfers.store'));
    };

    return (
        <AdminLayout
            breadcrumbs={[
                { title: 'Transferencias', href: route('admin.transfers.index') },
                { title: 'Nueva', href: '#' },
            ]}
        >
            <Head title="Nueva transferencia" />
            <form onSubmit={submit} className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                <PageHeader
                    icon={ArrowLeftRight}
                    title="Nueva transferencia"
                    description="El stock sale del origen al enviar y entra al destino cuando lo reciben."
                />

                <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
                    {/* IZQUIERDA: búsqueda + lista */}
                    <div className="flex min-w-0 flex-col gap-4">
                        {data.from_branch_id ? (
                            <SearchPicker<TransferProduct, BatchLookup>
                                inputRef={search}
                                autoFocus
                                minLength={1}
                                url={(q) =>
                                    route('admin.inventory.batches', {
                                        q,
                                        branch_id: data.from_branch_id,
                                        to_branch_id: data.to_branch_id || undefined,
                                    })
                                }
                                mapResults={groupByProduct}
                                onPick={setChoosing}
                                itemKey={(product) => product.product_id}
                                placeholder="Buscar producto, genérico, síntoma o escanear código…"
                                listClassName="max-h-[36rem] divide-y"
                                renderItem={(product) => (
                                    <ProductResult
                                        product={product}
                                        inList={data.items.reduce(
                                            (sum, row) => sum + (row.product.product_id === product.product_id ? row.quantity : 0),
                                            0,
                                        )}
                                        destinationChosen={data.to_branch_id !== ''}
                                    />
                                )}
                            />
                        ) : (
                            <p className="text-muted-foreground bg-card rounded-lg border px-4 py-3 text-sm">Primero elige la sucursal que envía.</p>
                        )}

                        <Panel className="overflow-hidden">
                            {data.items.length === 0 ? (
                                <div className="text-muted-foreground flex flex-col items-center gap-2 px-6 py-14 text-center text-sm">
                                    <PackagePlus className="size-7" />
                                    <p className="text-foreground font-medium">Todavía no hay productos en el envío</p>
                                    <p className="text-xs">Busca un producto y di cuánto va: el sistema elige los lotes que vencen antes.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between border-b px-4 py-2.5">
                                        <p className="flex items-center gap-2 text-sm font-semibold">
                                            <Send className="text-primary size-4" />
                                            Por enviar
                                            <span className="bg-primary/10 text-primary num rounded-full px-2 py-0.5 text-xs">
                                                {groups.length} {groups.length === 1 ? 'producto' : 'productos'}
                                            </span>
                                        </p>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="text-muted-foreground hover:text-destructive h-7"
                                            onClick={() => setData('items', [])}
                                        >
                                            <Trash2 className="size-3.5" /> Vaciar
                                        </Button>
                                    </div>
                                    <ul className="divide-y">
                                        {groups.map((rows, position) => (
                                            <ProductLine
                                                key={rows[0].product.product_id}
                                                position={position + 1}
                                                rows={rows}
                                                onLotUnits={(batchId, units) =>
                                                    saveQuantities(rows[0].product, { ...quantitiesOf(rows[0].product.product_id), [batchId]: units })
                                                }
                                                onEdit={() => setChoosing(rows[0].product)}
                                                onRemove={() => removeProduct(rows[0].product.product_id)}
                                            />
                                        ))}
                                    </ul>
                                </>
                            )}
                        </Panel>
                        <InputError message={err.items ?? Object.entries(err).find(([field]) => field.startsWith('items.'))?.[1]} />
                    </div>

                    {/* DERECHA: ruta + resumen */}
                    <div className="flex flex-col gap-4 xl:sticky xl:top-4">
                        <Panel>
                            <PanelHeader title="Ruta" />
                            <div className="grid gap-2 p-5">
                                <div className="grid gap-1.5">
                                    <Label>Envía</Label>
                                    <SimpleSelect
                                        options={fromBranches}
                                        value={data.from_branch_id}
                                        onChange={(value) => (data.items.length > 0 ? setNextOrigin(value) : changeOrigin(value))}
                                        className="h-10"
                                    />
                                    <InputError message={err.from_branch_id} />
                                </div>
                                <ArrowDown className="text-muted-foreground mx-auto size-4" />
                                <div className="grid gap-1.5">
                                    <Label>Recibe</Label>
                                    <SimpleSelect
                                        options={toBranches.filter((branch) => String(branch.id) !== data.from_branch_id)}
                                        value={data.to_branch_id}
                                        onChange={(value) => setData('to_branch_id', value)}
                                        className="h-10"
                                    />
                                    <InputError message={err.to_branch_id} />
                                </div>
                                <div className="mt-2 grid gap-1.5">
                                    <Label htmlFor="note">Nota</Label>
                                    <Input id="note" value={data.note} onChange={(e) => setData('note', e.target.value)} placeholder="Opcional" />
                                    <InputError message={err.note} />
                                </div>
                            </div>
                        </Panel>

                        <Panel className="overflow-hidden">
                            <PanelHeader title="Resumen" />
                            <dl className="grid gap-2 p-5 text-sm">
                                <SummaryRow label="Productos" value={groups.length} />
                                <SummaryRow label="Lotes" value={data.items.length} />
                                <SummaryRow label="Unidades" value={totalUnits.toLocaleString('es')} />
                                <div className="mt-1 flex items-end justify-between gap-3 border-t pt-3">
                                    <dt className="font-semibold">Valor al costo</dt>
                                    <dd className="num text-2xl leading-none font-bold">{money(totalValue)}</dd>
                                </div>
                            </dl>
                            <div className="bg-muted/40 grid gap-2 border-t p-4">
                                <Button
                                    type="submit"
                                    disabled={processing || blocker !== null}
                                    className="w-full disabled:opacity-100 disabled:[--btn-bg:var(--muted)] disabled:[--btn-fg:var(--muted-foreground)]"
                                >
                                    {processing ? <LoaderCircle className="size-4 animate-spin" /> : <Send />}
                                    Enviar transferencia
                                </Button>
                                {blocker && <p className="text-muted-foreground text-center text-xs">{blocker}</p>}
                                <Button asChild variant="ghost" size="sm">
                                    <Link href={route('admin.transfers.index')}>Cancelar</Link>
                                </Button>
                            </div>
                        </Panel>
                    </div>
                </div>
            </form>

            {choosing && (
                <TransferProductDialog
                    product={choosing}
                    initial={quantitiesOf(choosing.product_id)}
                    editing={isListed(choosing.product_id)}
                    onConfirm={confirmQuantities}
                    onClose={() => setChoosing(null)}
                />
            )}
            <ConfirmDialog
                open={nextOrigin !== null}
                onClose={() => setNextOrigin(null)}
                title="¿Cambiar la sucursal que envía?"
                description="Se vacía la lista, porque los lotes son de cada sucursal."
                confirmLabel="Cambiar"
                onConfirm={(done) => {
                    if (nextOrigin) {
                        changeOrigin(nextOrigin);
                    }
                    done();
                }}
            />
        </AdminLayout>
    );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="num font-medium">{value}</dd>
        </div>
    );
}

/** Quién es el producto, con íconos, igual que en compras y en el punto de venta. */
function ProductFacts({ product }: { product: TransferProduct }) {
    const facts = [
        { icon: FlaskConical, label: 'Genérico', value: product.generic_name },
        { icon: Beaker, label: 'Concentración', value: product.concentration },
        { icon: Factory, label: 'Laboratorio', value: product.laboratory },
    ].filter((fact) => fact.value);
    const extra = [product.pharmaceutical_form, product.category, product.barcode && `Cód. ${product.barcode}`].filter(Boolean).join(' · ');

    return (
        <>
            <p className="flex min-w-0 items-center gap-1.5 text-base leading-tight">
                <Tag className="text-primary size-4 shrink-0" />
                <span className="text-foreground/70 text-sm">Comercial:</span>
                <span className="truncate font-bold">{product.commercial_name}</span>
            </p>
            {facts.length > 0 && (
                <p className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
                    {facts.map(({ icon: Icon, label, value }) => (
                        <span key={label} className="inline-flex max-w-full min-w-0 items-start gap-1.5">
                            <Icon className="text-primary mt-0.5 size-4 shrink-0" />
                            <span className="text-foreground/70 shrink-0">{label}:</span>
                            <span className="text-foreground min-w-0 font-semibold break-words">{value}</span>
                        </span>
                    ))}
                </p>
            )}
            {(extra || product.is_controlled || product.requires_prescription) && (
                <p className="text-foreground/75 truncate text-sm">
                    {extra}
                    {product.is_controlled && <span className="ml-2 font-semibold text-red-600">Controlado</span>}
                    {!product.is_controlled && product.requires_prescription && <span className="ml-2 font-semibold text-amber-600">Con receta</span>}
                </p>
            )}
        </>
    );
}

/** Resultado de la búsqueda: quién es, en qué empaques viene, sus lotes y cuánto hay aquí y en el destino. */
function ProductResult({ product, inList, destinationChosen }: { product: TransferProduct; inList: number; destinationChosen: boolean }) {
    const breakdown = stockBreakdown(product.stock, product.presentations, product.base_unit);
    const lots = product.batches.slice(0, 3);
    const hiddenLots = product.batches.length - lots.length;

    return (
        <div className="flex items-center gap-3">
            <StoredImage path={product.image} alt={product.product_name} fallback={<Pill className="size-4" />} className="size-16 shrink-0" />
            <div className="grid min-w-0 flex-1 gap-1 text-left">
                <ProductFacts product={product} />
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                    <span className="inline-flex items-center gap-1.5">
                        <Boxes className="text-primary size-4 shrink-0" />
                        <span className="text-foreground/70">Presentaciones:</span>
                    </span>
                    <span className="font-semibold">{product.presentations.map((presentation) => presentation.name).join(' · ')}</span>
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="inline-flex items-center gap-1.5">
                        <Layers className="text-primary size-4 shrink-0" />
                        <span className="text-foreground/70">Lotes:</span>
                    </span>
                    {lots.map((batch) => (
                        <span key={batch.id} className="num inline-flex items-center gap-1.5 text-xs">
                            <span className="font-semibold">{batch.batch_number}</span>
                            <ExpiryBadge date={batch.expires_at} emptyLabel="Sin vencimiento" />
                            <span className="text-muted-foreground">{batch.stock.toLocaleString('es')}</span>
                        </span>
                    ))}
                    {hiddenLots > 0 && <span className="text-muted-foreground text-xs">+{hiddenLots} más</span>}
                </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                <span className="num text-muted-foreground text-xs">
                    Stock: <span className="text-foreground font-semibold">{unitsText(product.stock, product.base_unit)}</span>
                </span>
                {breakdown && <span className="num text-muted-foreground text-[11px]">= {breakdown}</span>}
                {product.destination_stock !== null ? (
                    <span className="num text-muted-foreground text-xs">
                        En destino: <span className="text-foreground font-semibold">{unitsText(product.destination_stock, product.base_unit)}</span>
                    </span>
                ) : (
                    !destinationChosen && <span className="text-muted-foreground text-[11px]">Elige destino para ver su stock</span>
                )}
                {inList > 0 && (
                    <span className="text-primary num text-[11px] font-semibold">En el envío: {unitsText(inList, product.base_unit)}</span>
                )}
                <span className="text-primary flex items-center gap-1.5 text-xs font-medium">
                    {inList > 0 ? 'Cambiar cantidad' : 'Elegir cantidad'}
                    <kbd className="bg-muted text-muted-foreground rounded border px-1 text-[9px] font-medium">Enter</kbd>
                </span>
            </div>
        </div>
    );
}

/** Un producto de la lista: quién es y su total; debajo, una fila por cada lote que sale, porque eso es lo que viaja. */
function ProductLine({
    position,
    rows,
    onLotUnits,
    onEdit,
    onRemove,
}: {
    position: number;
    rows: ItemRow[];
    onLotUnits: (batchId: number, units: number) => void;
    onEdit: () => void;
    onRemove: () => void;
}) {
    const { product } = rows[0];
    const units = rows.reduce((sum, row) => sum + row.quantity, 0);
    const value = rows.reduce((sum, row) => sum + row.quantity * row.batch.unit_cost, 0);

    return (
        <li className="grid gap-2.5 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
                <span className="text-muted-foreground num w-4 shrink-0 text-center text-xs">{position}</span>
                <StoredImage
                    path={product.image}
                    alt={product.product_name}
                    fallback={<Pill className="size-4" />}
                    className="size-14 shrink-0 rounded-lg"
                />
                <div className="grid min-w-48 flex-1 gap-1">
                    <ProductFacts product={product} />
                </div>
                <div className="num ml-auto shrink-0 text-right">
                    <p className="text-sm font-bold">{money(value)}</p>
                    <p className="text-muted-foreground text-xs">{unitsText(units, product.base_unit)}</p>
                </div>
                <RowActions>
                    <ActionButton icon={Pencil} label="Elegir lotes" onClick={onEdit} />
                    <ActionButton icon={Trash2} label="Quitar" tone="danger" onClick={onRemove} />
                </RowActions>
            </div>
            <ul className="divide-y rounded-lg border sm:ml-7">
                {rows.map((row) => (
                    <li key={row.batch_id} className="grid items-center gap-x-4 gap-y-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_8.5rem_9rem]">
                        <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                                <Layers className="text-primary size-3.5 shrink-0" />
                                Lote {row.batch.batch_number}
                                <ExpiryBadge date={row.batch.expires_at} emptyLabel="Sin vencimiento" />
                            </p>
                            <p className="num text-xs font-semibold">{packagesText(row.quantity, product)}</p>
                        </div>
                        <div className="stepper justify-self-start sm:justify-self-center" data-active="true">
                            <button type="button" onClick={() => onLotUnits(row.batch_id, row.quantity - 1)} aria-label="Menos">
                                <Minus className="size-3.5" />
                            </button>
                            <input
                                type="number"
                                min={0}
                                max={row.batch.stock}
                                className="text-sm"
                                value={row.quantity}
                                step={1}
                                inputMode="numeric"
                                onKeyDown={blockFractionKeys}
                                onChange={(e) => onLotUnits(row.batch_id, Math.min(row.batch.stock, Math.floor(Number(e.target.value) || 0)))}
                                onFocus={(e) => e.target.select()}
                                aria-label={`Cantidad del lote ${row.batch.batch_number}`}
                            />
                            <button
                                type="button"
                                onClick={() => onLotUnits(row.batch_id, row.quantity + 1)}
                                disabled={row.quantity >= row.batch.stock}
                                aria-label="Más"
                            >
                                <Plus className="size-3.5" />
                            </button>
                        </div>
                        <div className="num text-right">
                            <p className="text-sm font-semibold">{money(row.quantity * row.batch.unit_cost)}</p>
                            <p className="text-muted-foreground text-xs">
                                {money(row.batch.unit_cost)} c/{product.base_unit.toLowerCase()}
                            </p>
                        </div>
                    </li>
                ))}
            </ul>
        </li>
    );
}
