<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Spatie\Permission\Models\Role as SpatieRole;

/**
 * Rol del sistema (tabla "roles"). Es el modelo de spatie/laravel-permission con la regla de
 * borrado lógico y auditoría del sistema (trait Auditable). Registrado en config/permission.php.
 */
class Role extends SpatieRole
{
    use Auditable;
}
