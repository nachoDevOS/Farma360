<?php

namespace App\Providers;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Logout;
use Illuminate\Auth\Events\Registered;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // SUPER ADMIN: tiene TODOS los permisos del catálogo sin necesidad de marcarlos.
        // Gate::before se ejecuta antes que cualquier otra revisión:
        //   true = permitido · null = "sigue revisando normal".
        // Solo aplica a permisos del catálogo (los que tienen punto, ej: "usuarios.eliminar").
        // Las reglas de las Policies (ej: "no puedes eliminarte a ti mismo") se revisan siempre, también para él.
        Gate::before(fn (User $user, string $ability) => $user->isSuperAdmin() && str_contains($ability, '.') ? true : null);

        // AUDITORÍA de accesos: Laravel dispara estos "eventos" solo; aquí los escuchamos y los guardamos.
        // (El inicio de sesión exitoso se registra en LoginRequest, después de revisar que la cuenta esté activa.)
        Event::listen(Failed::class, function (Failed $event) {
            ActivityLog::record('auth.failed', 'Intento de inicio de sesión fallido ('.($event->credentials['email'] ?? '?').')', causer: $event->user);
        });

        Event::listen(Logout::class, function (Logout $event) {
            if ($event->user instanceof User) {
                ActivityLog::record('auth.logout', 'Cerró sesión', causer: $event->user);
            }
        });

        Event::listen(Registered::class, function (Registered $event) {
            if ($event->user instanceof User) {
                ActivityLog::record('auth.registered', 'Se registró en el sistema', $event->user, causer: $event->user);
            }
        });
    }
}
