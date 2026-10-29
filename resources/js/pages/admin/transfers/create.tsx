/*
 * PÁGINA: Nueva transferencia  (ruta /admin/transfers/create)
 * Se elige el LOTE que se envía (mismo número y vencimiento llegan al destino). Cantidades en unidades base.
 * Envía a TransferController@store → TransferService::send
 */
import { ExpiryBadge } from '@/components/admin/common/doc-status';
import { PageHeader } from '@/components/admin/common/page-header';
import { SearchPicker } from '@/components/admin/common/search-picker';
import { SimpleSelect } from '@/components/admin/common/simple-select';
import { Panel, PanelHeader } from '@/components/admin/dashboard/panel';
import InputError from '@/components/shared/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AdminLayout from '@/layouts/admin/admin-layout';
import { type BatchLookup, type Option } from '@/types/admin/pharmacy';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeftRight, LoaderCircle, PackagePlus, Trash2 } from 'lucide-react';
import { FormEventHandler } from 'react';

type ItemRow = {
    batch_id: number;
    label: string;
    batch_number: string;
    expires_at: string;
    available: number;
    base_unit: string;
    quantity: string;
};

export default function TransferCreate({ fromBranches, toBranches }: { fromBranches: Option[]; toBranches: Option[] }) {
    const { data, setData, post, processing, errors } = useForm({
        from_branch_id: fromBranches.length === 1 ? String(fromBranches[0].id) : '',
        to_branch_id: '',
        note: '',
        items: [] as ItemRow[],
    });
    const err = errors as Record<string, string | undefined>;

    const addBatch = (batch: BatchLookup) => {
        if (data.items.some((row) => row.batch_id === batch.id)) return;
        setData('items', [
            ...data.items,
            {
                batch_id: batch.id,
                label: batch.product_name,
                batch_number: batch.batch_number,
                expires_at: batch.expires_at,
                available: batch.quantity,
                base_unit: batch.base_unit,
                quantity: String(batch.quantity),
            },
        ]);
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

                <Panel>
                    <PanelHeader title="Sucursales" />
                    <div className="grid gap-4 p-5 md:grid-cols-3">
                        <div className="grid content-start gap-2">
                            <Label>Envía</Label>
                            <SimpleSelect
                                options={fromBranches}
                                value={data.from_branch_id}
                                onChange={(v) => setData((d) => ({ ...d, from_branch_id: v, items: [] }))}
                                className="h-10"
                            />
                            <InputError message={err.from_branch_id} />
                        </div>
                        <div className="grid content-start gap-2">
                            <Label>Recibe</Label>
                            <SimpleSelect
                                options={toBranches.filter((b) => String(b.id) !== data.from_branch_id)}
                                value={data.to_branch_id}
                                onChange={(v) => setData('to_branch_id', v)}
                                className="h-10"
                            />
                            <InputError message={err.to_branch_id} />
                        </div>
                        <div className="grid content-start gap-2">
                            <Label htmlFor="note">Nota</Label>
                            <Input id="note" value={data.note} onChange={(e) => setData('note', e.target.value)} placeholder="Opcional" />
                        </div>
                    </div>
                </Panel>

                <Panel>
                    <PanelHeader title="Lotes a enviar" description="Busca el producto y elige el lote. Las cantidades van en unidades base." />
                    <div className="grid gap-4 p-5">
                        {data.from_branch_id ? (
                            <SearchPicker<BatchLookup>
                                url={(q) => route('admin.inventory.batches', { q, branch_id: data.from_branch_id })}
                                onPick={addBatch}
                                itemKey={(b) => b.id}
                                placeholder="Buscar producto…"
                                renderItem={(b) => (
                                    <div className="flex items-center justify-between gap-3">
                                        <span>
                                            <span className="font-medium">{b.product_name}</span> · lote {b.batch_number}
                                        </span>
                                        <span className="flex items-center gap-2 text-xs">
                                            <ExpiryBadge date={b.expires_at} />
                                            <span className="text-muted-foreground">
                                                {b.quantity} {b.base_unit}
                                            </span>
                                        </span>
                                    </div>
                                )}
                            />
                        ) : (
                            <p className="text-muted-foreground text-sm">Primero elige la sucursal que envía.</p>
                        )}
                        <InputError message={err.items} />

                        {data.items.length === 0 ? (
                            <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-sm">
                                <PackagePlus className="size-6" />
                                Todavía no agregaste lotes.
                            </div>
                        ) : (
                            data.items.map((row, i) => (
                                <div key={row.batch_id} className="grid items-center gap-3 rounded-lg border p-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">{row.label}</p>
                                        <p className="text-muted-foreground text-xs">
                                            Lote {row.batch_number} · disponibles {row.available} {row.base_unit}
                                        </p>
                                    </div>
                                    <ExpiryBadge date={row.expires_at} className="justify-self-start" />
                                    <div>
                                        <Input
                                            type="number"
                                            min={1}
                                            max={row.available}
                                            value={row.quantity}
                                            onChange={(e) =>
                                                setData(
                                                    'items',
                                                    data.items.map((r, j) => (j === i ? { ...r, quantity: e.target.value } : r)),
                                                )
                                            }
                                        />
                                        <InputError message={err[`items.${i}.quantity`]} />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() =>
                                            setData(
                                                'items',
                                                data.items.filter((_, j) => j !== i),
                                            )
                                        }
                                        aria-label="Quitar"
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </Panel>

                <div className="flex justify-end gap-2">
                    <Button asChild variant="outline">
                        <Link href={route('admin.transfers.index')}>Cancelar</Link>
                    </Button>
                    <Button type="submit" disabled={processing || data.items.length === 0} className="btn-brand">
                        {processing && <LoaderCircle className="size-4 animate-spin" />}
                        Enviar transferencia
                    </Button>
                </div>
            </form>
        </AdminLayout>
    );
}
