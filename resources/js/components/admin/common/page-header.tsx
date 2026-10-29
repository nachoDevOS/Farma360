/**
 * CABECERA DE PÁGINA: título, descripción y botones de acción a la derecha.
 * Uso: <PageHeader title="Usuarios" description="49 cuentas" actions={<Button>…</Button>} />
 */
import { cn } from '@/lib/utils';

interface PageHeaderProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
    return (
        <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
            <div className="min-w-0 space-y-1">
                <h1 className="font-display text-2xl font-semibold text-balance">{title}</h1>
                {description && <p className="text-muted-foreground text-sm">{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}
