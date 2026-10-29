/**
 * PÁGINA DE ERROR (403, 404, 500, 503) con el diseño del panel.
 * La muestra Laravel automáticamente: ver withExceptions() en bootstrap/app.php
 */
import { AppLogoMark } from '@/components/shared/app-logo';
import { Button } from '@/components/ui/button';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Home } from 'lucide-react';

// Título y explicación para cada código de error
const MESSAGES: Record<number, { title: string; description: string }> = {
    403: { title: 'Acceso denegado', description: 'No tienes permiso para ver esta página. Si crees que es un error, contacta a un administrador.' },
    404: { title: 'Página no encontrada', description: 'La dirección que buscas no existe o fue movida.' },
    500: { title: 'Error del servidor', description: 'Algo salió mal de nuestro lado. Ya estamos al tanto; intenta de nuevo en unos minutos.' },
    503: { title: 'En mantenimiento', description: 'Estamos haciendo mejoras. Vuelve en unos minutos.' },
};

export default function ErrorPage({ status }: { status: number }) {
    const { title, description } = MESSAGES[status] ?? MESSAGES[500];

    return (
        <>
            <Head title={title} />
            <div className="bg-background flex min-h-dvh items-center justify-center p-6">
                <div className="w-full max-w-md space-y-6">
                    <AppLogoMark className="size-9" />
                    <div className="space-y-2">
                        <p className="text-primary num text-sm font-semibold">Error {status}</p>
                        <h1 className="font-display text-3xl font-semibold">{title}</h1>
                        <p className="text-muted-foreground leading-relaxed">{description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                        <Button asChild className="btn-brand">
                            <Link href="/dashboard">
                                <Home /> Ir al inicio
                            </Link>
                        </Button>
                        <Button variant="outline" onClick={() => window.history.back()}>
                            <ArrowLeft /> Volver
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}
