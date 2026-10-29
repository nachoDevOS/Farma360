/**
 * PÁGINA: Ajustes > Contraseña (ruta /settings/password).
 * La procesa app/Http/Controllers/Admin/Settings/PasswordController.php
 */
import InputError from '@/components/shared/input-error';
import { PasswordInput } from '@/components/shared/password-input';
import AdminLayout from '@/layouts/admin/admin-layout';
import SettingsLayout, { SettingsCard } from '@/layouts/admin/settings-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Transition } from '@headlessui/react';
import { Head, useForm } from '@inertiajs/react';
import { Check, CheckCircle2, Circle, LoaderCircle } from 'lucide-react';
import { FormEventHandler, useRef } from 'react';

import HeadingSmall from '@/components/admin/common/heading-small';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Contraseña',
        href: '/settings/password',
    },
];

/** Un requisito de la lista: círculo vacío o tilde verde cuando se cumple. */
function Rule({ ok, children }: { ok: boolean; children: React.ReactNode }) {
    return (
        <li
            className={cn(
                'flex items-center gap-2 text-sm transition-colors',
                ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
            )}
        >
            {ok ? <Check className="size-4" /> : <Circle className="size-4 opacity-50" />}
            {children}
        </li>
    );
}

export default function Password() {
    const passwordInput = useRef<HTMLInputElement>(null);
    const currentPasswordInput = useRef<HTMLInputElement>(null);

    const { data, setData, errors, put, reset, processing, recentlySuccessful } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    // Requisitos que se van marcando mientras escribe (los mismos que valida el servidor)
    const longEnough = data.password.length >= 8;
    const matches = data.password.length > 0 && data.password === data.password_confirmation;
    const different = data.password.length > 0 && data.password !== data.current_password;
    const ready = data.current_password.length > 0 && longEnough && matches;

    // PUT /settings/password. Si hay error, vaciamos el campo con problema y lo enfocamos
    const updatePassword: FormEventHandler = (e) => {
        e.preventDefault();

        put(route('password.update'), {
            preserveScroll: true,
            onSuccess: () => reset(),
            onError: (errors) => {
                if (errors.password) {
                    reset('password', 'password_confirmation');
                    passwordInput.current?.focus();
                }

                if (errors.current_password) {
                    reset('current_password');
                    currentPasswordInput.current?.focus();
                }
            },
        });
    };

    return (
        <AdminLayout breadcrumbs={breadcrumbs}>
            <Head title="Contraseña" />

            <SettingsLayout>
                <SettingsCard>
                    <HeadingSmall title="Cambiar contraseña" description="Escribe tu contraseña actual y luego la nueva dos veces." />

                    <form onSubmit={updatePassword} className="space-y-6">
                        <div className="grid gap-2 sm:max-w-sm">
                            <Label htmlFor="current_password">1. Tu contraseña actual</Label>
                            <PasswordInput
                                id="current_password"
                                ref={currentPasswordInput}
                                value={data.current_password}
                                onChange={(e) => setData('current_password', e.target.value)}
                                autoComplete="current-password"
                                placeholder="La que usas para entrar"
                            />
                            <InputError message={errors.current_password} />
                        </div>

                        <div className="grid gap-6 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="password">2. Nueva contraseña</Label>
                                <PasswordInput
                                    id="password"
                                    ref={passwordInput}
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    autoComplete="new-password"
                                    placeholder="Mínimo 8 caracteres"
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password_confirmation">3. Repite la nueva contraseña</Label>
                                <PasswordInput
                                    id="password_confirmation"
                                    value={data.password_confirmation}
                                    onChange={(e) => setData('password_confirmation', e.target.value)}
                                    autoComplete="new-password"
                                    placeholder="Escríbela otra vez"
                                />
                                <InputError message={errors.password_confirmation} />
                            </div>
                        </div>

                        <ul className="bg-muted/50 space-y-1.5 rounded-lg p-4" aria-live="polite">
                            <Rule ok={longEnough}>Tiene al menos 8 caracteres</Rule>
                            <Rule ok={matches}>Las dos contraseñas nuevas son iguales</Rule>
                            <Rule ok={different}>Es distinta de la actual</Rule>
                        </ul>

                        <div className="flex flex-wrap items-center gap-4">
                            <Button disabled={processing || !ready} className="btn-brand h-10 px-5">
                                {processing && <LoaderCircle className="size-4 animate-spin" />}
                                Cambiar contraseña
                            </Button>

                            <Transition
                                show={recentlySuccessful}
                                enter="transition ease-in-out"
                                enterFrom="opacity-0"
                                leave="transition ease-in-out"
                                leaveTo="opacity-0"
                            >
                                <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="size-4" /> Listo, tu contraseña se cambió
                                </p>
                            </Transition>
                        </div>
                    </form>
                </SettingsCard>
            </SettingsLayout>
        </AdminLayout>
    );
}
