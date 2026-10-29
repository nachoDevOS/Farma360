/**
 * Pieza de Auditoría: tabla con el historial (qué pasó, quién, desde dónde y cuándo).
 */
import { ActionBadge, ActionIcon } from '@/components/admin/activity/action-icon';
import { describeDevice } from '@/components/admin/activity/action-meta';
import { UserAvatar } from '@/components/admin/common/user-badges';
import { formatDate, relativeTime } from '@/lib/format';
import { type ActivityLog } from '@/types/admin/activity';
import { History, Monitor } from 'lucide-react';

export function ActivityTable({ logs }: { logs: ActivityLog[] }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="text-muted-foreground bg-muted/40 border-b text-left text-xs font-medium">
                    <tr>
                        <th className="px-4 py-2.5">Acción</th>
                        <th className="px-4 py-2.5">Realizada por</th>
                        <th className="hidden px-4 py-2.5 lg:table-cell">Origen</th>
                        <th className="px-4 py-2.5 text-right">Fecha</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                            {/* Qué pasó */}
                            <td className="px-4 py-2.5">
                                <div className="flex items-center gap-3">
                                    <ActionIcon action={log.action} className="size-8" />
                                    <div className="min-w-0">
                                        <p className="truncate">{log.description}</p>
                                        <ActionBadge action={log.action} />
                                    </div>
                                </div>
                            </td>
                            {/* Quién lo hizo */}
                            <td className="px-4 py-2.5">
                                {log.causer ? (
                                    <div className="flex items-center gap-2.5">
                                        <UserAvatar name={log.causer.name} className="size-7 text-[10px]" />
                                        <div className="min-w-0">
                                            <p className="truncate font-medium">{log.causer.name}</p>
                                            <p className="text-muted-foreground hidden truncate text-xs md:block">{log.causer.email}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground italic">Invitado</span>
                                )}
                            </td>
                            {/* Desde dónde (IP + navegador) */}
                            <td className="text-muted-foreground hidden px-4 py-2.5 lg:table-cell">
                                <p className="font-mono text-xs">{log.ip_address ?? '—'}</p>
                                <p className="flex items-center gap-1 text-xs">
                                    <Monitor className="size-3" /> {describeDevice(log.user_agent)}
                                </p>
                            </td>
                            {/* Cuándo: relativo + fecha exacta al pasar el mouse */}
                            <td
                                className="text-muted-foreground num px-4 py-2.5 text-right whitespace-nowrap"
                                title={formatDate(log.created_at, { dateStyle: 'full', timeStyle: 'short' })}
                            >
                                <p className="text-foreground">{relativeTime(log.created_at)}</p>
                                <p className="text-xs">
                                    {formatDate(log.created_at, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </td>
                        </tr>
                    ))}
                    {/* Mensaje cuando no hay resultados */}
                    {logs.length === 0 && (
                        <tr>
                            <td colSpan={4} className="px-4 py-16 text-center">
                                <div className="mx-auto flex max-w-xs flex-col items-center gap-2">
                                    <div className="bg-muted flex size-12 items-center justify-center rounded-full">
                                        <History className="text-muted-foreground size-5" />
                                    </div>
                                    <p className="font-medium">Sin actividad</p>
                                    <p className="text-muted-foreground text-sm">No hay registros que coincidan con los filtros.</p>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
