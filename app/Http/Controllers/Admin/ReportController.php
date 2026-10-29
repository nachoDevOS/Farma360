<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Branch;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SalePayment;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * REPORTES (permiso reportes.ver): ventas, ganancia, productos, formas de pago, vendedores,
 * inventario valorizado, vencimientos y compras. Todo filtrado por rango de fechas y sucursal.
 */
class ReportController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $allowed = $request->user()->allowedBranchIds();
        $from = Carbon::parse($request->input('from', today()->startOfMonth()->toDateString()))->startOfDay();
        $to = Carbon::parse($request->input('to', today()->toDateString()))->endOfDay();
        $branchId = $request->integer('branch') ?: null;
        abort_if($branchId && ! in_array($branchId, $allowed), 403);
        $branches = $branchId ? [$branchId] : $allowed;

        // Ventas completadas del rango
        // (columnas con "sales." porque abajo se une con users y branches, que también tienen created_at y branch_id)
        $sales = Sale::where('sales.status', 'completada')->whereIn('sales.branch_id', $branches)->whereBetween('sales.created_at', [$from, $to]);
        // Ítems de esas ventas (para ganancia y productos)
        $items = SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.status', 'completada')
            ->whereIn('sales.branch_id', $branches)
            ->whereBetween('sales.created_at', [$from, $to]);

        $revenue = round((float) (clone $sales)->sum('sales.total'), 2);
        $cost = round((float) (clone $items)->sum(DB::raw('sale_items.units * sale_items.unit_cost')), 2);

        return Inertia::render('admin/reports/index', [
            'filters' => ['from' => $from->toDateString(), 'to' => $to->toDateString(), 'branch' => $branchId],
            'branches' => Branch::whereIn('id', $allowed)->orderBy('name')->get(['id', 'name']),
            'paymentMethods' => config('farmacia.payment_methods'),
            'summary' => [
                'sales_count' => (clone $sales)->count(),
                'revenue' => $revenue,
                'cost' => $cost,
                'profit' => round($revenue - $cost, 2),
                'average_ticket' => (clone $sales)->count() ? round($revenue / (clone $sales)->count(), 2) : 0,
                'cancelled' => Sale::where('status', 'anulada')->whereIn('branch_id', $branches)->whereBetween('created_at', [$from, $to])->count(),
                'promo_revenue' => round((float) (clone $items)->where('sale_items.discount_percent', '>', 0)->sum('sale_items.subtotal'), 2),
            ],
            'byDay' => (clone $sales)
                ->selectRaw('DATE(sales.created_at) as day, COUNT(*) as count, SUM(sales.total) as total')
                ->groupBy('day')->orderBy('day')->get()
                ->map(fn ($r) => ['day' => $r->day, 'count' => (int) $r->count, 'total' => round((float) $r->total, 2)]),
            'byMethod' => SalePayment::query()
                ->join('sales', 'sales.id', '=', 'sale_payments.sale_id')
                ->where('sales.status', 'completada')->whereIn('sales.branch_id', $branches)->whereBetween('sales.created_at', [$from, $to])
                ->selectRaw('sale_payments.method, SUM(sale_payments.amount) as total')
                ->groupBy('sale_payments.method')->get()
                ->map(fn ($r) => ['method' => $r->method, 'total' => round((float) $r->total, 2)]),
            'topProducts' => (clone $items)
                ->join('products', 'products.id', '=', 'sale_items.product_id')
                ->selectRaw('products.id, products.name, products.base_unit, SUM(sale_items.units) as units, SUM(sale_items.subtotal) as revenue, SUM(sale_items.subtotal - sale_items.units * sale_items.unit_cost) as profit')
                ->groupBy('products.id', 'products.name', 'products.base_unit')
                ->orderByDesc('revenue')->limit(15)->get()
                ->map(fn ($r) => ['id' => $r->id, 'name' => $r->name, 'base_unit' => $r->base_unit, 'units' => (int) $r->units, 'revenue' => round((float) $r->revenue, 2), 'profit' => round((float) $r->profit, 2)]),
            'bySeller' => (clone $sales)
                ->join('users', 'users.id', '=', 'sales.registerUser_id')
                ->selectRaw('users.name, COUNT(*) as count, SUM(sales.total) as total')
                ->groupBy('users.name')->orderByDesc('total')->get()
                ->map(fn ($r) => ['name' => $r->name, 'count' => (int) $r->count, 'total' => round((float) $r->total, 2)]),
            'byBranch' => (clone $sales)
                ->join('branches', 'branches.id', '=', 'sales.branch_id')
                ->selectRaw('branches.name, COUNT(*) as count, SUM(sales.total) as total')
                ->groupBy('branches.name')->orderByDesc('total')->get()
                ->map(fn ($r) => ['name' => $r->name, 'count' => (int) $r->count, 'total' => round((float) $r->total, 2)]),
            'inventory' => Batch::query()
                ->join('branches', 'branches.id', '=', 'batches.branch_id')
                ->whereIn('batches.branch_id', $branches)->where('batches.quantity', '>', 0)
                ->selectRaw('branches.name, SUM(batches.quantity * batches.unit_cost) as value, COUNT(DISTINCT batches.product_id) as products')
                ->groupBy('branches.name')->get()
                ->map(fn ($r) => ['name' => $r->name, 'value' => round((float) $r->value, 2), 'products' => (int) $r->products]),
            'expiring' => Batch::with('product:id,name,concentration,pharmaceutical_form,base_unit', 'branch:id,name')
                ->whereIn('branch_id', $branches)->where('quantity', '>', 0)
                ->whereDate('expires_at', '<=', today()->addDays((int) config('farmacia.expiry_alert_days')))
                ->orderBy('expires_at')->limit(50)->get()
                ->map(fn (Batch $b) => [
                    'product' => $b->product->fullName(),
                    'branch' => $b->branch->name,
                    'batch_number' => $b->batch_number,
                    'expires_at' => $b->expires_at->toDateString(),
                    'days_left' => $b->daysToExpire(),
                    'quantity' => $b->quantity,
                    'base_unit' => $b->product->base_unit,
                    'value' => round($b->quantity * (float) $b->unit_cost, 2),
                ]),
            // Pérdida: lo dado de baja (vencido / dañado) en el rango, valorizado al costo
            'writeOffs' => round((float) DB::table('stock_movements')
                ->where('type', 'baja')->whereIn('branch_id', $branches)->whereBetween('created_at', [$from, $to])->whereNull('deleted_at')
                ->sum(DB::raw('-quantity * unit_cost')), 2),
            'purchases' => Purchase::query()
                ->join('suppliers', 'suppliers.id', '=', 'purchases.supplier_id')
                ->where('purchases.status', 'registrada')->whereIn('purchases.branch_id', $branches)
                ->whereBetween('purchases.purchased_at', [$from->toDateString(), $to->toDateString()])
                ->selectRaw('suppliers.name, COUNT(*) as count, SUM(purchases.total) as total')
                ->groupBy('suppliers.name')->orderByDesc('total')->get()
                ->map(fn ($r) => ['name' => $r->name, 'count' => (int) $r->count, 'total' => round((float) $r->total, 2)]),
        ]);
    }
}
