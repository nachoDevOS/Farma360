/**
 * ESTADO DE UN DOCUMENTO (compra, venta, transferencia, turno de caja) con su color.
 * Uso: <DocStatus status={sale.status} />
 * Y otras etiquetas chicas de la farmacia: vencimiento, promoción.
 */
import { cn } from '@/lib/utils';
import { type PromoPresentation } from '@/types/admin/pharmacy';

const styles: Record<string, { label: string; dot: string }> = {
    registrada: { label: 'Registrada', dot: 'bg-emerald-500' },
    completada: { label: 'Completada', dot: 'bg-emerald-500' },
    recibida: { label: 'Recibida', dot: 'bg-emerald-500' },
    cerrada: { label: 'Cerrada', dot: 'bg-zinc-400' },
    enviada: { label: 'En camino', dot: 'bg-sky-500' },
    abierta: { label: 'Abierta', dot: 'bg-sky-500' },
    pendiente: { label: 'Pendiente de revisión', dot: 'bg-amber-500' },
    anulada: { label: 'Anulada', dot: 'bg-red-500' },
};

export function DocStatus({ status, className }: { status: string; className?: string }) {
    const style = styles[status] ?? { label: status, dot: 'bg-zinc-400' };

    return (
        <span className={cn('inline-flex items-center gap-2 text-sm whitespace-nowrap', status === 'anulada' && 'text-muted-foreground', className)}>
            <span className={cn('size-1.5 rounded-full', style.dot)} />
            {style.label}
        </span>
    );
}

/** Opciones para el filtro de estado de cada lista. */
export function statusOptions(statuses: string[]) {
    return statuses.map((status) => ({ id: status, name: styles[status]?.label ?? status }));
}

/**
 * Vencimiento con color: rojo si venció, ámbar si vence dentro de alertDays, normal si no.
 * Uso: <ExpiryBadge date={batch.expires_at} emptyLabel="Sin vencimiento" />
 * Lote sin vencimiento: <ExpiryBadge date={batch.expires_at} emptyLabel="Sin vencimiento" emptyLabel="Sin vencimiento" /> (por defecto muestra "—").
 */
export function ExpiryBadge({
    date,
    alertDays = 90,
    emptyLabel = '—',
    className,
}: {
    date: string | null | undefined;
    alertDays?: number;
    emptyLabel?: string;
    className?: string;
}) {
    if (!date) return <span className={cn('text-muted-foreground text-xs whitespace-nowrap', className)}>{emptyLabel}</span>;

    const [y, m, d] = date.slice(0, 10).split('-').map(Number);
    const expires = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((expires.getTime() - today.getTime()) / 86400000);
    const label = expires.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });

    const tone =
        days < 0
            ? 'bg-red-500/10 text-red-700 dark:text-red-400'
            : days <= alertDays
              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
              : 'text-foreground/80';

    return (
        <span className={cn('num inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap', tone, className)}>
            {label}
            {days < 0 ? <span>· vencido</span> : days <= alertDays ? <span>· {days} d</span> : null}
        </span>
    );
}

/** Etiqueta verde de descuento: <PromoBadge percent={20} /> → "-20%". Si es de una presentación: only="Caja" → "-20% solo Caja". */
export function PromoBadge({ percent, only, className }: { percent: number | string; only?: string | null; className?: string }) {
    return (
        <span>
            <span
                className={cn(
                    'num rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400',
                    className,
                )}
            >
                -{Number(percent)}%
            </span>
            {only && <span className="text-muted-foreground ml-1 text-xs">solo {only}</span>}
        </span>
    );
}

/** Descuento de un lote: uno solo si es para todo el lote, o una etiqueta por presentación con su %. */
export function BatchPromoBadge({ percent, presentations }: { percent: number | string; presentations: PromoPresentation[] }) {
    if (presentations.length === 0) {
        return <PromoBadge percent={percent} />;
    }

    return (
        <span className="grid gap-1">
            {presentations.map((presentation) => (
                <PromoBadge key={presentation.id} percent={presentation.pivot.discount_percent} only={presentation.name} />
            ))}
        </span>
    );
}
