/*
 * IMÁGENES GUARDADAS EN S3 (las sube app/Http/Controllers/StorageController.php).
 * En la base queda la ruta del .avif normal ("products/October2026/abc.avif"); para mostrarla se le antepone la
 * dirección pública del bucket, que Laravel comparte como `aws_url` (HandleInertiaRequests, AWS_URL del .env).
 * Se muestra siempre el .avif (no la versión -cropped.webp).
 *
 *   const imageUrl = useStorageUrl();
 *   <img src={imageUrl(product.image) ?? ''} />
 */
import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';

/** Dirección completa de una ruta guardada. Si ya es una dirección (http… o /…) la deja igual; sin bucket usa /storage. */
export function storageUrl(path: string | null | undefined, baseUrl: string | null | undefined): string | null {
    if (!path) return null;
    if (path.startsWith('http') || path.startsWith('/') || path.startsWith('blob:')) return path;
    const file = path.replace(/^\/+/, '');
    return baseUrl ? `${baseUrl.replace(/\/+$/, '')}/${file}` : `/storage/${file}`;
}

/** Hook: devuelve la función que arma la dirección de una imagen con el bucket de la página. */
export function useStorageUrl() {
    const { aws_url } = usePage<SharedData>().props;
    return (path: string | null | undefined) => storageUrl(path, aws_url);
}
