/**
 * TABLA DE PERMISOS de un rol (se usa en pages/admin/roles/form.tsx).
 *
 * Filas = módulos del sistema · Columnas = acciones (Ver, Crear, Editar…).
 * Los módulos y acciones salen del catálogo config/roles.php: si agregas un módulo allí,
 * aparece aquí solo, sin tocar este archivo.
 *
 * Ayudas para el usuario:
 *   - Casilla al inicio de cada fila: marca / desmarca todo el módulo.
 *   - Al marcar Crear, Editar o Eliminar se marca "Ver" solo (sin ver no se puede usar el módulo).
 *   - Al desmarcar "Ver" se desmarca todo el módulo.
 */
import { useStackedLabels } from '@/components/admin/common/data-table';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { type PermissionCatalog, type PermissionModule } from '@/types/admin/roles';
import { useRef } from 'react';

interface PermissionMatrixProps {
    catalog: PermissionCatalog;
    /** Permisos marcados, ej: ['usuarios.ver', 'usuarios.crear'] */
    value: string[];
    onChange: (permissions: string[]) => void;
}

export function PermissionMatrix({ catalog, value, onChange }: PermissionMatrixProps) {
    const selected = new Set(value);
    const actionKeys = Object.keys(catalog.actions);
    const permissionsOf = (module: PermissionModule) => module.actions.map((action) => `${module.key}.${action}`);

    const toggle = (module: PermissionModule, action: string, checked: boolean) => {
        const next = new Set(selected);
        const name = `${module.key}.${action}`;
        const view = `${module.key}.ver`;

        if (checked) {
            next.add(name);
            // Cualquier acción necesita poder ver el módulo
            if (module.actions.includes('ver')) next.add(view);
        } else if (action === 'ver') {
            // Sin "ver" no tiene sentido ninguna otra acción del módulo
            permissionsOf(module).forEach((p) => next.delete(p));
        } else {
            next.delete(name);
        }

        onChange([...next]);
    };

    const toggleModule = (module: PermissionModule, checked: boolean) => {
        const next = new Set(selected);
        permissionsOf(module).forEach((p) => (checked ? next.add(p) : next.delete(p)));
        onChange([...next]);
    };

    // En celular cada módulo se ve como tarjeta con sus casillas (app.css → .table-stack)
    const tableRef = useRef<HTMLTableElement>(null);
    useStackedLabels(tableRef);

    return (
        <div className="overflow-x-auto">
            <table ref={tableRef} className="table-stack w-full text-[13px]">
                <thead className="text-muted-foreground bg-muted/60 border-b text-[11px] font-semibold tracking-wider uppercase">
                    <tr>
                        <th className="px-4 py-2.5 text-left">Módulo</th>
                        {actionKeys.map((action) => (
                            <th key={action} className="w-24 px-2 py-2.5 text-center">
                                {catalog.actions[action]}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {catalog.modules.map((module) => {
                        const all = permissionsOf(module);
                        const count = all.filter((p) => selected.has(p)).length;
                        const state = count === 0 ? false : count === all.length ? true : 'indeterminate';

                        return (
                            <tr key={module.key} className={cn('transition-colors', count > 0 && 'bg-primary/[0.03]')}>
                                <td className="px-4 py-3">
                                    <label className="flex cursor-pointer items-start gap-3">
                                        <Checkbox
                                            checked={state}
                                            onCheckedChange={(checked) => toggleModule(module, checked === true)}
                                            className="mt-0.5"
                                            aria-label={`Todo el módulo ${module.label}`}
                                        />
                                        <span className="grid gap-0.5">
                                            <span className="font-medium">{module.label}</span>
                                            {module.description && <span className="text-muted-foreground text-xs">{module.description}</span>}
                                        </span>
                                    </label>
                                </td>
                                {actionKeys.map((action) => (
                                    <td key={action} className="px-2 py-3 text-center">
                                        {module.actions.includes(action) ? (
                                            <Checkbox
                                                checked={selected.has(`${module.key}.${action}`)}
                                                onCheckedChange={(checked) => toggle(module, action, checked === true)}
                                                aria-label={`${catalog.actions[action]} ${module.label}`}
                                            />
                                        ) : (
                                            // Esta acción no existe para este módulo
                                            <span className="text-muted-foreground/40" aria-hidden>
                                                —
                                            </span>
                                        )}
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
