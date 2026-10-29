/**
 * PÁGINA: Registro de usuarios (ruta /register).
 * La procesa app/Http/Controllers/Auth/RegisteredUserController.php (crea el usuario con rol "user").
 */
import { Head, useForm } from '@inertiajs/react';
import { Check, LoaderCircle } from 'lucide-react';
import { FormEventHandler } from 'react';

import InputError from '@/components/shared/input-error';
import TextLink from '@/components/shared/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth/auth-layout';
import { cn } from '@/lib/utils';

type RegisterForm = {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
};

/**
 * Reglas que se muestran mientras escribes la contraseña.
 * (Solo visual: la validación real la hace Laravel.)
 */
function passwordChecks(password: string) {
    return [
        { label: 'Mínimo 8 caracteres', ok: password.length >= 8 },
        { label: 'Una mayúscula', ok: /[A-Z]/.test(password) },
        { label: 'Un número', ok: /\d/.test(password) },
        { label: 'Un símbolo', ok: /[^A-Za-z0-9]/.test(password) },
    ];
}

// Color y texto de la barra de seguridad según cuántas reglas se cumplen (0 a 4)
const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-500'];
const strengthLabels = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Excelente'];

export default function Register() {
    const { data, setData, post, processing, errors, reset } = useForm<RegisterForm>({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    const checks = passwordChecks(data.password);
    const score = checks.filter((c) => c.ok).length;
    // ¿Coinciden contraseña y confirmación? (borde verde o rojo)
    const matches = data.password_confirmation.length > 0 && data.password === data.password_confirmation;

    // Envía a POST /register. Si todo está bien, Laravel inicia sesión y te lleva al dashboard
    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('register'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <AuthLayout title="Crea tu cuenta" description="Completa tus datos para registrarte en el sistema">
            <Head title="Registro" />
            <form className="flex flex-col gap-6" onSubmit={submit}>
                <div className="grid gap-5">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Nombre completo</Label>
                        <Input
                            id="name"
                            type="text"
                            required
                            autoFocus
                            tabIndex={1}
                            autoComplete="name"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            disabled={processing}
                            placeholder="Juan Pérez"
                        />
                        <InputError message={errors.name} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="email">Correo electrónico</Label>
                        <Input
                            id="email"
                            type="email"
                            required
                            tabIndex={2}
                            autoComplete="email"
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            disabled={processing}
                            placeholder="correo@ejemplo.com"
                        />
                        <InputError message={errors.email} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="password">Contraseña</Label>
                        <Input
                            id="password"
                            type="password"
                            required
                            tabIndex={3}
                            autoComplete="new-password"
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            disabled={processing}
                            placeholder="••••••••"
                        />
                        {data.password && (
                            <div className="space-y-2">
                                <div className="flex gap-1">
                                    {[0, 1, 2, 3].map((i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                'h-1.5 flex-1 rounded-full transition-colors',
                                                i < score ? strengthColors[score] : 'bg-muted',
                                            )}
                                        />
                                    ))}
                                </div>
                                <p className="text-muted-foreground text-xs">
                                    Seguridad: <span className="text-foreground font-medium">{strengthLabels[score]}</span>
                                </p>
                                <ul className="grid grid-cols-2 gap-1">
                                    {checks.map((c) => (
                                        <li
                                            key={c.label}
                                            className={cn(
                                                'flex items-center gap-1.5 text-xs',
                                                c.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                                            )}
                                        >
                                            <Check className={cn('size-3', !c.ok && 'opacity-30')} />
                                            {c.label}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <InputError message={errors.password} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="password_confirmation">Confirmar contraseña</Label>
                        <Input
                            id="password_confirmation"
                            type="password"
                            required
                            tabIndex={4}
                            autoComplete="new-password"
                            value={data.password_confirmation}
                            onChange={(e) => setData('password_confirmation', e.target.value)}
                            disabled={processing}
                            placeholder="••••••••"
                            className={cn(data.password_confirmation && (matches ? 'border-emerald-500' : 'border-red-400'))}
                        />
                        <InputError message={errors.password_confirmation} />
                    </div>

                    <Button type="submit" className="btn-brand mt-2 h-10 w-full" tabIndex={5} disabled={processing}>
                        {processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                        Crear cuenta
                    </Button>
                </div>

                <div className="text-muted-foreground text-center text-sm">
                    ¿Ya tienes cuenta?{' '}
                    <TextLink href={route('login')} tabIndex={6}>
                        Inicia sesión
                    </TextLink>
                </div>
            </form>
        </AuthLayout>
    );
}
