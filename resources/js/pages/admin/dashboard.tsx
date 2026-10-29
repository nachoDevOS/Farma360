import { PageHeader } from '@/components/admin/common/page-header';
import { Panel, PanelHeader } from '@/components/admin/dashboard/panel';
import { RecentUsers } from '@/components/admin/dashboard/recent-users';
import { RegistrationsChart } from '@/components/admin/dashboard/registrations-chart';
import { RolesDonut } from '@/components/admin/dashboard/roles-donut';
import { KpiStrip } from '@/components/admin/dashboard/stat-card';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import AdminLayout from '@/layouts/admin/admin-layout';
import { greeting } from '@/lib/format';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { type DashboardStats, type MonthlyRegistration, type RecentUser, type RoleCount } from '@/types/admin/dashboard';
import { Head, Link, usePage } from '@inertiajs/react';
import { Users } from 'lucide-react';

/*
 * PÁGINA: Dashboard  (ruta /dashboard)
 * Los datos (props) los envía app/Http/Controllers/Admin/DashboardController.php
 * Esta página solo arma el diseño; cada bloque vive en components/admin/dashboard/.
 */

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
];

interface DashboardProps {
    stats: DashboardStats;
    monthly: MonthlyRegistration[];
    roles: RoleCount[];
    recentUsers: RecentUser[];
}

export default function Dashboard({ stats, monthly, roles, recentUsers }: DashboardProps) {
    const { auth } = usePage<SharedData>().props;
    const can = useCan();
    // Totales y porcentajes calculados en el navegador a partir de los datos
    const yearTotal = monthly.reduce((s, m) => s + m.total, 0);
    const activeRate = stats.total ? Math.round((stats.active / stats.total) * 100) : 0;
    const verifiedRate = stats.total ? Math.round((stats.verified / stats.total) * 100) : 0;
    const today = new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <AdminLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <div className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                {/* 1. Saludo + accesos rápidos */}
                <PageHeader
                    title={`${greeting()}, ${auth.user.name.split(' ')[0]}`}
                    description={
                        <>
                            <span className="inline-block first-letter:uppercase">{today}</span> · {stats.onlineToday}{' '}
                            {stats.onlineToday === 1 ? 'persona inició' : 'personas iniciaron'} sesión hoy
                        </>
                    }
                    actions={
                        can('usuarios.ver') && (
                            <Button asChild size="sm" className="btn-brand">
                                <Link href={route('admin.users.index')}>
                                    <Users /> Gestionar usuarios
                                </Link>
                            </Button>
                        )
                    }
                />

                {/* 2. Indicadores */}
                <KpiStrip
                    items={[
                        { label: 'Usuarios totales', value: stats.total, hint: `${yearTotal} registrados en los últimos 12 meses` },
                        { label: 'Nuevos este mes', value: stats.newThisMonth, hint: 'Comparado con el mes anterior', trend: stats.growth },
                        { label: 'Cuentas activas', value: stats.active, hint: `${activeRate}% del total`, ratio: activeRate },
                        { label: 'Correo verificado', value: stats.verified, hint: `${verifiedRate}% del total`, ratio: verifiedRate },
                    ]}
                />

                {/* 3. Gráficos */}
                <div className="grid gap-6 lg:grid-cols-3">
                    <Panel className="lg:col-span-2">
                        <PanelHeader
                            title="Registros de usuarios"
                            description="Cuentas nuevas por mes, últimos 12 meses"
                            aside={
                                <span className="num text-sm font-semibold">
                                    {yearTotal} <span className="text-muted-foreground font-normal">en total</span>
                                </span>
                            }
                        />
                        <div className="p-5">
                            <RegistrationsChart data={monthly} />
                        </div>
                    </Panel>
                    <Panel>
                        <PanelHeader title="Distribución por rol" description="Cuentas según su nivel de permiso" />
                        <div className="p-5">
                            <RolesDonut roles={roles} />
                        </div>
                    </Panel>
                </div>

                {/* 4. Últimos usuarios registrados */}
                <RecentUsers users={recentUsers} />
            </div>
        </AdminLayout>
    );
}
