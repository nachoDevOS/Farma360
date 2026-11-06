<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// La demo se reinicia sola cada hora. En cualquier otro sistema, con DEMO_MODE=false, esta tarea no corre.
Schedule::command('demo:reset')->hourly()->when(fn () => config('demo.enabled'));
