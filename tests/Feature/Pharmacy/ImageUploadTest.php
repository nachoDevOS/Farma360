<?php

namespace Tests\Feature\Pharmacy;

use App\Models\Laboratory;
use App\Models\Product;
use App\Models\User;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * IMÁGENES (productos, laboratorios y avatar de usuarios): las guarda StorageController en el disco de
 * FILESYSTEM_DISK (S3) como .avif normal + .webp recortada; en la columna queda la ruta del .avif.
 * Se usa un disco falso: nada llega al bucket real.
 */
class ImageUploadTest extends TestCase
{
    use PharmacyHelpers, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(config('filesystems.default'));
    }

    private function disk(): FilesystemAdapter
    {
        return Storage::disk(config('filesystems.default'));
    }

    /** Datos mínimos de un producto con una sola presentación (la unidad base). */
    private function productPayload(array $extra = []): array
    {
        return [
            'name' => 'Febrax', 'base_unit' => 'tableta', 'min_stock' => 0,
            'presentations' => [['sale_price' => 1, 'is_sellable' => true, 'is_purchasable' => true]],
            ...$extra,
        ];
    }

    public function test_a_product_image_is_saved_as_avif_kept_replaced_and_removed()
    {
        $admin = $this->userWithRole('Administrador');

        $this->actingAs($admin)->post('/admin/products', $this->productPayload([
            'image' => UploadedFile::fake()->image('foto.jpg', 1600, 1200),
        ]))->assertSessionHasNoErrors();

        $product = Product::firstOrFail();
        $first = $product->image;
        $this->assertStringStartsWith('products/', $first);
        $this->assertStringEndsWith('.avif', $first);
        $this->disk()->assertExists($first);
        // También la versión recortada (no es la que se muestra)
        $this->disk()->assertExists(str_replace('.avif', '-cropped.webp', $first));

        // Editar sin mandar imagen: se queda la que tenía
        $this->actingAs($admin)->put("/admin/products/{$product->id}", $this->productPayload([
            'presentations' => [['id' => $product->presentations()->first()->id, 'sale_price' => 1, 'is_sellable' => true, 'is_purchasable' => true]],
        ]))->assertSessionHasNoErrors();
        $this->assertSame($first, $product->fresh()->image);

        // Reemplazar: con archivo la pantalla manda POST + _method=put
        $this->actingAs($admin)->post("/admin/products/{$product->id}", $this->productPayload([
            '_method' => 'put',
            'presentations' => [['id' => $product->presentations()->first()->id, 'sale_price' => 1, 'is_sellable' => true, 'is_purchasable' => true]],
            'image' => UploadedFile::fake()->image('otra.png', 400, 400),
        ]))->assertSessionHasNoErrors();
        $second = $product->fresh()->image;
        $this->assertNotSame($first, $second);
        $this->disk()->assertExists($second);

        // Quitar
        $this->actingAs($admin)->put("/admin/products/{$product->id}", $this->productPayload([
            'presentations' => [['id' => $product->presentations()->first()->id, 'sale_price' => 1, 'is_sellable' => true, 'is_purchasable' => true]],
            'remove_image' => true,
        ]))->assertSessionHasNoErrors();
        $this->assertNull($product->fresh()->image);
    }

    public function test_only_images_are_accepted()
    {
        $this->actingAs($this->userWithRole('Administrador'))->post('/admin/products', $this->productPayload([
            'image' => UploadedFile::fake()->create('receta.pdf', 100, 'application/pdf'),
        ]))->assertSessionHasErrors('image');

        $this->assertSame(0, Product::count());
    }

    public function test_a_laboratory_logo_is_saved_from_the_catalog_screen()
    {
        $admin = $this->userWithRole('Administrador');

        $this->actingAs($admin)->post('/admin/laboratories', [
            'name' => 'Laboratorios Andinos',
            'image' => UploadedFile::fake()->image('logo.png', 300, 300),
        ])->assertSessionHasNoErrors();

        $laboratory = Laboratory::firstOrFail();
        $this->assertStringStartsWith('laboratories/', $laboratory->image);
        $this->disk()->assertExists($laboratory->image);

        // Editar el nombre no toca el logo
        $this->actingAs($admin)->put("/admin/laboratories/{$laboratory->id}", ['name' => 'Andinos SRL'])->assertSessionHasNoErrors();
        $this->assertSame($laboratory->image, $laboratory->fresh()->image);
    }

    public function test_a_user_avatar_is_saved_and_the_bucket_url_is_shared_with_the_screens()
    {
        $admin = $this->userWithRole('Administrador');

        $this->actingAs($admin)->post('/admin/users', [
            'name' => 'Ana Pérez', 'email' => 'ana@example.com', 'role' => 'Administrador', 'is_active' => true,
            'password' => 'password', 'password_confirmation' => 'password',
            'avatar' => UploadedFile::fake()->image('ana.jpg', 500, 500),
        ])->assertSessionHasNoErrors();

        $user = User::where('email', 'ana@example.com')->firstOrFail();
        $this->assertStringStartsWith('users/', $user->avatar);
        $this->disk()->assertExists($user->avatar);

        $this->actingAs($admin)->get('/admin/products')
            ->assertInertia(fn ($page) => $page->where('aws_url', config('filesystems.disks.s3.url')));
    }
}
