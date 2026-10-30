<?php

namespace Tests\Feature\Pharmacy;

use App\Models\Branch;
use App\Models\Indication;
use App\Models\Product;
use App\Models\ProductPriceHistory;
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

    public function test_products_are_created_with_presentations_by_levels()
    {
        $this->actingAs($this->userWithRole('Administrador'))->post('/admin/products', [
            'name' => 'Panadol', 'concentration' => '500 mg', 'pharmaceutical_form' => 'Tableta', 'base_unit' => 'tableta', 'min_stock' => 50,
            'presentations' => [
                ['sale_price' => 0.8, 'is_sellable' => true, 'is_purchasable' => false],
                ['parent_index' => 0, 'package' => 'Blíster', 'contains' => 10, 'sale_price' => 7.5, 'is_sellable' => true, 'is_purchasable' => false, 'barcode' => '7770001'],
                ['parent_index' => 1, 'package' => 'caja', 'contains' => 10, 'sale_price' => 70, 'is_sellable' => true, 'is_purchasable' => true],
            ],
        ])->assertRedirect('/admin/products');

        $product = Product::with('presentations')->firstOrFail();
        [$unit, $blister, $box] = $product->presentations->all();
        // Unidad base y empaques se guardan con la primera letra en mayúscula
        $this->assertSame('Tableta', $product->base_unit);
        $this->assertSame('Caja', $box->package);
        $this->assertSame('Panadol 500 mg Tableta', $product->fullName());
        // El sistema calcula las unidades y arma el nombre: el usuario solo dijo qué contiene cada empaque
        $this->assertSame([1, 10, 100], $product->presentations->pluck('factor')->all());
        $this->assertSame(['Tableta', 'Blíster x10', 'Caja x10 blísteres (100 tabletas)'], $product->presentations->pluck('name')->all());
        $this->assertSame([null, $unit->id, $blister->id], $product->presentations->pluck('parent_id')->all());
        $this->assertFalse($unit->is_purchasable);
        $this->assertTrue($box->is_purchasable);
    }

    public function test_updating_a_product_syncs_presentations()
    {
        $admin = $this->userWithRole('Administrador');
        $product = $this->product(1.0);
        $unit = $this->presentation($product);

        $this->actingAs($admin)->put("/admin/products/{$product->id}", [
            'name' => $product->name, 'base_unit' => 'tableta', 'min_stock' => 0,
            'presentations' => [
                ['id' => $unit->id, 'sale_price' => 1.2, 'is_sellable' => true, 'is_purchasable' => true],
                ['parent_index' => 0, 'package' => 'Blíster', 'contains' => 10, 'sale_price' => 11, 'is_sellable' => true, 'is_purchasable' => false],
            ],
        ])->assertRedirect('/admin/products');

        $this->assertEquals(1.2, $unit->fresh()->sale_price);
        $this->assertSame(['Tableta', 'Blíster x10'], $product->fresh()->presentations->pluck('name')->all());
        // La caja que se quitó queda eliminada lógicamente
        $this->assertSoftDeleted('product_presentations', ['product_id' => $product->id, 'name' => 'Caja x100']);
    }

    public function test_changing_what_a_package_contains_recalculates_the_outer_ones()
    {
        $admin = $this->userWithRole('Administrador');
        $product = $this->product(1.0);
        $rows = fn (int $blister) => [
            ['id' => $this->presentation($product)->id, 'sale_price' => 1, 'is_sellable' => true, 'is_purchasable' => false],
            ['parent_index' => 0, 'package' => 'Blíster', 'contains' => $blister, 'sale_price' => 9, 'is_sellable' => true, 'is_purchasable' => false],
            ['parent_index' => 1, 'package' => 'Caja', 'contains' => 3, 'sale_price' => 25, 'is_sellable' => false, 'is_purchasable' => true],
        ];

        $this->actingAs($admin)->put("/admin/products/{$product->id}", ['name' => 'X', 'base_unit' => 'tableta', 'min_stock' => 0, 'presentations' => $rows(10)]);
        $ids = $product->presentations()->pluck('id')->all();
        $this->actingAs($admin)->put("/admin/products/{$product->id}", [
            'name' => 'X', 'base_unit' => 'tableta', 'min_stock' => 0,
            'presentations' => collect($rows(12))->map(fn ($row, $i) => ['id' => $ids[$i]] + $row)->all(),
        ])->assertRedirect('/admin/products');

        $this->assertSame([1, 12, 36], $product->presentations()->pluck('factor')->all());
        $this->assertSame('Caja x3 blísteres (36 tabletas)', $product->presentations()->get()->last()->name);
    }

    public function test_presentation_levels_are_validated()
    {
        $admin = $this->userWithRole('Administrador');
        $post = fn (array $presentations) => $this->actingAs($admin)->post('/admin/products', [
            'name' => 'X', 'base_unit' => 'tableta', 'min_stock' => 0, 'presentations' => $presentations,
        ]);
        $unit = ['sale_price' => 1, 'is_sellable' => true, 'is_purchasable' => true];
        $box = fn (array $extra = []) => ['parent_index' => 0, 'package' => 'Caja', 'contains' => 10, 'sale_price' => 9, 'is_sellable' => true, 'is_purchasable' => true, ...$extra];

        // Dos empaques con la misma cantidad de unidades
        $post([$unit, $box(), $box(['package' => 'Blíster'])])->assertSessionHasErrors('presentations');
        // Un empaque que dice contener uno que va después de él
        $post([$unit, $box(['parent_index' => 1])])->assertSessionHasErrors('presentations.1.parent_index');
        // Falta decir cuántas trae y qué empaque es
        $post([$unit, $box(['contains' => null, 'package' => ''])])->assertSessionHasErrors(['presentations.1.contains', 'presentations.1.package']);
        // Un empaque no se llama igual que lo que contiene (sin importar mayúsculas, tildes ni plural)
        $post([$unit, $box(['package' => 'Tabletas'])])->assertSessionHasErrors('presentations.1.package');
        $post([$unit, $box(['package' => 'Blíster']), $box(['parent_index' => 1, 'package' => 'blister', 'contains' => 3])])
            ->assertSessionHasErrors('presentations.2.package');
        // Si se vende necesita precio
        $post([['is_sellable' => true, 'is_purchasable' => true]])->assertSessionHasErrors('presentations.0.sale_price');
        // Al menos una se vende y una se compra
        $post([['sale_price' => 1, 'is_sellable' => true, 'is_purchasable' => false]])->assertSessionHasErrors('presentations');
        $post([['is_sellable' => false, 'is_purchasable' => true]])->assertSessionHasErrors('presentations');

        $this->assertSame(0, Product::count());
    }

    public function test_purchase_search_only_lists_presentations_that_are_bought()
    {
        $admin = $this->userWithRole('Administrador');
        $product = $this->product(1.0, ['name' => 'Febrax']);
        $this->presentation($product)->update(['is_purchasable' => false]);

        $this->actingAs($admin)->getJson('/admin/products/search?q=Febrax')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.factor', 100);
    }

    public function test_product_page_shows_stock_per_branch_and_last_purchases()
    {
        $admin = $this->userWithRole('Administrador');
        $branch = $this->branch(['name' => 'Central']);
        $product = $this->product(1.0, ['name' => 'Febrax']);
        $supplier = Supplier::factory()->create(['name' => 'Droguería Inti']);
        $this->actingAs($admin)->post('/admin/purchases', [
            'branch_id' => $branch->id, 'supplier_id' => $supplier->id, 'invoice_number' => 'F-9', 'purchased_at' => today()->toDateString(),
            'items' => [['product_presentation_id' => $this->presentation($product, 100)->id, 'quantity' => 2, 'cost' => 40, 'batch_number' => 'L-1', 'expires_at' => today()->addYear()->toDateString()]],
        ]);

        $this->actingAs($admin)->get("/admin/products/{$product->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('admin/products/show')
                ->where('product.name', 'Febrax')
                ->where('product.registered_by', null)
                ->where('product.branch_stock.0.branch_id', $branch->id)
                ->where('product.branch_stock.0.stock', 200)
                ->where('purchases.0.supplier', 'Droguería Inti')
                ->where('purchases.0.invoice_number', 'F-9')
                ->where('purchases.0.quantity', 2)
                ->where('purchases.0.unit_cost', 0.4));
    }

    public function test_product_page_sends_monthly_sales_and_price_series_for_the_charts()
    {
        $branch = $this->branch();
        $product = $this->product(1.0, ['name' => 'Febrax']);
        $this->batch($product, $branch, 300, '+1 year', 0.4);
        $cashier = $this->userWithRole('Cajero', $branch);
        $this->openCash($cashier, $branch);
        // 5 tabletas a Bs 1 (costo Bs 0,40 c/u) y después sube el precio a Bs 1,20
        $this->actingAs($cashier)->post('/admin/sales', [
            'items' => [['product_presentation_id' => $this->presentation($product)->id, 'quantity' => 5]],
            'payments' => [['method' => 'efectivo', 'amount' => 10]],
        ])->assertRedirect();
        $this->presentation($product)->update(['sale_price' => 1.2]);

        $this->actingAs($this->userWithRole('Administrador'))->get("/admin/products/{$product->id}")
            ->assertInertia(fn ($page) => $page
                ->has('salesByMonth', 12)
                ->where('salesByMonth.11.month', now()->format('Y-m'))
                ->where('salesByMonth.11.units', 5)
                ->where('salesByMonth.11.amount', 5)
                ->where('salesByMonth.11.profit', 3)
                ->where('salesByMonth.11.sales', 1)
                ->where('salesByMonth.0.units', 0)
                ->has('priceSeries', 2)
                ->where('priceSeries.0.factor', 1)
                ->has('priceSeries.0.points', 2)
                ->where('priceSeries.0.points.0.price', 1)
                ->where('priceSeries.0.points.1.price', 1.2)
                ->where('priceSeries.1.factor', 100));
    }

    public function test_product_performance_shows_where_when_and_how_it_sells_and_what_could_expire()
    {
        $central = $this->branch(['name' => 'Central']);
        $north = $this->branch(['name' => 'Norte']);
        $product = $this->product(1.0, ['name' => 'Febrax']);
        $this->batch($product, $central, 4, '-5 days');
        $this->batch($product, $central, 20, '+10 days');
        $this->batch($product, $central, 300, '+100 days');
        $this->batch($product, $north, 50, '+30 days');
        $cashier = $this->userWithRole('Cajero', $central);
        $this->openCash($cashier, $central);
        // 7 tabletas en un producto creado hoy: el ritmo se mide sobre 7 días mínimo → 1 tableta por día
        $this->actingAs($cashier)->post('/admin/sales', [
            'items' => [['product_presentation_id' => $this->presentation($product)->id, 'quantity' => 7]],
            'payments' => [['method' => 'efectivo', 'amount' => 10]],
        ])->assertRedirect();

        $this->actingAs($this->userWithRole('Administrador'))->get("/admin/products/{$product->id}")
            ->assertInertia(fn ($page) => $page
                ->has('performance.daily', 60)
                ->where('performance.daily.59.date', today()->toDateString())
                ->where('performance.daily.59.units', 7)
                ->where('performance.dailyRate', 1)
                ->where('performance.branches.0.branch', 'Central')
                ->where('performance.branches.0.units', 7)
                ->where('performance.branches.0.stock', 317)
                ->where('performance.branches.1.branch', 'Norte')
                ->where('performance.branches.1.units', 0)
                ->where('performance.mix.0.factor', 1)
                ->where('performance.mix.0.quantity', 7)
                ->has('performance.hours', 1)
                ->where('performance.hours.0.day', now()->isoWeekday())
                ->where('performance.hours.0.units', 7)
                // Vencido: todo en riesgo. Vence en 10 días con 13 tabletas a 1 por día: se venden 10.
                // El de 100 días empieza a venderse cuando se acaba el anterior: 90 días → 90 tabletas.
                // Norte no vendió nada: no se puede estimar.
                ->where('performance.batches.0.units_at_risk', 4)
                ->where('performance.batches.1.quantity', 13)
                ->where('performance.batches.1.units_at_risk', 3)
                ->where('performance.batches.2.branch', 'Norte')
                ->where('performance.batches.2.units_at_risk', null)
                ->where('performance.batches.3.units_at_risk', 210)
                ->has('purchaseCosts', 0));
    }

    public function test_product_performance_can_be_seen_for_one_branch()
    {
        $central = $this->branch(['name' => 'Central']);
        $north = $this->branch(['name' => 'Norte']);
        $product = $this->product(1.0, ['name' => 'Febrax']);
        $this->batch($product, $central, 100);
        $this->batch($product, $north, 50);
        $cashier = $this->userWithRole('Cajero', $central);
        $this->openCash($cashier, $central);
        $this->actingAs($cashier)->post('/admin/sales', [
            'items' => [['product_presentation_id' => $this->presentation($product)->id, 'quantity' => 7]],
            'payments' => [['method' => 'efectivo', 'amount' => 10]],
        ])->assertRedirect();
        $admin = $this->userWithRole('Administrador');

        // Norte: sin sus ventas, solo sus lotes; la comparación con las demás sucursales sigue completa
        $this->actingAs($admin)->get("/admin/products/{$product->id}?branch={$north->id}")
            ->assertInertia(fn ($page) => $page
                ->where('branchFilter', $north->id)
                ->has('branchOptions', 2)
                ->where('salesByMonth.11.units', 0)
                ->where('performance.daily.59.units', 0)
                ->where('performance.dailyRate', 0)
                ->has('performance.hours', 0)
                ->has('performance.branches', 2)
                ->has('performance.batches', 1)
                ->where('performance.batches.0.branch', 'Norte'));

        // Una sucursal que no existe = todas
        $this->actingAs($admin)->get("/admin/products/{$product->id}?branch=999")
            ->assertInertia(fn ($page) => $page
                ->where('branchFilter', null)
                ->where('canSeeAllBranches', true)
                ->where('salesByMonth.11.units', 7)
                ->has('performance.batches', 2));
    }

    public function test_a_user_assigned_to_a_branch_sees_the_product_page_of_that_branch_only()
    {
        $central = $this->branch(['name' => 'Central']);
        $north = $this->branch(['name' => 'Norte']);
        $product = $this->product(1.0, ['name' => 'Febrax']);
        $supplier = Supplier::factory()->create();
        $admin = $this->userWithRole('Administrador');
        foreach ([$central, $north] as $branch) {
            $this->actingAs($admin)->post('/admin/purchases', [
                'branch_id' => $branch->id, 'supplier_id' => $supplier->id, 'purchased_at' => today()->toDateString(),
                'items' => [['product_presentation_id' => $this->presentation($product, 100)->id, 'quantity' => 1, 'cost' => 40, 'batch_number' => "L-{$branch->id}", 'expires_at' => today()->addYear()->toDateString()]],
            ]);
        }

        // Asignado a Norte: no tiene "Todas", y pedir otra sucursal no le muestra esa
        $this->actingAs($this->userWithRole('Administrador', $north))->get("/admin/products/{$product->id}?branch={$central->id}")
            ->assertInertia(fn ($page) => $page
                ->where('branchFilter', $north->id)
                ->where('canSeeAllBranches', false)
                ->has('branchOptions', 1)
                ->has('purchases', 1)
                ->where('purchases.0.branch', 'Norte')
                ->has('performance.branches', 1)
                ->where('performance.branches.0.branch', 'Norte')
                // El stock de cada sucursal se sigue viendo: sirve para saber dónde hay
                ->has('product.branch_stock', 2));

        // Sin sucursal asignada: las compras de todas
        $this->actingAs($admin)->get("/admin/products/{$product->id}")->assertInertia(fn ($page) => $page->has('purchases', 2));
    }

    public function test_price_changes_are_kept_in_the_price_history()
    {
        $admin = $this->userWithRole('Administrador');
        $save = fn (array $presentations, ?Product $product = null) => $product
            ? $this->actingAs($admin)->put("/admin/products/{$product->id}", ['name' => 'Febrax', 'base_unit' => 'Tableta', 'min_stock' => 0, 'presentations' => $presentations])
            : $this->actingAs($admin)->post('/admin/products', ['name' => 'Febrax', 'base_unit' => 'Tableta', 'min_stock' => 0, 'presentations' => $presentations]);

        $save([['sale_price' => 0.8, 'is_sellable' => true, 'is_purchasable' => true]]);
        $product = Product::firstOrFail();
        $unitId = $product->presentations()->first()->id;
        $save([['id' => $unitId, 'sale_price' => 0.8, 'is_sellable' => true, 'is_purchasable' => true]], $product);
        $save([['id' => $unitId, 'sale_price' => 1, 'is_sellable' => true, 'is_purchasable' => true]], $product);

        // Precio inicial + un cambio; guardar sin cambiar el precio no deja fila
        $this->assertSame(2, ProductPriceHistory::count());
        $this->assertDatabaseHas('product_price_histories', [
            'product_presentation_id' => $unitId, 'old_price' => 0.8, 'new_price' => 1, 'source' => 'edicion', 'registerUser_id' => $admin->id,
        ]);

        $this->actingAs($admin)->get("/admin/products/{$product->id}")
            ->assertInertia(fn ($page) => $page
                ->has('priceHistory', 2)
                ->where('priceHistory.0.old_price', 0.8)
                ->where('priceHistory.0.new_price', 1)
                ->where('priceHistory.0.user', $admin->name)
                ->where('priceHistory.1.old_price', null)
                ->where('priceHistory.1.source', 'creacion'));
    }

    public function test_product_list_shows_newest_first_with_stock_per_branch()
    {
        $branch = $this->branch(['name' => 'Central']);
        $older = $this->product(1.0, ['name' => 'Antiguo']);
        $newer = $this->product(1.0, ['name' => 'Nuevo']);
        $this->batch($older, $branch, 30, '+6 months');
        $this->batch($older, $branch, 20, '+1 year');

        $this->actingAs($this->userWithRole('Administrador'))->get('/admin/products')
            ->assertInertia(fn ($page) => $page
                ->where('products.data.0.id', $newer->id)
                ->where('products.data.1.id', $older->id)
                ->where('products.data.0.branch_stock', [])
                ->where('products.data.1.branch_stock.0.branch', 'Central')
                ->where('products.data.1.branch_stock.0.stock', 50)
                ->where('products.data.1.branch_stock.0.batches', 2)
                ->where('products.data.1.branch_stock.0.next_expiry', now()->addMonths(6)->toDateString()));
    }

    public function test_a_product_with_stock_cannot_be_deleted()
    {
        $product = $this->product();
        $this->batch($product, $this->branch(), 3);

        $this->actingAs($this->userWithRole('Administrador'))->delete("/admin/products/{$product->id}")->assertSessionHas('error');
        $this->assertNotSoftDeleted($product);
    }

    public function test_product_search_finds_by_generic_name_and_barcode()
    {
        $admin = $this->userWithRole('Administrador');
        $product = $this->product(1.0, ['name' => 'Febrax', 'generic_name' => 'Ibuprofeno', 'barcode' => '999111']);

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
            'presentations' => [['sale_price' => 0.5, 'is_sellable' => true, 'is_purchasable' => true]],
        ])->assertRedirect('/admin/products');

        $product = Product::with('indications')->firstOrFail();
        // El genérico se guarda con mayúscula inicial; los usos existentes se reutilizan sin duplicarse
        $this->assertSame('Paracetamol', $product->generic_name);
        $this->assertSame(['Dolor de cabeza', 'Fiebre'], $product->indications->pluck('name')->all());
        $this->assertSame(2, Indication::count());
        $this->assertSame('Alivia el dolor y baja la fiebre.', $product->description);

        // Un segundo producto con el mismo genérico (otras mayúsculas) queda escrito igual que el primero
        $this->actingAs($admin)->post('/admin/products', [
            'name' => 'Panadol', 'generic_name' => 'PARACETAMOL', 'base_unit' => 'tableta', 'min_stock' => 0,
            'presentations' => [['sale_price' => 0.6, 'is_sellable' => true, 'is_purchasable' => true]],
        ]);
        $this->assertSame(['Paracetamol'], Product::pluck('generic_name')->unique()->values()->all());

        // Al editar llegan el genérico, los usos como texto y los genéricos ya usados para sugerir
        $this->actingAs($admin)->get("/admin/products/{$product->id}/edit")
            ->assertInertia(fn ($page) => $page
                ->where('product.generic_name', 'Paracetamol')
                ->where('product.indication_names', ['Dolor de cabeza', 'Fiebre'])
                ->where('genericNames', ['Paracetamol'])
                ->has('indications', 2));

        // Quitar los usos al editar los desvincula
        $this->actingAs($admin)->put("/admin/products/{$product->id}", [
            'name' => 'Dolofen', 'generic_name' => '', 'base_unit' => 'tableta', 'min_stock' => 0, 'indications' => [],
            'presentations' => [['id' => $product->presentations()->first()->id, 'sale_price' => 0.5, 'is_sellable' => true, 'is_purchasable' => true]],
        ])->assertRedirect('/admin/products');
        $this->assertCount(0, $product->fresh()->indications);
        $this->assertNull($product->fresh()->generic_name);
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
