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
const CURRENCY = 'Bs';

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

const BELOW_THIRTY = [
    '',
    'un',
    'dos',
    'tres',
    'cuatro',
    'cinco',
    'seis',
    'siete',
    'ocho',
    'nueve',
    'diez',
    'once',
    'doce',
    'trece',
    'catorce',
    'quince',
    'dieciséis',
    'diecisiete',
    'dieciocho',
    'diecinueve',
    'veinte',
    'veintiún',
    'veintidós',
    'veintitrés',
    'veinticuatro',
    'veinticinco',
    'veintiséis',
    'veintisiete',
    'veintiocho',
    'veintinueve',
];
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const HUNDREDS = [
    '',
    'ciento',
    'doscientos',
    'trescientos',
    'cuatrocientos',
    'quinientos',
    'seiscientos',
    'setecientos',
    'ochocientos',
    'novecientos',
];

function wordsBelowThousand(value: number): string {
    if (value === 100) return 'cien';
    const rest = value % 100;
    const lastTwo = rest < 30 ? BELOW_THIRTY[rest] : `${TENS[Math.floor(rest / 10)]}${rest % 10 ? ` y ${BELOW_THIRTY[rest % 10]}` : ''}`;
    return [HUNDREDS[Math.floor(value / 100)], lastTwo].filter(Boolean).join(' ');
}

/** Monto en letras como en los comprobantes de Bolivia: amountInWords(9.9) → "Nueve 90/100 Bolivianos". */
export function amountInWords(value: number | string | null | undefined): string {
    const [integer, cents] = Number(value ?? 0)
        .toFixed(2)
        .split('.');
    const whole = Number(integer);
    const millions = Math.floor(whole / 1_000_000);
    const thousands = Math.floor(whole / 1000) % 1000;
    const units = whole % 1000;
    const words =
        [
            millions > 0 && (millions === 1 ? 'un millón' : `${wordsBelowThousand(millions)} millones`),
            thousands > 0 && (thousands === 1 ? 'mil' : `${wordsBelowThousand(thousands)} mil`),
            units > 0 && wordsBelowThousand(units),
        ]
            .filter(Boolean)
            .join(' ') || 'cero';
    return `${words.charAt(0).toUpperCase()}${words.slice(1)} ${cents}/100 Bolivianos`;
}
