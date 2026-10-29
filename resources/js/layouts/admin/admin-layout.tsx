/**
 * MARCO DEL PANEL ADMIN: menú lateral a la izquierda, barra superior y la página en el centro.
 * Uso:  <AdminLayout breadcrumbs={[{ title: 'Usuarios', href: '/admin/users' }]}> ...contenido... </AdminLayout>
 */
import { AdminHeader } from '@/components/admin/layout/admin-header';
import { AdminSidebar } from '@/components/admin/layout/admin-sidebar';
import { FlashToast } from '@/components/shared/flash-toast';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { type BreadcrumbItem } from '@/types';
import { useState } from 'react';

export default function AdminLayout({ children, breadcrumbs = [] }: { children: React.ReactNode; breadcrumbs?: BreadcrumbItem[] }) {
    // Menú abierto / plegado. Se recuerda en el navegador entre visitas
    const [open, setOpen] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('sidebar') !== 'false' : true));

    const handleOpenChange = (value: boolean) => {
        setOpen(value);
        localStorage.setItem('sidebar', String(value));
    };

    return (
        <SidebarProvider open={open} onOpenChange={handleOpenChange}>
            <AdminSidebar />
            <SidebarInset className="relative isolate min-w-0 md:border">
                <AdminHeader breadcrumbs={breadcrumbs} />
                {/* Aquí se dibuja la página actual (dashboard, usuarios…) */}
                {children}
            </SidebarInset>
            {/* Avisos de éxito / error (esquina inferior derecha) */}
            <FlashToast />
        </SidebarProvider>
    );
}
