<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Spatie\Permission\Models\Permission as SpatiePermission;

/**
 * Permiso del sistema (tabla "permissions"). Es el modelo de spatie/laravel-permission con la regla de
 * borrado lógico y auditoría del sistema (trait Auditable). Registrado en config/permission.php.
 */
class Permission extends SpatiePermission
{
    use Auditable;
}
