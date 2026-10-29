/*
 * PÁGINA: Reportes  (ruta /admin/reports?from=&to=&branch=)
 * Ventas, ganancia (venta − costo de los lotes vendidos), productos, formas de pago, vendedores, sucursales,
 * inventario valorizado, vencimientos, bajas y compras por proveedor.
 * Datos: app/Http/Controllers/Admin/ReportController.php
 */
import { DataTable, EmptyRow, Td, Th } from '@/components/admin/common/data-table';
import { ExpiryBadge } from '@/components/admin/common/doc-status';
import { PageHeader } from '@/components/admin/common/page-header';
import { SimpleSelect } from '@/components/admin/common/simple-select';
import { StatCard, StatGrid } from '@/components/admin/common/stat-card';
import { Panel, PanelHeader } from '@/components/admin/dashboard/panel';
import { DailySalesChart } from '@/components/admin/reports/daily-sales-chart';
import { Input } from '@/components/ui/input';
import { useFilters } from '@/hooks/use-filters';
import AdminLayout from '@/layouts/admin/admin-layout';
import { formatDay, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Option } from '@/types/admin/pharmacy';
import { Head } from '@inertiajs/react';
import { BadgePercent, BarChart3, Boxes, CalendarDays, CreditCard, PackageOpen, Pill, Receipt, TrendingUp } from 'lucide-react';

type Total = { name: string; count: number; total: number };

interface Props {
    filters: { from: string; to: string; branch: number | null };
    branches: Option[];
    paymentMethods: Record<string, string>;
    summary: { sales_count: number; revenue: number; cost: number; profit: number; average_ticket: number; cancelled: number; promo_revenue: number };
    byDay: { day: string; count: number; total: number }[];
    byMethod: { method: string; total: number }[];
    topProducts: { id: number; name: string; base_unit: string; units: number; revenue: number; profit: number }[];
    bySeller: Total[];
    byBranch: Total[];
    inventory: { name: string; value: number; products: number }[];
    expiring: {
        product: string;
        branch: string;
        batch_number: string;
        expires_at: string;
        days_left: number;
        quantity: number;
        base_unit: string;
        value: number;
    }[];
    writeOffs: number;
    purchases: Total[];
}

export default function Reports(props: Props) {
    const {
        filters,
        branches,
        paymentMethods,
        summary,
        byDay,
        byMethod,
        topProducts,
        bySeller,
        byBranch,
        inventory,
        expiring,
        writeOffs,
        purchases,
    } = props;
    const applyFilters = useFilters('admin.reports.index', {
        from: filters.from,
        to: filters.to,
        branch: filters.branch ? String(filters.branch) : '',
    });
    const margin = summary.revenue > 0 ? Math.round((summary.profit / summary.revenue) * 100) : 0;
    const methodTotal = byMethod.reduce((s, m) => s + m.total, 0);

    return (
        <AdminLayout breadcrumbs={[{ title: 'Reportes', href: route('admin.reports.index') }]}>
            <Head title="Reportes" />
            <div className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                <PageHeader
                    icon={BarChart3}
                    title="Reportes"
                    description={`Del ${formatDay(filters.from)} al ${formatDay(filters.to)}. Solo cuentan las ventas completadas.`}
                    actions={
                        <>
                            <Input
                                type="date"
                                className="h-9 w-40"
                                value={filters.from}
                                max={filters.to}
                                onChange={(e) => applyFilters({ from: e.target.value })}
                                aria-label="Desde"
                            />
                            <Input
                                type="date"
                                className="h-9 w-40"
                                value={filters.to}
                                min={filters.from}
                                onChange={(e) => applyFilters({ to: e.target.value })}
                                aria-label="Hasta"
                            />
                            {branches.length > 1 && (
                                <SimpleSelect
                                    className="w-48"
                                    options={branches}
                                    value={filters.branch}
                                    allLabel="Todas las sucursales"
                                    onChange={(branch) => applyFilters({ branch })}
                                />
                            )}
                        </>
                    }
                />

                <StatGrid>
                    <StatCard
                        icon={Receipt}
                        tone="blue"
                        label="Ventas"
                        value={money(summary.revenue)}
                        hint={`${summary.sales_count} ventas · ticket promedio ${money(summary.average_ticket)}`}
                    />
                    <StatCard
                        icon={PackageOpen}
                        tone="slate"
                        label="Costo de lo vendido"
                        value={money(summary.cost)}
                        hint="Costo de los lotes que salieron"
                    />
                    <StatCard
                        icon={TrendingUp}
                        tone="green"
                        colorValue
                        label="Ganancia bruta"
                        value={money(summary.profit)}
                        hint={`Margen ${margin}%`}
                    />
                    <StatCard
                        icon={BadgePercent}
                        tone="amber"
                        label="Vendido con promoción"
                        value={money(summary.promo_revenue)}
                        hint={`Bajas ${money(writeOffs)} · ${summary.cancelled} ventas anuladas`}
                    />
                </StatGrid>

                <Panel>
                    <PanelHeader
                        icon={CalendarDays}
                        title="Ventas por día"
                        description="Todos los días del período. Pasa el mouse por una barra para ver el detalle."
                    />
                    <DailySalesChart data={byDay} from={filters.from} to={filters.to} />
                </Panel>

                <div className="grid gap-6 xl:grid-cols-3">
                    <Panel className="overflow-hidden xl:col-span-2">
                        <PanelHeader icon={Pill} title="Productos más vendidos" />
                        <DataTable
                            head={
                                <>
                                    <Th>Producto</Th>
                                    <Th align="right">Unidades</Th>
                                    <Th align="right">Venta</Th>
                                    <Th align="right">Ganancia</Th>
                                </>
                            }
                        >
                            {topProducts.map((p) => (
                                <tr key={p.id}>
                                    <Td className="font-medium">{p.name}</Td>
                                    <Td align="right">
                                        {p.units.toLocaleString('es')} <span className="text-muted-foreground text-xs">{p.base_unit}</span>
                                    </Td>
                                    <Td align="right">{money(p.revenue)}</Td>
                                    <Td align="right" className={cn(p.profit < 0 ? 'text-red-600' : 'text-emerald-600')}>
                                        {money(p.profit)}
                                    </Td>
                                </tr>
                            ))}
                            {topProducts.length === 0 && <EmptyRow colSpan={4} />}
                        </DataTable>
                    </Panel>

                    <Panel>
                        <PanelHeader icon={CreditCard} title="Formas de pago" />
                        <div className="grid gap-3 p-5">
                            {byMethod.map((m) => (
                                <div key={m.method} className="grid gap-1">
                                    <div className="flex justify-between text-sm">
                                        <span>{paymentMethods[m.method] ?? m.method}</span>
                                        <span className="num font-medium">{money(m.total)}</span>
                                    </div>
                                    <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                                        <div
                                            className="bg-primary h-full rounded-full"
                                            style={{ width: `${methodTotal ? (m.total / methodTotal) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                            {byMethod.length === 0 && <p className="text-muted-foreground text-sm">Sin pagos.</p>}
                        </div>
                    </Panel>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    <TotalsTable title="Por vendedor" rows={bySeller} countLabel="Ventas" />
                    <TotalsTable title="Por sucursal" rows={byBranch} countLabel="Ventas" />
                    <TotalsTable title="Compras por proveedor" rows={purchases} countLabel="Compras" />
                </div>

                <div className="grid gap-6 xl:grid-cols-3">
                    <Panel className="overflow-hidden">
                        <PanelHeader icon={Boxes} title="Inventario valorizado" description="Stock actual al costo de cada lote." />
                        <DataTable
                            head={
                                <>
                                    <Th>Sucursal</Th>
                                    <Th align="right">Productos</Th>
                                    <Th align="right">Valor</Th>
                                </>
                            }
                        >
                            {inventory.map((row) => (
                                <tr key={row.name}>
                                    <Td>{row.name}</Td>
                                    <Td align="right">{row.products}</Td>
                                    <Td align="right" className="font-medium">
                                        {money(row.value)}
                                    </Td>
                                </tr>
                            ))}
                            {inventory.length === 0 && <EmptyRow colSpan={3} />}
                        </DataTable>
                    </Panel>

                    <Panel className="overflow-hidden xl:col-span-2">
                        <PanelHeader
                            title="Vencidos y por vencer"
                            description="Lotes con stock. Conviene ponerlos en promoción antes de que venzan."
                        />
                        <DataTable
                            head={
                                <>
                                    <Th>Producto / lote</Th>
                                    <Th>Sucursal</Th>
                                    <Th>Vence</Th>
                                    <Th align="right">Stock</Th>
                                    <Th align="right">Valor</Th>
                                </>
                            }
                        >
                            {expiring.map((row, i) => (
                                <tr key={i}>
                                    <Td>
                                        <p className="font-medium">{row.product}</p>
                                        <p className="text-muted-foreground text-xs">Lote {row.batch_number}</p>
                                    </Td>
                                    <Td className="text-muted-foreground">{row.branch}</Td>
                                    <Td>
                                        <ExpiryBadge date={row.expires_at} />
                                    </Td>
                                    <Td align="right">
                                        {row.quantity.toLocaleString('es')} <span className="text-muted-foreground text-xs">{row.base_unit}</span>
                                    </Td>
                                    <Td align="right">{money(row.value)}</Td>
                                </tr>
                            ))}
                            {expiring.length === 0 && <EmptyRow colSpan={5} text="No hay lotes vencidos ni por vencer." />}
                        </DataTable>
                    </Panel>
                </div>
            </div>
        </AdminLayout>
    );
}

function TotalsTable({ title, rows, countLabel }: { title: string; rows: Total[]; countLabel: string }) {
    return (
        <Panel className="overflow-hidden">
            <PanelHeader title={title} />
            <DataTable
                head={
                    <>
                        <Th>Nombre</Th>
                        <Th align="right">{countLabel}</Th>
                        <Th align="right">Total</Th>
                    </>
                }
            >
                {rows.map((row) => (
                    <tr key={row.name}>
                        <Td>{row.name}</Td>
                        <Td align="right">{row.count}</Td>
                        <Td align="right" className="font-medium">
                            {money(row.total)}
                        </Td>
                    </tr>
                ))}
                {rows.length === 0 && <EmptyRow colSpan={3} />}
            </DataTable>
        </Panel>
    );
}
