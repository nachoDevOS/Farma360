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
        $this->assertSame(30, $batch->fresh()->stock);
        // Mientras viaja, el destino todavía no lo tiene
        $this->assertSame(0, app(InventoryService::class)->stock($product->id, $to->id));

        $this->actingAs($admin)->post("/admin/transfers/{$transfer->id}/receive")->assertSessionHas('success');

        $destination = Batch::where('branch_id', $to->id)->firstOrFail();
        $this->assertSame('LT-9', $destination->batch_number);
        $this->assertSame($batch->expires_at->toDateString(), $destination->expires_at->toDateString());
        $this->assertEquals(0.7, $destination->unit_cost);
        $this->assertSame(20, $destination->stock);
        $this->assertSame('recibida', $transfer->fresh()->status);
    }

    public function test_the_search_brings_each_batch_with_its_product_in_expiry_order()
    {
        $from = $this->branch();
        $to = $this->branch();
        $product = $this->product(1.0, ['name' => 'Paracetamolix', 'generic_name' => 'Acetaminofeno']);
        $later = $this->batch($product, $from, 30, '+10 months', 0.7, 'LATER');
        $sooner = $this->batch($product, $from, 20, '+2 months', 0.5, 'SOONER');
        $this->batch($product, $from, 0, '+1 month', 0.5, 'EMPTY');
        $this->batch($product, $to, 12, '+6 months', 0.5, 'THERE');
        $this->batch($this->product(1.0, ['name' => 'Otrofen']), $from, 5);

        $this->actingAs($this->userWithRole('Administrador'))
            ->getJson('/admin/inventory/batches?'.http_build_query(['q' => 'Acetaminofeno', 'branch_id' => $from->id, 'to_branch_id' => $to->id]))
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonPath('0.id', $sooner->id)
            ->assertJsonPath('1.id', $later->id)
            ->assertJsonPath('0.product_id', $product->id)
            ->assertJsonPath('0.commercial_name', 'Paracetamolix')
            ->assertJsonPath('0.generic_name', 'Acetaminofeno')
            ->assertJsonPath('1.unit_cost', 0.7)
            ->assertJsonPath('0.destination_stock', 12)
            ->assertJsonPath('0.presentations.1.factor', 100);
    }

    public function test_the_search_does_not_say_the_destination_stock_until_a_destination_is_chosen()
    {
        $from = $this->branch();
        $this->batch($this->product(1.0, ['name' => 'Paracetamolix']), $from, 30);

        $this->actingAs($this->userWithRole('Administrador'))
            ->getJson('/admin/inventory/batches?'.http_build_query(['q' => 'Paracet', 'branch_id' => $from->id]))
            ->assertJsonPath('0.destination_stock', null);
    }

    public function test_the_search_is_only_for_my_branches()
    {
        $mine = $this->branch();
        $other = $this->branch();

        $this->actingAs($this->userWithRole('Regente', $mine))
            ->getJson('/admin/inventory/batches?'.http_build_query(['q' => 'x', 'branch_id' => $other->id]))
            ->assertForbidden();
    }

    public function test_a_product_can_be_sent_from_several_batches()
    {
        $from = $this->branch();
        $to = $this->branch();
        $product = $this->product();
        $first = $this->batch($product, $from, 20, '+2 months', 0.5, 'A');
        $second = $this->batch($product, $from, 30, '+10 months', 0.5, 'B');

        $this->actingAs($this->userWithRole('Administrador'))->post('/admin/transfers', [
            'from_branch_id' => $from->id, 'to_branch_id' => $to->id,
            'items' => [['batch_id' => $first->id, 'quantity' => 20], ['batch_id' => $second->id, 'quantity' => 5]],
        ])->assertRedirect();

        $this->assertSame([0, 25], [$first->fresh()->stock, $second->fresh()->stock]);
        $this->assertCount(2, Transfer::firstOrFail()->items);
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

        $this->assertSame(15, $existing->fresh()->stock);
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
        $this->assertSame(10, $batch->fresh()->stock);
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
        $this->assertSame(5, $batch->fresh()->stock);
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
