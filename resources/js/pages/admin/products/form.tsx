/*
 * PÁGINA: Nuevo / Editar producto  (rutas /admin/products/create y /admin/products/{id}/edit)
 * Datos: app/Http/Controllers/Admin/ProductController.php -> create() / edit()
 *
 * NOMBRES: comercial (la marca: Dolofen) y genérico (la sustancia: Paracetamol). El genérico se escribe;
 *   se sugieren los que ya usan otros productos.
 * PARA QUÉ SIRVE: usos / síntomas como etiquetas ("Dolor de cabeza", "Fiebre") + un detalle en texto.
 *   Se buscan en Productos, Inventario y el Punto de venta.
 * PRESENTACIONES POR NIVELES: la unidad base (tableta) y empaques que contienen al anterior
 *   (Blíster contiene 10 tabletas, Caja contiene 10 blísteres). El sistema calcula las unidades y el nombre.
 *   Escribiendo un precio se sugieren los demás
 *   (precio unitario × cantidad), y se pueden cambiar a mano. Cada una dice si se vende y/o se compra.
 *   Lógica: components/admin/products/presentation-levels.ts. El stock siempre se cuenta en unidades base.
 */
import { ImageUpload } from '@/components/admin/common/image-upload';
import { PageHeader } from '@/components/admin/common/page-header';
import { SimpleSelect } from '@/components/admin/common/simple-select';
import { TagInput } from '@/components/admin/common/tag-input';
import { Panel, PanelHeader } from '@/components/admin/dashboard/panel';
import { BaseUnitHelp } from '@/components/admin/products/base-unit-help';
import {
    defaultRows,
    type LevelRow,
    PHARMACEUTICAL_FORMS,
    plural,
    rowsFromPresentations,
    withSuggestedPrices,
} from '@/components/admin/products/presentation-levels';
import { PresentationLevelsEditor } from '@/components/admin/products/presentation-levels-editor';
import InputError from '@/components/shared/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AdminLayout from '@/layouts/admin/admin-layout';
import { cn } from '@/lib/utils';
import { type Option, type Product } from '@/types/admin/pharmacy';
import { Head, Link, useForm } from '@inertiajs/react';
import { HeartPulse, LoaderCircle, Pill } from 'lucide-react';
import { FormEventHandler } from 'react';

interface Props {
    product: Product | null;
    categories: Option[];
    laboratories: Option[];
    /** Genéricos ya usados en otros productos (se sugieren al escribir) */
    genericNames: string[];
    /** Usos / síntomas que ya existen (se sugieren al escribir) */
    indications: Option[];
}

const NONE = 'all';

export default function ProductForm({ product, categories, laboratories, genericNames, indications }: Props) {
    const isEdit = product !== null;
    const { data, setData, transform, post, put, processing, errors } = useForm({
        name: product?.name ?? '',
        generic_name: product?.generic_name ?? '',
        description: product?.description ?? '',
        indications: product?.indication_names ?? ([] as string[]),
        concentration: product?.concentration ?? '',
        pharmaceutical_form: product?.pharmaceutical_form ?? '',
        laboratory_id: product?.laboratory_id ? String(product.laboratory_id) : '',
        category_id: product?.category_id ? String(product.category_id) : '',
        barcode: product?.barcode ?? '',
        health_registry: product?.health_registry ?? '',
        base_unit: product?.base_unit ?? 'Unidad',
        requires_prescription: product?.requires_prescription ?? false,
        is_controlled: product?.is_controlled ?? false,
        min_stock: String(product?.min_stock ?? 0),
        is_active: product?.is_active ?? true,
        presentations: product ? rowsFromPresentations(product.presentations) : defaultRows(),
        // Foto: archivo elegido ahora (la sube StorageController a S3) y si se quitó la que tenía
        image: null as File | null,
        remove_image: false as boolean,
    });

    // Al servidor va el índice de la fila que contiene ("auto" lo ignora: es solo de la pantalla)
    // Con foto nueva al editar se manda POST + _method=put (PHP no lee archivos en un PUT)
    transform((d) => ({
        ...d,
        presentations: d.presentations.map(({ parent, ...row }) => ({ ...row, parent_index: parent })),
        ...(isEdit && d.image ? { _method: 'put' } : {}),
    }));

    const err = errors as Record<string, string | undefined>;

    const updateRows = (next: LevelRow[]) => setData('presentations', withSuggestedPrices(next));

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (isEdit && !data.image) put(route('admin.products.update', product.id));
        else post(isEdit ? route('admin.products.update', product.id) : route('admin.products.store'));
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
                    <div className="border-b px-5 py-4">
                        <ImageUpload
                            current={product?.image}
                            file={data.image}
                            removed={data.remove_image}
                            onChange={(file) => setData((d) => ({ ...d, image: file, remove_image: false }))}
                            onRemove={() => setData((d) => ({ ...d, image: null, remove_image: true }))}
                            error={err.image}
                            hint="Foto del producto o de la caja · JPG, PNG, WEBP o AVIF · hasta 5 MB"
                        />
                    </div>
                    <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                        <Field label="Nombre comercial" hint="La marca. Ej: Dolofen, Panadol" error={err.name}>
                            <Input value={data.name} onChange={(e) => setData('name', e.target.value)} placeholder="Dolofen" autoFocus />
                        </Field>
                        <Field label="Nombre genérico" hint="La sustancia. Ej: Paracetamol" error={err.generic_name}>
                            <Input
                                list="generic-names"
                                value={data.generic_name}
                                onChange={(e) => setData('generic_name', e.target.value)}
                                placeholder="Paracetamol"
                            />
                            <datalist id="generic-names">
                                {genericNames.map((name) => (
                                    <option key={name} value={name} />
                                ))}
                            </datalist>
                        </Field>
                        <Field label="Concentración" error={err.concentration}>
                            <Input value={data.concentration} onChange={(e) => setData('concentration', e.target.value)} placeholder="500 mg" />
                        </Field>
                        <Field label="Forma farmacéutica" error={err.pharmaceutical_form}>
                            <Input
                                list="pharmaceutical-forms"
                                value={data.pharmaceutical_form}
                                onChange={(e) => setData('pharmaceutical_form', e.target.value)}
                                placeholder="Tableta, Jarabe, Cápsula…"
                            />
                            <datalist id="pharmaceutical-forms">
                                {PHARMACEUTICAL_FORMS.map((form) => (
                                    <option key={form} value={form} />
                                ))}
                            </datalist>
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
                        <Field label={`Stock mínimo (en ${plural(data.base_unit) || 'unidades'})`} error={err.min_stock}>
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
                        icon={HeartPulse}
                        title="¿Para qué sirve?"
                        description='Usos y síntomas para encontrarlo rápido: al buscar "dolor de cabeza" aparece en el punto de venta.'
                    />
                    <div className="grid gap-4 p-5 lg:grid-cols-2">
                        <Field label="Usos / síntomas" hint="Escribe y presiona Enter" error={err.indications ?? err['indications.0']}>
                            <TagInput
                                value={data.indications}
                                onChange={(value) => setData('indications', value)}
                                suggestions={indications.map((i) => i.name)}
                                placeholder="Dolor de cabeza, Fiebre…"
                                invalid={!!err.indications}
                            />
                        </Field>
                        <Field label="Detalle" hint="Opcional" error={err.description}>
                            <textarea
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                rows={3}
                                maxLength={2000}
                                placeholder="Alivia el dolor leve a moderado y baja la fiebre."
                                className="border-input bg-card placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/20 dark:bg-background/60 w-full rounded-md border px-3 py-2 text-sm shadow-xs transition-[border-color,box-shadow] outline-none focus-visible:ring-3"
                            />
                        </Field>
                    </div>
                </Panel>

                <Panel>
                    <PanelHeader
                        title="Presentaciones y precios"
                        description="Cómo viene el producto, de lo más chico a lo más grande. Solo di qué contiene cada empaque: las unidades y el nombre se calculan solos."
                        aside={<BaseUnitHelp label="¿Cómo lleno esto?" />}
                    />
                    <div className="grid gap-3 p-5">
                        <PresentationLevelsEditor
                            rows={data.presentations}
                            baseUnit={data.base_unit}
                            errors={err}
                            onRowsChange={updateRows}
                            onBaseUnitChange={(value) => setData('base_unit', value)}
                        />
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

function Field({
    label,
    hint,
    error,
    className,
    children,
}: {
    label: string;
    hint?: React.ReactNode;
    error?: string;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div className={cn('grid content-start gap-2', className)}>
            <div className="flex items-baseline justify-between gap-2">
                <Label>{label}</Label>
                {hint && <span className="text-muted-foreground shrink-0 truncate text-xs">{hint}</span>}
            </div>
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
