<?php

namespace App\Services;

use App\Exceptions\BusinessException;
use App\Models\CashMovement;
use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\Denomination;
use App\Models\SalePayment;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * CAJA con corte de billetes.
 *
 *   open()        → el cajero cuenta el fondo inicial billete por billete
 *   addMovement() → ingresos, egresos y retiros parciales de efectivo
 *   close()       → arqueo: cuenta billete por billete; se compara con lo esperado (cierre ciego)
 *   approve()     → un supervisor aprueba un cierre con diferencia grande
 *
 * Efectivo esperado = fondo inicial + ventas en efectivo + ingresos − egresos − retiros.
 * QR, tarjeta y transferencia NO entran al conteo de billetes: se muestran aparte.
 */
class CashService
{
    /** Turno abierto del usuario (null si no tiene). */
    public function currentSession(User $user): ?CashSession
    {
        return CashSession::where('user_id', $user->id)->where('status', CashSession::OPEN)->first();
    }

    /**
     * @param  array<int|string, int|string>  $counts  [denomination_id => cantidad]
     */
    public function open(CashRegister $register, User $user, array $counts): CashSession
    {
        if (! $register->is_active) {
            throw new BusinessException("La caja {$register->name} está desactivada.");
        }
        if ($user->branch_id && $user->branch_id !== $register->branch_id) {
            throw new BusinessException('Solo puedes abrir cajas de tu sucursal.');
        }

        return DB::transaction(function () use ($register, $user, $counts) {
            if (CashSession::where('cash_register_id', $register->id)->where('status', CashSession::OPEN)->lockForUpdate()->exists()) {
                throw new BusinessException("La caja {$register->name} ya tiene un turno abierto.");
            }
            if ($this->currentSession($user)) {
                throw new BusinessException('Ya tienes un turno de caja abierto. Ciérralo antes de abrir otro.');
            }

            $session = CashSession::create([
                'cash_register_id' => $register->id,
                'branch_id' => $register->branch_id,
                'user_id' => $user->id,
                'opened_at' => now(),
                'opening_amount' => 0,
                'status' => CashSession::OPEN,
            ]);

            $session->update(['opening_amount' => $this->saveCounts($session, 'apertura', $counts)]);

            return $session;
        });
    }

    public function addMovement(CashSession $session, string $type, float $amount, string $reason): CashMovement
    {
        $this->ensureOpen($session);

        if (! array_key_exists($type, CashMovement::TYPES)) {
            throw new BusinessException('Tipo de movimiento no válido.');
        }
        if ($amount <= 0) {
            throw new BusinessException('El monto debe ser mayor a cero.');
        }
        if ($type !== 'ingreso' && $amount > $this->expectedCash($session)) {
            throw new BusinessException('No hay suficiente efectivo en la caja para esa salida.');
        }

        return $session->movements()->create(['type' => $type, 'amount' => round($amount, 2), 'reason' => $reason]);
    }

    /**
     * Resumen del turno: de dónde sale el efectivo esperado y cuánto entró por otras formas de pago.
     *
     * @return array{opening: float, cash_sales: float, income: float, expense: float, withdrawals: float, expected: float,
     *     sales_count: int, sales_total: float, by_method: array<string, float>}
     */
    public function summary(CashSession $session): array
    {
        $payments = SalePayment::query()
            ->join('sales', 'sales.id', '=', 'sale_payments.sale_id')
            ->where('sales.cash_session_id', $session->id)
            ->where('sales.status', 'completada')
            ->groupBy('sale_payments.method')
            ->selectRaw('sale_payments.method, SUM(sale_payments.amount) as total')
            ->pluck('total', 'method')
            ->map(fn ($total) => round((float) $total, 2));

        $movements = $session->movements()->groupBy('type')->selectRaw('type, SUM(amount) as total')->pluck('total', 'type');

        $opening = (float) $session->opening_amount;
        $cashSales = $payments['efectivo'] ?? 0.0;
        $income = (float) ($movements['ingreso'] ?? 0);
        $expense = (float) ($movements['egreso'] ?? 0);
        $withdrawals = (float) ($movements['retiro'] ?? 0);
        $sales = $session->sales()->where('status', 'completada');

        return [
            'opening' => $opening,
            'cash_sales' => $cashSales,
            'income' => $income,
            'expense' => $expense,
            'withdrawals' => $withdrawals,
            'expected' => round($opening + $cashSales + $income - $expense - $withdrawals, 2),
            'sales_count' => (clone $sales)->count(),
            'sales_total' => round((float) (clone $sales)->sum('total'), 2),
            'by_method' => $payments->all(),
        ];
    }

    public function expectedCash(CashSession $session): float
    {
        return $this->summary($session)['expected'];
    }

    /**
     * Cierre con arqueo. Si la diferencia supera config('farmacia.cash_difference_limit'):
     * hay que explicarla (note) y el turno queda "pendiente" hasta que un supervisor lo apruebe.
     *
     * @param  array<int|string, int|string>  $counts  [denomination_id => cantidad]
     */
    public function close(CashSession $session, array $counts, ?string $note = null): CashSession
    {
        return DB::transaction(function () use ($session, $counts, $note) {
            $session = CashSession::whereKey($session->id)->lockForUpdate()->firstOrFail();
            $this->ensureOpen($session);

            $expected = $this->expectedCash($session);
            $counted = $this->saveCounts($session, 'cierre', $counts);
            $difference = round($counted - $expected, 2);
            $overLimit = abs($difference) > (float) config('farmacia.cash_difference_limit');

            if ($overLimit && blank($note)) {
                throw new BusinessException('La diferencia es grande: escribe una observación que la explique.');
            }

            $session->forceFill([
                'closed_at' => now(),
                'expected_amount' => $expected,
                'counted_amount' => $counted,
                'difference' => $difference,
                'close_note' => $note,
                'status' => $overLimit ? CashSession::PENDING : CashSession::CLOSED,
            ])->save();

            return $session;
        });
    }

    /** Un supervisor revisa un cierre con diferencia grande. */
    public function approve(CashSession $session, User $user, ?string $note = null): CashSession
    {
        if ($session->status !== CashSession::PENDING) {
            throw new BusinessException('Este turno no está pendiente de revisión.');
        }
        if ($session->user_id === $user->id) {
            throw new BusinessException('No puedes aprobar el cierre de tu propio turno.');
        }

        $session->forceFill([
            'status' => CashSession::CLOSED,
            'reviewed_at' => now(),
            'reviewUser_id' => $user->id,
            'review_note' => $note,
        ])->save();

        return $session;
    }

    public function ensureOpen(CashSession $session): void
    {
        if (! $session->isOpen()) {
            throw new BusinessException('El turno de caja ya está cerrado.');
        }
    }

    /**
     * Guarda el corte de billetes y devuelve el total contado.
     *
     * @param  array<int|string, int|string>  $counts
     */
    private function saveCounts(CashSession $session, string $moment, array $counts): float
    {
        $total = 0;
        $denominations = Denomination::whereIn('id', array_keys($counts))->get()->keyBy('id');

        foreach ($counts as $denominationId => $quantity) {
            $quantity = (int) $quantity;
            $denomination = $denominations->get($denominationId);
            if ($quantity <= 0 || ! $denomination) {
                continue;
            }

            $subtotal = round($quantity * (float) $denomination->value, 2);
            $session->counts()->create([
                'moment' => $moment,
                'denomination_id' => $denomination->id,
                'value' => $denomination->value,
                'quantity' => $quantity,
                'subtotal' => $subtotal,
            ]);
            $total += $subtotal;
        }

        return round($total, 2);
    }
}
