{{-- SEO y vista previa al compartir. Los textos e imágenes están en config/seo.php --}}
@php
    $isIndexable = request()->routeIs(...config('seo.indexable_routes'));
    $structuredData = [
        '@context' => 'https://schema.org',
        '@type' => 'WebApplication',
        'name' => config('seo.name'),
        'url' => url('/'),
        'description' => config('seo.description'),
        'image' => asset(config('seo.image')),
        'applicationCategory' => 'BusinessApplication',
        'operatingSystem' => 'Web',
        'inLanguage' => 'es',
        'creator' => ['@type' => 'Organization', 'name' => 'soluciondigital.dev', 'url' => 'https://www.soluciondigital.dev/'],
    ];
@endphp
<meta name="description" content="{{ config('seo.description') }}">
<meta name="robots" content="{{ $isIndexable ? 'index, follow' : 'noindex, nofollow' }}">
<meta name="theme-color" content="{{ config('seo.theme_color') }}">
<link rel="canonical" href="{{ url()->current() }}">

<link rel="icon" href="{{ asset('favicon.ico') }}" sizes="48x48">
<link rel="icon" type="image/png" sizes="512x512" href="{{ asset('images/icon.png') }}">
<link rel="apple-touch-icon" href="{{ asset('images/apple-touch-icon.png') }}">

<meta property="og:type" content="website">
<meta property="og:site_name" content="{{ config('seo.name') }}">
<meta property="og:locale" content="{{ config('seo.locale') }}">
<meta property="og:title" content="{{ config('seo.title') }}">
<meta property="og:description" content="{{ config('seo.description') }}">
<meta property="og:url" content="{{ url()->current() }}">
<meta property="og:image" content="{{ asset(config('seo.image')) }}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{{ config('seo.image_alt') }}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{{ config('seo.title') }}">
<meta name="twitter:description" content="{{ config('seo.description') }}">
<meta name="twitter:image" content="{{ asset(config('seo.image')) }}">
<meta name="twitter:image:alt" content="{{ config('seo.image_alt') }}">

<script type="application/ld+json">@json($structuredData)</script>
