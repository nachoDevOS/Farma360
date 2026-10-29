<?php

namespace App\Services;

use App\Exceptions\BusinessException;
use App\Models\Batch;
use App\Models\BatchPromotion;
use App\Models\ExpiryPromotionRule;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * PROMOCIONES POR VENCIMIENTO: descuentos a LOTES que están por vencer, para venderlos antes de perderlos.
 *
 * Reglas (tabla expiry_promotion_rules): "faltan 60 días o menos → 20%". Se usa la regla más ajustada:
 * con 45 días de vida y reglas 90/60/30, aplica la de 60.
 * El punto de venta cobra solo el precio con descuento del lote que sale (SaleService).
 */
class PromotionService
{
    /** Descuento sugerido por las reglas para un lote al que le faltan $daysLeft días. null = ninguna regla aplica. */
    public function suggestedDiscount(int $daysLeft): ?float
    {
        if ($daysLeft < 0) {
            return null;
        }

        $rule = ExpiryPromotionRule::where('is_active', true)
            ->where('days_before', '>=', $daysLeft)
            ->orderBy('days_before')
            ->first();

        return $rule ? (float) $rule->discount_percent : null;
    }

    /**
     * Lotes a los que conviene aplicar (o subir) el descuento: con stock, sin vencer, dentro de alguna regla,
     * y sin promoción o con una promoción automática menor a la sugerida.
     *
     * @return Collection<int, Batch>
     */
    public function candidates(?int $branchId = null): Collection
    {
        $maxDays = (int) ExpiryPromotionRule::where('is_active', true)->max('days_before');
        if ($maxDays === 0) {
            return collect();
        }

        return Batch::with(['product.presentations', 'branch', 'activePromotion'])
            ->sellable()
            ->whereDate('expires_at', '<=', today()->addDays($maxDays))
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->orderBy('expires_at')
            ->get()
            ->each(function (Batch $batch) {
                $batch->suggested_discount = $this->suggestedDiscount($batch->daysToExpire());
                $batch->suggested_below_cost = $batch->suggested_discount !== null && $this->isBelowCost($batch, $batch->suggested_discount);
            })
            ->filter(function (Batch $batch) {
                $current = $batch->activePromotion;

                return $batch->suggested_discount !== null
                    && ($current === null || ($current->source === 'regla' && (float) $current->discount_percent < $batch->suggested_discount));
            })
            ->values();
    }

    /** ¿Con ese descuento alguna presentación se vendería por debajo del costo del lote? */
    public function isBelowCost(Batch $batch, float $percent): bool
    {
        return $batch->product->presentations->contains(
            fn ($presentation) => ($presentation->sale_price / $presentation->factor) * (1 - $percent / 100) < (float) $batch->unit_cost,
        );
    }

    /**
     * Aplica un descuento al lote (reemplaza el que tenía). Por debajo del costo solo con el permiso promociones.aprobar.
     */
    public function apply(Batch $batch, float $percent, User $user, string $source = 'manual'): BatchPromotion
    {
        if ($percent <= 0 || $percent >= 100) {
            throw new BusinessException('El descuento debe ser mayor a 0% y menor a 100%.');
        }

        if ($batch->isExpired()) {
            throw new BusinessException("El lote {$batch->batch_number} ya venció: no se puede vender.");
        }

        $belowCost = $this->isBelowCost($batch->loadMissing('product.presentations'), $percent);
        if ($belowCost && ! $user->can('promociones.aprobar')) {
            throw new BusinessException("Con {$percent}% el lote {$batch->batch_number} se vendería por debajo del costo. Necesitas el permiso para aprobarlo.");
        }

        return DB::transaction(function () use ($batch, $percent, $source, $belowCost) {
            $this->deactivate($batch);

            return BatchPromotion::create([
                'batch_id' => $batch->id,
                'discount_percent' => $percent,
                'source' => $source,
                'below_cost' => $belowCost,
            ]);
        });
    }

    /** Aplica todas las sugeridas de una vez. Las que quedarían bajo el costo se saltan si el usuario no puede aprobarlas. */
    public function applySuggested(User $user, ?int $branchId = null): int
    {
        $applied = 0;

        foreach ($this->candidates($branchId) as $batch) {
            if ($batch->suggested_below_cost && ! $user->can('promociones.aprobar')) {
                continue;
            }
            $this->apply($batch, $batch->suggested_discount, $user, 'regla');
            $applied++;
        }

        return $applied;
    }

    /** Quita la promoción vigente del lote (queda en el historial). */
    public function deactivate(Batch $batch): void
    {
        BatchPromotion::where('batch_id', $batch->id)->where('is_active', true)->update(['is_active' => false]);
    }
}
