<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Las pruebas no cargan JS/CSS: así corren sin "npm run build" ni "npm run dev"
        $this->withoutVite();
    }
}
