/**
 * Título de sección con descripción (se usa en las tarjetas de Ajustes).
 */
export default function HeadingSmall({ title, description }: { title: string; description?: string }) {
    return (
        <header className="border-b pb-4">
            <h3 className="mb-0.5 text-base font-semibold">{title}</h3>
            {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </header>
    );
}
