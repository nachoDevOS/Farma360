/**
 * TARJETA BASE de cada bloque (dashboard y módulos): fondo sólido, borde fino y sombra suave.
 */
import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
    return <div className={cn('surface rounded-xl', className)}>{children}</div>;
}

/** Encabezado de un panel: ícono opcional, título, subtítulo y algo a la derecha (enlace, total, botones…). */
export function PanelHeader({
    title,
    description,
    aside,
    icon: Icon,
}: {
    title: string;
    description?: string;
    aside?: React.ReactNode;
    icon?: LucideIcon;
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
                {Icon && (
                    <div className="bg-muted text-foreground/70 flex size-8 shrink-0 items-center justify-center rounded-lg">
                        <Icon className="size-4" />
                    </div>
                )}
                <div className="min-w-0">
                    <h2 className="text-sm font-semibold">{title}</h2>
                    {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
                </div>
            </div>
            {aside}
        </div>
    );
}
