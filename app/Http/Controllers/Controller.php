<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

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

    /**
     * PAGINACIÓN DEL LADO DEL SERVIDOR para una lista que ya está en memoria (calculada en PHP, no una consulta).
     * Devuelve lo mismo que ->paginate(): el navegador recibe solo la página pedida y usa <Pagination />.
     * $pageName sirve cuando hay dos tablas en la misma pantalla (?candidates_page=2&active_page=1).
     * Uso: $this->paginateCollection($items, $request)
     *
     * @template T
     *
     * @param  Collection<int, T>  $items
     * @return LengthAwarePaginator<int, T>
     */
    protected function paginateCollection(Collection $items, Request $request, string $pageName = 'page'): LengthAwarePaginator
    {
        $perPage = $this->perPage($request);
        $page = max(1, (int) $request->input($pageName, 1));

        return (new LengthAwarePaginator($items->forPage($page, $perPage)->values(), $items->count(), $perPage, $page, [
            'path' => $request->url(),
            'pageName' => $pageName,
        ]))->withQueryString();
    }
}
