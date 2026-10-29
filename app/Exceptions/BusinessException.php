<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Una regla del negocio impide la operación (ej: "Stock insuficiente", "La caja está cerrada").
 * El mensaje es para el usuario: bootstrap/app.php lo muestra como aviso rojo y vuelve a la pantalla anterior.
 * Si ocurre dentro de DB::transaction(), todo lo que se hizo se deshace.
 */
class BusinessException extends RuntimeException {}
