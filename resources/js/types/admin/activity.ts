/**
 * TIPOS DE LA AUDITORÍA: datos que envía app/Http/Controllers/Admin/ActivityLogController.php
 */
import { type User } from '@/types';

/** Un registro del historial (modelo App\Models\ActivityLog). */
export interface ActivityLog {
    id: number;
    /** Tipo de acción, formato "grupo.accion" (ej: "user.created") */
    action: string;
    /** Texto legible (ej: "Creó al usuario Ana Pérez") */
    description: string;
    /** Quién lo hizo. null = invitado o usuario ya eliminado */
    causer: Pick<User, 'id' | 'name' | 'email'> | null;
    properties: Record<string, unknown> | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
}

/** Filtros de la pantalla de Auditoría (viajan en la URL). */
export interface ActivityFilters {
    search?: string;
    group?: string;
    /** Registros por página ("Mostrar N registros"): 10, 15, 25, 50 o 100 */
    per_page?: string;
}
