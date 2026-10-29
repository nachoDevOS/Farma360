/**
 * HOOK DEL TEMA claro / oscuro.
 * Guarda la elección en el navegador (localStorage) para recordarla la próxima vez.
 */
import { useEffect, useState } from 'react';

/** 'system' = sigue la configuración del sistema operativo */
export type Appearance = 'light' | 'dark' | 'system';

const prefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

// Pone o quita la clase 'dark' en <html>. Tailwind la usa para las clases dark:...
const applyTheme = (appearance: Appearance) => {
    const isDark = appearance === 'dark' || (appearance === 'system' && prefersDark());

    document.documentElement.classList.toggle('dark', isDark);
};

const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

const handleSystemThemeChange = () => {
    const currentAppearance = localStorage.getItem('appearance') as Appearance;
    applyTheme(currentAppearance || 'dark');
};

/** Se llama una vez al arrancar (app.tsx). Si no hay nada guardado: modo oscuro. */
export function initializeTheme() {
    const savedAppearance = (localStorage.getItem('appearance') as Appearance) || 'dark';

    applyTheme(savedAppearance);

    // Add the event listener for system theme changes...
    mediaQuery.addEventListener('change', handleSystemThemeChange);
}

/** Uso: const { appearance, updateAppearance } = useAppearance();  updateAppearance('light'); */
export function useAppearance() {
    const [appearance, setAppearance] = useState<Appearance>('dark');

    const updateAppearance = (mode: Appearance) => {
        setAppearance(mode);
        localStorage.setItem('appearance', mode);
        applyTheme(mode);
    };

    useEffect(() => {
        const savedAppearance = localStorage.getItem('appearance') as Appearance | null;
        updateAppearance(savedAppearance || 'dark');

        return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
    }, []);

    return { appearance, updateAppearance };
}
