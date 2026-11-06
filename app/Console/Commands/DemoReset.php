<?php

namespace App\Console\Commands;

use Database\Seeders\DemoSeeder;
use Illuminate\Console\Command;

/**
 * Deja la demo como nueva. BORRA TODA LA BASE, es la única excepción a la regla de borrado lógico del sistema.
 * Por eso se niega a correr salvo con DEMO_MODE=true y una base que lleve "demo" en el nombre.
 */
class DemoReset extends Command
{
    protected $signature = 'demo:reset';

    protected $description = 'Borra la base de demostración y la vuelve a llenar con datos de ejemplo';

    public function handle(): int
    {
        $database = (string) config('database.connections.'.config('database.default').'.database');

        if (! config('demo.enabled') || ! str_contains(strtolower($database), 'demo')) {
            $this->error("demo:reset cancelado: requiere DEMO_MODE=true y una base con \"demo\" en el nombre (actual: {$database}).");

            return self::FAILURE;
        }

        $this->call('migrate:fresh', ['--force' => true, '--seeder' => DemoSeeder::class]);

        return self::SUCCESS;
    }
}
