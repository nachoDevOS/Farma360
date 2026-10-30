/*
 * PÁGINA: Productos  (ruta /admin/products)
 * Datos: app/Http/Controllers/Admin/ProductController.php -> index()
 * El buscador encuentra por nombre comercial, genérico, código de barras, uso / síntoma o detalle.
 * Filtro "Todos los usos": productos para un síntoma (ej: Dolor de cabeza).
 * Ordenada por ID, los más nuevos primero. La flecha de la columna ID despliega el detalle de la fila
 * (presentaciones, stock por sucursal y datos): components/admin/products/product-row-detail.tsx
 * Botones: Ver (ficha completa: products/show.tsx) · Editar · Eliminar.
 */
import { BranchMenu } from '@/components/admin/common/branch-menu';
import { ConfirmDialog } from '@/components/admin/common/confirm-dialog';
import { DataTable, EmptyRow, Td, Th } from '@/components/admin/common/data-table';
import { StoredImage } from '@/components/admin/common/image-upload';
import { PageHeader } from '@/components/admin/common/page-header';
import { ActionButton, RowActions } from '@/components/admin/common/row-actions';
import { SimpleSelect } from '@/components/admin/common/simple-select';
import { TableToolbar } from '@/components/admin/common/table-toolbar';
import { StatusBadge } from '@/components/admin/common/user-badges';
import { ProductRowDetail } from '@/components/admin/products/product-row-detail';
import { StockBreakdown } from '@/components/admin/products/stock-breakdown';
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
import { ChevronRight, Eye, Pencil, Pill, Plus, Stethoscope, Tags, Trash2 } from 'lucide-react';
import { Fragment, useState } from 'react';

interface Props {
    products: Paginated<Product>;
    filters: ListFilters & { category?: string; laboratory?: string; indication?: string };
    /** Sucursales que el usuario puede elegir y si puede ver "Todas" (sin sucursal asignada) */
    branchOptions: Option[];
    canSeeAllBranches: boolean;
    categories: Option[];
    laboratories: Option[];
    indications: Option[];
}

export default function ProductsIndex({ products, filters, branchOptions, canSeeAllBranches, categories, laboratories, indications }: Props) {
    const can = useCan();
    const applyFilters = useFilters('admin.products.index', filters);
    // Sucursal elegida (null = todas): cambia la columna Stock y el ojo abre la ficha en esa sucursal
    const branchId = filters.branch ? Number(filters.branch) : null;
    const branchName = branchOptions.find((b) => b.id === branchId)?.name ?? null;
    const [deleting, setDeleting] = useState<Product | null>(null);
    // Filas con el detalle abierto (por ID)
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const toggle = (id: number) =>
        setExpanded((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    const columns = 7;

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
                            {(canSeeAllBranches || branchOptions.length > 1) && (
                                <BranchMenu
                                    note="Cambia la columna Stock y la sucursal con la que se abre cada producto."
                                    current={branchId}
                                    onChoose={(branch) => applyFilters({ branch: branch === null ? '' : String(branch) })}
                                    options={[
                                        ...(canSeeAllBranches ? [{ id: null, name: 'Todas las sucursales' }] : []),
                                        ...branchOptions.map((b) => ({ id: b.id, name: b.name })),
                                    ]}
                                />
                            )}
                            <Button asChild variant="outline" size="sm">
                                <Link href={route('admin.categories.index')}>
                                    <Tags /> Categorías
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
                                <Th>ID</Th>
                                <Th>Producto</Th>
                                <Th>Laboratorio</Th>
                                <Th>Presentaciones</Th>
                                <Th align="right">{branchName ? `Stock · ${branchName}` : 'Stock total'}</Th>
                                <Th>Estado</Th>
                                <Th align="right">Acciones</Th>
                            </>
                        }
                    >
                        {products.data.map((product) => {
                            const stock = Number(product.stock ?? 0);
                            const isOpen = expanded.has(product.id);
                            return (
                                <Fragment key={product.id}>
                                    <tr className={cn(!product.is_active && 'opacity-60', isOpen && 'bg-muted/40')}>
                                        <Td className="w-px">
                                            <button
                                                type="button"
                                                onClick={() => toggle(product.id)}
                                                aria-expanded={isOpen}
                                                aria-label={isOpen ? 'Ocultar detalle' : 'Ver detalle'}
                                                className="hover:bg-muted inline-flex items-center gap-1 rounded-md py-1 pr-2 pl-1 whitespace-nowrap"
                                            >
                                                <ChevronRight
                                                    className={cn(
                                                        'text-muted-foreground size-4 transition-transform',
                                                        isOpen && 'text-primary rotate-90',
                                                    )}
                                                />
                                                <span className="num font-medium">#{product.id}</span>
                                            </button>
                                        </Td>
                                        <Td>
                                            <div className="flex items-center gap-3">
                                                <StoredImage
                                                    path={product.image}
                                                    alt={product.name}
                                                    fallback={<Pill className="size-4" />}
                                                    className="size-10"
                                                />
                                                <div className="min-w-0">
                                                    <p className="font-medium">
                                                        {product.name}{' '}
                                                        <span className="text-muted-foreground font-normal">{product.concentration}</span>
                                                    </p>
                                                    <p className="text-muted-foreground text-xs">
                                                        {[product.generic_name, product.pharmaceutical_form, product.category?.name]
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
                                                </div>
                                            </div>
                                        </Td>
                                        <Td className="text-muted-foreground">{product.laboratory?.name ?? '—'}</Td>
                                        <Td>
                                            <div className="flex flex-wrap gap-1">
                                                {product.presentations.map((p) => (
                                                    <span key={p.id} className="bg-muted/60 rounded px-1.5 py-0.5 text-xs whitespace-nowrap">
                                                        {p.name} ·{' '}
                                                        {p.is_sellable ? (
                                                            <span className="num">{money(p.sale_price)}</span>
                                                        ) : (
                                                            <span className="text-muted-foreground">solo compra</span>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        </Td>
                                        <Td align="right">
                                            <span className={cn(stock <= product.min_stock && 'font-semibold text-red-600')}>
                                                {stock.toLocaleString('es')}
                                            </span>{' '}
                                            <span className="text-muted-foreground text-xs">{product.base_unit}</span>
                                            <StockBreakdown units={stock} product={product} className="mt-0.5 font-medium" />
                                        </Td>
                                        <Td>
                                            <StatusBadge active={product.is_active} />
                                        </Td>
                                        <Td align="right">
                                            <RowActions>
                                                <ActionButton
                                                    icon={Eye}
                                                    label="Ver producto"
                                                    onClick={() =>
                                                        router.visit(
                                                            route('admin.products.show', { product: product.id, branch: branchId ?? undefined }),
                                                        )
                                                    }
                                                />
                                                {can('productos.editar') && (
                                                    <ActionButton
                                                        icon={Pencil}
                                                        label="Editar"
                                                        tone="warning"
                                                        onClick={() => router.visit(route('admin.products.edit', product.id))}
                                                    />
                                                )}
                                                {can('productos.eliminar') && (
                                                    <ActionButton icon={Trash2} label="Eliminar" tone="danger" onClick={() => setDeleting(product)} />
                                                )}
                                            </RowActions>
                                        </Td>
                                    </tr>
                                    {isOpen && (
                                        <tr className="bg-muted/40 hover:bg-muted/40!">
                                            <td colSpan={columns} className="px-4 pt-1 pb-4">
                                                <ProductRowDetail product={product} />
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                        {products.data.length === 0 && <EmptyRow colSpan={columns} text="Ningún producto coincide con la búsqueda." />}
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
