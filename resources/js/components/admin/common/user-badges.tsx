/**
 * PIEZAS DE USUARIO reutilizables: etiqueta de rol, estado (activo/inactivo) y avatar con iniciales.
 */
import { SUPER_ADMIN } from '@/components/admin/common/role-colors';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';

/**
 * Etiqueta de rol, en gris neutro (sobria para tablas). El Super Admin va con texto más marcado.
 * Uso: <RoleBadge role={user.role} />
 */
export function RoleBadge({ role, className }: { role: string | null; className?: string }) {
    return (
        <span
            className={cn(
                'bg-muted/60 ring-border inline-flex items-center rounded-md px-2 py-0.5 text-xs whitespace-nowrap ring-1 ring-inset',
                role === SUPER_ADMIN ? 'text-foreground font-semibold' : 'text-foreground/80 font-medium',
                !role && 'text-muted-foreground',
                className,
            )}
        >
            {role ?? 'Sin rol'}
        </span>
    );
}

/** Punto verde "Activo" o gris "Inactivo" (el color va solo en el punto). Uso: <StatusBadge active={user.is_active} /> */
export function StatusBadge({ active, className }: { active: boolean; className?: string }) {
    return (
        <span className={cn('inline-flex items-center gap-2 text-sm', active ? 'text-foreground' : 'text-muted-foreground', className)}>
            <span className={cn('size-1.5 rounded-full', active ? 'bg-emerald-500' : 'bg-zinc-400')} />
            {active ? 'Activo' : 'Inactivo'}
        </span>
    );
}

/** Círculo gris con las iniciales. Uso: <UserAvatar name={user.name} /> */
export function UserAvatar({ name, className }: { name: string; className?: string }) {
    const getInitials = useInitials();

    return (
        <div
            className={cn(
                'bg-muted text-foreground/70 ring-border flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1 ring-inset',
                className,
            )}
        >
            {getInitials(name)}
        </div>
    );
}
