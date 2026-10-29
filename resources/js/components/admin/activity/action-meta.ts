/**
 * DICCIONARIO DE ACCIONES DE LA AUDITORÍA: nombre, ícono y color de cada tipo de acción.
 * Si registras una acción nueva en Laravel (ActivityLog::record('algo.nuevo', ...)), agrégala aquí.
 */
import {
    Activity,
    Ban,
    Download,
    KeyRound,
    LogIn,
    LogOut,
    type LucideIcon,
    Pencil,
    Power,
    PowerOff,
    ShieldAlert,
    ShieldCheck,
    ShieldPlus,
    ShieldX,
    Trash2,
    UserPlus,
    UserRound,
} from 'lucide-react';

export type Tone = 'blue' | 'indigo' | 'emerald' | 'sky' | 'amber' | 'red' | 'slate';

interface ActionMeta {
    label: string;
    icon: LucideIcon;
    tone: Tone;
}

const ACTIONS: Record<string, ActionMeta> = {
    'auth.login': { label: 'Inicio de sesión', icon: LogIn, tone: 'emerald' },
    'auth.logout': { label: 'Cierre de sesión', icon: LogOut, tone: 'slate' },
    'auth.failed': { label: 'Acceso fallido', icon: ShieldAlert, tone: 'red' },
    'auth.blocked': { label: 'Cuenta bloqueada', icon: Ban, tone: 'red' },
    'auth.registered': { label: 'Registro', icon: UserPlus, tone: 'blue' },
    'user.created': { label: 'Usuario creado', icon: UserPlus, tone: 'blue' },
    'user.updated': { label: 'Usuario editado', icon: Pencil, tone: 'sky' },
    'user.deleted': { label: 'Usuario eliminado', icon: Trash2, tone: 'red' },
    'user.activated': { label: 'Cuenta activada', icon: Power, tone: 'emerald' },
    'user.deactivated': { label: 'Cuenta desactivada', icon: PowerOff, tone: 'amber' },
    'user.exported': { label: 'Exportación', icon: Download, tone: 'indigo' },
    'role.created': { label: 'Rol creado', icon: ShieldPlus, tone: 'blue' },
    'role.updated': { label: 'Permisos cambiados', icon: ShieldCheck, tone: 'indigo' },
    'role.deleted': { label: 'Rol eliminado', icon: ShieldX, tone: 'red' },
    'profile.updated': { label: 'Perfil actualizado', icon: UserRound, tone: 'sky' },
    'profile.password': { label: 'Contraseña cambiada', icon: KeyRound, tone: 'indigo' },
};

/** Clases de color para el ícono de cada tono (funcionan en modo claro y oscuro). */
export const toneClasses: Record<Tone, string> = {
    blue: 'bg-blue-500/10 text-blue-700 ring-blue-500/20 dark:text-blue-300',
    indigo: 'bg-indigo-500/10 text-indigo-600 ring-indigo-500/20 dark:text-indigo-300',
    emerald: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-300',
    sky: 'bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300',
    amber: 'bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300',
    red: 'bg-red-500/10 text-red-600 ring-red-500/20 dark:text-red-300',
    slate: 'bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300',
};

/** Devuelve nombre, ícono y color de una acción. Si no la conoce, usa un ícono genérico. */
export function actionMeta(action: string): ActionMeta {
    return ACTIONS[action] ?? { label: action, icon: Activity, tone: 'slate' };
}

/** Navegador y sistema a partir del "user agent". Ej: "Chrome · Windows" */
export function describeDevice(userAgent: string | null): string {
    if (!userAgent) return 'Desconocido';
    const browser = /Edg\//.test(userAgent)
        ? 'Edge'
        : /OPR\//.test(userAgent)
          ? 'Opera'
          : /Chrome\//.test(userAgent)
            ? 'Chrome'
            : /Firefox\//.test(userAgent)
              ? 'Firefox'
              : /Safari\//.test(userAgent)
                ? 'Safari'
                : 'Navegador';
    const os = /Windows/.test(userAgent)
        ? 'Windows'
        : /Android/.test(userAgent)
          ? 'Android'
          : /iPhone|iPad/.test(userAgent)
            ? 'iOS'
            : /Mac OS/.test(userAgent)
              ? 'macOS'
              : /Linux/.test(userAgent)
                ? 'Linux'
                : '';
    return os ? `${browser} · ${os}` : browser;
}
