/**
 * BOTÓN PARA ELEGIR SUCURSAL (arriba a la derecha de una ficha, junto a Volver / Editar).
 * Muestra la sucursal que se mira; al abrirlo, la lista con un detalle por sucursal (stock, para cuántos días alcanza…),
 * un punto de color de estado y, si se pasa, el % de lo vendido. Lo usan la ficha del producto
 * (products/branch-picker.tsx) y la de inventario (pages/admin/inventory/show.tsx).
 *
 *   <BranchMenu
 *       note="Lotes, movimientos y gráficos son de la sucursal elegida."
 *       options={[{ id: null, name: 'Todas las sucursales', detail: 'Stock 110' }, { id: 3, name: 'Central', detail: 'Stock 40', dot: 'green', share: 60 }]}
 *       current={3}
 *       loading={false}
 *       onChoose={(id) => …}
 *   />
 *
 * id: null = "Todas las sucursales" (ícono de edificio). Con una sucursal elegida el botón va en azul, para que se note
 * que se está mirando solo una (en el inventario siempre; en el producto, salvo con "Todas").
 */
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Building2, Check, ChevronDown, Loader2, Store } from 'lucide-react';

export interface BranchMenuOption {
    /** null = todas las sucursales */
    id: number | null;
    name: string;
    /** Línea chica debajo del nombre: "Stock 110 · alcanza 23 días" */
    detail?: string;
    /** Punto de estado junto al detalle */
    dot?: 'red' | 'amber' | 'green' | 'slate';
    /** % de lo vendido (a la derecha) */
    share?: number | null;
}

const DOT = { red: 'bg-red-500', amber: 'bg-amber-500', green: 'bg-emerald-500', slate: 'bg-muted-foreground/40' };

export function BranchMenu({
    options,
    current,
    loading = false,
    onChoose,
    note,
}: {
    options: BranchMenuOption[];
    current: number | null;
    /** Esperando al servidor: el ícono del botón gira */
    loading?: boolean;
    onChoose: (branchId: number | null) => void;
    /** Aclaración bajo el título del menú */
    note?: string;
}) {
    const currentName = options.find((o) => o.id === current)?.name ?? 'Sucursal';
    const highlight = current !== null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={cn('max-w-60', highlight && 'border-primary/40 bg-primary/5 text-primary hover:bg-primary/10')}
                    aria-label={`Sucursal: ${currentName}`}
                >
                    {loading ? <Loader2 className="animate-spin" /> : current === null ? <Building2 /> : <Store />}
                    <span className="truncate">{currentName}</span>
                    <ChevronDown className="opacity-60" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="grid gap-0.5">
                    <span className="text-sm">Ver la información de</span>
                    {note && <span className="text-muted-foreground text-[11px] font-normal">{note}</span>}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {options.map((option) => {
                    const active = option.id === current;
                    const Icon = option.id === null ? Building2 : Store;
                    return (
                        <DropdownMenuItem
                            key={option.id ?? 'all'}
                            onSelect={() => option.id !== current && onChoose(option.id)}
                            className={cn('gap-2.5 py-2', active && 'bg-primary/5')}
                        >
                            <span
                                className={cn(
                                    'flex size-7 items-center justify-center rounded-md',
                                    active ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground/70',
                                )}
                            >
                                <Icon className="size-3.5!" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className={cn('block truncate text-[13px] font-medium', active && 'text-primary')}>{option.name}</span>
                                {option.detail && (
                                    <span className="text-muted-foreground num flex items-center gap-1.5 text-[11px]">
                                        {option.dot && <span className={cn('size-1.5 shrink-0 rounded-full', DOT[option.dot])} />}
                                        <span className="truncate">{option.detail}</span>
                                    </span>
                                )}
                            </span>
                            {active ? (
                                <Check className="text-primary" />
                            ) : (
                                option.share !== undefined &&
                                option.share !== null && <span className="text-muted-foreground num text-[11px]">{option.share}%</span>
                            )}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
