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
                'surface flex items-start gap-4 rounded-xl p-5 text-left',
                onClick && 'hover:border-foreground/20 cursor-pointer transition-[border-color,box-shadow] hover:shadow-md',
                className,
            )}
        >
            <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', tones[tone].icon)}>
                <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-sm">{label}</p>
                <p className={cn('font-display num mt-1 truncate text-2xl leading-tight font-semibold', colorValue && tones[tone].value)}>{value}</p>
                {hint && <p className="text-muted-foreground mt-1 truncate text-xs">{hint}</p>}
            </div>
        </Tag>
    );
}

/** Grilla responsiva de tarjetas: 1 columna en móvil, 2 en tablet, `cols` en escritorio. */
export function StatGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
    return <div className={cn('grid gap-4 sm:grid-cols-2', cols === 3 && 'xl:grid-cols-3', cols === 4 && 'xl:grid-cols-4')}>{children}</div>;
}
