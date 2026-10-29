<?php

use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\RoleController;
use App\Http\Controllers\Admin\Settings\PasswordController;
use App\Http\Controllers\Admin\Settings\ProfileController;
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
    });
});
