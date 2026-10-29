/**
 * PÁGINA: Ajustes > Apariencia (ruta /settings/appearance). Solo cambia el tema en este navegador.
 */
import { Head } from '@inertiajs/react';

import HeadingSmall from '@/components/admin/common/heading-small';
import AppearanceTabs from '@/components/admin/settings/appearance-tabs';
import { type BreadcrumbItem } from '@/types';

import AdminLayout from '@/layouts/admin/admin-layout';
import SettingsLayout, { SettingsCard } from '@/layouts/admin/settings-layout';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Apariencia',
        href: '/settings/appearance',
    },
];

export default function Appearance() {
    return (
        <AdminLayout breadcrumbs={breadcrumbs}>
            <Head title="Apariencia" />

            <SettingsLayout>
                <SettingsCard>
                    <HeadingSmall title="Apariencia" description="Toca una opción: el cambio se aplica al instante, no hace falta guardar." />
                    <AppearanceTabs />
                </SettingsCard>
            </SettingsLayout>
        </AdminLayout>
    );
}
