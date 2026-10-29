<?php

namespace Tests\Feature\Pharmacy;

use App\Models\Batch;
use App\Models\Transfer;
use App\Services\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * TRANSFERENCIAS: enviar, recibir (mismo lote y vencimiento en el destino) y anular.
 */
class TransferTest extends TestCase
{
    use PharmacyHelpers, RefreshDatabase;

    public function test_send_and_receive_moves_the_same_batch_to_the_destination()
    {
        $from = $this->branch();
        $to = $this->branch();
        $product = $this->product();
        $batch = $this->batch($product, $from, 50, '+8 months', 0.7, 'LT-9');
        $admin = $this->userWithRole('Administrador');

        $this->actingAs($admin)->post('/admin/transfers', [
            'from_branch_id' => $from->id, 'to_branch_id' => $to->id,
            'items' => [['batch_id' => $batch->id, 'quantity' => 20]],
        ])->assertRedirect();

        $transfer = Transfer::firstOrFail();
        $this->assertSame('enviada', $transfer->status);
        $this->assertSame(30, $batch->fresh()->quantity);
        // Mientras viaja, el destino todavía no lo tiene
        $this->assertSame(0, app(InventoryService::class)->stock($product->id, $to->id));

        $this->actingAs($admin)->post("/admin/transfers/{$transfer->id}/receive")->assertSessionHas('success');

        $destination = Batch::where('branch_id', $to->id)->firstOrFail();
        $this->assertSame('LT-9', $destination->batch_number);
        $this->assertSame($batch->expires_at->toDateString(), $destination->expires_at->toDateString());
        $this->assertEquals(0.7, $destination->unit_cost);
        $this->assertSame(20, $destination->quantity);
        $this->assertSame('recibida', $transfer->fresh()->status);
    }

    public function test_a_received_transfer_merges_into_the_existing_batch()
    {
        $from = $this->branch();
        $to = $this->branch();
        $product = $this->product();
        $origin = $this->batch($product, $from, 50, '+8 months', 0.7, 'LT-1');
        $existing = $this->batch($product, $to, 5, '+8 months', 0.7, 'LT-1');
        $admin = $this->userWithRole('Administrador');

        $this->actingAs($admin)->post('/admin/transfers', ['from_branch_id' => $from->id, 'to_branch_id' => $to->id, 'items' => [['batch_id' => $origin->id, 'quantity' => 10]]]);
        $this->actingAs($admin)->post('/admin/transfers/'.Transfer::first()->id.'/receive');

        $this->assertSame(15, $existing->fresh()->quantity);
        $this->assertSame(1, Batch::where('branch_id', $to->id)->count());
    }

    public function test_a_transfer_can_be_cancelled_only_before_it_is_received()
    {
        $from = $this->branch();
        $to = $this->branch();
        $batch = $this->batch($this->product(), $from, 10);
        $admin = $this->userWithRole('Administrador');
        $this->actingAs($admin)->post('/admin/transfers', ['from_branch_id' => $from->id, 'to_branch_id' => $to->id, 'items' => [['batch_id' => $batch->id, 'quantity' => 4]]]);
        $transfer = Transfer::firstOrFail();

        $this->actingAs($admin)->post("/admin/transfers/{$transfer->id}/cancel", ['reason' => 'Error de envío'])->assertSessionHas('success');
        $this->assertSame(10, $batch->fresh()->quantity);
        $this->assertSame('anulada', $transfer->fresh()->status);

        $this->actingAs($admin)->post("/admin/transfers/{$transfer->id}/receive")->assertSessionHas('error');
    }

    public function test_cannot_send_more_than_the_batch_has_or_to_the_same_branch()
    {
        $from = $this->branch();
        $batch = $this->batch($this->product(), $from, 5);
        $admin = $this->userWithRole('Administrador');

        $this->actingAs($admin)->post('/admin/transfers', ['from_branch_id' => $from->id, 'to_branch_id' => $this->branch()->id, 'items' => [['batch_id' => $batch->id, 'quantity' => 6]]])
            ->assertSessionHas('error');
        $this->actingAs($admin)->post('/admin/transfers', ['from_branch_id' => $from->id, 'to_branch_id' => $from->id, 'items' => [['batch_id' => $batch->id, 'quantity' => 1]]])
            ->assertSessionHasErrors('to_branch_id');

        $this->assertSame(0, Transfer::count());
        $this->assertSame(5, $batch->fresh()->quantity);
    }

    public function test_only_the_destination_branch_receives()
    {
        $from = $this->branch();
        $to = $this->branch();
        $batch = $this->batch($this->product(), $from, 10);
        $sender = $this->userWithRole('Almacenero', $from);
        $this->actingAs($sender)->post('/admin/transfers', ['from_branch_id' => $from->id, 'to_branch_id' => $to->id, 'items' => [['batch_id' => $batch->id, 'quantity' => 2]]]);
        $transfer = Transfer::firstOrFail();

        $this->actingAs($sender)->post("/admin/transfers/{$transfer->id}/receive")->assertForbidden();
        $this->actingAs($this->userWithRole('Almacenero', $to))->post("/admin/transfers/{$transfer->id}/receive")->assertSessionHas('success');
    }
}
