import { cn } from '@/lib/utils';
import { type Paginated } from '@/types';
import { Link } from '@inertiajs/react';

/**
 * Pie de tabla con "Mostrando 1–10 de 49" y los botones de página.
 * Sirve para cualquier resultado de ->paginate() de Laravel.
 */
export function Pagination<T>({ paginator, itemName = 'registros' }: { paginator: Paginated<T>; itemName?: string }) {
    return (
        <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
            <p className="text-muted-foreground num text-sm">
                Mostrando <span className="text-foreground font-medium">{paginator.from ?? 0}</span>–
                <span className="text-foreground font-medium">{paginator.to ?? 0}</span> de{' '}
                <span className="text-foreground font-medium">{paginator.total}</span> {itemName}
            </p>
            <nav className="flex items-center gap-1">
                {paginator.links.map((link, i) => {
                    // Laravel manda "&laquo; Anterior" y "Siguiente &raquo;": los mostramos como flechas
                    const label = link.label.includes('&laquo;') ? '‹' : link.label.includes('&raquo;') ? '›' : link.label;
                    return link.url ? (
                        <Link
                            key={i}
                            href={link.url}
                            preserveScroll
                            preserveState
                            className={cn(
                                'num flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm transition-colors',
                                link.active
                                    ? 'bg-foreground text-background font-medium'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                        >
                            {label}
                        </Link>
                    ) : (
                        <span key={i} className="text-muted-foreground flex h-8 min-w-8 items-center justify-center px-2 text-sm">
                            {label}
                        </span>
                    );
                })}
            </nav>
        </div>
    );
}
