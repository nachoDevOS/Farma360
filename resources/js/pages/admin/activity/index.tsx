/**
 * PÁGINA: Auditoría  (ruta /admin/activity, solo administradores)
 * Los datos (props) los envía app/Http/Controllers/Admin/ActivityLogController.php -> index()
 * Muestra el historial de acciones: accesos, cambios en usuarios, cambios de perfil…
 */
import { ActivityTable } from '@/components/admin/activity/activity-table';
import { ActivityToolbar } from '@/components/admin/activity/activity-toolbar';
import { PageHeader } from '@/components/admin/common/page-header';
import { ALL } from '@/components/admin/common/table-toolbar';
import { Pagination } from '@/components/shared/pagination';
import AdminLayout from '@/layouts/admin/admin-layout';
import { type BreadcrumbItem, type Paginated } from '@/types';
import { type ActivityFilters, type ActivityLog } from '@/types/admin/activity';
import { Head, router } from '@inertiajs/react';
import { ShieldCheck } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Administración', href: '/admin/users' },
    { title: 'Auditoría', href: '/admin/activity' },
];

interface Props {
    logs: Paginated<ActivityLog>;
    filters: ActivityFilters;
    groups: Record<string, string>;
}

export default function ActivityIndex({ logs, filters, groups }: Props) {
    // Cambia los filtros de la URL y Laravel devuelve el historial filtrado
    const applyFilters = (changes: Partial<ActivityFilters>) => {
        const next = { ...filters, ...changes };
        const query = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined && v !== '' && v !== ALL));
        router.get(route('admin.activity.index'), query, { preserveState: true, preserveScroll: true, replace: true });
    };

    return (
        <AdminLayout breadcrumbs={breadcrumbs}>
            <Head title="Auditoría" />
            <div className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                {/* Título */}
                <PageHeader
                    title="Auditoría"
                    description="Quién hizo qué, cuándo y desde dónde. Los registros no se pueden editar ni borrar."
                    actions={
                        <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
                            <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                            <span className="num text-foreground font-medium">{logs.total}</span> registros
                        </span>
                    }
                />

                {/* Buscador + tabla + paginación */}
                <div className="surface overflow-hidden rounded-xl">
                    <ActivityToolbar filters={filters} groups={groups} onFilter={applyFilters} />
                    <ActivityTable logs={logs.data} />
                    <Pagination paginator={logs} itemName="registros" />
                </div>
            </div>
        </AdminLayout>
    );
}
