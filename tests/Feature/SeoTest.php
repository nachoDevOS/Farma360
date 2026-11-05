<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SeoTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_page_gives_crawlers_its_title_description_and_image(): void
    {
        $this->get('/login')
            ->assertOk()
            ->assertSee('<title inertia>'.config('seo.title').'</title>', false)
            ->assertSee('<meta property="og:title" content="'.config('seo.title').'">', false)
            ->assertSee('<meta name="description" content="'.config('seo.description').'">', false)
            ->assertSee('<meta property="og:image" content="'.asset(config('seo.image')).'">', false)
            ->assertSee('<meta name="robots" content="index, follow">', false);
    }

    public function test_private_pages_are_kept_out_of_search_engines(): void
    {
        $this->actingAs(User::factory()->create())
            ->get('/dashboard')
            ->assertOk()
            ->assertSee('<meta name="robots" content="noindex, nofollow">', false);
    }
}
