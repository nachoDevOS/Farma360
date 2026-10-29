/**
 * Pieza del Dashboard (se usa en pages/admin/dashboard.tsx).
 */
import { RoleBadge, StatusBadge, UserAvatar } from '@/components/admin/common/user-badges';
import { Panel, PanelHeader } from '@/components/admin/dashboard/panel';
import { useCan } from '@/hooks/use-can';
import { formatDate } from '@/lib/format';
import { type RecentUser } from '@/types/admin/dashboard';
import { Link } from '@inertiajs/react';
import { ArrowRight } from 'lucide-react';

/** Lista de los últimos usuarios registrados. */
export function RecentUsers({ users }: { users: RecentUser[] }) {
    const can = useCan();

    return (
        <Panel className="overflow-hidden">
            <PanelHeader
                title="Últimos registros"
                description="Cuentas creadas recientemente"
                aside={can('usuarios.ver') && <PanelLink href={route('admin.users.index')}>Ver usuarios</PanelLink>}
            />
            <ul className="divide-y">
                {users.map((user) => (
                    <li key={user.id} className="hover:bg-muted/50 flex items-center gap-3 px-5 py-2.5 transition-colors">
                        <UserAvatar name={user.name} className="size-8" />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{user.name}</p>
                            <p className="text-muted-foreground truncate text-xs">{user.email}</p>
                        </div>
                        <RoleBadge role={user.role} className="hidden sm:inline-flex" />
                        <StatusBadge active={user.is_active} className="hidden w-20 md:inline-flex" />
                        <span className="text-muted-foreground num w-16 text-right text-xs">
                            {formatDate(user.created_at, { day: 'numeric', month: 'short' })}
                        </span>
                    </li>
                ))}
            </ul>
        </Panel>
    );
}

/** Enlace chico "Ver todo →" del encabezado de un panel. */
export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <Link
            href={href}
            className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-xs font-medium transition-colors"
        >
            {children} <ArrowRight className="size-3.5" />
        </Link>
    );
}
