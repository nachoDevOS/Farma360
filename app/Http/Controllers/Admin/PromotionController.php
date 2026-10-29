<?php

namespace App\Http\Controllers\Admin;

use App\Exceptions\BusinessException;
use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\BatchPromotion;
use App\Models\Branch;
use App\Models\ExpiryPromotionRule;
use App\Services\PromotionService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * PROMOCIONES POR VENCIMIENTO: lotes candidatos, promociones vigentes y reglas.
 * Permisos: promociones.ver · promociones.crear (aplicar / quitar / reglas) · promociones.aprobar (bajo el costo)
 */
class PromotionController extends Controller
{
    public function __construct(private PromotionService $promotions) {}

    public function index(Request $request): Response
    {
        $allowed = $request->user()->allowedBranchIds();
        $branchId = $request->integer('branch') ?: null;
        abort_if($branchId && ! in_array($branchId, $allowed), 403);

        $candidates = $this->promotions->candidates($branchId)->whereIn('branch_id', $allowed)->values();

        $active = BatchPromotion::with('batch.product.presentations', 'batch.branch:id,name', 'registeredBy:id,name')
            ->where('is_active', true)
            ->whereHas('batch', fn ($q) => $q->where('quantity', '>', 0)->whereIn('branch_id', $branchId ? [$branchId] : $allowed))
            ->get()
            ->sortBy('batch.expires_at')
            ->values();

        return Inertia::render('admin/promotions/index', [
            'candidates' => $candidates->map(fn (Batch $b) => $this->batchRow($b) + [
                'suggested_discount' => $b->suggested_discount,
                'suggested_below_cost' => $b->suggested_below_cost,
                'current_discount' => $b->activePromotion?->discount_percent,
            ]),
            'active' => $active->map(fn (BatchPromotion $p) => $this->batchRow($p->batch) + [
                'promotion_id' => $p->id,
                'discount_percent' => $p->discount_percent,
                'source' => $p->source,
                'below_cost' => $p->below_cost,
                'approved_by' => $p->registeredBy?->name,
            ]),
            'rules' => ExpiryPromotionRule::orderByDesc('days_before')->get(),
            'branches' => Branch::whereIn('id', $allowed)->orderBy('name')->get(['id', 'name']),
            'branch' => $branchId,
        ]);
    }

    /** POST /admin/promotions/apply — descuento manual a un lote. */
    public function apply(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'batch_id' => ['required', 'integer'],
            'discount_percent' => ['required', 'numeric', 'gt:0', 'lt:100'],
        ], [], ['discount_percent' => 'descuento']);

        $batch = $this->allowedBatch($request, $data['batch_id']);
        $this->promotions->apply($batch, (float) $data['discount_percent'], $request->user());

        return back()->with('success', "Promoción de {$data['discount_percent']}% aplicada al lote {$batch->batch_number}.");
    }

    /** POST /admin/promotions/apply-suggested — aplica todas las sugeridas. */
    public function applySuggested(Request $request): RedirectResponse
    {
        $branchId = $request->integer('branch_id') ?: null;
        abort_if($branchId && ! in_array($branchId, $request->user()->allowedBranchIds()), 403);
        if (! $branchId && $request->user()->branch_id) {
            $branchId = $request->user()->branch_id;
        }

        $count = $this->promotions->applySuggested($request->user(), $branchId);

        return back()->with('success', $count === 1 ? 'Se aplicó 1 promoción.' : "Se aplicaron {$count} promociones.");
    }

    /** DELETE /admin/promotions/{batch} — quita la promoción vigente del lote. */
    public function remove(Request $request, int $batch): RedirectResponse
    {
        $batch = $this->allowedBatch($request, $batch);
        $this->promotions->deactivate($batch);

        return back()->with('success', "Se quitó la promoción del lote {$batch->batch_number}.");
    }

    /** PUT /admin/promotions/rules — guarda las reglas (reemplaza la lista). */
    public function rules(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'rules' => ['present', 'array'],
            'rules.*.days_before' => ['required', 'integer', 'min:1', 'max:730', 'distinct'],
            'rules.*.discount_percent' => ['required', 'numeric', 'gt:0', 'lt:100'],
        ], [], ['rules.*.days_before' => 'días', 'rules.*.discount_percent' => 'descuento']);

        $keep = collect($data['rules'])->map(function (array $row) {
            // withTrashed: si esa regla se había quitado antes, se recupera (days_before es único)
            $rule = ExpiryPromotionRule::withTrashed()->firstOrNew(['days_before' => $row['days_before']]);
            if ($rule->trashed()) {
                $rule->restore();
            }
            $rule->fill(['discount_percent' => $row['discount_percent'], 'is_active' => true])->save();

            return $rule->id;
        });

        ExpiryPromotionRule::whereNotIn('id', $keep)->get()->each->delete();

        return back()->with('success', 'Reglas de promoción guardadas.');
    }

    private function allowedBatch(Request $request, int $id): Batch
    {
        $batch = Batch::findOrFail($id);
        if (! in_array($batch->branch_id, $request->user()->allowedBranchIds())) {
            throw new BusinessException('Ese lote no es de tu sucursal.');
        }

        return $batch;
    }

    /** @return array<string, mixed> */
    private function batchRow(Batch $batch): array
    {
        $presentations = $batch->product->presentations;

        return [
            'batch_id' => $batch->id,
            'batch_number' => $batch->batch_number,
            'product_name' => $batch->product->fullName(),
            'branch_name' => $batch->branch->name,
            'expires_at' => $batch->expires_at->toDateString(),
            'days_left' => $batch->daysToExpire(),
            'quantity' => $batch->quantity,
            'base_unit' => $batch->product->base_unit,
            'unit_cost' => (float) $batch->unit_cost,
            // Precio normal de una unidad base (de la presentación más chica)
            'unit_price' => $presentations->isNotEmpty() ? round($presentations->first()->sale_price / $presentations->first()->factor, 4) : null,
        ];
    }
}
