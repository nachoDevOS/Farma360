<?php

namespace Tests\Feature\Pharmacy;

use App\Models\Branch;
use App\Models\Product;
use App\Models\Supplier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * CATÁLOGOS: pantalla genérica (sucursales, proveedores…) y productos con presentaciones.
 */
class CatalogTest extends TestCase
{
    use PharmacyHelpers, RefreshDatabase;

    public function test_simple_catalogs_create_update_and_soft_delete()
    {
        $admin = $this->userWithRole('Administrador');

        $this->actingAs($admin)->post('/admin/suppliers', ['name' => 'Droguería Inti', 'nit' => '1020', 'is_active' => true])->assertSessionHas('success');
        $supplier = Supplier::firstOrFail();
        $this->assertSame($admin->id, $supplier->registerUser_id);

        $this->actingAs($admin)->put("/admin/suppliers/{$supplier->id}", ['name' => 'Droguería Inti SRL'])->assertSessionHas('success');
        $this->assertSame('Droguería Inti SRL', $supplier->fresh()->name);
        // Casilla sin marcar = false
        $this->assertFalse($supplier->fresh()->is_active);

        $this->actingAs($admin)->delete("/admin/suppliers/{$supplier->id}")->assertSessionHas('success');
        $this->assertSoftDeleted($supplier);
    }

    public function test_simple_catalog_validation_uses_spanish_labels()
    {
        $this->actingAs($this->userWithRole('Administrador'))
            ->post('/admin/branches', ['name' => 'Sin código'])
            ->assertSessionHasErrors(['code' => 'El campo código es obligatorio.']);
    }

    public function test_a_branch_with_stock_cannot_be_deleted()
    {
        $branch = $this->branch();
        $this->batch($this->product(), $branch, 1);

        $this->actingAs($this->userWithRole('Administrador'))->delete("/admin/branches/{$branch->id}")->assertSessionHas('error');

        $this->assertNotSoftDeleted($branch);
    }

    public function test_products_are_created_with_their_presentations()
    {
        $this->actingAs($this->userWithRole('Administrador'))->post('/admin/products', [
            'name' => 'Panadol', 'concentration' => '500 mg', 'pharmaceutical_form' => 'Tableta', 'base_unit' => 'tableta', 'min_stock' => 50,
            'presentations' => [
                ['name' => 'Unidad', 'factor' => 1, 'sale_price' => 0.8],
                ['name' => 'Blíster x10', 'factor' => 10, 'sale_price' => 7.5, 'barcode' => '7770001'],
            ],
        ])->assertRedirect('/admin/products');

        $product = Product::with('presentations')->firstOrFail();
        $this->assertSame('Panadol 500 mg Tableta', $product->fullName());
        $this->assertSame([1, 10], $product->presentations->pluck('factor')->all());
    }

    public function test_updating_a_product_syncs_presentations()
    {
        $admin = $this->userWithRole('Administrador');
        $product = $this->product(1.0);
        $unit = $this->presentation($product);

        $this->actingAs($admin)->put("/admin/products/{$product->id}", [
            'name' => $product->name, 'base_unit' => 'tableta', 'min_stock' => 0,
            'presentations' => [
                ['id' => $unit->id, 'name' => 'Unidad', 'factor' => 1, 'sale_price' => 1.2],
                ['name' => 'Blíster x10', 'factor' => 10, 'sale_price' => 11],
            ],
        ])->assertRedirect('/admin/products');

        $this->assertEquals(1.2, $unit->fresh()->sale_price);
        $this->assertSame(['Unidad', 'Blíster x10'], $product->fresh()->presentations->pluck('name')->all());
        // La caja que se quitó queda eliminada lógicamente
        $this->assertSoftDeleted('product_presentations', ['product_id' => $product->id, 'name' => 'Caja x100']);
    }

    public function test_presentations_cannot_repeat_the_number_of_units()
    {
        $this->actingAs($this->userWithRole('Administrador'))->post('/admin/products', [
            'name' => 'X', 'base_unit' => 'tableta', 'min_stock' => 0,
            'presentations' => [['name' => 'A', 'factor' => 10, 'sale_price' => 1], ['name' => 'B', 'factor' => 10, 'sale_price' => 2]],
        ])->assertSessionHasErrors('presentations');
    }

    public function test_a_product_with_stock_cannot_be_deleted()
    {
        $product = $this->product();
        $this->batch($product, $this->branch(), 3);

        $this->actingAs($this->userWithRole('Administrador'))->delete("/admin/products/{$product->id}")->assertSessionHas('error');
        $this->assertNotSoftDeleted($product);
    }

    public function test_product_search_finds_by_active_ingredient_and_barcode()
    {
        $admin = $this->userWithRole('Administrador');
        $this->actingAs($admin)->post('/admin/active-ingredients', ['name' => 'Ibuprofeno']);
        $product = $this->product(1.0, ['name' => 'Febrax', 'barcode' => '999111']);
        $product->update(['active_ingredient_id' => 1]);

        $this->actingAs($admin)->getJson('/admin/products/search?q=ibupro')->assertOk()->assertJsonPath('0.product_id', $product->id);
        $this->actingAs($admin)->getJson('/admin/products/search?q=999111')->assertOk()->assertJsonCount(2);
    }

    public function test_users_can_be_assigned_to_a_branch()
    {
        $branch = Branch::factory()->create();

        $this->actingAs($this->userWithRole('Administrador'))->post('/admin/users', [
            'name' => 'Cajera Uno', 'email' => 'caja1@example.com', 'role' => 'Cajero', 'branch_id' => $branch->id,
            'is_active' => true, 'password' => 'password', 'password_confirmation' => 'password',
        ])->assertSessionHas('success');

        $this->assertDatabaseHas('users', ['email' => 'caja1@example.com', 'branch_id' => $branch->id]);
    }
}
