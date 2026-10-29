<?php

namespace App\Services;

use App\Exceptions\BusinessException;
use App\Models\Batch;
use App\Models\Transfer;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * TRANSFERENCIAS: enviar (sale del origen), recibir (entra al destino, mismo lote y vencimiento) o anular.
 */
class TransferService
{
    public function __construct(private InventoryService $inventory) {}

    /**
     * @param  list<array{batch_id: int, quantity: int}>  $items  quantity en unidades base
     */
    public function send(int $fromBranchId, int $toBranchId, array $items, ?string $note = null): Transfer
    {
        if ($fromBranchId === $toBranchId) {
            throw new BusinessException('La sucursal de origen y la de destino deben ser distintas.');
        }

        return DB::transaction(function () use ($fromBranchId, $toBranchId, $items, $note) {
            $transfer = Transfer::create([
                'from_branch_id' => $fromBranchId,
                'to_branch_id' => $toBranchId,
                'status' => 'enviada',
                'note' => $note,
            ]);

            foreach ($items as $row) {
                $batch = Batch::findOrFail($row['batch_id']);

                if ($batch->branch_id !== $fromBranchId) {
                    throw new BusinessException("El lote {$batch->batch_number} no pertenece a la sucursal de origen.");
                }

                $this->inventory->decrease($batch, (int) $row['quantity'], 'transferencia_salida', $transfer);

                $transfer->items()->create([
                    'product_id' => $batch->product_id,
                    'batch_id' => $batch->id,
                    'batch_number' => $batch->batch_number,
                    'expires_at' => $batch->expires_at,
                    'unit_cost' => $batch->unit_cost,
                    'quantity' => (int) $row['quantity'],
                ]);
            }

            return $transfer;
        });
    }

    /** Recibir en el destino: suma al lote igual (mismo número y vencimiento) o crea uno nuevo. */
    public function receive(Transfer $transfer, User $user): Transfer
    {
        return DB::transaction(function () use ($transfer, $user) {
            $transfer = $this->lockPending($transfer);

            foreach ($transfer->items as $item) {
                $destination = Batch::firstOrCreate(
                    [
                        'product_id' => $item->product_id,
                        'branch_id' => $transfer->to_branch_id,
                        'batch_number' => $item->batch_number,
                        'expires_at' => $item->expires_at,
                    ],
                    ['unit_cost' => $item->unit_cost, 'quantity' => 0],
                );

                $this->inventory->increase($destination, $item->quantity, 'transferencia_entrada', $transfer);
                $item->update(['destination_batch_id' => $destination->id]);
            }

            $transfer->forceFill(['status' => 'recibida', 'received_at' => now(), 'receiveUser_id' => $user->id])->save();

            return $transfer;
        });
    }

    /** Anular una transferencia que todavía no se recibió: la mercadería vuelve a sus lotes de origen. */
    public function cancel(Transfer $transfer, string $reason, User $user): Transfer
    {
        return DB::transaction(function () use ($transfer, $reason, $user) {
            $transfer = $this->lockPending($transfer);

            foreach ($transfer->items as $item) {
                $this->inventory->increase($item->batch, $item->quantity, 'anulacion_transferencia', $transfer, $reason);
            }

            $transfer->forceFill([
                'status' => 'anulada',
                'cancelled_at' => now(),
                'cancelUser_id' => $user->id,
                'cancel_reason' => $reason,
            ])->save();

            return $transfer;
        });
    }

    private function lockPending(Transfer $transfer): Transfer
    {
        $transfer = Transfer::with('items.batch')->whereKey($transfer->id)->lockForUpdate()->firstOrFail();

        if ($transfer->status !== 'enviada') {
            throw new BusinessException("La transferencia {$transfer->number} ya está {$transfer->status}.");
        }

        return $transfer;
    }
}
