/**
 * AYUDA CORTA junto a una etiqueta: un ícono "?" que muestra la explicación al pasar el mouse (o al enfocarlo con Tab).
 *
 *   <Label>Lote <HelpTip>Número impreso en la caja, junto al vencimiento.</HelpTip></Label>
 *
 * Para explicaciones largas, con pasos o ejemplos, usa un diálogo (ver products/base-unit-help.tsx).
 */
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { CircleHelp } from 'lucide-react';

export function HelpTip({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    tabIndex={0}
                    aria-label="Ayuda"
                    className={cn('text-muted-foreground hover:text-primary inline-flex align-middle transition-colors', className)}
                >
                    <CircleHelp className="size-3.5" />
                </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs leading-relaxed font-normal">{children}</TooltipContent>
        </Tooltip>
    );
}
