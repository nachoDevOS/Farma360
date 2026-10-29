/*
 * PÁGINA: Nuevo / Editar producto  (rutas /admin/products/create y /admin/products/{id}/edit)
 * Datos: app/Http/Controllers/Admin/ProductController.php -> create() / edit()
 *
 * PRESENTACIONES: formas de vender el producto. "Unidades" = cuántas unidades base trae.
 *   Unidad = 1 · Blíster x10 = 10 · Caja x100 = 100. El stock siempre se cuenta en unidades base.
 */
import { PageHeader } from '@/components/admin/common/page-header';
import { SimpleSelect } from '@/components/admin/common/simple-select';
import { Panel, PanelHeader } from '@/components/admin/dashboard/panel';
import InputError from '@/components/shared/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AdminLayout from '@/layouts/admin/admin-layout';
import { money } from '@/lib/format';
import { type Option, type Product } from '@/types/admin/pharmacy';
import { Head, Link, useForm } from '@inertiajs/react';
import { LoaderCircle, Pill, Plus, Trash2 } from 'lucide-react';
import { FormEventHandler } from 'react';

interface Props {
    product: Product | null;
    categories: Option[];
    laboratories: Option[];
    activeIngredients: Option[];
}

// "type" (no "interface"): useForm de Inertia necesita tipos que acepten cualquier clave
type PresentationRow = {
    id?: number;
    name: string;
    factor: string;
    sale_price: string;
    barcode: string;
};

const NONE = 'all';

export default function ProductForm({ product, categories, laboratories, activeIngredients }: Props) {
    const isEdit = product !== null;
    const { data, setData, post, put, processing, errors } = useForm({
        name: product?.name ?? '',
        active_ingredient_id: product?.active_ingredient_id ? String(product.active_ingredient_id) : '',
        concentration: product?.concentration ?? '',
        pharmaceutical_form: product?.pharmaceutical_form ?? '',
        laboratory_id: product?.laboratory_id ? String(product.laboratory_id) : '',
        category_id: product?.category_id ? String(product.category_id) : '',
        barcode: product?.barcode ?? '',
        health_registry: product?.health_registry ?? '',
        base_unit: product?.base_unit ?? 'tableta',
        requires_prescription: product?.requires_prescription ?? false,
        is_controlled: product?.is_controlled ?? false,
        min_stock: String(product?.min_stock ?? 0),
        is_active: product?.is_active ?? true,
        presentations: (product?.presentations.map((p) => ({
            id: p.id,
            name: p.name,
            factor: String(p.factor),
            sale_price: p.sale_price,
            barcode: p.barcode ?? '',
        })) ?? [{ name: 'Unidad', factor: '1', sale_price: '', barcode: '' }]) as PresentationRow[],
    });

    const err = errors as Record<string, string | undefined>;
    const setPresentation = (index: number, field: keyof PresentationRow, value: string) =>
        setData(
            'presentations',
            data.presentations.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
        );

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (isEdit) put(route('admin.products.update', product.id));
        else post(route('admin.products.store'));
    };

    const optional = (value: string) => (value === NONE ? '' : value);

    return (
        <AdminLayout
            breadcrumbs={[
                { title: 'Productos', href: route('admin.products.index') },
                { title: isEdit ? 'Editar' : 'Nuevo', href: '#' },
            ]}
        >
            <Head title={isEdit ? `Editar ${product.name}` : 'Nuevo producto'} />
            <form onSubmit={submit} className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                <PageHeader
                    icon={Pill}
                    title={isEdit ? `Editar ${product.name}` : 'Nuevo producto'}
                    description="Datos del medicamento y sus formas de venta."
                />

                <Panel>
                    <PanelHeader title="Datos del producto" />
                    <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                        <Field label="Nombre comercial" error={err.name}>
                            <Input value={data.name} onChange={(e) => setData('name', e.target.value)} placeholder="Panadol" autoFocus />
                        </Field>
                        <Field label="Principio activo" error={err.active_ingredient_id}>
                            <SimpleSelect
                                options={activeIngredients}
                                value={data.active_ingredient_id}
                                allLabel="— Ninguno —"
                                onChange={(v) => setData('active_ingredient_id', optional(v))}
                                className="h-10"
                            />
                        </Field>
                        <Field label="Concentración" error={err.concentration}>
                            <Input value={data.concentration} onChange={(e) => setData('concentration', e.target.value)} placeholder="500 mg" />
                        </Field>
                        <Field label="Forma farmacéutica" error={err.pharmaceutical_form}>
                            <Input
                                value={data.pharmaceutical_form}
                                onChange={(e) => setData('pharmaceutical_form', e.target.value)}
                                placeholder="Tableta, Jarabe, Cápsula…"
                            />
                        </Field>
                        <Field label="Laboratorio" error={err.laboratory_id}>
                            <SimpleSelect
                                options={laboratories}
                                value={data.laboratory_id}
                                allLabel="— Ninguno —"
                                onChange={(v) => setData('laboratory_id', optional(v))}
                                className="h-10"
                            />
                        </Field>
                        <Field label="Categoría" error={err.category_id}>
                            <SimpleSelect
                                options={categories}
                                value={data.category_id}
                                allLabel="— Ninguna —"
                                onChange={(v) => setData('category_id', optional(v))}
                                className="h-10"
                            />
                        </Field>
                        <Field label="Código de barras" error={err.barcode}>
                            <Input value={data.barcode} onChange={(e) => setData('barcode', e.target.value)} />
                        </Field>
                        <Field label="Registro sanitario" error={err.health_registry}>
                            <Input value={data.health_registry} onChange={(e) => setData('health_registry', e.target.value)} />
                        </Field>
                        <Field label="Unidad base (cómo se cuenta el stock)" error={err.base_unit}>
                            <Input
                                value={data.base_unit}
                                onChange={(e) => setData('base_unit', e.target.value)}
                                placeholder="tableta, frasco, ampolla…"
                            />
                        </Field>
                        <Field label={`Stock mínimo (en ${data.base_unit || 'unidades'})`} error={err.min_stock}>
                            <Input type="number" min={0} value={data.min_stock} onChange={(e) => setData('min_stock', e.target.value)} />
                        </Field>
                        <div className="flex flex-col gap-2 md:col-span-2">
                            <Label>Control</Label>
                            <div className="flex flex-wrap gap-2">
                                <Flag
                                    checked={data.requires_prescription}
                                    onChange={(v) => setData('requires_prescription', v)}
                                    label="Venta con receta"
                                />
                                <Flag
                                    checked={data.is_controlled}
                                    onChange={(v) =>
                                        setData((d) => ({ ...d, is_controlled: v, requires_prescription: v || d.requires_prescription }))
                                    }
                                    label="Controlado (psicotrópico / estupefaciente)"
                                />
                                <Flag checked={data.is_active} onChange={(v) => setData('is_active', v)} label="Activo" />
                            </div>
                        </div>
                    </div>
                </Panel>

                <Panel>
                    <PanelHeader
                        title="Presentaciones y precios"
                        description={`"Unidades" = cuántas ${data.base_unit || 'unidades'} trae cada presentación.`}
                        aside={
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                    setData('presentations', [...data.presentations, { name: '', factor: '', sale_price: '', barcode: '' }])
                                }
                            >
                                <Plus /> Agregar
                            </Button>
                        }
                    />
                    <div className="grid gap-3 p-5">
                        {data.presentations.map((p, i) => {
                            const unitPrice = Number(p.sale_price) / Number(p.factor || 1);
                            return (
                                <div key={i} className="grid items-start gap-3 rounded-lg border p-3 sm:grid-cols-[2fr_1fr_1fr_1.5fr_auto]">
                                    <Field label="Nombre" error={err[`presentations.${i}.name`]}>
                                        <Input value={p.name} onChange={(e) => setPresentation(i, 'name', e.target.value)} placeholder="Caja x100" />
                                    </Field>
                                    <Field label="Unidades" error={err[`presentations.${i}.factor`]}>
                                        <Input
                                            type="number"
                                            min={1}
                                            value={p.factor}
                                            onChange={(e) => setPresentation(i, 'factor', e.target.value)}
                                        />
                                    </Field>
                                    <Field label="Precio de venta" error={err[`presentations.${i}.sale_price`]}>
                                        <Input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={p.sale_price}
                                            onChange={(e) => setPresentation(i, 'sale_price', e.target.value)}
                                        />
                                        {Number(p.factor) > 1 && p.sale_price && (
                                            <p className="text-muted-foreground text-xs">{money(unitPrice)} c/u</p>
                                        )}
                                    </Field>
                                    <Field label="Código de barras" error={err[`presentations.${i}.barcode`]}>
                                        <Input value={p.barcode} onChange={(e) => setPresentation(i, 'barcode', e.target.value)} />
                                    </Field>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="mt-6"
                                        disabled={data.presentations.length === 1}
                                        onClick={() =>
                                            setData(
                                                'presentations',
                                                data.presentations.filter((_, j) => j !== i),
                                            )
                                        }
                                        aria-label="Quitar presentación"
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            );
                        })}
                        <InputError message={err.presentations} />
                    </div>
                </Panel>

                <div className="flex justify-end gap-2">
                    <Button asChild variant="outline">
                        <Link href={route('admin.products.index')}>Cancelar</Link>
                    </Button>
                    <Button type="submit" disabled={processing} className="btn-brand">
                        {processing && <LoaderCircle className="size-4 animate-spin" />}
                        {isEdit ? 'Guardar cambios' : 'Crear producto'}
                    </Button>
                </div>
            </form>
        </AdminLayout>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <div className="grid content-start gap-2">
            <Label>{label}</Label>
            {children}
            <InputError message={error} />
        </div>
    );
}

function Flag({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
    return (
        <label className="flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2">
            <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} />
            <span className="text-sm">{label}</span>
        </label>
    );
}
