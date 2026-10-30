<?php

namespace App\Services;

use App\Models\Batch;
use App\Models\Branch;
use App\Models\Product;
use App\Models\ProductPresentation;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * CÓMO LE VA A UN PRODUCTO (pestaña "Rendimiento" de la ficha del producto, ProductController@show).
 * Todo sale de las ventas completadas (sin las anuladas) y de los lotes con stock, de todas las sucursales o de una
 * ($branchId). "branches" siempre trae todas, para comparar la elegida con las demás.
 *
 * - salesByMonth: últimos 12 meses (unidades, cobrado, ganancia, ventas).
 * - daily:        últimos 60 días, para comparar los 30 últimos con los 30 anteriores.
 * - branches:     por sucursal, últimos 90 días: lo vendido, el stock y para cuántos días alcanza.
 * - mix:          por presentación, últimos 90 días: cómo lo compran los clientes (suelto, blíster, caja…).
 * - hours:        por día de la semana y hora, últimos 90 días: cuándo se vende.
 * - batches:      lotes con stock y cuánto de cada uno se vencería sin venderse al ritmo actual.
 *
 * Se agrupa en PHP para no depender de funciones de fecha de una base de datos en particular.
 * Las horas son las de config('app.timezone').
 */
class ProductAnalytics
{
    /** Días que se miran para el ritmo de venta, las sucursales, las presentaciones y las horas. */
    public const RECENT_DAYS = 90;

    /**
     * @return array{
     *     salesByMonth: list<array{month: string, units: int, amount: float, profit: float, sales: int}>,
     *     daily: list<array{date: string, units: int, amount: float, profit: float, sales: int}>,
     *     dailyRate: float,
     *     rateDays: int,
     *     branches: list<array{branch_id: int, branch: ?string, units: int, amount: float, stock: int, daily_rate: float}>,
     *     mix: list<array{presentation_id: int, name: string, factor: int, quantity: int, units: int, amount: float}>,
     *     hours: list<array{day: int, hour: int, units: int, sales: int}>,
     *     batches: list<array{id: int, batch_number: string, branch: ?string, expires_at: string, days_left: int, quantity: int, unit_cost: float, units_at_risk: ?int}>
     * }
     */
    public function for(Product $product, ?int $branchId = null): array
    {
        $all = $this->saleLines($product, today()->startOfMonth()->subMonths(11));
        $recentFrom = today()->subDays(self::RECENT_DAYS - 1);
        $isRecent = fn (object $row) => $row->at->gte($recentFrom);
        // Lo que se mira: las ventas de la sucursal elegida, o todas
        $rows = $branchId ? $all->where('branch_id', $branchId) : $all;
        $recent = $rows->filter($isRecent);

        // Ritmo de venta: unidades por día de los últimos 90 días (o desde que existe el producto, mínimo 7 días)
        $since = $product->created_at ? Carbon::parse($product->created_at)->startOfDay() : $recentFrom;
        $rateDays = (int) min(self::RECENT_DAYS, max(7, $since->diffInDays(today()) + 1));
        $branches = $this->branches($product, $all->filter($isRecent), $rateDays);

        return [
            'salesByMonth' => $this->byMonth($rows),
            'daily' => $this->byDay($rows),
            'dailyRate' => round($recent->sum('units') / $rateDays, 2),
            'rateDays' => $rateDays,
            'branches' => $branches,
            'mix' => $this->mix($recent),
            'hours' => $this->hours($recent),
            'batches' => $this->batchesAtRisk($product, collect($branches)->pluck('daily_rate', 'branch_id'), $branchId),
        ];
    }

    /**
     * Líneas de venta del producto desde $from, con la fecha ya convertida ($row->at).
     *
     * @return Collection<int, object>
     */
    private function saleLines(Product $product, Carbon $from): Collection
    {
        return DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sale_items.product_id', $product->id)
            ->where('sales.status', 'completada')
            ->whereNull('sales.deleted_at')
            ->whereNull('sale_items.deleted_at')
            ->where('sales.created_at', '>=', $from)
            ->get([
                'sales.id as sale_id', 'sales.branch_id', 'sales.created_at', 'sale_items.product_presentation_id',
                'sale_items.units', 'sale_items.factor', 'sale_items.subtotal', 'sale_items.unit_cost',
            ])
            ->each(function (object $row) {
                $row->at = Carbon::parse($row->created_at);
                $row->units = (int) $row->units;
                $row->subtotal = (float) $row->subtotal;
                $row->cost = $row->units * (float) $row->unit_cost;
            });
    }

    /**
     * Unidades, cobrado, ganancia (cobrado − costo del lote) y cantidad de ventas de un grupo de líneas.
     *
     * @param  Collection<int, object>  $rows
     * @return array{units: int, amount: float, profit: float, sales: int}
     */
    private function totals(Collection $rows): array
    {
        $amount = (float) $rows->sum('subtotal');

        return [
            'units' => (int) $rows->sum('units'),
            'amount' => round($amount, 2),
            'profit' => round($amount - $rows->sum('cost'), 2),
            'sales' => $rows->pluck('sale_id')->unique()->count(),
        ];
    }

    /**
     * @param  Collection<int, object>  $rows
     * @return list<array{month: string, units: int, amount: float, profit: float, sales: int}>
     */
    private function byMonth(Collection $rows): array
    {
        $groups = $rows->groupBy(fn (object $row) => $row->at->format('Y-m'));
        $months = [];
        for ($month = today()->startOfMonth()->subMonths(11); $month->lte(today()); $month->addMonth()) {
            $months[] = ['month' => $month->format('Y-m'), ...$this->totals($groups->get($month->format('Y-m'), collect()))];
        }

        return $months;
    }

    /**
     * @param  Collection<int, object>  $rows
     * @return list<array{date: string, units: int, amount: float, profit: float, sales: int}>
     */
    private function byDay(Collection $rows): array
    {
        $groups = $rows->groupBy(fn (object $row) => $row->at->toDateString());
        $days = [];
        for ($day = today()->subDays(59); $day->lte(today()); $day->addDay()) {
            $days[] = ['date' => $day->toDateString(), ...$this->totals($groups->get($day->toDateString(), collect()))];
        }

        return $days;
    }

    /**
     * Sucursales con stock o con ventas recientes, la que más vende primero.
     *
     * @param  Collection<int, object>  $recent
     * @return list<array{branch_id: int, branch: ?string, units: int, amount: float, stock: int, daily_rate: float}>
     */
    private function branches(Product $product, Collection $recent, int $rateDays): array
    {
        $stock = Batch::where('product_id', $product->id)
            ->where('quantity', '>', 0)
            ->groupBy('branch_id')
            ->selectRaw('branch_id, SUM(quantity) as stock')
            ->pluck('stock', 'branch_id');
        $sales = $recent->groupBy('branch_id');
        $ids = $stock->keys()->merge($sales->keys())->unique();
        $names = Branch::withTrashed()->whereIn('id', $ids)->pluck('name', 'id');

        return $ids
            ->map(function (int $id) use ($stock, $sales, $names, $rateDays) {
                $rows = $sales->get($id, collect());

                return [
                    'branch_id' => $id,
                    'branch' => $names->get($id),
                    'units' => (int) $rows->sum('units'),
                    'amount' => round((float) $rows->sum('subtotal'), 2),
                    'stock' => (int) $stock->get($id, 0),
                    'daily_rate' => round($rows->sum('units') / $rateDays, 2),
                ];
            })
            ->sortByDesc('units')
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, object>  $recent
     * @return list<array{presentation_id: int, name: string, factor: int, quantity: int, units: int, amount: float}>
     */
    private function mix(Collection $recent): array
    {
        $groups = $recent->groupBy('product_presentation_id');
        $presentations = ProductPresentation::withTrashed()->whereIn('id', $groups->keys())->get()->keyBy('id');

        return $groups
            ->map(fn (Collection $rows, int $id) => [
                'presentation_id' => $id,
                'name' => $presentations->get($id)?->name ?? '—',
                'factor' => (int) $rows->first()->factor,
                'quantity' => (int) $rows->sum(fn (object $row) => intdiv($row->units, max(1, (int) $row->factor))),
                'units' => (int) $rows->sum('units'),
                'amount' => round((float) $rows->sum('subtotal'), 2),
            ])
            ->sortBy('factor')
            ->values()
            ->all();
    }

    /**
     * Solo las celdas con ventas. day: 1 = lunes … 7 = domingo.
     *
     * @param  Collection<int, object>  $recent
     * @return list<array{day: int, hour: int, units: int, sales: int}>
     */
    private function hours(Collection $recent): array
    {
        return $recent
            ->groupBy(fn (object $row) => $row->at->isoWeekday().'-'.$row->at->hour)
            ->map(fn (Collection $rows, string $key) => [
                'day' => (int) explode('-', $key)[0],
                'hour' => (int) explode('-', $key)[1],
                'units' => (int) $rows->sum('units'),
                'sales' => $rows->pluck('sale_id')->unique()->count(),
            ])
            ->values()
            ->all();
    }

    /**
     * Lotes con stock (el que vence primero adelante) y cuántas unidades de cada uno se vencerían sin venderse
     * si cada sucursal sigue vendiendo a su ritmo. Se venden en orden de vencimiento, como en el punto de venta:
     * un lote empieza a venderse cuando se acaba el anterior. Un lote vencido queda entero en riesgo.
     * units_at_risk = null: la sucursal no vendió nada en los últimos 90 días y no se puede estimar.
     *
     * @param  Collection<int, float>  $rates  unidades por día de cada sucursal
     * @param  ?int  $branchId  solo los lotes de esta sucursal (null = todas)
     * @return list<array{id: int, batch_number: string, branch: ?string, expires_at: string, days_left: int, quantity: int, unit_cost: float, units_at_risk: ?int}>
     */
    private function batchesAtRisk(Product $product, Collection $rates, ?int $branchId): array
    {
        return Batch::with(['branch' => fn ($q) => $q->withTrashed()])
            ->where('product_id', $product->id)
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->where('quantity', '>', 0)
            ->orderBy('expires_at')
            ->orderBy('id')
            ->get()
            ->groupBy('branch_id')
            ->flatMap(function (Collection $batches, int $batchBranchId) use ($rates) {
                $rate = (float) $rates->get($batchBranchId, 0);
                // Días de venta que ya ocupan los lotes anteriores de la sucursal
                $busyDays = 0.0;

                return $batches->map(function (Batch $batch) use ($rate, &$busyDays) {
                    $daysLeft = $batch->daysToExpire();
                    if ($daysLeft < 0) {
                        $atRisk = $batch->quantity;
                    } elseif ($rate <= 0) {
                        $atRisk = null;
                    } else {
                        $sold = (int) min($batch->quantity, floor(max(0, $daysLeft - $busyDays) * $rate));
                        $atRisk = $batch->quantity - $sold;
                        $busyDays += $sold / $rate;
                    }

                    return [
                        'id' => $batch->id,
                        'batch_number' => $batch->batch_number,
                        'branch' => $batch->branch?->name,
                        'expires_at' => $batch->expires_at->toDateString(),
                        'days_left' => $daysLeft,
                        'quantity' => $batch->quantity,
                        'unit_cost' => (float) $batch->unit_cost,
                        'units_at_risk' => $atRisk,
                    ];
                });
            })
            ->sortBy('expires_at')
            ->values()
            ->all();
    }
}
