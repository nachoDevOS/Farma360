/**
 * Pieza de Gestión de usuarios (se usa en pages/admin/users/index.tsx).
 */
import InputError from '@/components/shared/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type User } from '@/types';
import { type UserForm } from '@/types/admin/users';
import { useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler, useEffect } from 'react';

/**
 * Ventana para crear un usuario (user = null) o editarlo (user = el usuario elegido).
 * Envía el formulario a UserController@store o UserController@update.
 */
interface UserFormDialogProps {
    open: boolean;
    onClose: () => void;
    user: User | null;
    roles: string[];
    branches: { id: number; name: string }[];
}

/** Valor del selector de sucursal que significa "todas" (Radix no acepta value vacío). */
const ALL_BRANCHES = 'all';

export function UserFormDialog({ open, onClose, user, roles, branches }: UserFormDialogProps) {
    // Si recibimos un usuario estamos EDITANDO; si es null, CREANDO
    const isEdit = user !== null;
    // useForm de Inertia guarda: los campos (data), los errores de Laravel (errors) y si se está enviando (processing)
    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm<UserForm>({
        name: '',
        email: '',
        role: 'user',
        is_active: true,
        branch_id: '',
        password: '',
        password_confirmation: '',
    });

    // Cada vez que se abre el modal: cargamos los datos del usuario, o vaciamos el formulario
    useEffect(() => {
        if (!open) return;
        clearErrors();
        setData({
            name: user?.name ?? '',
            email: user?.email ?? '',
            // Rol por defecto al crear: Operador (si existe) o el primero de la lista
            role: user?.role ?? (roles.includes('Operador') ? 'Operador' : (roles[0] ?? '')),
            is_active: user?.is_active ?? true,
            branch_id: user?.branch_id ? String(user.branch_id) : '',
            password: '',
            password_confirmation: '',
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, user]);

    // Al enviar: PUT si editamos, POST si creamos. Si sale bien, cerramos el modal
    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        const options = {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                onClose();
            },
        };
        if (isEdit) put(route('admin.users.update', user.id), options);
        else post(route('admin.users.store'), options);
    };

    return (
        <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{isEdit ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? 'Actualiza los datos de la cuenta. Deja la contraseña vacía para no cambiarla.'
                            : 'Crea una cuenta con acceso inmediato.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Nombre completo</Label>
                        <Input id="name" value={data.name} onChange={(e) => setData('name', e.target.value)} placeholder="Juan Pérez" autoFocus />
                        <InputError message={errors.name} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="email">Correo electrónico</Label>
                        <Input
                            id="email"
                            type="email"
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            placeholder="correo@ejemplo.com"
                        />
                        <InputError message={errors.email} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label>Rol</Label>
                            <Select value={data.role} onValueChange={(value) => setData('role', value)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map((role) => (
                                        <SelectItem key={role} value={role}>
                                            {role}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <InputError message={errors.role} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Estado</Label>
                            <label className="flex h-10 cursor-pointer items-center gap-3 rounded-md border px-3">
                                <Checkbox checked={data.is_active} onCheckedChange={(checked) => setData('is_active', checked === true)} />
                                <span className="text-sm">Cuenta activa</span>
                            </label>
                            <InputError message={errors.is_active} />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label>Sucursal</Label>
                        <Select
                            value={data.branch_id || ALL_BRANCHES}
                            onValueChange={(value) => setData('branch_id', value === ALL_BRANCHES ? '' : value)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL_BRANCHES}>Todas las sucursales</SelectItem>
                                {branches.map((branch) => (
                                    <SelectItem key={branch.id} value={String(branch.id)}>
                                        {branch.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-muted-foreground text-xs">Con una sucursal asignada solo opera en ella (caja, ventas, inventario).</p>
                        <InputError message={errors.branch_id} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <Input
                                id="password"
                                type="password"
                                autoComplete="new-password"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                placeholder={isEdit ? 'Sin cambios' : '••••••••'}
                            />
                            <InputError message={errors.password} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password_confirmation">Confirmar</Label>
                            <Input
                                id="password_confirmation"
                                type="password"
                                autoComplete="new-password"
                                value={data.password_confirmation}
                                onChange={(e) => setData('password_confirmation', e.target.value)}
                                placeholder={isEdit ? 'Sin cambios' : '••••••••'}
                            />
                        </div>
                    </div>
                    <DialogFooter className="mt-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={processing} className="btn-brand">
                            {processing && <LoaderCircle className="size-4 animate-spin" />}
                            {isEdit ? 'Guardar cambios' : 'Crear usuario'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
