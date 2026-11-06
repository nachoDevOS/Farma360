<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/** Botón "Probar sistema": entra con la cuenta de demostración, sin contraseña. Solo existe con DEMO_MODE=true. */
class DemoController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        abort_unless(config('demo.enabled'), 404);

        $demoUser = User::where('email', config('demo.user_email'))->firstOrFail();

        Auth::login($demoUser);
        $request->session()->regenerate();

        return to_route('admin.pos');
    }
}
