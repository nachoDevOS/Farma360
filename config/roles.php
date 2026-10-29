<?php

/*
| CATÁLOGO DE ROLES Y PERMISOS
|
| Aquí se declaran los MÓDULOS del sistema y qué ACCIONES tiene cada uno.
| Cada combinación es un permiso: "usuarios.ver", "usuarios.crear", "auditoria.ver"...
|
| Al agregar un módulo nuevo (ej: ventas):
|   1. Súmalo en 'modules' con sus acciones.
|   2. Corre:  php artisan permissions:sync
|   3. En Administración → Roles marca qué roles lo pueden usar.
|   4. Protege sus rutas con ->middleware('can:ventas.ver') (ver routes/admin.php).
*/

return [

    // Rol con TODOS los permisos siempre (no se puede editar ni eliminar). Ver AppServiceProvider (Gate::before).
    'super_admin' => 'Super Admin',

    // Rol que recibe quien se registra solo desde /register
    'default_role' => 'Operador',

    // Nombre en pantalla de cada acción (columnas de la tabla de permisos)
    'actions' => [
        'ver' => 'Ver',
        'crear' => 'Crear',
        'editar' => 'Editar',
        'eliminar' => 'Eliminar',
        // Si un módulo nuevo necesita otra acción (ej: 'exportar' => 'Exportar'), agrégala aquí
    ],

    // Módulos del sistema (filas de la tabla de permisos)
    'modules' => [
        'usuarios' => [
            'label' => 'Usuarios',
            'description' => 'Cuentas del sistema. Editar incluye activar y desactivar.',
            'actions' => ['ver', 'crear', 'editar', 'eliminar'],
        ],
        'roles' => [
            'label' => 'Roles y permisos',
            'description' => 'Qué puede hacer cada rol.',
            'actions' => ['ver', 'crear', 'editar', 'eliminar'],
        ],
        'auditoria' => [
            'label' => 'Auditoría',
            'description' => 'Historial de accesos y cambios.',
            'actions' => ['ver'],
        ],
    ],

    // Roles que se crean la primera vez (php artisan permissions:sync). Después se editan desde el panel.
    // '*' = todos los permisos.
    'defaults' => [
        'Administrador' => ['*'],
        'Supervisor' => ['usuarios.ver', 'auditoria.ver'],
        'Operador' => [],
    ],

];
