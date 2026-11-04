/**
 * ELEGIR UNA IMAGEN en un formulario (foto del producto, logo del laboratorio, avatar…), con vista previa.
 * La sube el servidor con StorageController (S3, .avif). Se puede elegir, cambiar o quitar; también arrastrar y soltar.
 *
 *   <ImageUpload
 *       current={product.image}          // ruta guardada (o null)
 *       file={data.image}                // archivo elegido ahora (o null)
 *       removed={data.remove_image}      // true = el usuario quitó la que tenía
 *       onChange={(file) => setData((d) => ({ ...d, image: file, remove_image: false }))}
 *       onRemove={() => setData((d) => ({ ...d, image: null, remove_image: true }))}
 *       error={errors.image}
 *   />
 *
 * shape: "square" (producto, logo) o "round" (avatar). Acepta JPG, PNG, WEBP, GIF, AVIF hasta 5 MB.
 * stacked: la foto grande ocupa todo el ancho y debajo van los botones (para una columna al costado del formulario).
 */
import InputError from '@/components/shared/input-error';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useStorageUrl } from '@/lib/storage';
import { cn } from '@/lib/utils';
import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const MAX_BYTES = 5 * 1024 * 1024;

export function ImageUpload({
    current,
    file,
    removed = false,
    onChange,
    onRemove,
    error,
    shape = 'square',
    stacked = false,
    hint = 'JPG, PNG, WEBP o AVIF · hasta 5 MB',
    className,
}: {
    current?: string | null;
    file: File | null;
    removed?: boolean;
    onChange: (file: File) => void;
    onRemove: () => void;
    error?: string;
    shape?: 'square' | 'round';
    stacked?: boolean;
    hint?: string;
    className?: string;
}) {
    const imageUrl = useStorageUrl();
    const input = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    // Vista previa del archivo elegido (se libera al cambiarlo)
    useEffect(() => {
        if (!file) {
            setPreview(null);
            return;
        }
        const url = URL.createObjectURL(file);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const shown = preview ?? (removed ? null : imageUrl(current));

    const pick = (picked: File | undefined) => {
        if (!picked) return;
        if (!picked.type.startsWith('image/')) {
            setLocalError('El archivo debe ser una imagen.');
            return;
        }
        if (picked.size > MAX_BYTES) {
            setLocalError('La imagen no puede pasar de 5 MB.');
            return;
        }
        setLocalError(null);
        onChange(picked);
    };

    return (
        <div className={cn(stacked ? 'grid gap-2' : 'flex items-center gap-4', className)}>
            <button
                type="button"
                onClick={() => input.current?.click()}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    pick(e.dataTransfer.files[0]);
                }}
                aria-label={shown ? 'Cambiar imagen' : 'Elegir imagen'}
                className={cn(
                    'group bg-muted/40 relative flex shrink-0 items-center justify-center overflow-hidden border-2 border-dashed transition-colors',
                    stacked ? 'aspect-square w-full flex-col gap-2' : 'size-24',
                    shape === 'round' ? 'rounded-full' : 'rounded-xl',
                    dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
                    shown && 'border-solid',
                )}
            >
                {shown ? (
                    <>
                        <img src={shown} alt="Vista previa" className="size-full object-cover" />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
                            <RefreshCw className="size-5" />
                        </span>
                    </>
                ) : (
                    <>
                        <ImagePlus className="text-muted-foreground group-hover:text-primary size-7 transition-colors" />
                        {stacked && <span className="text-muted-foreground group-hover:text-primary text-[13px] font-medium">Agregar foto</span>}
                    </>
                )}
            </button>
            <div className={cn('grid gap-1.5', stacked && 'justify-items-center text-center')}>
                <div className={cn('flex flex-wrap gap-2', stacked && !shown && 'hidden')}>
                    <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
                        <ImagePlus /> {shown ? 'Cambiar' : 'Elegir imagen'}
                    </Button>
                    {shown && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => {
                                if (input.current) input.current.value = '';
                                onRemove();
                            }}
                        >
                            <Trash2 /> Quitar
                        </Button>
                    )}
                </div>
                <p className="text-muted-foreground text-xs">{file ? `${file.name} · se guarda al registrar` : hint}</p>
                <InputError message={localError ?? error} />
            </div>
            <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp"
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0])}
            />
        </div>
    );
}

/** Miniatura de una imagen guardada (o un ícono / iniciales si no hay). Con `zoomable` muestra la imagen en grande al pasar el puntero. */
export function StoredImage({
    path,
    alt,
    fallback,
    className,
    round = false,
    zoomable = false,
}: {
    path: string | null | undefined;
    alt: string;
    fallback: React.ReactNode;
    className?: string;
    round?: boolean;
    zoomable?: boolean;
}) {
    const imageUrl = useStorageUrl();
    const [failed, setFailed] = useState(false);
    const url = imageUrl(path);
    const hasImage = !!url && !failed;
    const thumbnail = (
        <span
            className={cn(
                'bg-muted text-foreground/60 ring-border flex size-9 shrink-0 items-center justify-center overflow-hidden ring-1 ring-inset',
                round ? 'rounded-full' : 'rounded-lg',
                className,
            )}
        >
            {hasImage ? <img src={url} alt={alt} loading="lazy" className="size-full object-cover" onError={() => setFailed(true)} /> : fallback}
        </span>
    );

    if (!zoomable || !hasImage) {
        return thumbnail;
    }

    return (
        <TooltipProvider delayDuration={150}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="cursor-zoom-in">{thumbnail}</span>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} className="bg-background ring-border p-1 ring-1">
                    <img src={url} alt={alt} className="size-64 rounded-md object-contain" />
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
