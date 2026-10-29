<?php

namespace Tests\Feature\Pharmacy;

use App\Models\ActiveIngredient;
use App\Models\Branch;
use App\Models\Indication;
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

    public function test_products_save_generic_name_uses_and_description()
    {
        $admin = $this->userWithRole('Administrador');
        Indication::create(['name' => 'Fiebre']);

        $this->actingAs($admin)->post('/admin/products', [
            'name' => 'Dolofen', 'generic_name' => 'paracetamol', 'base_unit' => 'tableta', 'min_stock' => 0,
            'description' => 'Alivia el dolor y baja la fiebre.',
            'indications' => ['Dolor de cabeza', 'fiebre', 'Dolor de cabeza'],
            'presentations' => [['name' => 'Unidad', 'factor' => 1, 'sale_price' => 0.5]],
        ])->assertRedirect('/admin/products');

        $product = Product::with('activeIngredient', 'indications')->firstOrFail();
        // El genérico escrito se crea en el catálogo; los usos existentes se reutilizan sin duplicarse
        $this->assertSame('Paracetamol', $product->activeIngredient->name);
        $this->assertSame(['Dolor de cabeza', 'Fiebre'], $product->indications->pluck('name')->all());
        $this->assertSame(2, Indication::count());
        $this->assertSame('Alivia el dolor y baja la fiebre.', $product->description);

        // Un segundo producto con el mismo genérico usa el mismo principio activo
        $this->actingAs($admin)->post('/admin/products', [
            'name' => 'Panadol', 'generic_name' => 'PARACETAMOL', 'base_unit' => 'tableta', 'min_stock' => 0,
            'presentations' => [['name' => 'Unidad', 'factor' => 1, 'sale_price' => 0.6]],
        ]);
        $this->assertSame(1, ActiveIngredient::count());

        // Al editar llegan el genérico y los usos como texto
        $this->actingAs($admin)->get("/admin/products/{$product->id}/edit")
            ->assertInertia(fn ($page) => $page
                ->where('product.generic_name', 'Paracetamol')
                ->where('product.indication_names', ['Dolor de cabeza', 'Fiebre'])
                ->has('indications', 2));

        // Quitar los usos al editar los desvincula
        $this->actingAs($admin)->put("/admin/products/{$product->id}", [
            'name' => 'Dolofen', 'generic_name' => '', 'base_unit' => 'tableta', 'min_stock' => 0, 'indications' => [],
            'presentations' => [['id' => $product->presentations()->first()->id, 'name' => 'Unidad', 'factor' => 1, 'sale_price' => 0.5]],
        ])->assertRedirect('/admin/products');
        $this->assertCount(0, $product->fresh()->indications);
        $this->assertNull($product->fresh()->active_ingredient_id);
    }

    public function test_products_are_found_and_filtered_by_what_they_are_for()
    {
        $admin = $this->userWithRole('Administrador');
        $headache = $this->product(1.0, ['name' => 'Cefalín']);
        $headache->indications()->sync(Indication::idsFor(['Dolor de cabeza']));
        $stomach = $this->product(1.0, ['name' => 'Gastrozol', 'description' => 'Reduce la acidez del estómago.']);
        $this->product(1.0, ['name' => 'Otro']);

        $this->actingAs($admin)->get('/admin/products?search=dolor de cabeza')
            ->assertInertia(fn ($page) => $page->where('products.total', 1)->where('products.data.0.name', 'Cefalín'));
        $this->actingAs($admin)->get('/admin/products?search=acidez')
            ->assertInertia(fn ($page) => $page->where('products.total', 1)->where('products.data.0.id', $stomach->id));
        $this->actingAs($admin)->get('/admin/products?indication='.$headache->indications->first()->id)
            ->assertInertia(fn ($page) => $page->where('products.total', 1)->where('products.data.0.indications.0.name', 'Dolor de cabeza'));
        $this->actingAs($admin)->getJson('/admin/products/search?q=cabeza')->assertOk()->assertJsonPath('0.product_id', $headache->id);
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
