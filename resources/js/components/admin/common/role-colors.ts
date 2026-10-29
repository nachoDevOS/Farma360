/**
 * COLOR DE CADA ROL EN GRÁFICOS (anillo "Distribución por rol" del dashboard).
 * Como los roles se crean desde el panel, el color sale del nombre: el mismo rol tiene siempre el mismo color.
 * En tablas y etiquetas los roles van en gris neutro (ver RoleBadge en user-badges.tsx).
 */

export const SUPER_ADMIN = 'Super Admin'; // Igual que config/roles.php → super_admin

// Colores de gráficos definidos en app.css (--chart-1 … --chart-5)
const palette = ['var(--chart-1)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-2)'];

/** Devuelve { chart } con el color del rol para usar en SVG o style={{ backgroundColor }}. */
export function roleColor(role: string | null | undefined): { chart: string } {
    if (!role) return { chart: 'var(--muted-foreground)' };
    if (role === SUPER_ADMIN) return { chart: 'var(--foreground)' };

    const hash = [...role].reduce((sum, c) => sum + c.charCodeAt(0), 0);
    return { chart: palette[hash % palette.length] };
}
