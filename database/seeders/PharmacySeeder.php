<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\CashRegister;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Denomination;
use App\Models\Indication;
use App\Models\Laboratory;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\User;
use App\Services\CashService;
use App\Services\InventoryService;
use App\Services\PromotionService;
use App\Services\PurchaseService;
use App\Services\SaleService;
use App\Services\TransferService;
use App\Support\PermissionCatalog;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Auth;

/**
 * DATOS DE DEMOSTRACIÓN de la farmacia: sucursales, catálogo, compras con lotes (algunos por vencer y uno vencido),
 * promociones, una transferencia en camino, un turno de caja abierto con ventas, y usuarios de cada rol.
 * Lo llama DatabaseSeeder. Si ya hay sucursales no hace nada.
 *
 * Usuarios (contraseña: password): regente@farma360.test · cajero@farma360.test · almacenero@farma360.test
 */
class PharmacySeeder extends Seeder
{
    public function run(): void
    {
        if (Branch::exists()) {
            return;
        }

        // Todo queda registrado como hecho por el Super Admin (columnas registerUser_id / registerRole)
        $admin = User::whereHas('roles', fn ($q) => $q->where('name', PermissionCatalog::superAdmin()))->firstOrFail();
        Auth::setUser($admin);

        [$central, $norte, $almacen] = $this->branches();
        $users = $this->users($central, $almacen);
        $products = $this->catalog();
        $suppliers = $this->suppliersAndCustomers();

        $this->stock($central, $norte, $almacen, $products, $suppliers);
        app(PromotionService::class)->applySuggested($admin);

        // Transferencia del almacén a la sucursal Norte, todavía en camino
        $batch = $almacen->batches()->where('quantity', '>', 0)->first();
        app(TransferService::class)->send($almacen->id, $norte->id, [['batch_id' => $batch->id, 'quantity' => 100]], 'Reposición semanal');

        $this->sales($central, $users['cajero'], $products);

        Auth::forgetUser();
    }

    /** @return array{0: Branch, 1: Branch, 2: Branch} */
    private function branches(): array
    {
        $central = Branch::create(['code' => 'SUC-01', 'name' => 'Farmacia Central', 'address' => 'Av. 6 de Agosto #123', 'phone' => '34620000']);
        $norte = Branch::create(['code' => 'SUC-02', 'name' => 'Farmacia Norte', 'address' => 'Calle Cochabamba #45', 'phone' => '34621111']);
        $almacen = Branch::create(['code' => 'ALM-01', 'name' => 'Almacén Central', 'address' => 'Zona Industrial', 'is_warehouse' => true]);

        CashRegister::create(['branch_id' => $central->id, 'name' => 'Caja 1']);
        CashRegister::create(['branch_id' => $central->id, 'name' => 'Caja 2']);
        CashRegister::create(['branch_id' => $norte->id, 'name' => 'Caja 1']);

        return [$central, $norte, $almacen];
    }

    /** @return array<string, User> */
    private function users(Branch $central, Branch $almacen): array
    {
        $make = function (string $key, string $name, string $role, Branch $branch) {
            $user = User::firstOrCreate(
                ['email' => "{$key}@farma360.test"],
                ['name' => $name, 'password' => 'password', 'email_verified_at' => now(), 'branch_id' => $branch->id],
            );
            $user->syncRoles([$role]);

            return $user;
        };

        return [
            'regente' => $make('regente', 'Dra. Carla Méndez', 'Regente', $central),
            'cajero' => $make('cajero', 'Luis Rojas', 'Cajero', $central),
            'almacenero' => $make('almacenero', 'Pedro Suárez', 'Almacenero', $almacen),
        ];
    }

    /** @return array<string, Product> */
    private function catalog(): array
    {
        $categories = collect(['Analgésicos', 'Antibióticos', 'Antialérgicos', 'Gastrointestinales', 'Vitaminas', 'Respiratorios', 'Psicotrópicos'])
            ->mapWithKeys(fn ($name) => [$name => Category::create(['name' => $name])]);
        $labs = collect(['Laboratorios Andinos', 'Farmacéutica del Oriente', 'Genéricos Bolivia', 'Lab. Amazonía'])
            ->map(fn ($name) => Laboratory::create(['name' => $name, 'country' => 'Bolivia']));

        // Para qué sirve cada producto: [detalle, [usos / síntomas]] (se buscan en el catálogo y en el punto de venta)
        $uses = [
            'paracetamol' => ['Alivia el dolor leve a moderado y baja la fiebre.', ['Dolor de cabeza', 'Fiebre', 'Dolor muscular', 'Resfrío']],
            'paracetamol_gen' => ['Alivia el dolor leve a moderado y baja la fiebre.', ['Dolor de cabeza', 'Fiebre', 'Dolor muscular']],
            'ibuprofeno' => ['Antiinflamatorio: calma el dolor, la inflamación y baja la fiebre.', ['Dolor de cabeza', 'Dolor muscular', 'Inflamación', 'Fiebre', 'Dolor menstrual']],
            'diclofenaco' => ['Antiinflamatorio para dolores de articulaciones, golpes y espalda.', ['Dolor muscular', 'Inflamación', 'Dolor de espalda']],
            'amoxicilina' => ['Antibiótico para infecciones causadas por bacterias. Solo con receta.', ['Infección de garganta', 'Infección de oído', 'Infección urinaria']],
            'loratadina' => ['Antialérgico: alivia estornudos, picazón y ojos llorosos.', ['Alergia', 'Rinitis', 'Picazón']],
            'omeprazol' => ['Reduce el ácido del estómago.', ['Acidez', 'Gastritis', 'Reflujo']],
            'vitamina_c' => ['Refuerza las defensas.', ['Defensas bajas', 'Resfrío']],
            'salbutamol' => ['Abre los bronquios en crisis de asma.', ['Asma', 'Falta de aire']],
            'jarabe_tos' => ['Calma la tos seca.', ['Tos seca', 'Resfrío']],
            'clonazepam' => ['Ansiolítico. Medicamento controlado: venta con receta retenida.', ['Ansiedad', 'Insomnio']],
        ];

        // [clave, nombre comercial, nombre genérico, concentración, forma, categoría, unidad base, [presentación => [unidades, precio]], controlado]
        $rows = [
            ['paracetamol', 'Dolofen', 'Paracetamol', '500 mg', 'Tableta', 'Analgésicos', 'tableta', ['Unidad' => [1, 0.50], 'Blíster x10' => [10, 4.50], 'Caja x100' => [100, 40]], false],
            ['paracetamol_gen', 'Paracetamol genérico', 'Paracetamol', '500 mg', 'Tableta', 'Analgésicos', 'tableta', ['Unidad' => [1, 0.30], 'Caja x100' => [100, 25]], false],
            ['ibuprofeno', 'Ibufen', 'Ibuprofeno', '400 mg', 'Tableta', 'Analgésicos', 'tableta', ['Unidad' => [1, 0.80], 'Blíster x10' => [10, 7.50]], false],
            ['diclofenaco', 'Diclofen', 'Diclofenaco', '50 mg', 'Tableta', 'Analgésicos', 'tableta', ['Unidad' => [1, 0.60], 'Blíster x10' => [10, 5.50]], false],
            ['amoxicilina', 'Amoxil', 'Amoxicilina', '500 mg', 'Cápsula', 'Antibióticos', 'cápsula', ['Unidad' => [1, 1.50], 'Caja x21' => [21, 30]], false],
            ['loratadina', 'Alergin', 'Loratadina', '10 mg', 'Tableta', 'Antialérgicos', 'tableta', ['Unidad' => [1, 1.00], 'Caja x10' => [10, 9]], false],
            ['omeprazol', 'Gastrozol', 'Omeprazol', '20 mg', 'Cápsula', 'Gastrointestinales', 'cápsula', ['Unidad' => [1, 1.20], 'Caja x14' => [14, 15]], false],
            ['vitamina_c', 'Vitacé', 'Ácido ascórbico', '1 g', 'Tableta efervescente', 'Vitaminas', 'tableta', ['Unidad' => [1, 2.00], 'Tubo x10' => [10, 18]], false],
            ['salbutamol', 'Respirol', 'Salbutamol', '100 mcg/dosis', 'Inhalador', 'Respiratorios', 'inhalador', ['Unidad' => [1, 45]], false],
            ['jarabe_tos', 'Tosfin jarabe', 'Dextrometorfano', '15 mg/5 ml', 'Jarabe', 'Respiratorios', 'frasco', ['Frasco 120 ml' => [1, 28]], false],
            ['clonazepam', 'Calmazep', 'Clonazepam', '2 mg', 'Tableta', 'Psicotrópicos', 'tableta', ['Unidad' => [1, 2.50], 'Caja x30' => [30, 70]], true],
        ];

        $products = [];
        foreach ($rows as $i => [$key, $name, $active, $concentration, $form, $category, $unit, $presentations, $controlled]) {
            $product = Product::create([
                'name' => $name,
                'generic_name' => $active,
                'concentration' => $concentration,
                'pharmaceutical_form' => $form,
                'description' => $uses[$key][0],
                'laboratory_id' => $labs[$i % $labs->count()]->id,
                'category_id' => $categories[$category]->id,
                'barcode' => '7770000'.str_pad((string) ($i + 1), 6, '0', STR_PAD_LEFT),
                'base_unit' => $unit,
                'requires_prescription' => $controlled || $category === 'Antibióticos',
                'is_controlled' => $controlled,
                'min_stock' => $unit === 'tableta' || $unit === 'cápsula' ? 100 : 5,
            ]);
            foreach ($presentations as $presentation => [$factor, $price]) {
                $product->presentations()->create(['name' => $presentation, 'factor' => $factor, 'sale_price' => $price]);
            }
            $product->indications()->sync(Indication::idsFor($uses[$key][1]));
            $products[$key] = $product->load('presentations');
        }

        return $products;
    }

    /** @return list<Supplier> */
    private function suppliersAndCustomers(): array
    {
        $suppliers = [
            Supplier::create(['name' => 'Droguería Illimani', 'nit' => '1020304050', 'contact_name' => 'Marcela Quispe', 'phone' => '22445566']),
            Supplier::create(['name' => 'Distribuidora Oriente', 'nit' => '2030405060', 'contact_name' => 'Jorge Áñez', 'phone' => '33445566']),
            Supplier::create(['name' => 'Importadora Salud', 'nit' => '3040506070', 'contact_name' => 'Ana Vaca', 'phone' => '44556677']),
        ];

        foreach ([['Juan Pérez', '4567890'], ['María Gutiérrez', '5678901'], ['Clínica San José', '1023456789', 'NIT'], ['Rosa Mamani', '6789012']] as $c) {
            Customer::create(['name' => $c[0], 'document_number' => $c[1], 'document_type' => $c[2] ?? 'CI']);
        }

        return $suppliers;
    }

    /**
     * Compras con lotes de distintos vencimientos. Algunos quedan por vencer (para ver promociones)
     * y uno vencido (para ver la alerta y la baja).
     *
     * @param  array<string, Product>  $p
     * @param  list<Supplier>  $suppliers
     */
    private function stock(Branch $central, Branch $norte, Branch $almacen, array $p, array $suppliers): void
    {
        $purchases = app(PurchaseService::class);
        $line = fn (Product $product, string $presentation, int $qty, float $cost, string $batch, int $days) => [
            'product_presentation_id' => $product->presentations->firstWhere('name', $presentation)->id,
            'quantity' => $qty, 'cost' => $cost, 'batch_number' => $batch, 'expires_at' => today()->addDays($days)->toDateString(),
        ];

        $purchases->create([
            'branch_id' => $central->id, 'supplier_id' => $suppliers[0]->id, 'invoice_number' => 'F-1001', 'purchased_at' => today()->subDays(20)->toDateString(),
            'items' => [
                $line($p['paracetamol'], 'Caja x100', 3, 22, 'DOL-2401', 25),   // vence en 25 días → promo 30%
                $line($p['paracetamol'], 'Caja x100', 5, 22, 'DOL-2405', 400),
                $line($p['ibuprofeno'], 'Blíster x10', 30, 4, 'IBU-118', 55),   // promo 20%
                $line($p['amoxicilina'], 'Caja x21', 10, 18, 'AMX-77', 300),
                $line($p['loratadina'], 'Caja x10', 15, 5, 'LOR-09', 85),       // promo 10%
                $line($p['omeprazol'], 'Caja x14', 12, 8, 'OME-31', 500),
                $line($p['vitamina_c'], 'Tubo x10', 10, 10, 'VTC-5', 200),
                $line($p['salbutamol'], 'Unidad', 8, 30, 'SAL-2', 365),
                $line($p['jarabe_tos'], 'Frasco 120 ml', 12, 16, 'TOS-44', 150),
                $line($p['clonazepam'], 'Caja x30', 4, 40, 'CLZ-3', 600),
                $line($p['diclofenaco'], 'Blíster x10', 20, 3, 'DIC-12', 700),
                $line($p['paracetamol_gen'], 'Caja x100', 4, 12, 'PGN-1', 365),
            ],
        ]);

        $purchases->create([
            'branch_id' => $norte->id, 'supplier_id' => $suppliers[1]->id, 'invoice_number' => 'N-552', 'purchased_at' => today()->subDays(10)->toDateString(),
            'items' => [
                $line($p['paracetamol'], 'Caja x100', 2, 22, 'DOL-2405', 400),
                $line($p['ibuprofeno'], 'Blíster x10', 10, 4, 'IBU-130', 380),
                $line($p['loratadina'], 'Caja x10', 5, 5, 'LOR-12', 420),
            ],
        ]);

        $purchases->create([
            'branch_id' => $almacen->id, 'supplier_id' => $suppliers[2]->id, 'invoice_number' => 'IS-9001', 'purchased_at' => today()->subDays(5)->toDateString(),
            'items' => [
                $line($p['paracetamol'], 'Caja x100', 20, 21, 'DOL-2410', 540),
                $line($p['amoxicilina'], 'Caja x21', 40, 17, 'AMX-80', 480),
                $line($p['omeprazol'], 'Caja x14', 30, 7.5, 'OME-35', 520),
            ],
        ]);

        // Un lote vencido que quedó en la sucursal (aparece en alertas para darlo de baja)
        $inventory = app(InventoryService::class);
        $expired = $inventory->createBatch([
            'product_id' => $p['diclofenaco']->id, 'branch_id' => $central->id, 'batch_number' => 'DIC-OLD',
            'expires_at' => today()->subDays(10)->toDateString(), 'unit_cost' => 0.3,
        ]);
        $inventory->increase($expired, 30, 'ajuste_entrada', null, 'Inventario inicial');
    }

    /** @param  array<string, Product>  $p */
    private function sales(Branch $central, User $cashier, array $p): void
    {
        Auth::setUser($cashier);
        $register = CashRegister::where('branch_id', $central->id)->firstOrFail();
        $bill = fn (float $value) => Denomination::where('value', $value)->value('id');

        $session = app(CashService::class)->open($register, $cashier, [$bill(100) => 2, $bill(20) => 5, $bill(10) => 5, $bill(1) => 10]);

        $sell = fn (array $items, array $payments, array $extra = []) => app(SaleService::class)->create($session, $cashier, [
            'items' => collect($items)->map(fn ($i) => ['product_presentation_id' => $p[$i[0]]->presentations->firstWhere('name', $i[1])->id, 'quantity' => $i[2]])->all(),
            'payments' => $payments,
        ] + $extra);

        $sell([['paracetamol', 'Blíster x10', 2], ['vitamina_c', 'Tubo x10', 1]], [['method' => 'efectivo', 'amount' => 50]]);
        $sell([['ibuprofeno', 'Blíster x10', 1]], [['method' => 'qr', 'amount' => 6]]);
        $sell([['amoxicilina', 'Caja x21', 1], ['omeprazol', 'Unidad', 7]], [['method' => 'efectivo', 'amount' => 20], ['method' => 'tarjeta', 'amount' => 18.40]], ['customer_name' => 'Juan Pérez', 'customer_document' => '4567890']);
        $sell([['clonazepam', 'Unidad', 10]], [['method' => 'efectivo', 'amount' => 25]], ['prescription_number' => 'RC-5521', 'prescription_doctor' => 'Dr. Hugo Salazar']);

        app(CashService::class)->addMovement($session, 'egreso', 15, 'Pago de delivery');
    }
}
