<?php

use App\Http\Controllers\Public\DemoController;
use App\Http\Controllers\Public\HomeController;
use Illuminate\Support\Facades\Route;

/*
| RUTAS DEL SITIO PÚBLICO (sin iniciar sesión)
| Controladores: app/Http/Controllers/Public   ·   Páginas: resources/js/pages/public
*/
Route::get('/', [HomeController::class, 'index'])->name('home');
Route::post('demo', [DemoController::class, 'store'])->name('demo.login')->middleware('throttle:10,1');

// Panel admin (dashboard, usuarios, roles, ajustes) y autenticación (login, registro…)
require __DIR__.'/admin.php';
require __DIR__.'/auth.php';
