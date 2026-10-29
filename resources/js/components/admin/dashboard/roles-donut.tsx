/**
 * Pieza del Dashboard (se usa en pages/admin/dashboard.tsx).
 */
import { roleColor } from '@/components/admin/common/role-colors';
import { type RoleCount } from '@/types/admin/dashboard';
import { useState } from 'react';

/** Anillo con la proporción de cada rol (total al centro) + leyenda con cantidad y porcentaje.
 * El color de cada rol sale de role-colors.ts (el mismo que en sus etiquetas). */
export function RolesDonut({ roles }: { roles: RoleCount[] }) {
    const [hover, setHover] = useState<string | null>(null);
    const count = roles.reduce((sum, r) => sum + r.total, 0);
    const total = count || 1;
    const pct = (n: number) => Math.round((n / total) * 100);

    // Geometría del anillo: cada rol es un tramo del círculo (stroke-dasharray)
    const size = 160;
    const stroke = 18;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const visible = roles.filter((r) => r.total > 0);
    const gap = visible.length > 1 ? 3 : 0;
    let offset = 0;
    const arcs = visible.map((r) => {
        const length = (r.total / total) * circumference;
        const arc = { ...r, dash: Math.max(0, length - gap), offset };
        offset += length;
        return arc;
    });

    const focused = hover ? roles.find((r) => r.role === hover) : null;

    return (
        <div className="flex h-full flex-col items-center gap-6 sm:flex-row lg:flex-col xl:flex-row">
            <div className="relative shrink-0" onMouseLeave={() => setHover(null)}>
                <svg
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                    className="-rotate-90"
                    role="img"
                    aria-label="Proporción de cuentas por rol"
                >
                    <circle cx={size / 2} cy={size / 2} r={radius} fill="none" className="stroke-muted" strokeWidth={stroke} />
                    {arcs.map((a) => (
                        <circle
                            key={a.role}
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            fill="none"
                            stroke={roleColor(a.role).chart}
                            strokeWidth={hover === a.role ? stroke + 4 : stroke}
                            strokeDasharray={`${a.dash} ${circumference}`}
                            strokeDashoffset={-a.offset}
                            className="cursor-default transition-[stroke-width,opacity] duration-200"
                            opacity={hover && hover !== a.role ? 0.35 : 1}
                            onMouseEnter={() => setHover(a.role)}
                        />
                    ))}
                </svg>
                {/* Centro: total o el rol bajo el mouse */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="font-display num text-3xl leading-none font-semibold">{focused ? focused.total : count}</span>
                    <span className="text-muted-foreground mt-1 text-xs">{focused ? `${focused.role} · ${pct(focused.total)}%` : 'cuentas'}</span>
                </div>
            </div>

            <ul className="w-full min-w-0 flex-1 space-y-1">
                {roles.map((r) => (
                    <li
                        key={r.role}
                        onMouseEnter={() => setHover(r.role)}
                        onMouseLeave={() => setHover(null)}
                        className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors ${hover === r.role ? 'bg-muted' : ''}`}
                    >
                        <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: roleColor(r.role).chart }} />
                        <span className="min-w-0 flex-1 truncate">{r.role}</span>
                        <span className="num font-medium">{r.total}</span>
                        <span className="text-muted-foreground num w-10 text-right">{pct(r.total)}%</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
