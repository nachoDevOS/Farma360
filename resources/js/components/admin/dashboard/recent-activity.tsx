/**
 * Pieza del Dashboard (se usa en pages/admin/dashboard.tsx): últimas acciones de la auditoría.
 * Solo la ven los administradores.
 */
import { ActionIcon } from '@/components/admin/activity/action-icon';
import { Panel, PanelHeader } from '@/components/admin/dashboard/panel';
import { PanelLink } from '@/components/admin/dashboard/recent-users';
import { relativeTime } from '@/lib/format';
import { type ActivityLog } from '@/types/admin/activity';

export function RecentActivity({ logs }: { logs: ActivityLog[] }) {
    return (
        <Panel className="overflow-hidden">
            <PanelHeader
                title="Actividad reciente"
                description="Últimas acciones registradas en la auditoría"
                aside={<PanelLink href={route('admin.activity.index')}>Ver auditoría</PanelLink>}
            />
            <ul className="divide-y">
                {logs.map((log) => (
                    <li key={log.id} className="flex items-center gap-3 px-5 py-2.5">
                        <ActionIcon action={log.action} className="size-8" />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm">{log.description}</p>
                            <p className="text-muted-foreground truncate text-xs">{log.causer?.name ?? 'Invitado'}</p>
                        </div>
                        <span className="text-muted-foreground shrink-0 text-xs">{relativeTime(log.created_at)}</span>
                    </li>
                ))}
            </ul>
        </Panel>
    );
}
