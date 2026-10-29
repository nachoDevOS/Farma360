/**
 * CABECERA DE PÁGINA: ícono del módulo, título, descripción y botones de acción a la derecha.
 * Uso: <PageHeader icon={Wallet} title="Mi caja" description="…" actions={<Button>…</Button>} />
 * El ícono es opcional; va en un cuadro con el color de la marca.
 */
import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

interface PageHeaderProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    icon?: LucideIcon;
    className?: string;
}

export function PageHeader({ title, description, actions, icon: Icon, className }: PageHeaderProps) {
    return (
        <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between', className)}>
            <div className="flex min-w-0 items-center gap-4">
                {Icon && (
                    <div className="bg-primary/10 text-primary ring-primary/15 hidden size-12 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset sm:flex">
                        <Icon className="size-6" />
                    </div>
                )}
                <div className="min-w-0 space-y-1">
                    <h1 className="font-display text-2xl leading-tight font-bold text-balance">{title}</h1>
                    {description && <div className="text-muted-foreground text-sm">{description}</div>}
                </div>
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}
