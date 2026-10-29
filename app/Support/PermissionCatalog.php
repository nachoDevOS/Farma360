<?php

namespace App\Support;

/**
 * Lee el catálogo de permisos de config/roles.php.
 * Un solo lugar para saber qué permisos existen: lo usan el comando permissions:sync,
 * la pantalla de Roles y la validación al guardar un rol.
 */
class PermissionCatalog
{
    /**
     * Todos los permisos: ['usuarios.ver', 'usuarios.crear', ..., 'auditoria.ver'].
     *
     * @return list<string>
     */
    public static function all(): array
    {
        return collect(config('roles.modules'))
            ->flatMap(fn (array $module, string $key) => collect($module['actions'])->map(fn (string $action) => "{$key}.{$action}"))
            ->values()
            ->all();
    }

    /**
     * Estructura para la tabla de casillas de la pantalla de Roles (React).
     *
     * @return array{actions: array<string, string>, modules: list<array{key: string, label: string, description: string, actions: list<string>}>}
     */
    public static function matrix(): array
    {
        return [
            'actions' => config('roles.actions'),
            'modules' => collect(config('roles.modules'))
                ->map(fn (array $module, string $key) => [
                    'key' => $key,
                    'label' => $module['label'],
                    'description' => $module['description'] ?? '',
                    'actions' => $module['actions'],
                ])
                ->values()
                ->all(),
        ];
    }

    /** Nombre del rol con acceso total (config/roles.php → super_admin). */
    public static function superAdmin(): string
    {
        return config('roles.super_admin');
    }
}
