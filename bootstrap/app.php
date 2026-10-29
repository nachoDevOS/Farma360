<?php

use App\Exceptions\BusinessException;
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // REGLAS DEL NEGOCIO (stock insuficiente, caja cerrada…): volver atrás con el aviso rojo.
        // No se escriben en el log: no son errores del sistema, son avisos para el usuario.
        $exceptions->dontReport(BusinessException::class);
        $exceptions->render(function (BusinessException $exception, Request $request) {
            if (! $request->expectsJson()) {
                return back()->with('error', $exception->getMessage());
            }
        });

        // PÁGINAS DE ERROR con el diseño del panel (resources/js/pages/error.tsx).
        $exceptions->respond(function (Response $response, Throwable $exception, Request $request) {
            $status = $response->getStatusCode();

            // 419 = la sesión expiró (formulario abierto mucho tiempo): volvemos atrás con un aviso
            if ($status === 419) {
                return back()->with('error', 'Tu sesión expiró. Vuelve a intentarlo.');
            }

            // 403 y 404 siempre con diseño. 500 y 503 solo en producción:
            // en local preferimos la pantalla de Laravel con el detalle del error para poder arreglarlo.
            $styled = in_array($status, [403, 404]) || (in_array($status, [500, 503]) && ! app()->hasDebugModeEnabled());

            if ($styled && ! $request->expectsJson()) {
                return Inertia::render('error', ['status' => $status])
                    ->toResponse($request)
                    ->setStatusCode($status);
            }

            return $response;
        });
    })->create();
