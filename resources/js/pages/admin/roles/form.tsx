/**
 * PÁGINA: Nuevo rol / Editar rol (rutas /admin/roles/create y /admin/roles/{id}/edit).
 * La misma página sirve para las dos cosas: si llega `role`, es edición.
 * Guarda con RoleController@store (POST) o RoleController@update (PUT).
 */
import { PageHeader } from '@/components/admin/common/page-header';
import { PermissionMatrix } from '@/components/admin/roles/permission-matrix';
import InputError from '@/components/shared/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AdminLayout from '@/layouts/admin/admin-layout';
import { type BreadcrumbItem } from '@/types';
import { type PermissionCatalog, type RoleDetail } from '@/types/admin/roles';
import { Head, Link, useForm } from '@inertiajs/react';
import { Info, LoaderCircle } from 'lucide-react';
import { FormEventHandler } from 'react';

interface Props {
    role: RoleDetail | null;
    catalog: PermissionCatalog;
}

export default function RoleForm({ role, catalog }: Props) {
    const editing = role !== null;
    const title = editing ? `Editar rol: ${role.name}` : 'Nuevo rol';

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Roles y permisos', href: route('admin.roles.index') },
        { title: editing ? role.name : 'Nuevo rol', href: '#' },
    ];

    const { data, setData, post, put, processing, errors, isDirty } = useForm({
        name: role?.name ?? '',
        permissions: role?.permissions ?? ([] as string[]),
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (editing) {
            put(route('admin.roles.update', role.id));
        } else {
            post(route('admin.roles.store'));
        }
    };

    const total = catalog.modules.reduce((sum, m) => sum + m.actions.length, 0);

    return (
        <AdminLayout breadcrumbs={breadcrumbs}>
            <Head title={title} />
            <form onSubmit={submit} className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                <PageHeader
                    title={title}
                    description="Escribe el nombre del rol y marca lo que puede hacer en cada parte del sistema."
                    actions={
                        <>
                            <Button asChild variant="outline" size="sm">
                                <Link href={route('admin.roles.index')}>Cancelar</Link>
                            </Button>
                            <Button type="submit" size="sm" className="btn-brand" disabled={processing || (editing && !isDirty)}>
                                {processing && <LoaderCircle className="size-4 animate-spin" />}
                                {editing ? 'Guardar cambios' : 'Crear rol'}
                            </Button>
                        </>
                    }
                />

                {/* 1. Nombre */}
                <div className="surface grid gap-2 rounded-xl p-5 sm:max-w-md">
                    <Label htmlFor="name">Nombre del rol</Label>
                    <Input
                        id="name"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        placeholder="Ej: Cajero, Contador, Recepción"
                        autoFocus={!editing}
                        required
                    />
                    <InputError message={errors.name} />
                    {editing && role.users_count > 0 && (
                        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                            <Info className="size-3.5" />
                            Los cambios afectan a {role.users_count} {role.users_count === 1 ? 'usuario' : 'usuarios'} con este rol.
                        </p>
                    )}
                </div>

                {/* 2. Permisos */}
                <div className="surface overflow-hidden rounded-xl">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                        <div>
                            <h2 className="font-display font-semibold">Permisos</h2>
                            <p className="text-muted-foreground text-sm">
                                <span className="num text-foreground font-medium">{data.permissions.length}</span> de {total} marcados
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => setData('permissions', [])}>
                                Quitar todos
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    setData(
                                        'permissions',
                                        catalog.modules.flatMap((m) => m.actions.map((a) => `${m.key}.${a}`)),
                                    )
                                }
                            >
                                Marcar todos
                            </Button>
                        </div>
                    </div>
                    <PermissionMatrix catalog={catalog} value={data.permissions} onChange={(permissions) => setData('permissions', permissions)} />
                    <InputError message={errors.permissions} className="px-5 pb-4" />
                </div>
            </form>
        </AdminLayout>
    );
}
