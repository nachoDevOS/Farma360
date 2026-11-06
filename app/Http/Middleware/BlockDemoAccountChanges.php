<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** La cuenta de demostración la comparten todos los visitantes: nadie puede cambiarle el perfil ni la contraseña. */
class BlockDemoAccountChanges
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->email === config('demo.user_email')) {
            return back()->with('info', 'En la demostración no se puede cambiar la cuenta.');
        }

        return $next($request);
    }
}
