/**
 * BOTONES DE ACCIÓN de una fila de tabla (Editar, Activar, Eliminar…), siempre visibles.
 * Uso:
 *   <RowActions>
 *       <ActionButton icon={Pencil} label="Editar" onClick={...} />
 *       <ActionButton icon={Trash2} label="Eliminar" tone="danger" onClick={...} />
 *   </RowActions>
 * Se ve solo el ícono; el nombre (o el motivo si está deshabilitado) aparece al pasar el mouse.
 */
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

type Tone = 'default' | 'success' | 'warning' | 'danger';

// Cada tipo usa una clase global de app.css (sección "BOTONES DE ÍCONO"), que trae el color y el efecto
const toneClasses: Record<Tone, string> = {
    default: 'btn-icon-primary', // Editar (azul)
    success: 'btn-icon-success', // Activar (verde)
    warning: 'btn-icon-warning', // Desactivar (naranja)
    danger: 'btn-icon-danger', // Eliminar (rojo)
};

interface ActionButtonProps {
    icon: LucideIcon;
    label: string;
    onClick: () => void;
    tone?: Tone;
    disabled?: boolean;
    /** Motivo que se muestra al pasar el mouse cuando el botón está deshabilitado */
    disabledReason?: string;
}

export function ActionButton({ icon: Icon, label, onClick, tone = 'default', disabled, disabledReason }: ActionButtonProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                {/* El <span> deja mostrar la etiqueta aunque el botón esté deshabilitado */}
                <span tabIndex={disabled ? 0 : -1} className="inline-flex">
                    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} className={cn('btn-icon', toneClasses[tone])}>
                        <Icon />
                    </button>
                </span>
            </TooltipTrigger>
            <TooltipContent>{disabled && disabledReason ? disabledReason : label}</TooltipContent>
        </Tooltip>
    );
}

export function RowActions({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn('flex items-center justify-end gap-1.5', className)}>{children}</div>;
}
