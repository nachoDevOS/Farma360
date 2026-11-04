/** Crédito del desarrollador, con enlace a su sitio. Va en el login y al pie del panel admin. */
export function DevelopedBy() {
    return (
        <p className="text-muted-foreground text-center text-xs">
            Desarrollado por{' '}
            <a
                href="https://www.soluciondigital.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground font-medium hover:underline"
            >
                soluciondigital.dev
            </a>
        </p>
    );
}
