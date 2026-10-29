<?php

/*
| CATÁLOGO DE ROLES Y PERMISOS
|
| Aquí se declaran los MÓDULOS del sistema y qué ACCIONES tiene cada uno.
| Cada combinación es un permiso: "usuarios.ver", "ventas.crear", "caja.operar"...
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
        'anular' => 'Anular',
        'ajustar' => 'Ajustar',
        'recibir' => 'Recibir',
        'operar' => 'Operar',
        'aprobar' => 'Aprobar',
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
        'sucursales' => [
            'label' => 'Sucursales',
            'description' => 'Farmacias y almacenes de la empresa.',
            'actions' => ['ver', 'crear', 'editar', 'eliminar'],
        ],
        'productos' => [
            'label' => 'Productos',
            'description' => 'Catálogo: productos, presentaciones, categorías, laboratorios y usos.',
            'actions' => ['ver', 'crear', 'editar', 'eliminar'],
        ],
        'proveedores' => [
            'label' => 'Proveedores',
            'description' => 'Distribuidoras y laboratorios a los que se compra.',
            'actions' => ['ver', 'crear', 'editar', 'eliminar'],
        ],
        'clientes' => [
            'label' => 'Clientes',
            'description' => 'Datos de facturación de los clientes.',
            'actions' => ['ver', 'crear', 'editar', 'eliminar'],
        ],
        'compras' => [
            'label' => 'Compras',
            'description' => 'Ingreso de mercadería con lote y vencimiento.',
            'actions' => ['ver', 'crear', 'anular'],
        ],
        'inventario' => [
            'label' => 'Inventario',
            'description' => 'Stock por lote, kardex. Ajustar = inventario inicial, correcciones y bajas.',
            'actions' => ['ver', 'ajustar'],
        ],
        'transferencias' => [
            'label' => 'Transferencias',
            'description' => 'Envío de mercadería entre sucursales.',
            'actions' => ['ver', 'crear', 'recibir', 'anular'],
        ],
        'promociones' => [
            'label' => 'Promociones por vencimiento',
            'description' => 'Descuentos a lotes por vencer. Aprobar = permitir precios por debajo del costo.',
            'actions' => ['ver', 'crear', 'aprobar'],
        ],
        'ventas' => [
            'label' => 'Ventas',
            'description' => 'Punto de venta. Crear necesita una caja abierta.',
            'actions' => ['ver', 'crear', 'anular'],
        ],
        'caja' => [
            'label' => 'Caja',
            'description' => 'Operar = abrir, movimientos y cerrar. Aprobar = revisar diferencias. Editar = cajas y billetes.',
            'actions' => ['ver', 'operar', 'aprobar', 'editar'],
        ],
        'reportes' => [
            'label' => 'Reportes',
            'description' => 'Ventas, ganancias, inventario valorizado y vencimientos.',
            'actions' => ['ver'],
        ],
    ],

    // Roles que se crean la primera vez (php artisan permissions:sync). Después se editan desde el panel.
    // '*' = todos los permisos.
    'defaults' => [
        'Administrador' => ['*'],
        'Supervisor' => ['usuarios.ver'],
        'Operador' => [],
        'Regente' => [
            'productos.ver', 'productos.crear', 'productos.editar',
            'proveedores.ver', 'clientes.ver',
            'compras.ver', 'compras.crear',
            'inventario.ver', 'inventario.ajustar',
            'transferencias.ver', 'transferencias.crear', 'transferencias.recibir',
            'promociones.ver', 'promociones.crear',
            'ventas.ver', 'reportes.ver',
        ],
        'Cajero' => [
            'productos.ver', 'clientes.ver', 'clientes.crear',
            'ventas.ver', 'ventas.crear',
            'caja.ver', 'caja.operar',
        ],
        'Almacenero' => [
            'productos.ver', 'proveedores.ver',
            'compras.ver', 'compras.crear',
            'inventario.ver', 'inventario.ajustar',
            'transferencias.ver', 'transferencias.crear', 'transferencias.recibir',
        ],
    ],

];
