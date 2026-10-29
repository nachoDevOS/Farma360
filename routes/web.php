<?php

use Illuminate\Support\Facades\Route;

/*
| RUTAS DEL SITIO PÚBLICO (sin iniciar sesión)
| Cuando se implemente la parte pública, sus rutas van aquí:
|   Controladores: app/Http/Controllers/Public   ·   Páginas: resources/js/pages/public
|   Ej: Route::get('/', [HomeController::class, 'index'])->name('home');
|
| Por ahora la raíz manda al panel (y si no iniciaste sesión, Laravel te manda al login).
*/
Route::redirect('/', '/dashboard')->name('home');

// Panel admin (dashboard, usuarios, roles, ajustes) y autenticación (login, registro…)
require __DIR__.'/admin.php';
require __DIR__.'/auth.php';
