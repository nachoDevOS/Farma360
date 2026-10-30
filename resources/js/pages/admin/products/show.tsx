/*
 * PÁGINA: Ver producto  (ruta /admin/products/{id})
 * Datos: app/Http/Controllers/Admin/ProductController.php -> show()
 *
 * Ficha completa: indicadores (stock, precio, último costo, ganancia), presentaciones con su ganancia
 * según el último costo de compra, stock por sucursal (con enlace a los lotes), últimas compras,
 * historial de precios, datos del producto, para qué sirve y quién lo registró.
 * Las tablas de presentaciones y stock son las mismas del desplegable de la lista (product-row-detail.tsx).
 */
import { DataTable, Detail, EmptyRow, Td, Th } from '@/components/admin/common/data-table';
import { PageHeader } from '@/components/admin/common/page-header';
import { StatCard, StatGrid } from '@/components/admin/common/stat-card';
import { StatusBadge } from '@/components/admin/common/user-badges';
import { Panel, PanelHeader } from '@/components/admin/dashboard/panel';
import { plural } from '@/components/admin/products/presentation-levels';
import { BranchStockTable, PresentationsTable, RegisteredBy, SaleType } from '@/components/admin/products/product-row-detail';
import { StockBreakdown } from '@/components/admin/products/stock-breakdown';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import AdminLayout from '@/layouts/admin/admin-layout';
import { formatDate, formatDay, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Product } from '@/types/admin/pharmacy';
import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    BadgeDollarSign,
    Boxes,
    HeartPulse,
    History,
    Info,
    Layers,
    Pencil,
    Pill,
    ShoppingCart,
    Tag,
    TrendingUp,
    Truck,
    Warehouse,
} from 'lucide-react';

/** Línea de una compra del producto. Ver ProductController@show. */
interface PurchaseRow {
    id: number;
    purchase_id: number;
    purchased_at: string;
    invoice_number: string | null;
    supplier: string | null;
    branch: string | null;
    presentation: string | null;
    quantity: number;
    cost: number;
    unit_cost: number;
    batch_number: string;
    expires_at: string | null;
}

/** Un cambio del precio de venta. Ver ProductController@show (solo historial, no toca las ventas). */
interface PriceChange {
    id: number;
    changed_at: string;
    presentation: string;
    /** null = precio inicial */
    old_price: number | null;
    new_price: number | null;
    source: 'creacion' | 'edicion';
    user: string | null;
    role: string | null;
}

interface Props {
    product: Product;
    /** Últimas 10 compras registradas (la primera es la más reciente) */
    purchases: PurchaseRow[];
    /** Últimos 50 cambios de precio (el primero es el más reciente) */
    priceHistory: PriceChange[];
}

export default function ProductShow({ product, purchases, priceHistory }: Props) {
    const can = useCan();
    const units = plural(product.base_unit);
    const branches = product.branch_stock ?? [];
    const stock = branches.reduce((sum, s) => sum + s.stock, 0);

    // Precio de una unidad base: el de la presentación más chica que se vende
    const smallest = product.presentations.find((p) => p.is_sellable && p.sale_price);
    const unitPrice = smallest ? Number(smallest.sale_price) / smallest.factor : null;
    const last = purchases[0] ?? null;
    const lastUnitCost = last ? last.unit_cost : null;
    const margin = unitPrice && lastUnitCost !== null ? ((unitPrice - lastUnitCost) / unitPrice) * 100 : null;
    const title = [product.name, product.concentration].filter(Boolean).join(' ');

    return (
        <AdminLayout
            breadcrumbs={[
                { title: 'Productos', href: route('admin.products.index') },
                { title: product.name, href: '#' },
            ]}
        >
            <Head title={title} />
            <div className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                <PageHeader
                    icon={Pill}
                    title={title}
                    description={
                        [product.generic_name, product.pharmaceutical_form, product.laboratory?.name, `#${product.id}`].filter(Boolean).join(' · ') ||
                        undefined
                    }
                    actions={
                        <>
                            <Button asChild variant="outline" size="sm">
                                <Link href={route('admin.products.index')}>
                                    <ArrowLeft /> Volver
                                </Link>
                            </Button>
                            {can('productos.editar') && (
                                <Button asChild size="sm" className="btn-brand">
                                    <Link href={route('admin.products.edit', product.id)}>
                                        <Pencil /> Editar
                                    </Link>
                                </Button>
                            )}
                        </>
                    }
                />

                <StatGrid>
                    <StatCard
                        icon={Boxes}
                        label="Stock total"
                        value={`${stock.toLocaleString('es')} ${units}`}
                        hint={
                            <>
                                <StockBreakdown units={stock} product={product} className="text-xs" />
                                {branches.length} {branches.length === 1 ? 'sucursal' : 'sucursales'} · mínimo {product.min_stock} por sucursal
                            </>
                        }
                        tone={stock <= product.min_stock ? 'red' : 'blue'}
                        colorValue={stock <= product.min_stock}
                    />
                    <StatCard
                        icon={Tag}
                        label={`Precio por ${product.base_unit.toLowerCase()}`}
                        value={unitPrice !== null ? money(unitPrice) : '—'}
                        hint={smallest ? `Según «${smallest.name}»` : 'No se vende suelto'}
                        tone="violet"
                    />
                    <StatCard
                        icon={Truck}
                        label="Último costo"
                        value={lastUnitCost !== null ? money(lastUnitCost) : 'Sin compras'}
                        hint={last ? `${formatDay(last.purchased_at)} · ${last.supplier ?? 'Sin proveedor'}` : undefined}
                        tone="slate"
                    />
                    <StatCard
                        icon={TrendingUp}
                        label="Ganancia"
                        value={margin !== null ? `${margin.toFixed(1)}%` : '—'}
                        hint="Precio por unidad contra el último costo"
                        tone={margin !== null && margin < 0 ? 'red' : 'green'}
                        colorValue={margin !== null}
                    />
                </StatGrid>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                    <div className="grid content-start gap-6">
                        <Panel>
                            <PanelHeader
                                icon={Layers}
                                title="Presentaciones y precios"
                                description={
                                    lastUnitCost !== null
                                        ? 'Costo y ganancia calculados con la última compra.'
                                        : 'Sin compras todavía: no hay costo para calcular la ganancia.'
                                }
                            />
                            <div className="p-5">
                                <PresentationsTable product={product} unitCost={lastUnitCost} className="text-[13px]" />
                            </div>
                        </Panel>

                        <Panel>
                            <PanelHeader
                                icon={Warehouse}
                                title="Stock por sucursal"
                                description="Lotes con stock. En rojo: bajo el mínimo o vence en 30 días o menos."
                            />
                            <div className="p-5">
                                <BranchStockTable product={product} inventoryLink={can('inventario.ver')} className="text-[13px]" />
                            </div>
                        </Panel>

                        <Panel>
                            <PanelHeader icon={ShoppingCart} title="Últimas compras" description="Las 10 más recientes (sin las anuladas)." />
                            <DataTable
                                head={
                                    <>
                                        <Th>Fecha</Th>
                                        <Th>Proveedor</Th>
                                        <Th>Sucursal</Th>
                                        <Th>Presentación</Th>
                                        <Th align="right">Cant.</Th>
                                        <Th align="right">Costo</Th>
                                        <Th align="right">c/{product.base_unit.toLowerCase()}</Th>
                                        <Th>Lote</Th>
                                        <Th>Vence</Th>
                                    </>
                                }
                            >
                                {purchases.map((row) => (
                                    <tr key={row.id}>
                                        <Td>
                                            {can('compras.ver') ? (
                                                <Link
                                                    href={route('admin.purchases.show', row.purchase_id)}
                                                    className="text-primary font-medium hover:underline"
                                                >
                                                    {formatDay(row.purchased_at)}
                                                </Link>
                                            ) : (
                                                formatDay(row.purchased_at)
                                            )}
                                            {row.invoice_number && <p className="text-muted-foreground text-xs">Factura {row.invoice_number}</p>}
                                        </Td>
                                        <Td>{row.supplier ?? '—'}</Td>
                                        <Td className="text-muted-foreground">{row.branch ?? '—'}</Td>
                                        <Td>{row.presentation ?? '—'}</Td>
                                        <Td align="right">{row.quantity}</Td>
                                        <Td align="right">{money(row.cost)}</Td>
                                        <Td align="right">{money(row.unit_cost)}</Td>
                                        <Td className="text-muted-foreground">{row.batch_number}</Td>
                                        <Td className="whitespace-nowrap">{formatDay(row.expires_at)}</Td>
                                    </tr>
                                ))}
                                {purchases.length === 0 && <EmptyRow colSpan={9} text="Este producto todavía no tiene compras." />}
                            </DataTable>
                        </Panel>

                        <Panel>
                            <PanelHeader
                                icon={BadgeDollarSign}
                                title="Historial de precios"
                                description="Cada cambio del precio de venta: cuándo, de cuánto a cuánto y quién. Las ventas guardan su propio precio."
                            />
                            <DataTable
                                head={
                                    <>
                                        <Th>Fecha</Th>
                                        <Th>Presentación</Th>
                                        <Th align="right">Antes</Th>
                                        <Th align="right">Ahora</Th>
                                        <Th align="right">Cambio</Th>
                                        <Th>Quién</Th>
                                    </>
                                }
                            >
                                {priceHistory.map((change) => (
                                    <tr key={change.id}>
                                        <Td className="whitespace-nowrap">
                                            {formatDate(change.changed_at, {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </Td>
                                        <Td>{change.presentation}</Td>
                                        <Td align="right" className="text-muted-foreground">
                                            {change.old_price !== null ? money(change.old_price) : '—'}
                                        </Td>
                                        <Td align="right" className="font-medium">
                                            {change.new_price !== null ? money(change.new_price) : '—'}
                                        </Td>
                                        <Td align="right">
                                            <PriceDifference change={change} />
                                        </Td>
                                        <Td>
                                            {change.user ?? 'Sistema'}
                                            {change.role && <span className="text-muted-foreground text-xs"> · {change.role}</span>}
                                        </Td>
                                    </tr>
                                ))}
                                {priceHistory.length === 0 && <EmptyRow colSpan={6} text="Todavía no hay cambios de precio." />}
                            </DataTable>
                        </Panel>
                    </div>

                    <div className="grid content-start gap-6">
                        <Panel>
                            <PanelHeader icon={Info} title="Datos del producto" aside={<StatusBadge active={product.is_active} />} />
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-5">
                                <Detail label="Nombre comercial">{product.name}</Detail>
                                <Detail label="Nombre genérico">{product.generic_name || '—'}</Detail>
                                <Detail label="Concentración">{product.concentration || '—'}</Detail>
                                <Detail label="Forma farmacéutica">{product.pharmaceutical_form || '—'}</Detail>
                                <Detail label="Laboratorio">{product.laboratory?.name ?? '—'}</Detail>
                                <Detail label="Categoría">{product.category?.name ?? '—'}</Detail>
                                <Detail label="Código de barras">{product.barcode || '—'}</Detail>
                                <Detail label="Registro sanitario">{product.health_registry || '—'}</Detail>
                                <Detail label="Unidad base">{product.base_unit}</Detail>
                                <Detail label="Stock mínimo">
                                    {product.min_stock.toLocaleString('es')} {units}
                                </Detail>
                                <Detail label="Venta">
                                    <SaleType product={product} />
                                </Detail>
                            </div>
                        </Panel>

                        <Panel>
                            <PanelHeader icon={HeartPulse} title="¿Para qué sirve?" />
                            <div className="grid gap-3 p-5">
                                {product.indications?.length ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {product.indications.map((i) => (
                                            <span key={i.id} className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-medium">
                                                {i.name}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-sm">Sin usos / síntomas registrados.</p>
                                )}
                                {product.description && <p className="text-sm">{product.description}</p>}
                            </div>
                        </Panel>

                        <Panel>
                            <PanelHeader icon={History} title="Registro" />
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-5">
                                <div className="col-span-2">
                                    <Detail label="Registrado por">
                                        <RegisteredBy product={product} />
                                    </Detail>
                                </div>
                                <Detail label="Fecha de registro">
                                    {product.created_at
                                        ? formatDate(product.created_at, {
                                              day: '2-digit',
                                              month: 'short',
                                              year: 'numeric',
                                              hour: '2-digit',
                                              minute: '2-digit',
                                          })
                                        : '—'}
                                </Detail>
                                <Detail label="Última modificación">
                                    {product.updated_at
                                        ? formatDate(product.updated_at, {
                                              day: '2-digit',
                                              month: 'short',
                                              year: 'numeric',
                                              hour: '2-digit',
                                              minute: '2-digit',
                                          })
                                        : '—'}
                                </Detail>
                            </div>
                        </Panel>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

/** "Precio inicial", o la diferencia: "+Bs 0,30 (+60%)" en verde si subió, en rojo si bajó. */
function PriceDifference({ change }: { change: PriceChange }) {
    if (change.old_price === null) {
        return <span className="text-muted-foreground text-xs">Precio inicial</span>;
    }
    if (change.new_price === null) {
        return <span className="text-muted-foreground text-xs">Sin precio</span>;
    }
    const diff = change.new_price - change.old_price;
    const percent = change.old_price > 0 ? (diff / change.old_price) * 100 : null;
    return (
        <span className={cn('whitespace-nowrap', diff > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600')}>
            {diff > 0 ? '+' : '−'}
            {money(Math.abs(diff))}
            {percent !== null && ` (${diff > 0 ? '+' : '−'}${Math.abs(percent).toFixed(1)}%)`}
        </span>
    );
}
