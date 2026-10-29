/**
 * LOGO del panel. Para usar tu propio logo, guarda la imagen en public/images/logo.png
 * (cuadrada, ideal 256×256 px, PNG con fondo transparente). Si no existe, se muestra el ícono por defecto.
 */
import { Code2 } from 'lucide-react';
import { useState } from 'react';

// Ruta del logo. Cámbiala si usas otro nombre o formato (ej: '/images/logo.svg')
const LOGO_SRC = '/images/logo.png';

/** Solo el logo cuadrado (se usa en el menú lateral y en el login). */
export function AppLogoMark({ className = '' }: { className?: string }) {
    const [failed, setFailed] = useState(false);

    if (!failed) {
        return (
            <img
                src={LOGO_SRC}
                alt="Logo"
                onError={() => setFailed(true)}
                className={`aspect-square size-8 shrink-0 rounded-lg object-contain ${className}`}
            />
        );
    }

    return (
        <div className={`logo-mark flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg text-white ${className}`}>
            <Code2 className="size-[58%]" strokeWidth={2.25} />
        </div>
    );
}

/** Logo + nombre "Panel Admin" (arriba del menú lateral). */
export default function AppLogo() {
    return (
        <>
            <AppLogoMark />
            <div className="ml-1 grid flex-1 text-left text-sm">
                <span className="font-display mb-0.5 truncate leading-none font-semibold">Panel Admin</span>
                <span className="text-sidebar-foreground/60 truncate text-xs">Sistema de gestión</span>
            </div>
        </>
    );
}
