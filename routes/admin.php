<?php

use App\Http\Controllers\Admin\BranchController;
use App\Http\Controllers\Admin\CashController;
use App\Http\Controllers\Admin\CashRegisterController;
use App\Http\Controllers\Admin\CategoryController;
use App\Http\Controllers\Admin\CustomerController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\DenominationController;
use App\Http\Controllers\Admin\IndicationController;
use App\Http\Controllers\Admin\InventoryController;
use App\Http\Controllers\Admin\LaboratoryController;
use App\Http\Controllers\Admin\ProductController;
use App\Http\Controllers\Admin\PromotionController;
use App\Http\Controllers\Admin\PurchaseController;
use App\Http\Controllers\Admin\ReportController;
use App\Http\Controllers\Admin\RoleController;
use App\Http\Controllers\Admin\SaleController;
use App\Http\Controllers\Admin\Settings\PasswordController;
use App\Http\Controllers\Admin\Settings\ProfileController;
use App\Http\Controllers\Admin\SupplierController;
use App\Http\Controllers\Admin\TransferController;
use App\Http\Controllers\Admin\UserController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
| RUTAS DEL PANEL ADMIN
| Todo lo que está aquí requiere haber iniciado sesión ('auth').
| Controladores: app/Http/Controllers/Admin   ·   Páginas: resources/js/pages/admin
*/

Route::middleware('auth')->group(function () {
    // /dashboard → DashboardController (calcula las métricas) → pages/admin/dashboard.tsx
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    // Mis ajustes (cada usuario): perfil, contraseña y apariencia
    Route::redirect('settings', 'settings/profile');
    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::get('settings/password', [PasswordController::class, 'edit'])->name('password.edit');
    Route::put('settings/password', [PasswordController::class, 'update'])->name('password.update');
    Route::get('settings/appearance', fn () => Inertia::render('admin/settings/appearance'))->name('appearance');

    // Gestión del sistema. Cada ruta pide un PERMISO del catálogo (config/roles.php):
    //   ->middleware('can:usuarios.ver') → si el rol no lo tiene, se muestra la página 403.
    //   El Super Admin pasa siempre (AppServiceProvider → Gate::before).
    //   prefix('admin') → las URLs empiezan con /admin   ·   name('admin.') → route('admin.users.index')
    Route::prefix('admin')->name('admin.')->group(function () {
        // Usuarios: listado con búsqueda, filtros, orden y paginación
        Route::get('users', [UserController::class, 'index'])->name('users.index')->middleware('can:usuarios.ver');
        Route::post('users', [UserController::class, 'store'])->name('users.store')->middleware('can:usuarios.crear');
        // {user} = id; Laravel busca el usuario solo (route model binding)
        Route::put('users/{user}', [UserController::class, 'update'])->name('users.update')->middleware('can:usuarios.editar');
        // Activar / desactivar cuenta (usa el permiso de editar)
        Route::patch('users/{user}/toggle', [UserController::class, 'toggle'])->name('users.toggle')->middleware('can:usuarios.editar');
        Route::delete('users/{user}', [UserController::class, 'destroy'])->name('users.destroy')->middleware('can:usuarios.eliminar');

        // Roles y permisos
        Route::get('roles', [RoleController::class, 'index'])->name('roles.index')->middleware('can:roles.ver');
        Route::get('roles/create', [RoleController::class, 'create'])->name('roles.create')->middleware('can:roles.crear');
        Route::post('roles', [RoleController::class, 'store'])->name('roles.store')->middleware('can:roles.crear');
        Route::get('roles/{role}/edit', [RoleController::class, 'edit'])->name('roles.edit')->middleware('can:roles.editar');
        Route::put('roles/{role}', [RoleController::class, 'update'])->name('roles.update')->middleware('can:roles.editar');
        Route::delete('roles/{role}', [RoleController::class, 'destroy'])->name('roles.destroy')->middleware('can:roles.eliminar');

        // ─── FARMACIA ───────────────────────────────────────────────────────────────

        // Catálogos simples (misma pantalla genérica: pages/admin/resources/index.tsx).
        // Cada uno: index (modulo.ver) · store (modulo.crear) · update (modulo.editar) · destroy (modulo.eliminar)
        $resources = [
            'branches' => [BranchController::class, 'sucursales'],
            'suppliers' => [SupplierController::class, 'proveedores'],
            'customers' => [CustomerController::class, 'clientes'],
            'categories' => [CategoryController::class, 'productos'],
            'laboratories' => [LaboratoryController::class, 'productos'],
            'indications' => [IndicationController::class, 'productos'],
            'cash-registers' => [CashRegisterController::class, 'caja'],
            'denominations' => [DenominationController::class, 'caja'],
        ];
        foreach ($resources as $uri => [$controller, $module]) {
            // cajas y billetes se configuran con caja.editar (caja no tiene crear / eliminar)
            [$create, $edit, $delete] = $module === 'caja' ? ['editar', 'editar', 'editar'] : ['crear', 'editar', 'eliminar'];
            Route::get($uri, [$controller, 'index'])->name("{$uri}.index")->middleware($module === 'caja' ? 'can:caja.editar' : "can:{$module}.ver");
            Route::post($uri, [$controller, 'store'])->name("{$uri}.store")->middleware("can:{$module}.{$create}");
            Route::put("{$uri}/{id}", [$controller, 'update'])->name("{$uri}.update")->middleware("can:{$module}.{$edit}")->whereNumber('id');
            Route::delete("{$uri}/{id}", [$controller, 'destroy'])->name("{$uri}.destroy")->middleware("can:{$module}.{$delete}")->whereNumber('id');
        }
        Route::get('customers/search', [CustomerController::class, 'search'])->name('customers.search')->middleware('can:ventas.crear');

        // Productos
        Route::get('products/search', [ProductController::class, 'lookup'])->name('products.search')->middleware('can:productos.ver');
        Route::get('products', [ProductController::class, 'index'])->name('products.index')->middleware('can:productos.ver');
        Route::get('products/create', [ProductController::class, 'create'])->name('products.create')->middleware('can:productos.crear');
        Route::post('products', [ProductController::class, 'store'])->name('products.store')->middleware('can:productos.crear');
        Route::get('products/{product}/edit', [ProductController::class, 'edit'])->name('products.edit')->middleware('can:productos.editar');
        Route::put('products/{product}', [ProductController::class, 'update'])->name('products.update')->middleware('can:productos.editar');
        Route::delete('products/{product}', [ProductController::class, 'destroy'])->name('products.destroy')->middleware('can:productos.eliminar');

        // Compras
        Route::get('purchases', [PurchaseController::class, 'index'])->name('purchases.index')->middleware('can:compras.ver');
        Route::get('purchases/create', [PurchaseController::class, 'create'])->name('purchases.create')->middleware('can:compras.crear');
        Route::post('purchases', [PurchaseController::class, 'store'])->name('purchases.store')->middleware('can:compras.crear');
        Route::get('purchases/{purchase}', [PurchaseController::class, 'show'])->name('purchases.show')->middleware('can:compras.ver');
        Route::post('purchases/{purchase}/cancel', [PurchaseController::class, 'cancel'])->name('purchases.cancel')->middleware('can:compras.anular');

        // Inventario
        Route::get('inventory', [InventoryController::class, 'index'])->name('inventory.index')->middleware('can:inventario.ver');
        Route::get('inventory/batches', [InventoryController::class, 'batches'])->name('inventory.batches')->middleware('can:transferencias.crear');
        Route::post('inventory/adjust', [InventoryController::class, 'adjust'])->name('inventory.adjust')->middleware('can:inventario.ajustar');
        Route::get('inventory/{product}', [InventoryController::class, 'show'])->name('inventory.show')->middleware('can:inventario.ver');

        // Transferencias
        Route::get('transfers', [TransferController::class, 'index'])->name('transfers.index')->middleware('can:transferencias.ver');
        Route::get('transfers/create', [TransferController::class, 'create'])->name('transfers.create')->middleware('can:transferencias.crear');
        Route::post('transfers', [TransferController::class, 'store'])->name('transfers.store')->middleware('can:transferencias.crear');
        Route::get('transfers/{transfer}', [TransferController::class, 'show'])->name('transfers.show')->middleware('can:transferencias.ver');
        Route::post('transfers/{transfer}/receive', [TransferController::class, 'receive'])->name('transfers.receive')->middleware('can:transferencias.recibir');
        Route::post('transfers/{transfer}/cancel', [TransferController::class, 'cancel'])->name('transfers.cancel')->middleware('can:transferencias.anular');

        // Promociones por vencimiento
        Route::get('promotions', [PromotionController::class, 'index'])->name('promotions.index')->middleware('can:promociones.ver');
        Route::post('promotions/apply', [PromotionController::class, 'apply'])->name('promotions.apply')->middleware('can:promociones.crear');
        Route::post('promotions/apply-suggested', [PromotionController::class, 'applySuggested'])->name('promotions.apply-suggested')->middleware('can:promociones.crear');
        Route::put('promotions/rules', [PromotionController::class, 'rules'])->name('promotions.rules')->middleware('can:promociones.crear');
        Route::delete('promotions/{batch}', [PromotionController::class, 'remove'])->name('promotions.remove')->middleware('can:promociones.crear')->whereNumber('batch');

        // Caja
        Route::get('cash', [CashController::class, 'index'])->name('cash.index')->middleware('can:caja.ver');
        Route::post('cash/open', [CashController::class, 'open'])->name('cash.open')->middleware('can:caja.operar');
        Route::post('cash/movement', [CashController::class, 'movement'])->name('cash.movement')->middleware('can:caja.operar');
        Route::post('cash/close', [CashController::class, 'close'])->name('cash.close')->middleware('can:caja.operar');
        Route::get('cash/sessions', [CashController::class, 'sessions'])->name('cash.sessions.index')->middleware('can:caja.ver');
        Route::get('cash/sessions/{session}', [CashController::class, 'show'])->name('cash.sessions.show')->middleware('can:caja.ver');
        Route::post('cash/sessions/{session}/approve', [CashController::class, 'approve'])->name('cash.sessions.approve')->middleware('can:caja.aprobar');

        // Ventas y punto de venta
        Route::get('pos', [SaleController::class, 'pos'])->name('pos')->middleware('can:ventas.crear');
        Route::get('pos/search', [SaleController::class, 'search'])->name('pos.search')->middleware('can:ventas.crear');
        Route::get('sales', [SaleController::class, 'index'])->name('sales.index')->middleware('can:ventas.ver');
        Route::post('sales', [SaleController::class, 'store'])->name('sales.store')->middleware('can:ventas.crear');
        Route::get('sales/{sale}', [SaleController::class, 'show'])->name('sales.show')->middleware('can:ventas.ver');
        Route::post('sales/{sale}/cancel', [SaleController::class, 'cancel'])->name('sales.cancel')->middleware('can:ventas.anular');

        // Reportes
        Route::get('reports', ReportController::class)->name('reports.index')->middleware('can:reportes.ver');
    });
});
