/**
 * PÁGINA: Ajustes > Perfil (ruta /settings/profile).
 * La procesa app/Http/Controllers/Admin/Settings/ProfileController.php
 */
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Transition } from '@headlessui/react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { CheckCircle2, LoaderCircle } from 'lucide-react';
import { FormEventHandler } from 'react';

import HeadingSmall from '@/components/admin/common/heading-small';
import { RoleBadge, UserAvatar } from '@/components/admin/common/user-badges';
import InputError from '@/components/shared/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AdminLayout from '@/layouts/admin/admin-layout';
import SettingsLayout, { SettingsCard } from '@/layouts/admin/settings-layout';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Ajustes de perfil',
        href: '/settings/profile',
    },
];

export default function Profile({ mustVerifyEmail, status }: { mustVerifyEmail: boolean; status?: string }) {
    const { auth } = usePage<SharedData>().props;

    // Formulario con el nombre y correo actuales del usuario
    const { data, setData, patch, errors, processing, recentlySuccessful, isDirty } = useForm({
        name: auth.user.name,
        email: auth.user.email,
    });

    // PATCH /settings/profile (ProfileController@update)
    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        patch(route('profile.update'));
    };

    return (
        <AdminLayout breadcrumbs={breadcrumbs}>
            <Head title="Ajustes de perfil" />

            <SettingsLayout>
                <SettingsCard>
                    <div className="flex items-center gap-4">
                        <UserAvatar name={auth.user.name} className="size-14 text-base" />
                        <div className="min-w-0">
                            <p className="font-display truncate text-lg font-semibold">{auth.user.name}</p>
                            <p className="text-muted-foreground truncate text-sm">{auth.user.email}</p>
                            <RoleBadge role={auth.user.role} className="mt-1.5" />
                        </div>
                    </div>
                </SettingsCard>

                <SettingsCard>
                    <HeadingSmall title="Tus datos" description="Corrige tu nombre o tu correo y presiona Guardar cambios." />

                    <form onSubmit={submit} className="space-y-6">
                        <div className="grid gap-6 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Nombre completo</Label>
                                <Input
                                    id="name"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    required
                                    autoComplete="name"
                                    placeholder="Nombre completo"
                                />
                                <InputError message={errors.name} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="email">Correo electrónico</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    required
                                    autoComplete="username"
                                    placeholder="correo@ejemplo.com"
                                />
                                <p className="text-muted-foreground text-xs">Con este correo entras al sistema.</p>
                                <InputError message={errors.email} />
                            </div>
                        </div>

                        {mustVerifyEmail && auth.user.email_verified_at === null && (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                                Tu correo aún no está verificado.{' '}
                                <Link
                                    href={route('verification.send')}
                                    method="post"
                                    as="button"
                                    className="font-medium underline underline-offset-4"
                                >
                                    Reenviar correo de verificación.
                                </Link>
                                {status === 'verification-link-sent' && (
                                    <p className="mt-2 font-medium text-emerald-600">Te enviamos un nuevo enlace de verificación.</p>
                                )}
                            </div>
                        )}

                        <div className="flex items-center gap-4">
                            <Button disabled={processing || !isDirty} className="btn-brand h-10 px-5">
                                {processing && <LoaderCircle className="size-4 animate-spin" />}
                                Guardar cambios
                            </Button>
                            {!isDirty && !recentlySuccessful && <span className="text-muted-foreground text-sm">Sin cambios por guardar</span>}

                            <Transition
                                show={recentlySuccessful}
                                enter="transition ease-in-out"
                                enterFrom="opacity-0"
                                leave="transition ease-in-out"
                                leaveTo="opacity-0"
                            >
                                <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="size-4" /> Listo, tus datos se guardaron
                                </p>
                            </Transition>
                        </div>
                    </form>
                </SettingsCard>
            </SettingsLayout>
        </AdminLayout>
    );
}
