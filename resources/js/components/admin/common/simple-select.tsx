/**
 * SELECTOR SIMPLE a partir de una lista { id, name } (sucursales, proveedores…).
 *
 * Uso:
 *   <SimpleSelect options={branches} value={data.branch_id} onChange={(v) => setData('branch_id', v)} placeholder="Elige sucursal" />
 *   <SimpleSelect options={branches} value={filters.branch ?? ALL} onChange={...} allLabel="Todas las sucursales" />
 *
 * allLabel: agrega la opción "Todas" con valor ALL (sirve para filtros).
 */
import { ALL } from '@/components/admin/common/table-toolbar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface SimpleSelectProps {
    options: { id: number | string; name: string }[];
    value: string | number | null | undefined;
    onChange: (value: string) => void;
    placeholder?: string;
    allLabel?: string;
    className?: string;
    disabled?: boolean;
    id?: string;
}

export function SimpleSelect({ options, value, onChange, placeholder = 'Selecciona…', allLabel, className, disabled, id }: SimpleSelectProps) {
    const current = value === null || value === undefined || value === '' ? (allLabel ? ALL : '') : String(value);

    return (
        <Select value={current} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger id={id} className={cn('h-9', className)}>
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {allLabel && <SelectItem value={ALL}>{allLabel}</SelectItem>}
                {options.map((option) => (
                    <SelectItem key={option.id} value={String(option.id)}>
                        {option.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
