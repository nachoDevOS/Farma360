/*
 * PÁGINA GENÉRICA de catálogos simples: sucursales, proveedores, clientes, categorías, laboratorios,
 * principios activos, cajas y billetes. Todo lo que cambia entre uno y otro (título, campos, columnas,
 * rutas y permisos) lo manda Laravel en la prop `resource` (ver app/Http/Controllers/Admin/ResourceController.php).
 */
import { ConfirmDialog } from '@/components/admin/common/confirm-dialog';
import { DataTable, EmptyRow, Td, Th } from '@/components/admin/common/data-table';
import { PageHeader } from '@/components/admin/common/page-header';
import { ActionButton, RowActions } from '@/components/admin/common/row-actions';
import { TableToolbar } from '@/components/admin/common/table-toolbar';
import { StatusBadge } from '@/components/admin/common/user-badges';
import InputError from '@/components/shared/input-error';
import { Pagination } from '@/components/shared/pagination';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCan } from '@/hooks/use-can';
import { useFilters } from '@/hooks/use-filters';
import AdminLayout from '@/layouts/admin/admin-layout';
import { money } from '@/lib/format';
import { type Paginated } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import {
    Building2,
    Check,
    Coins,
    Contact,
    FlaskConical,
    FlaskRound,
    LoaderCircle,
    type LucideIcon,
    Monitor,
    Pencil,
    Plus,
    Stethoscope,
    Tags,
    Trash2,
    Truck,
} from 'lucide-react';
import { FormEventHandler, useEffect, useState } from 'react';

type Value = string | number | boolean | null;

/** Ícono de cada catálogo (por nombre de ruta). */
const resourceIcons: Record<string, LucideIcon> = {
    'admin.branches': Building2,
    'admin.suppliers': Truck,
    'admin.customers': Contact,
    'admin.categories': Tags,
    'admin.laboratories': FlaskRound,
    'admin.active-ingredients': FlaskConical,
    'admin.indications': Stethoscope,
    'admin.cash-registers': Monitor,
    'admin.denominations': Coins,
};
type Row = { id: number } & Record<string, unknown>;

interface Field {
    name: string;
    label: string;
    type: 'text' | 'number' | 'email' | 'select' | 'checkbox';
    options?: { value: string | number; label: string }[];
    placeholder?: string;
    default?: Value;
}

interface Column {
    key: string;
    label: string;
    type?: 'text' | 'boolean' | 'status' | 'money';
}

interface Resource {
    title: string;
    singular: string;
    description: string;
    /** Nombre base de las rutas, ej: "admin.suppliers" */
    route: string;
    /** Módulo de permisos, ej: "proveedores" */
    permission: string;
    fields: Field[];
    columns: Column[];
}

interface Props {
    resource: Resource;
    rows: Paginated<Row>;
    filters: { search?: string; per_page?: string };
}

/** Lee "branch.name" de una fila. */
const read = (row: Row, key: string): unknown =>
    key.split('.').reduce<unknown>((value, part) => (value as Record<string, unknown> | null)?.[part], row);

export default function ResourceIndex({ resource, rows, filters }: Props) {
    const can = useCan();
    const applyFilters = useFilters(`${resource.route}.index`, filters);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<Row | null>(null);
    const [deleting, setDeleting] = useState<Row | null>(null);

    // Cajas y billetes se administran con caja.editar (no tienen crear / eliminar propios)
    const perm = (action: 'crear' | 'editar' | 'eliminar') =>
        can(resource.permission === 'caja' ? 'caja.editar' : `${resource.permission}.${action}`);
    const showActions = perm('editar') || perm('eliminar');

    const openForm = (row: Row | null) => {
        setEditing(row);
        setFormOpen(true);
    };

    return (
        <AdminLayout breadcrumbs={[{ title: resource.title, href: route(`${resource.route}.index`) }]}>
            <Head title={resource.title} />
            <div className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                <PageHeader
                    icon={resourceIcons[resource.route] ?? Tags}
                    title={resource.title}
                    description={resource.description}
                    actions={
                        perm('crear') && (
                            <Button size="sm" className="btn-brand" onClick={() => openForm(null)}>
                                <Plus /> Nuevo
                            </Button>
                        )
                    }
                />

                <div className="surface overflow-hidden rounded-xl">
                    <TableToolbar
                        perPage={Number(filters.per_page ?? 10)}
                        onPerPageChange={(n) => applyFilters({ per_page: String(n) })}
                        search={filters.search ?? ''}
                        onSearch={(search) => applyFilters({ search })}
                    />
                    <DataTable
                        head={
                            <>
                                {resource.columns.map((column) => (
                                    <Th key={column.key} align={column.type === 'money' ? 'right' : 'left'}>
                                        {column.label}
                                    </Th>
                                ))}
                                {showActions && <Th align="right">Acciones</Th>}
                            </>
                        }
                    >
                        {rows.data.map((row) => (
                            <tr key={row.id}>
                                {resource.columns.map((column) => (
                                    <Td key={column.key} align={column.type === 'money' ? 'right' : 'left'}>
                                        <Cell column={column} value={read(row, column.key)} />
                                    </Td>
                                ))}
                                {showActions && (
                                    <Td align="right">
                                        <RowActions>
                                            {perm('editar') && <ActionButton icon={Pencil} label="Editar" onClick={() => openForm(row)} />}
                                            {perm('eliminar') && (
                                                <ActionButton icon={Trash2} label="Eliminar" tone="danger" onClick={() => setDeleting(row)} />
                                            )}
                                        </RowActions>
                                    </Td>
                                )}
                            </tr>
                        ))}
                        {rows.data.length === 0 && <EmptyRow colSpan={resource.columns.length + 1} />}
                    </DataTable>
                    <Pagination paginator={rows} />
                </div>
            </div>

            <ResourceFormDialog resource={resource} open={formOpen} row={editing} onClose={() => setFormOpen(false)} />
            <ConfirmDialog
                open={deleting !== null}
                onClose={() => setDeleting(null)}
                title={`¿Eliminar ${resource.singular.toLowerCase()}?`}
                description="Deja de aparecer en el sistema, pero queda guardado (eliminación lógica)."
                confirmLabel="Eliminar"
                destructive
                onConfirm={(done) =>
                    deleting && router.delete(route(`${resource.route}.destroy`, deleting.id), { preserveScroll: true, onFinish: done })
                }
            />
        </AdminLayout>
    );
}

function Cell({ column, value }: { column: Column; value: unknown }) {
    if (column.type === 'status') return <StatusBadge active={Boolean(value)} />;
    if (column.type === 'boolean') return value ? <Check className="size-4 text-emerald-600" /> : <span className="text-muted-foreground">—</span>;
    if (column.type === 'money') return <>{money(value as string)}</>;
    if (value === null || value === undefined || value === '') return <span className="text-muted-foreground">—</span>;
    return <>{String(value)}</>;
}

/** Formulario que se arma solo a partir de resource.fields. */
function ResourceFormDialog({ resource, open, row, onClose }: { resource: Resource; open: boolean; row: Row | null; onClose: () => void }) {
    const empty = () =>
        Object.fromEntries(resource.fields.map((f) => [f.name, f.default ?? (f.type === 'checkbox' ? false : '')])) as Record<string, Value>;
    const { data, setData, post, put, processing, errors, clearErrors } = useForm<Record<string, Value>>(empty());

    useEffect(() => {
        if (!open) return;
        clearErrors();
        setData(
            row
                ? (Object.fromEntries(resource.fields.map((f) => [f.name, (row[f.name] as Value) ?? (f.type === 'checkbox' ? false : '')])) as Record<
                      string,
                      Value
                  >)
                : empty(),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, row]);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: () => onClose() };
        if (row) put(route(`${resource.route}.update`, row.id), options);
        else post(route(`${resource.route}.store`), options);
    };

    return (
        <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {row ? 'Editar' : 'Nuevo'}: {resource.singular.toLowerCase()}
                    </DialogTitle>
                    <DialogDescription>{resource.description}</DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="grid gap-4">
                    {resource.fields.map((field, i) => (
                        <div key={field.name} className="grid gap-2">
                            {field.type === 'checkbox' ? (
                                <label className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5">
                                    <Checkbox
                                        checked={Boolean(data[field.name])}
                                        onCheckedChange={(checked) => setData(field.name, checked === true)}
                                    />
                                    <span className="text-sm">{field.label}</span>
                                </label>
                            ) : (
                                <>
                                    <Label htmlFor={field.name}>{field.label}</Label>
                                    {field.type === 'select' ? (
                                        <Select value={String(data[field.name] ?? '')} onValueChange={(value) => setData(field.name, value)}>
                                            <SelectTrigger id={field.name}>
                                                <SelectValue placeholder="Selecciona…" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {field.options?.map((option) => (
                                                    <SelectItem key={option.value} value={String(option.value)}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <Input
                                            id={field.name}
                                            type={field.type}
                                            step={field.type === 'number' ? '0.01' : undefined}
                                            value={String(data[field.name] ?? '')}
                                            onChange={(e) => setData(field.name, e.target.value)}
                                            placeholder={field.placeholder}
                                            autoFocus={i === 0}
                                        />
                                    )}
                                </>
                            )}
                            <InputError message={errors[field.name]} />
                        </div>
                    ))}
                    <DialogFooter className="mt-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={processing} className="btn-brand">
                            {processing && <LoaderCircle className="size-4 animate-spin" />}
                            {row ? 'Guardar cambios' : 'Crear'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
