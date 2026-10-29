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
    className?: string;
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'blue', colorValue, onClick, className }: StatCardProps) {
    const Tag = onClick ? 'button' : 'div';

    return (
        <Tag
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className={cn(
                'surface flex min-w-0 flex-col gap-3 rounded-xl p-4 text-left sm:flex-row sm:items-start sm:gap-4 sm:p-5',
                onClick && 'hover:border-foreground/20 cursor-pointer transition-[border-color,box-shadow] hover:shadow-md',
                className,
            )}
        >
            <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-11', tones[tone].icon)}>
                <Icon className="size-[18px] sm:size-5" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs sm:text-sm">{label}</p>
                <p className={cn('font-display num mt-1 truncate text-xl leading-tight font-bold sm:text-2xl', colorValue && tones[tone].value)}>
                    {value}
                </p>
                {hint && <p className="text-muted-foreground mt-1 truncate text-xs">{hint}</p>}
            </div>
        </Tag>
    );
}

/** Grilla responsiva de tarjetas: 2 columnas en celular y tablet, `cols` en escritorio. */
export function StatGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
    return <div className={cn('grid grid-cols-2 gap-3 sm:gap-4', cols === 3 && 'xl:grid-cols-3', cols === 4 && 'xl:grid-cols-4')}>{children}</div>;
}
