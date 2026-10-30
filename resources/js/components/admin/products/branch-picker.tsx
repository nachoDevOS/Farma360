/**
 * ELEGIR SUCURSAL EN LA FICHA DEL PRODUCTO (pages/admin/products/show.tsx, arriba a la derecha junto a Volver / Editar).
 * Un botón chico con la sucursal que se mira; al abrirlo, la lista: "Todas" (si el usuario no está asignado a una) y cada
 * sucursal con su stock, para cuántos días le alcanza (punto verde / ámbar / rojo) y su parte de lo vendido en 90 días.
 *
 *   const { current, loading, choose } = useBranchSwitch(product.id, branchFilter);
 *   <BranchPicker options={branchOptions} canSeeAll={canSeeAllBranches} branches={performance.branches} current={current}
 *                 loading={loading} totalStock={totalStock} units="tabletas" onChoose={choose} />
 *
 * Elegir pide al servidor solo lo que cambia (ver BRANCH_PROPS) y deja ?branch= en la dirección, como el inventario.
 */
import { coverageTone, daysText, type Performance, sum } from '@/components/admin/products/product-performance';
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
import { router } from '@inertiajs/react';
import { Building2, Check, ChevronDown, Loader2, type LucideIcon, Store } from 'lucide-react';
import { useState } from 'react';

/** Lo que depende de la sucursal elegida (ProductController@show): lo demás de la ficha no se vuelve a pedir. */
const BRANCH_PROPS = ['branchFilter', 'purchases', 'salesByMonth', 'performance'];

/**
 * Cambia la sucursal que se mira. current se mueve al instante (el botón muestra la nueva mientras carga);
 * loading = esperando al servidor (la página se atenúa).
 */
export function useBranchSwitch(productId: number, selected: number | null) {
    const [pending, setPending] = useState<number | null | undefined>(undefined);
    const current = pending === undefined ? selected : pending;
    const choose = (branchId: number | null) => {
        if (branchId === current) return;
        setPending(branchId);
        router.get(route('admin.products.show', productId), branchId ? { branch: branchId } : {}, {
            only: BRANCH_PROPS,
            preserveState: true,
            preserveScroll: true,
            replace: true,
            onFinish: () => setPending(undefined),
        });
    };
    return { current, loading: pending !== undefined, choose };
}

const DOT = { red: 'bg-red-500', amber: 'bg-amber-500', green: 'bg-emerald-500', slate: 'bg-muted-foreground/40' };

export function BranchPicker({
    options,
    canSeeAll,
    branches,
    current,
    loading,
    totalStock,
    units,
    onChoose,
}: {
    options: { id: number; name: string }[];
    /** Sin sucursal asignada: puede ver "Todas" */
    canSeeAll: boolean;
    branches: Performance['branches'];
    current: number | null;
    loading: boolean;
    totalStock: number;
    units: string;
    onChoose: (branchId: number | null) => void;
}) {
    const totalUnits = sum(branches, (b) => b.units);
    const currentName = current === null ? 'Todas las sucursales' : (options.find((o) => o.id === current)?.name ?? 'Sucursal');

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={cn('max-w-60', current !== null && 'border-primary/40 bg-primary/5 text-primary hover:bg-primary/10')}
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
                    <span className="text-muted-foreground text-[11px] font-normal">El precio y los costos son iguales en todas las sucursales.</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {canSeeAll && (
                    <Option
                        icon={Building2}
                        title="Todas las sucursales"
                        detail={`Stock ${totalStock.toLocaleString('es')} ${units}`}
                        active={current === null}
                        onSelect={() => onChoose(null)}
                    />
                )}
                {options.map((option) => {
                    const data = branches.find((b) => b.branch_id === option.id);
                    const stock = data?.stock ?? 0;
                    const coverage = data && data.daily_rate > 0 ? data.stock / data.daily_rate : null;
                    const tone = coverage === null ? (stock > 0 ? 'amber' : 'slate') : coverageTone(coverage);
                    return (
                        <Option
                            key={option.id}
                            icon={Store}
                            title={option.name}
                            detail={
                                coverage !== null
                                    ? `Stock ${stock.toLocaleString('es')} · alcanza ${daysText(coverage)}`
                                    : `Stock ${stock.toLocaleString('es')} · ${stock > 0 ? 'sin ventas en 90 días' : 'sin stock'}`
                            }
                            dot={DOT[tone]}
                            share={totalUnits > 0 && data?.units ? Math.round((data.units / totalUnits) * 100) : null}
                            active={current === option.id}
                            onSelect={() => onChoose(option.id)}
                        />
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function Option({
    icon: Icon,
    title,
    detail,
    dot,
    share,
    active,
    onSelect,
}: {
    icon: LucideIcon;
    title: string;
    detail: string;
    /** Color del punto: para cuántos días alcanza el stock */
    dot?: string;
    /** % de lo vendido en 90 días (null = no vendió) */
    share?: number | null;
    active: boolean;
    onSelect: () => void;
}) {
    return (
        <DropdownMenuItem onSelect={onSelect} className={cn('gap-2.5 py-2', active && 'bg-primary/5')}>
            <span
                className={cn(
                    'flex size-7 items-center justify-center rounded-md',
                    active ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground/70',
                )}
            >
                <Icon className="size-3.5!" />
            </span>
            <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-[13px] font-medium', active && 'text-primary')}>{title}</span>
                <span className="text-muted-foreground num flex items-center gap-1.5 text-[11px]">
                    {dot && <span className={cn('size-1.5 shrink-0 rounded-full', dot)} />}
                    <span className="truncate">{detail}</span>
                </span>
            </span>
            {active ? (
                <Check className="text-primary" />
            ) : (
                share !== undefined && share !== null && <span className="text-muted-foreground num text-[11px]">{share}%</span>
            )}
        </DropdownMenuItem>
    );
}
