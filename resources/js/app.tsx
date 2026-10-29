/**
 * PUNTO DE ENTRADA de React (lo carga primero Vite, ver resources/views/app.blade.php).
 * Arranca Inertia, que conecta Laravel con React. Casi nunca hace falta tocar este archivo.
 */
import '../css/app.css';

import { initializeTheme } from '@/hooks/use-appearance';
import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { route as routeFn } from 'ziggy-js';

// Permite usar route("nombre-de-ruta") en cualquier archivo sin importarlo (lo da Ziggy)
declare global {
    const route: typeof routeFn;
}

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

// Arranca la aplicación
createInertiaApp({
    // Título de la pestaña: <Head title="Usuarios" /> → "Usuarios - Panel Admin"
    title: (title) => `${title} - ${appName}`,
    // Busca la página: Inertia::render('admin/dashboard') → ./pages/admin/dashboard.tsx
    resolve: (name) => resolvePageComponent(`./pages/${name}.tsx`, import.meta.glob('./pages/**/*.tsx')),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(<App {...props} />);
    },
    // Barra de carga que aparece arriba al cambiar de página
    progress: {
        color: '#4B5563',
    },
});

// Aplica el modo claro / oscuro guardado
initializeTheme();
