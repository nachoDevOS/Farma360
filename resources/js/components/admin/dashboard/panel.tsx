/**
 * Pieza del Dashboard (se usa en pages/admin/dashboard.tsx).
 */
import { cn } from '@/lib/utils';

/** Tarjeta base de cada bloque: fondo sólido, borde fino y sombra suave. */
export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
    return <div className={cn('surface rounded-xl', className)}>{children}</div>;
}

/** Encabezado de un panel: título, subtítulo y algo a la derecha (enlace, total…). */
export function PanelHeader({ title, description, aside }: { title: string; description?: string; aside?: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
            <div className="min-w-0">
                <h2 className="text-sm font-semibold">{title}</h2>
                {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
            </div>
            {aside}
        </div>
    );
}
