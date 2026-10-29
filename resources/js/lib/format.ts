/*
 * Funciones pequeñas para mostrar fechas y textos en español.
 * Úsalas en cualquier archivo con: import { formatDate } from '@/lib/format';
 */

/** "Buenos días" / "Buenas tardes" / "Buenas noches" según la hora actual. */
export function greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
}

/** Formatea una fecha que llega de Laravel, ej: formatDate(user.created_at) → "19 oct 2026". */
export function formatDate(date: string, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }): string {
    // toLocaleString (y no toLocaleDateString) para poder incluir también la hora si se pide
    return new Date(date).toLocaleString('es', options);
}

/** Moneda del sistema (debe coincidir con config/farmacia.php → currency). */
export const CURRENCY = 'Bs';

/** Monto con 2 decimales y moneda: money(12.5) → "Bs 12.50". Acepta los decimales que Laravel manda como texto. */
export function money(value: number | string | null | undefined, withCurrency = true): string {
    const amount = Number(value ?? 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return withCurrency ? `${CURRENCY} ${amount}` : amount;
}

/** Solo la fecha de un campo "Y-m-d" sin correrla por zona horaria: formatDay('2026-12-01') → "01 dic 2026". */
export function formatDay(date: string | null | undefined): string {
    if (!date) return '—';
    const [y, m, d] = date.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Fecha de hoy en formato "Y-m-d" (para inputs type="date"). */
export function today(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** "hace 4 días", "Justo ahora", "Nunca"... */
export function relativeTime(date: string | null): string {
    if (!date) return 'Nunca';
    const diff = (new Date(date).getTime() - Date.now()) / 1000;
    const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
        ['year', 31536000],
        ['month', 2592000],
        ['day', 86400],
        ['hour', 3600],
        ['minute', 60],
    ];
    for (const [unit, seconds] of units) {
        if (Math.abs(diff) >= seconds) return rtf.format(Math.round(diff / seconds), unit);
    }
    return 'Justo ahora';
}
