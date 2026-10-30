/**
 * TIPOS DEL DASHBOARD: datos que envía app/Http/Controllers/Admin/DashboardController.php
 */
import { type User } from '@/types';

/** Números de las 4 tarjetas de métricas. Vienen de DashboardController. */
export interface DashboardStats {
    total: number;
    active: number;
    verified: number;
    newThisMonth: number;
    growth: number | null;
    onlineToday: number;
}

/** Un punto del gráfico de registros (uno por mes). */
export interface MonthlyRegistration {
    month: string;
    total: number;
}

/** Cuántas cuentas tiene cada rol. */
export interface RoleCount {
    role: string;
    total: number;
}

export type RecentUser = Pick<User, 'id' | 'name' | 'email' | 'avatar' | 'role' | 'is_active' | 'created_at'>;
