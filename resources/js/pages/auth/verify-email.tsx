/**
 * PÁGINA de autenticación (ruta /verify-email). La procesa app/Http/Controllers/Auth/EmailVerificationPromptController.php
 */
import { Head, useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler } from 'react';

import TextLink from '@/components/shared/text-link';
import { Button } from '@/components/ui/button';
import AuthLayout from '@/layouts/auth/auth-layout';

export default function VerifyEmail({ status }: { status?: string }) {
    const { post, processing } = useForm({});

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('verification.send'));
    };

    return (
        <AuthLayout title="Verifica tu correo" description="Te enviamos un enlace a tu correo. Haz clic en él para activar tu cuenta.">
            <Head title="Verificar correo" />

            {status === 'verification-link-sent' && (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                    Te enviamos un nuevo enlace de verificación al correo con el que te registraste.
                </div>
            )}

            <form onSubmit={submit} className="space-y-6 text-center">
                <Button disabled={processing} className="btn-brand h-10 w-full">
                    {processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                    Reenviar correo de verificación
                </Button>

                <TextLink href={route('logout')} method="post" className="mx-auto block text-sm">
                    Cerrar sesión
                </TextLink>
            </form>
        </AuthLayout>
    );
}
