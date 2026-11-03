/*
 * PÁGINA: Nueva compra  (ruta /admin/purchases/create)
 * Envía a PurchaseController@store → PurchaseService::create (cada ítem crea un lote).
 *
 * Por ítem: presentación comprada (ej: Caja x100), cantidad, costo de UNA presentación, lote y vencimiento.
 * El sistema convierte a unidades base: 2 cajas x100 = 200 tabletas, costo por tableta = costo / 100.
 */
import { Detail } from '@/components/admin/common/data-table';
import { HelpTip } from '@/components/admin/common/help-tip';
import { StoredImage } from '@/components/admin/common/image-upload';
import { describeLevels, PackageChain } from '@/components/admin/common/package-chain';
import { PageHeader } from '@/components/admin/common/page-header';
import { QuantityInput } from '@/components/admin/common/quantity-input';
import { SearchPicker } from '@/components/admin/common/search-picker';
import { SimpleSelect } from '@/components/admin/common/simple-select';
import { Panel, PanelHeader } from '@/components/admin/dashboard/panel';
import { plural } from '@/components/admin/products/presentation-levels';
import InputError from '@/components/shared/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import AdminLayout from '@/layouts/admin/admin-layout';
import { money, today } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Option, type ProductLookup } from '@/types/admin/pharmacy';
import { Head, Link, useForm } from '@inertiajs/react';
import { Beaker, CalendarClock, ClipboardList, Factory, FlaskConical, LoaderCircle, PackagePlus, Pill, Tag, Trash2 } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

interface Props {
    branches: Option[];
    suppliers: Option[];
}

type ItemRow = {
    product_presentation_id: number;
    label: string;
    /** Foto y datos del producto, solo para mostrar (no se envían a guardar) */
    image: string | null;
    product: ProductLookup;
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

    /** Fila resaltada un momento cuando se vuelve a elegir una presentación que ya está en la lista */
    const [highlighted, setHighlighted] = useState<number | null>(null);

    const addItem = (item: ProductLookup) => {
        const existing = data.items.findIndex((row) => row.product_presentation_id === item.presentation_id);
        if (existing !== -1) {
            setItem(existing, 'quantity', String((Number(data.items[existing].quantity) || 0) + 1));
            setHighlighted(existing);
            setTimeout(() => setHighlighted((current) => (current === existing ? null : current)), 1500);
            return;
        }
        setData('items', [
            ...data.items,
            {
                product_presentation_id: item.presentation_id,
                label: `${item.product_name} · ${item.presentation_name}`,
                image: item.image,
                product: item,
                factor: item.factor,
                base_unit: item.base_unit,
                quantity: '1',
                cost: '',
                batch_number: '',
                expires_at: '',
            },
        ]);
    };

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
                            <Label className="inline-flex items-center gap-1.5">
                                Sucursal que recibe <HelpTip>El stock de esta compra entra a esta sucursal.</HelpTip>
                            </Label>
                            <SimpleSelect options={branches} value={data.branch_id} onChange={(v) => setData('branch_id', v)} className="h-10" />
                            <InputError message={err.branch_id} />
                        </div>
                        <div className="grid content-start gap-2">
                            <Label className="inline-flex items-center gap-1.5">
                                Proveedor <HelpTip>Quién te vendió la mercadería. Si no está en la lista, regístralo primero en Proveedores.</HelpTip>
                            </Label>
                            <SimpleSelect options={suppliers} value={data.supplier_id} onChange={(v) => setData('supplier_id', v)} className="h-10" />
                            <InputError message={err.supplier_id} />
                        </div>
                        <div className="grid content-start gap-2">
                            <Label htmlFor="invoice" className="inline-flex items-center gap-1.5">
                                N° factura / nota <HelpTip>Opcional. Sirve para encontrar la compra después y compararla con el papel.</HelpTip>
                            </Label>
                            <Input id="invoice" value={data.invoice_number} onChange={(e) => setData('invoice_number', e.target.value)} />
                            <InputError message={err.invoice_number} />
                        </div>
                        <div className="grid content-start gap-2">
                            <Label htmlFor="date" className="inline-flex items-center gap-1.5">
                                Fecha <HelpTip>Día en que recibiste la mercadería. No puede ser una fecha futura.</HelpTip>
                            </Label>
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
                        description="Busca por nombre, genérico o código de barras y elige la presentación comprada."
                    />
                    <div className="grid gap-4 p-5">
                        <SearchPicker<ProductLookup>
                            url={(q) => route('admin.products.search', { q })}
                            onPick={addItem}
                            itemKey={(item) => item.presentation_id}
                            placeholder="Buscar por nombre, genérico o escanear el código de barras…"
                            listClassName="max-h-[32rem] divide-y"
                            renderItem={(item) => (
                                <div className="flex items-center gap-3">
                                    <StoredImage
                                        path={item.image}
                                        alt={item.product_name}
                                        fallback={<Pill className="size-4" />}
                                        className="size-16"
                                    />
                                    <ProductIdentity item={item} className="flex-1" />
                                    {data.items.some((row) => row.product_presentation_id === item.presentation_id) && (
                                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                                            Ya en la lista · +1
                                        </span>
                                    )}
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
                                <div
                                    key={i}
                                    className={cn(
                                        'grid items-start gap-3 rounded-lg border p-3 transition-colors duration-500 lg:grid-cols-[minmax(0,1fr)_8.5rem_8.5rem_10rem_10.5rem_auto]',
                                        highlighted === i && 'border-amber-400 bg-amber-50 dark:bg-amber-950/40',
                                    )}
                                >
                                    <div className="flex min-w-0 gap-3">
                                        <span className="bg-primary/10 text-primary num mt-1 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                                            {i + 1}
                                        </span>
                                        <StoredImage
                                            path={row.image}
                                            alt={row.label}
                                            fallback={<Pill className="size-4" />}
                                            className="size-16"
                                            zoomable
                                        />
                                        <div className="min-w-0">
                                            <ProductIdentity item={row.product} compact />
                                            <InputError message={err[`items.${i}.product_presentation_id`]} />
                                        </div>
                                    </div>
                                    <ItemField
                                        label={`Cantidad (${row.product.package})`}
                                        required
                                        help={
                                            row.factor > 1
                                                ? `Cuántas "${row.product.presentation_name}" llegaron. ${describeLevels(row.product.breakdown) || `Cada una trae ${row.product.contents}`}. Así entran al stock.`
                                                : `Cuántas unidades sueltas (${row.product.contents.replace(/^1 /, '')}) llegaron.`
                                        }
                                        error={err[`items.${i}.quantity`]}
                                        hint={
                                            row.factor > 1 && Number(row.quantity) > 0
                                                ? `Entran ${(Number(row.quantity) * row.factor).toLocaleString('es')} ${plural(row.base_unit)}`
                                                : undefined
                                        }
                                    >
                                        <QuantityInput min={1} value={row.quantity} onChange={(value) => setItem(i, 'quantity', value)} />
                                    </ItemField>
                                    <ItemField
                                        label={`Costo por ${row.product.package}`}
                                        required
                                        help="Lo que pagaste por UNA, según la factura (hasta 5 decimales). El sistema calcula solo el costo de cada unidad suelta."
                                        error={err[`items.${i}.cost`]}
                                        hint={Number(row.cost) > 0 ? `Subtotal ${money(Number(row.quantity || 0) * Number(row.cost))}` : undefined}
                                    >
                                        <Input
                                            type="number"
                                            min={0}
                                            step="0.00001"
                                            required
                                            placeholder="0.00"
                                            value={row.cost}
                                            onChange={(e) => {
                                                // Hasta 5 decimales: si escribe más, no se acepta la tecla
                                                if (/^\d*([.,]\d{0,5})?$/.test(e.target.value)) {
                                                    setItem(i, 'cost', e.target.value);
                                                }
                                            }}
                                        />
                                    </ItemField>
                                    <ItemField
                                        label="Lote"
                                        optional
                                        help="Número de lote impreso en la caja (Lot / Lote), cerca del vencimiento. Si lo dejas vacío se guarda como S/L (sin lote)."
                                        error={err[`items.${i}.batch_number`]}
                                    >
                                        <Input
                                            value={row.batch_number}
                                            placeholder="S/L"
                                            maxLength={50}
                                            onChange={(e) => setItem(i, 'batch_number', e.target.value)}
                                        />
                                    </ItemField>
                                    <ItemField
                                        label="Vencimiento"
                                        optional
                                        help="Fecha de vencimiento impresa en la caja. Al vender se usa primero el lote que vence antes; si lo dejas vacío, el lote no vence y se vende al final."
                                        error={err[`items.${i}.expires_at`]}
                                        warning={expiryWarning(row.expires_at)}
                                    >
                                        <Input
                                            type="date"
                                            min={today()}
                                            value={row.expires_at}
                                            onChange={(e) => setItem(i, 'expires_at', e.target.value)}
                                        />
                                    </ItemField>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="mt-5 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
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
                                        </TooltipTrigger>
                                        <TooltipContent>Quitar de la compra</TooltipContent>
                                    </Tooltip>
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

function ItemField({
    label,
    required = false,
    optional = false,
    help,
    hint,
    warning,
    error,
    children,
}: {
    label: string;
    /** Muestra un * rojo: el campo es obligatorio */
    required?: boolean;
    /** Muestra "(opcional)" */
    optional?: boolean;
    help?: React.ReactNode;
    /** Texto chico de cálculo debajo del campo (ej: "Subtotal Bs 16,97") */
    hint?: string;
    /** Aviso en ámbar debajo del campo (ej: vence pronto) */
    warning?: string;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="grid content-start gap-1">
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                {label}
                {required && (
                    <span className="font-semibold text-red-600" aria-hidden>
                        *
                    </span>
                )}
                {optional && <span className="text-muted-foreground/80 italic">(opcional)</span>}
                {help && <HelpTip>{help}</HelpTip>}
            </span>
            {children}
            {hint && <span className="text-foreground/75 num text-xs font-medium">{hint}</span>}
            {warning && !error && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                    <CalendarClock className="size-3.5 shrink-0" />
                    {warning}
                </span>
            )}
            <InputError message={error} />
        </div>
    );
}

/** Aviso si el lote vence en menos de 6 meses: conviene revisarlo antes de aceptar la mercadería. */
function expiryWarning(date: string): string | undefined {
    if (!date) {
        return undefined;
    }
    const days = Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${today()}T00:00:00`).getTime()) / 86_400_000);
    if (days <= 0 || days > 180) {
        return undefined;
    }
    return days < 60 ? `Vence en ${days} días` : `Vence en ~${Math.round(days / 30)} meses`;
}

/**
 * Datos para reconocer el producto (compact = sin la línea de forma, categoría, código y receta; para las filas de la factura): comercial y presentación; genérico, concentración y laboratorio
 * (solo los que tiene); luego forma, categoría, código de barras y si es controlado o con receta.
 */
function ProductIdentity({ item, compact = false, className }: { item: ProductLookup; compact?: boolean; className?: string }) {
    const facts = [
        { icon: FlaskConical, label: 'Genérico', value: item.generic_name },
        { icon: Beaker, label: 'Concentración', value: item.concentration },
        { icon: Factory, label: 'Laboratorio', value: item.laboratory },
    ].filter((fact) => fact.value);
    const extra = [item.pharmaceutical_form, item.category, item.barcode && `Cód. ${item.barcode}`].filter(Boolean).join(' · ');

    return (
        <div className={cn('grid min-w-0 gap-1 text-left', className)}>
            <PackageChain pkg={item.package} levels={item.breakdown} />
            <p className="flex min-w-0 items-center gap-1.5 text-base leading-tight">
                <Tag className="text-primary size-4 shrink-0" />
                <span className="text-foreground/70 text-sm">Comercial:</span>
                <span className="truncate font-bold">{item.commercial_name}</span>
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
            {!compact && (extra || item.is_controlled || item.requires_prescription) && (
                <p className="text-foreground/75 truncate text-sm">
                    {extra}
                    {item.is_controlled && <span className="ml-2 font-semibold text-red-600">Controlado</span>}
                    {!item.is_controlled && item.requires_prescription && <span className="ml-2 font-semibold text-amber-600">Con receta</span>}
                </p>
            )}
        </div>
    );
}
