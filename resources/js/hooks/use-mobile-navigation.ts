/**
 * HOOK: limpia un estilo que deja el menú móvil al cerrar sesión.
 */
import { useCallback } from 'react';

export function useMobileNavigation() {
    const cleanup = useCallback(() => {
        // Remove pointer-events style from body...
        document.body.style.removeProperty('pointer-events');
    }, []);

    return cleanup;
}
