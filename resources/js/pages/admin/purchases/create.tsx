/*
 * PÁGINA: Nueva compra  (ruta /admin/purchases/create)
 * Envía a PurchaseController@store → PurchaseService::create (cada ítem crea un lote).
 *
 * Por ítem: presentación comprada (ej: Caja x100), cantidad, costo de UNA presentación, lote y vencimiento.
 * El sistema convierte a unidades base: 2 cajas x100 = 200 tabletas, costo por tableta = costo / 100.
 */
import { Detail } from '@/components/admin/common/data-table';
import { PageHeader } from '@/components/admin/common/page-header';
import { SearchPicker } from '@/components/admin/common/search-picker';
import { SimpleSelect } from '@/components/admin/common/simple-select';
import { Panel, PanelHeader } from '@/components/admin/dashboard/panel';
import InputError from '@/components/shared/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AdminLayout from '@/layouts/admin/admin-layout';
import { money, today } from '@/lib/format';
import { type Option, type ProductLookup } from '@/types/admin/pharmacy';
import { Head, Link, useForm } from '@inertiajs/react';
import { ClipboardList, LoaderCircle, PackagePlus, Trash2 } from 'lucide-react';
import { FormEventHandler } from 'react';

interface Props {
    branches: Option[];
    suppliers: Option[];
}

type ItemRow = {
    product_presentation_id: number;
    label: string;
    factor: number;
    base_unit: string;
    quantity: string;
    cost: string;
    batch_number: string;
    expires_at: string;
};

export default function PurchaseCreate({ branches, suppliers }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        branch_id: branches.length === 1 ? String(branches[0].id) : '',
        supplier_id: '',
        invoice_number: '',
        purchased_at: today(),
        note: '',
        items: [] as ItemRow[],
    });
    const err = errors as Record<string, string | undefined>;

    const addItem = (item: ProductLookup) =>
        setData('items', [
            ...data.items,
            {
                product_presentation_id: item.presentation_id,
                label: `${item.product_name} · ${item.presentation_name}`,
                factor: item.factor,
                base_unit: item.base_unit,
                quantity: '1',
                cost: '',
                batch_number: '',
                expires_at: '',
            },
        ]);

    const setItem = (index: number, field: keyof ItemRow, value: string) =>
        setData(
            'items',
            data.items.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
        );

    const total = data.items.reduce((sum, row) => sum + Number(row.quantity || 0) * Number(row.cost || 0), 0);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('admin.purchases.store'));
    };

    return (
        <AdminLayout
            breadcrumbs={[
                { title: 'Compras', href: route('admin.purchases.index') },
                { title: 'Nueva', href: '#' },
            ]}
        >
            <Head title="Nueva compra" />
            <form onSubmit={submit} className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                <PageHeader
                    icon={ClipboardList}
                    title="Nueva compra"
                    description="Registra la mercadería recibida. Al guardar, el stock queda disponible."
                />

                <Panel>
                    <PanelHeader title="Datos de la compra" />
                    <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
                        <div className="grid content-start gap-2">
                            <Label>Sucursal que recibe</Label>
                            <SimpleSelect options={branches} value={data.branch_id} onChange={(v) => setData('branch_id', v)} className="h-10" />
                            <InputError message={err.branch_id} />
                        </div>
                        <div className="grid content-start gap-2">
                            <Label>Proveedor</Label>
                            <SimpleSelect options={suppliers} value={data.supplier_id} onChange={(v) => setData('supplier_id', v)} className="h-10" />
                            <InputError message={err.supplier_id} />
                        </div>
                        <div className="grid content-start gap-2">
                            <Label htmlFor="invoice">N° factura / nota</Label>
                            <Input id="invoice" value={data.invoice_number} onChange={(e) => setData('invoice_number', e.target.value)} />
                            <InputError message={err.invoice_number} />
                        </div>
                        <div className="grid content-start gap-2">
                            <Label htmlFor="date">Fecha</Label>
                            <Input
                                id="date"
                                type="date"
                                max={today()}
                                value={data.purchased_at}
                                onChange={(e) => setData('purchased_at', e.target.value)}
                            />
                            <InputError message={err.purchased_at} />
                        </div>
                    </div>
                </Panel>

                <Panel>
                    <PanelHeader
                        title="Productos recibidos"
                        description="Busca por nombre, código de barras o principio activo y elige la presentación comprada."
                    />
                    <div className="grid gap-4 p-5">
                        <SearchPicker<ProductLookup>
                            url={(q) => route('admin.products.search', { q })}
                            onPick={addItem}
                            itemKey={(item) => item.presentation_id}
                            placeholder="Buscar producto para agregar…"
                            renderItem={(item) => (
                                <div className="flex items-center justify-between gap-3">
                                    <span>
                                        <span className="font-medium">{item.product_name}</span> · {item.presentation_name}
                                        {item.active_ingredient && <span className="text-muted-foreground"> ({item.active_ingredient})</span>}
                                    </span>
                                    <span className="text-muted-foreground text-xs whitespace-nowrap">
                                        {item.factor} {item.base_unit}
                                    </span>
                                </div>
                            )}
                        />
                        <InputError message={err.items} />

                        {data.items.length === 0 ? (
                            <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-sm">
                                <PackagePlus className="size-6" />
                                Agrega los productos de la factura.
                            </div>
                        ) : (
                            data.items.map((row, i) => (
                                <div key={i} className="grid items-start gap-3 rounded-lg border p-3 lg:grid-cols-[2.2fr_0.8fr_1fr_1fr_1.1fr_auto]">
                                    <div className="min-w-0">
                                        <p className="text-muted-foreground text-xs">Producto</p>
                                        <p className="mt-1.5 truncate text-sm font-medium">{row.label}</p>
                                        {Number(row.quantity) > 0 && (
                                            <p className="text-muted-foreground mt-0.5 text-xs">
                                                = {(Number(row.quantity) * row.factor).toLocaleString('es')} {row.base_unit}
                                                {Number(row.cost) > 0 && <> · {money(Number(row.cost) / row.factor)} c/u</>}
                                            </p>
                                        )}
                                    </div>
                                    <ItemField label="Cantidad" error={err[`items.${i}.quantity`]}>
                                        <Input type="number" min={1} value={row.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} />
                                    </ItemField>
                                    <ItemField label="Costo c/presentación" error={err[`items.${i}.cost`]}>
                                        <Input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={row.cost}
                                            onChange={(e) => setItem(i, 'cost', e.target.value)}
                                        />
                                    </ItemField>
                                    <ItemField label="Lote" error={err[`items.${i}.batch_number`]}>
                                        <Input value={row.batch_number} onChange={(e) => setItem(i, 'batch_number', e.target.value)} />
                                    </ItemField>
                                    <ItemField label="Vencimiento" error={err[`items.${i}.expires_at`]}>
                                        <Input
                                            type="date"
                                            min={today()}
                                            value={row.expires_at}
                                            onChange={(e) => setItem(i, 'expires_at', e.target.value)}
                                        />
                                    </ItemField>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="mt-5"
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

                <div className="surface flex flex-col gap-4 rounded-xl p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-8">
                        <Detail label="Ítems">{data.items.length}</Detail>
                        <Detail label="Total de la compra">
                            <span className="num text-lg">{money(total)}</span>
                        </Detail>
                    </div>
                    <div className="flex gap-2">
                        <Button asChild variant="outline">
                            <Link href={route('admin.purchases.index')}>Cancelar</Link>
                        </Button>
                        <Button type="submit" disabled={processing || data.items.length === 0} className="btn-brand">
                            {processing && <LoaderCircle className="size-4 animate-spin" />}
                            Registrar compra
                        </Button>
                    </div>
                </div>
            </form>
        </AdminLayout>
    );
}

function ItemField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <div className="grid content-start gap-1">
            <span className="text-muted-foreground text-xs">{label}</span>
            {children}
            <InputError message={error} />
        </div>
    );
}
