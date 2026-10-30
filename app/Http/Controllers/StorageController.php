<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use Intervention\Image\ImageManager;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\Drivers\Gd\Encoders\AvifEncoder;
use Intervention\Image\Drivers\Gd\Encoders\WebpEncoder;
// use Intervention\Image\Gd\Driver;
// use Intervention\Image\Gd\Encoders\AvifEncoder;
// use Intervention\Image\Gd\Encoders\WebpEncoder;

class StorageController extends Controller
{
    private ImageManager $manager;

    public function __construct()
    {
        $this->manager = new ImageManager(new Driver());
    }

    public function store_image($file, string $folder): ?string
    {
        try {
            $directory = $folder . '/' . date('FY');
            Storage::disk(env('FILESYSTEM_DISK'))->makeDirectory($directory);

            $baseName = Str::random(20) . 'day' . date('d') . date('a');

            $original = $this->manager->decodePath($file->getRealPath())->orient();

            $versions = [
                'normal'  => ['suffix' => '',         'width' => 1200, 'height' => null, 'crop' => false, 'encoder' => new AvifEncoder(quality: 75)],
                // 'banner'  => ['suffix' => '-banner',   'width' => 900,  'height' => null, 'crop' => false, 'encoder' => new AvifEncoder(quality: 75)],
                // 'medium'  => ['suffix' => '-medium',   'width' => 600,  'height' => null, 'crop' => false, 'encoder' => new WebpEncoder(quality: 80)],
                // 'small'   => ['suffix' => '-small',    'width' => 256,  'height' => null, 'crop' => false, 'encoder' => new WebpEncoder(quality: 80)],
                'cropped' => ['suffix' => '-cropped',  'width' => 300,  'height' => 300,  'crop' => true,  'encoder' => new WebpEncoder(quality: 80)],
            ];

            $paths = [];

            foreach ($versions as $key => $config) {
                $ext      = $config['encoder'] instanceof AvifEncoder ? 'avif' : 'webp';
                $filename = $baseName . $config['suffix'] . '.' . $ext;
                $path     = $directory . '/' . $filename;

                $img = clone $original;

                if ($config['crop']) {
                    $img->cover($config['width'], $config['height']);
                } else {
                    $img->scaleDown(width: $config['width']);
                }

                Storage::disk(env('FILESYSTEM_DISK'))->put($path, $img->encode($config['encoder']));

                $paths[$key] = $path;
            }

            return $paths['normal'];

        } catch (\Throwable $th) {
            Log::error('StorageController::store_image — ' . $th->getMessage());
            return null;
        }
    }
}
