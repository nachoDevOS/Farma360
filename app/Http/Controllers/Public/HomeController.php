<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Página pública de SIVEFARMA. Quien ya inició sesión va directo a su panel. */
class HomeController extends Controller
{
    public function index(Request $request): Response|RedirectResponse
    {
        if ($request->user()) {
            return redirect('/dashboard');
        }

        return Inertia::render('public/home', [
            'demoEnabled' => config('demo.enabled'),
            'whatsappUrl' => $this->whatsappUrl(),
            'phone' => config('demo.phone'),
            'testimonials' => config('demo.testimonials'),
        ]);
    }

    private function whatsappUrl(): ?string
    {
        $number = config('demo.whatsapp');

        return $number ? 'https://wa.me/'.$number.'?'.http_build_query(['text' => config('demo.whatsapp_message')]) : null;
    }
}
