<?php

/*
| SITIO PÚBLICO Y MODO DEMO
| El modo demo es para un despliegue aparte, con su propia base de datos. Nada se borra: lo que hagan los visitantes queda guardado.
| Nunca actives DEMO_MODE en la base de un cliente: el botón "Probar sistema" entra sin contraseña.
*/
return [

    'enabled' => (bool) env('DEMO_MODE', false),

    'user_email' => 'demo@sivefarma.test',

    // WhatsApp de ventas, solo dígitos y con código de país (ej: 59170000000). Vacío = no se muestra el botón.
    'whatsapp' => env('SIVEFARMA_WHATSAPP'),

    // Teléfono como se muestra en la página (ej: +591 70000000). Vacío = no se muestra.
    'phone' => env('SIVEFARMA_PHONE'),

    'whatsapp_message' => 'Hola, quiero más información sobre SIVEFARMA.',

    // Opiniones de clientes REALES, con su permiso. Vacío = la sección no se muestra.
    // Ej: ['quote' => 'Lo que dijo', 'name' => 'Nombre', 'pharmacy' => 'Farmacia, ciudad']
    'testimonials' => [],

];
