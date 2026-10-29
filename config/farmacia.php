<?php

/*
| CONFIGURACIÓN DE LA FARMACIA
| Valores del negocio que se pueden cambiar sin tocar código.
*/

return [

    // Moneda que se muestra en pantallas y tickets
    'currency' => 'Bs',

    // Formas de pago del punto de venta. "efectivo" es la única que entra al corte de billetes.
    'payment_methods' => [
        'efectivo' => 'Efectivo',
        'qr' => 'QR',
        'tarjeta' => 'Tarjeta',
        'transferencia' => 'Transferencia',
    ],

    // Días antes del vencimiento a partir de los cuales un lote aparece como "por vencer"
    'expiry_alert_days' => 90,

    // Si la diferencia del cierre de caja (faltante o sobrante) supera este monto,
    // el cierre queda "pendiente de revisión" hasta que alguien con caja.aprobar lo apruebe.
    'cash_difference_limit' => 10,

];
