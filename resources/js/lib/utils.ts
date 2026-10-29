/**
 * Utilidades generales sin diseño.
 */
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina clases de Tailwind sin conflictos.
 * Ej: cn('p-2 text-sm', activo && 'bg-cyan-500', 'p-4')  →  'text-sm bg-cyan-500 p-4'
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
