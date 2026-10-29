/*
 * PÁGINA: Productos  (ruta /admin/products)
 * Datos: app/Http/Controllers/Admin/ProductController.php -> index()
 * El buscador encuentra por nombre comercial, genérico, código de barras, uso / síntoma o detalle.
 * Filtro "Todos los usos": productos para un síntoma (ej: Dolor de cabeza).
 */
import { ConfirmDialog } from '@/components/admin/common/confirm-dialog';
import { DataTable, EmptyRow, Td, Th } from '@/components/admin/common/data-table';
import { PageHeader } from '@/components/admin/common/page-header';
import { ActionButton, RowActions } from '@/components/admin/common/row-actions';
import { SimpleSelect } from '@/components/admin/common/simple-select';
import { TableToolbar } from '@/components/admin/common/table-toolbar';
import { StatusBadge } from '@/components/admin/common/user-badges';
import { Pagination } from '@/components/shared/pagination';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { useFilters } from '@/hooks/use-filters';
import AdminLayout from '@/layouts/admin/admin-layout';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Paginated } from '@/types';
import { type ListFilters, type Option, type Product } from '@/types/admin/pharmacy';
import { Head, Link, router } from '@inertiajs/react';
import { FlaskConical, Pencil, Pill, Plus, Stethoscope, Tags, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface Props {
    products: Paginated<Product>;
    filters: ListFilters & { category?: string; laboratory?: string; indication?: string };
    categories: Option[];
    laboratories: Option[];
    indications: Option[];
}

export default function ProductsIndex({ products, filters, categories, laboratories, indications }: Props) {
    const can = useCan();
    const applyFilters = useFilters('admin.products.index', filters);
    const [deleting, setDeleting] = useState<Product | null>(null);

    return (
        <AdminLayout breadcrumbs={[{ title: 'Productos', href: route('admin.products.index') }]}>
            <Head title="Productos" />
            <div className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                <PageHeader
                    icon={Pill}
                    title="Productos"
                    description={`${products.total} productos en el catálogo. El stock se cuenta en la unidad base de cada uno.`}
                    actions={
                        <>
                            <Button asChild variant="outline" size="sm">
                                <Link href={route('admin.categories.index')}>
                                    <Tags /> Categorías
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm">
                                <Link href={route('admin.active-ingredients.index')}>
                                    <FlaskConical /> Genéricos
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm">
                                <Link href={route('admin.indications.index')}>
                                    <Stethoscope /> Usos
                                </Link>
                            </Button>
                            {can('productos.crear') && (
                                <Button asChild size="sm" className="btn-brand">
                                    <Link href={route('admin.products.create')}>
                                        <Plus /> Nuevo producto
                                    </Link>
                                </Button>
                            )}
                        </>
                    }
                />

                <div className="surface overflow-hidden rounded-xl">
                    <TableToolbar
                        perPage={Number(filters.per_page ?? 10)}
                        onPerPageChange={(n) => applyFilters({ per_page: String(n) })}
                        search={filters.search ?? ''}
                        onSearch={(search) => applyFilters({ search })}
                        searchPlaceholder="Nombre, genérico, código o síntoma…"
                    >
                        <SimpleSelect
                            className="w-52"
                            options={categories}
                            value={filters.category}
                            allLabel="Todas las categorías"
                            onChange={(category) => applyFilters({ category })}
                        />
                        <SimpleSelect
                            className="w-52"
                            options={laboratories}
                            value={filters.laboratory}
                            allLabel="Todos los laboratorios"
                            onChange={(laboratory) => applyFilters({ laboratory })}
                        />
                        <SimpleSelect
                            className="w-52"
                            options={indications}
                            value={filters.indication}
                            allLabel="Todos los usos"
                            onChange={(indication) => applyFilters({ indication })}
                        />
                    </TableToolbar>
                    <DataTable
                        head={
                            <>
                                <Th>Producto</Th>
                                <Th>Laboratorio</Th>
                                <Th>Presentaciones</Th>
                                <Th align="right">Stock total</Th>
                                <Th>Estado</Th>
                                {(can('productos.editar') || can('productos.eliminar')) && <Th align="right">Acciones</Th>}
                            </>
                        }
                    >
                        {products.data.map((product) => {
                            const stock = Number(product.stock ?? 0);
                            return (
                                <tr key={product.id} className={cn(!product.is_active && 'opacity-60')}>
                                    <Td>
                                        <p className="font-medium">
                                            {product.name} <span className="text-muted-foreground font-normal">{product.concentration}</span>
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                            {[product.active_ingredient?.name, product.pharmaceutical_form, product.category?.name]
                                                .filter(Boolean)
                                                .join(' · ') || '—'}
                                            {product.is_controlled && <span className="ml-2 font-medium text-red-600">Controlado</span>}
                                            {!product.is_controlled && product.requires_prescription && (
                                                <span className="ml-2 font-medium text-amber-600">Con receta</span>
                                            )}
                                        </p>
                                        {/* Para qué sirve */}
                                        {!!product.indications?.length && (
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {product.indications.map((i) => (
                                                    <span
                                                        key={i.id}
                                                        className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[11px] font-medium"
                                                    >
                                                        {i.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </Td>
                                    <Td className="text-muted-foreground">{product.laboratory?.name ?? '—'}</Td>
                                    <Td>
                                        <div className="flex flex-wrap gap-1">
                                            {product.presentations.map((p) => (
                                                <span key={p.id} className="bg-muted/60 rounded px-1.5 py-0.5 text-xs whitespace-nowrap">
                                                    {p.name} · <span className="num">{money(p.sale_price)}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </Td>
                                    <Td align="right">
                                        <span className={cn(stock <= product.min_stock && 'font-semibold text-red-600')}>
                                            {stock.toLocaleString('es')}
                                        </span>{' '}
                                        <span className="text-muted-foreground text-xs">{product.base_unit}</span>
                                    </Td>
                                    <Td>
                                        <StatusBadge active={product.is_active} />
                                    </Td>
                                    {(can('productos.editar') || can('productos.eliminar')) && (
                                        <Td align="right">
                                            <RowActions>
                                                {can('productos.editar') && (
                                                    <ActionButton
                                                        icon={Pencil}
                                                        label="Editar"
                                                        onClick={() => router.visit(route('admin.products.edit', product.id))}
                                                    />
                                                )}
                                                {can('productos.eliminar') && (
                                                    <ActionButton icon={Trash2} label="Eliminar" tone="danger" onClick={() => setDeleting(product)} />
                                                )}
                                            </RowActions>
                                        </Td>
                                    )}
                                </tr>
                            );
                        })}
                        {products.data.length === 0 && <EmptyRow colSpan={6} text="Ningún producto coincide con la búsqueda." />}
                    </DataTable>
                    <Pagination paginator={products} itemName="productos" />
                </div>
            </div>

            <ConfirmDialog
                open={deleting !== null}
                onClose={() => setDeleting(null)}
                title={`¿Eliminar ${deleting?.name}?`}
                description="Solo se puede si no tiene stock. Si todavía lo vendes, mejor desactívalo."
                confirmLabel="Eliminar"
                destructive
                onConfirm={(done) =>
                    deleting && router.delete(route('admin.products.destroy', deleting.id), { preserveScroll: true, onFinish: done })
                }
            />
        </AdminLayout>
    );
}
