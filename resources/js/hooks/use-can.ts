/**
 * PERMISOS en React. Responde si el usuario logueado tiene un permiso del catálogo (config/roles.php).
 *
 * Uso:
 *   const can = useCan();
 *   {can('usuarios.crear') && <Button>Nuevo usuario</Button>}
 *
 * Importante: esto solo OCULTA botones y opciones para que la pantalla quede limpia.
 * La seguridad real la pone Laravel en cada ruta (->middleware('can:usuarios.crear')).
 */
import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { useCallback } from 'react';

export function useCan() {
    const { permissions } = usePage<SharedData>().props.auth;

    return useCallback((permission: string) => permissions.includes(permission), [permissions]);
}
