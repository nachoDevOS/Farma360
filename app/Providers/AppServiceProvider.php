<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
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
        $this->registerAuditableColumns();

        // SUPER ADMIN: tiene TODOS los permisos del catálogo sin necesidad de marcarlos.
        // Gate::before se ejecuta antes que cualquier otra revisión:
        //   true = permitido · null = "sigue revisando normal".
        // Solo aplica a permisos del catálogo (los que tienen punto, ej: "usuarios.eliminar").
        // Las reglas de las Policies (ej: "no puedes eliminarte a ti mismo") se revisan siempre, también para él.
        Gate::before(fn (User $user, string $ability) => $user->isSuperAdmin() && str_contains($ability, '.') ? true : null);
    }

    /**
     * REGLA DEL SISTEMA: toda tabla nueva lleva las columnas de auditoría y borrado lógico.
     * En la migración:   $table->auditable();       (al crear la tabla)
     *                    $table->dropAuditable();   (en el down() de una migración que las agregó)
     * El modelo debe usar el trait App\Models\Concerns\Auditable, que las llena solo.
     */
    private function registerAuditableColumns(): void
    {
        Blueprint::macro('auditable', function () {
            /** @var Blueprint $this */
            // Sin onDelete: la base de datos impide borrar físicamente a un usuario que registró o eliminó datos
            $this->foreignId('registerUser_id')->nullable()->constrained('users');
            $this->string('registerRole')->nullable();
            $this->foreignId('deleteUser_id')->nullable()->constrained('users');
            $this->string('deleteRole')->nullable();
            $this->softDeletes();
        });

        Blueprint::macro('dropAuditable', function () {
            /** @var Blueprint $this */
            $this->dropConstrainedForeignId('registerUser_id');
            $this->dropConstrainedForeignId('deleteUser_id');
            $this->dropColumn(['registerRole', 'deleteRole']);
            $this->dropSoftDeletes();
        });
    }
}
