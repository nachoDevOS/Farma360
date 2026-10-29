<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

abstract class Controller
{
    /** Opciones del selector "Mostrar N registros" (deben coincidir con PER_PAGE_OPTIONS en table-toolbar.tsx). */
    protected const PER_PAGE_OPTIONS = [10, 15, 25, 50, 100];

    /**
     * Cuántos registros por página pidió el usuario (?per_page=25).
     * Solo acepta los valores de la lista: así nadie puede pedir ?per_page=100000 y trabar el servidor.
     * Uso: $query->paginate($this->perPage($request))
     */
    protected function perPage(Request $request, int $default = 10): int
    {
        $value = (int) $request->input('per_page', $default);

        return in_array($value, self::PER_PAGE_OPTIONS, true) ? $value : $default;
    }
}
