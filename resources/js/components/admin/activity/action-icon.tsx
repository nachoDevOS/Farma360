/**
 * Pieza de Auditoría: ícono de color según el tipo de acción (verde = login, rojo = eliminado…).
 * Se usa en pages/admin/activity/index.tsx y en el dashboard.
 */
import { actionMeta, toneClasses } from '@/components/admin/activity/action-meta';
import { cn } from '@/lib/utils';

/** Uso: <ActionIcon action="user.created" /> */
export function ActionIcon({ action, className }: { action: string; className?: string }) {
    const { icon: Icon, tone } = actionMeta(action);

    return (
        <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset', toneClasses[tone], className)}>
            <Icon className="size-4" />
        </div>
    );
}

/** Etiqueta con el nombre de la acción. Uso: <ActionBadge action="auth.login" /> */
export function ActionBadge({ action }: { action: string }) {
    const { label, tone } = actionMeta(action);

    return (
        <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset', toneClasses[tone])}>
            {label}
        </span>
    );
}
