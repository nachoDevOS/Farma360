/**
 * TARJETAS DE INDICADORES con ícono y color (caja, inventario, reportes…).
 *
 *   <StatGrid>
 *       <StatCard icon={Wallet} label="Ventas del turno" value="Bs 120,00" hint="8 ventas" tone="blue" />
 *       <StatCard icon={AlertTriangle} label="Vencidos" value={3} tone="red" onClick={...} />
 *   </StatGrid>
 *
 * tone: blue (normal) · green (dinero que entra / bueno) · amber (atención) · red (problema) · violet · slate
 * onClick: la tarjeta se vuelve un botón (ej: filtrar la tabla de abajo).
 * compact: más chica (menos relleno, ícono y número más chicos), para fichas con mucha información (ej: ficha del producto).
 */
import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

export type Tone = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'slate';

const tones: Record<Tone, { icon: string; value: string }> = {
    blue: { icon: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', value: '' },
    green: { icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', value: 'text-emerald-700 dark:text-emerald-400' },
    amber: { icon: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', value: 'text-amber-700 dark:text-amber-400' },
    red: { icon: 'bg-red-500/10 text-red-600 dark:text-red-400', value: 'text-red-700 dark:text-red-400' },
    violet: { icon: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', value: '' },
    slate: { icon: 'bg-muted text-foreground/70', value: '' },
};

interface StatCardProps {
    icon: LucideIcon;
    label: string;
    value: React.ReactNode;
    hint?: React.ReactNode;
    tone?: Tone;
    /** Pinta el número con el color del tono (ej: rojo para "vencidos") */
    colorValue?: boolean;
    onClick?: () => void;
    compact?: boolean;
    className?: string;
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'blue', colorValue, onClick, compact, className }: StatCardProps) {
    const Tag = onClick ? 'button' : 'div';

    return (
        <Tag
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className={cn(
                'surface flex min-w-0 flex-col rounded-xl text-left sm:flex-row sm:items-start',
                compact ? 'gap-2 p-3 sm:gap-3 sm:p-3.5' : 'gap-3 p-4 sm:gap-4 sm:p-5',
                onClick && 'hover:border-foreground/20 cursor-pointer transition-[border-color,box-shadow] hover:shadow-md',
                className,
            )}
        >
            <div
                className={cn(
                    'flex shrink-0 items-center justify-center rounded-xl',
                    compact ? 'size-8 rounded-lg sm:size-9' : 'size-9 sm:size-11',
                    tones[tone].icon,
                )}
            >
                <Icon className={compact ? 'size-4' : 'size-[18px] sm:size-5'} />
            </div>
            <div className="min-w-0 flex-1">
                <p className={cn('text-muted-foreground truncate', compact ? 'text-xs' : 'text-xs sm:text-sm')}>{label}</p>
                <p
                    className={cn(
                        'font-display num truncate leading-tight font-bold',
                        compact ? 'mt-0.5 text-lg sm:text-xl' : 'mt-1 text-xl sm:text-2xl',
                        colorValue && tones[tone].value,
                    )}
                >
                    {value}
                </p>
                {hint && <p className={cn('text-muted-foreground truncate', compact ? 'mt-0.5 text-[11px]' : 'mt-1 text-xs')}>{hint}</p>}
            </div>
        </Tag>
    );
}

/** Grilla responsiva de tarjetas: 2 columnas en celular y tablet, `cols` en escritorio. */
export function StatGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
    return <div className={cn('grid grid-cols-2 gap-3 sm:gap-4', cols === 3 && 'xl:grid-cols-3', cols === 4 && 'xl:grid-cols-4')}>{children}</div>;
}
