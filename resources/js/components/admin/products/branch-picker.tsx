/**
 * ELEGIR SUCURSAL EN LA FICHA DEL PRODUCTO (pages/admin/products/show.tsx, arriba a la derecha junto a Volver / Editar).
 * Usa el botón común BranchMenu (common/branch-menu.tsx): "Todas" (si el usuario no está asignado a una) y cada sucursal
 * con su stock, para cuántos días le alcanza (punto verde / ámbar / rojo) y su % de lo vendido en 90 días.
 *
 *   const { current, loading, choose } = useBranchSwitch(product.id, branchFilter);
 *   <BranchPicker options={branchOptions} canSeeAll={canSeeAllBranches} branches={performance.branches} current={current}
 *                 loading={loading} totalStock={totalStock} units="tabletas" onChoose={choose} />
 *
 * Elegir pide al servidor solo lo que cambia (ver BRANCH_PROPS) y deja ?branch= en la dirección, como el inventario.
 */
import { BranchMenu, type BranchMenuOption } from '@/components/admin/common/branch-menu';
import { coverageTone, daysText, type Performance, sum } from '@/components/admin/products/product-performance';
import { router } from '@inertiajs/react';
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
    const items: BranchMenuOption[] = options.map((option) => {
        const data = branches.find((b) => b.branch_id === option.id);
        const stock = data?.stock ?? 0;
        const coverage = data && data.daily_rate > 0 ? data.stock / data.daily_rate : null;
        return {
            id: option.id,
            name: option.name,
            detail:
                coverage !== null
                    ? `Stock ${stock.toLocaleString('es')} · alcanza ${daysText(coverage)}`
                    : `Stock ${stock.toLocaleString('es')} · ${stock > 0 ? 'sin ventas en 90 días' : 'sin stock'}`,
            dot: coverage === null ? (stock > 0 ? 'amber' : 'slate') : coverageTone(coverage),
            share: totalUnits > 0 && data?.units ? Math.round((data.units / totalUnits) * 100) : null,
        };
    });
    if (canSeeAll) {
        items.unshift({ id: null, name: 'Todas las sucursales', detail: `Stock ${totalStock.toLocaleString('es')} ${units}` });
    }

    return (
        <BranchMenu
            options={items}
            current={current}
            loading={loading}
            onChoose={onChoose}
            note="El precio y los costos son iguales en todas las sucursales."
        />
    );
}
