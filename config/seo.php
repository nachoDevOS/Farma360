<?php

/*
| SEO Y VISTA PREVIA AL COMPARTIR
| Lo leen Google, WhatsApp, Facebook y demás en el HTML que manda el servidor (resources/views/partials/seo.blade.php).
| Esos robots no ejecutan React: lo que se ponga con <Head> en las páginas no les llega.
|
| image: imagen de 1200x630. Cambiarla si cambia el nombre del sistema.
| indexable_routes: rutas que pueden aparecer en Google. Las demás llevan noindex.
*/

return [

    'name' => 'SIVEFARMA',

    // Título de Google y de la vista previa: hasta unos 60 caracteres
    'title' => 'SIVEFARMA | Sistema de Inventario y Ventas de Farmacia',

    // Descripción de Google y de la vista previa: hasta unos 160 caracteres
    'description' => 'Sistema de gestión para farmacias: punto de venta, caja, inventario por lotes, compras, transferencias entre sucursales y reportes.',

    'image' => 'images/og-image.jpg',

    'image_alt' => 'SIVEFARMA: logo y nombre del sistema',

    // Color de la barra del navegador en el celular
    'theme_color' => '#0B1B33',

    'locale' => 'es_BO',

    'indexable_routes' => ['home', 'login'],

];
