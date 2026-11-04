/**
 * VENTANA PARA ELEGIR CUÁNTO DE UN PRODUCTO SE ENVÍA (pages/admin/transfers/create.tsx).
 *
 * Arriba se escribe el total y se reparte solo por lotes: salen primero los que vencen antes (FEFO) y los vencidos
 * no se usan solos. Con + Caja, + Blíster se suma de a un empaque. Abajo cada lote con − / + por si quieren otro reparto.
 *
 *   <TransferProductDialog product={...} initial={{ [batchId]: unidades }} editing={false} onConfirm={...} onClose={...} />
 */
import { ExpiryBadge } from '@/components/admin/common/doc-status';
import { StoredImage } from '@/components/admin/common/image-upload';
import { blockFractionKeys } from '@/components/admin/common/quantity-input';
import { plural, stockBreakdown } from '@/components/admin/products/presentation-levels';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type BatchLookup } from '@/types/admin/pharmacy';
import { Minus, Pill, Plus } from 'lucide-react';
import { useRef, useState } from 'react';

/** Un producto con sus lotes en la sucursal que envía, del que vence antes al que vence después. */
export type TransferProduct = Omit<BatchLookup, 'id' | 'batch_number' | 'expires_at' | 'stock' | 'unit_cost' | 'expired'> & {
    batches: BatchLookup[];
    /** Unidades disponibles entre todos los lotes */
    stock: number;
};

/** [id del lote => unidades que se envían] */
export type LotQuantities = Record<number, number>;

/** Junta los lotes que manda el servidor (una fila por lote) en un resultado por producto. */
export function groupByProduct(rows: BatchLookup[]): TransferProduct[] {
    const products = new Map<number, TransferProduct>();
    rows.forEach((row) => {
        const product = products.get(row.product_id);
        if (product) {
            product.batches.push(row);
            product.stock += row.stock;
        } else {
            products.set(row.product_id, { ...row, batches: [row] });
        }
    });
    return [...products.values()];
}

/** "1 tableta" / "3 tabletas" */
export function unitsText(units: number, baseUnit: string): string {
    return `${units.toLocaleString('es')} ${units === 1 ? baseUnit.toLowerCase() : plural(baseUnit)}`;
}

/** Saca las unidades de los lotes en orden; los vencidos no se usan solos. */
export function distribute(units: number, batches: BatchLookup[]): LotQuantities {
    const quantities: LotQuantities = {};
    let pending = units;
    batches
        .filter((batch) => !batch.expired)
        .forEach((batch) => {
            const take = Math.min(pending, batch.stock);
            if (take > 0) {
                quantities[batch.id] = take;
                pending -= take;
            }
        });
    return quantities;
}

const sumOf = (quantities: LotQuantities) => Object.values(quantities).reduce((sum, units) => sum + units, 0);

export function TransferProductDialog({
    product,
    initial,
    editing,
    onConfirm,
    onClose,
}: {
    product: TransferProduct;
    initial: LotQuantities;
    editing: boolean;
    onConfirm: (quantities: LotQuantities) => void;
    onClose: () => void;
}) {
    const [quantities, setQuantities] = useState<LotQuantities>(initial);
    const [typed, setTyped] = useState(sumOf(initial) > 0 ? String(sumOf(initial)) : '');
    const unitsInput = useRef<HTMLInputElement>(null);

    const units = sumOf(quantities);
    const usable = product.batches.filter((batch) => !batch.expired).reduce((sum, batch) => sum + batch.stock, 0);
    const overStock = Number(typed) > units;
    const canConfirm = (units > 0 || editing) && !overStock;
    const packages = product.presentations.filter((presentation) => presentation.factor > 1 && presentation.factor <= product.stock);
    const breakdown = stockBreakdown(units, product.presentations, product.base_unit);
    const value = product.batches.reduce((sum, batch) => sum + (quantities[batch.id] ?? 0) * batch.unit_cost, 0);

    const typeUnits = (text: string) => {
        setTyped(text);
        setQuantities(distribute(Math.max(0, Math.floor(Number(text) || 0)), product.batches));
    };

    const setLot = (batch: BatchLookup, lotUnits: number) => {
        const next = { ...quantities, [batch.id]: Math.min(batch.stock, Math.max(0, lotUnits)) };
        setQuantities(next);
        setTyped(String(sumOf(next)));
    };

    const confirm = () => {
        if (canConfirm) {
            onConfirm(Object.fromEntries(Object.entries(quantities).filter(([, lotUnits]) => lotUnits > 0)));
        }
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className="bg-card w-[calc(100%-2rem)] max-w-xl gap-0 overflow-hidden rounded-xl p-0 sm:rounded-xl"
                onOpenAutoFocus={(e) => {
                    e.preventDefault();
                    unitsInput.current?.focus();
                    unitsInput.current?.select();
                }}
                onCloseAutoFocus={(e) => e.preventDefault()}
                onKeyDown={(e) => {
                    // Enter agrega (sin enviar el formulario de la transferencia)
                    if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
                        e.preventDefault();
                        confirm();
                    }
                }}
            >
                <div className="bg-primary h-1" />
                <div className="flex items-center gap-3 px-5 pt-5 pr-12 pb-4">
                    <StoredImage
                        path={product.image}
                        alt={product.product_name}
                        fallback={<Pill className="size-5" />}
                        className="size-12 shrink-0 rounded-lg"
                    />
                    <div className="min-w-0">
                        <DialogTitle className="truncate text-[15px] leading-snug font-bold">{product.product_name}</DialogTitle>
                        <DialogDescription className="num mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="bg-muted rounded-md px-1.5 py-0.5 font-medium">
                                Disponible: {unitsText(product.stock, product.base_unit)}
                            </span>
                            {product.destination_stock !== null && (
                                <span className="bg-primary/10 text-primary rounded-md px-1.5 py-0.5 font-medium">
                                    En destino: {unitsText(product.destination_stock, product.base_unit)}
                                </span>
                            )}
                        </DialogDescription>
                    </div>
                </div>

                <div className="grid gap-4 px-5 pb-5">
                    <div className="bg-muted/40 grid gap-2.5 rounded-lg border px-4 py-3">
                        <label className="flex items-center justify-between gap-4">
                            <span className="min-w-0">
                                <span className="block text-sm font-semibold">¿Cuántas {plural(product.base_unit)} envías?</span>
                                <span className="text-muted-foreground block text-xs">Salen primero los lotes que vencen antes.</span>
                            </span>
                            <Input
                                ref={unitsInput}
                                type="number"
                                min={0}
                                step={1}
                                inputMode="numeric"
                                onKeyDown={blockFractionKeys}
                                value={typed}
                                onChange={(e) => typeUnits(e.target.value)}
                                placeholder="0"
                                className="num bg-card h-12 w-32 shrink-0 [appearance:textfield] text-center text-2xl font-bold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {packages.map((presentation) => (
                                <Button
                                    key={presentation.factor}
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => typeUnits(String(units + presentation.factor))}
                                >
                                    <Plus /> {presentation.name}
                                </Button>
                            ))}
                            <Button type="button" size="sm" variant="ghost" onClick={() => typeUnits(String(usable))}>
                                Enviar todo
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-1.5">
                        <div className="flex items-baseline justify-between gap-3">
                            <span className="text-sm font-semibold">Sale de estos lotes</span>
                            <span className="text-muted-foreground text-xs">Cámbialo con − / +</span>
                        </div>
                        <ul className="max-h-60 divide-y overflow-y-auto rounded-lg border">
                            {product.batches.map((batch) => {
                                const lotUnits = quantities[batch.id] ?? 0;
                                return (
                                    <li
                                        key={batch.id}
                                        className={cn('flex items-center gap-3 px-3 py-2.5 transition-colors', lotUnits > 0 && 'bg-primary/5')}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                                                Lote {batch.batch_number}
                                                <ExpiryBadge date={batch.expires_at} emptyLabel="Sin vencimiento" />
                                            </p>
                                            <p className="text-muted-foreground num text-xs">Hay {unitsText(batch.stock, product.base_unit)}</p>
                                        </div>
                                        <div className="stepper" data-active={lotUnits > 0 ? 'true' : undefined}>
                                            <button
                                                type="button"
                                                onClick={() => setLot(batch, lotUnits - 1)}
                                                disabled={lotUnits <= 0}
                                                aria-label="Menos"
                                            >
                                                <Minus className="size-3.5" />
                                            </button>
                                            <input
                                                type="number"
                                                min={0}
                                                max={batch.stock}
                                                className="text-sm"
                                                value={lotUnits}
                                                step={1}
                                                inputMode="numeric"
                                                onKeyDown={blockFractionKeys}
                                                onChange={(e) => setLot(batch, Math.floor(Number(e.target.value) || 0))}
                                                onFocus={(e) => e.target.select()}
                                                aria-label={`Cantidad del lote ${batch.batch_number}`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setLot(batch, lotUnits + 1)}
                                                disabled={lotUnits >= batch.stock}
                                                aria-label="Más"
                                            >
                                                <Plus className="size-3.5" />
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    {overStock && <p className="text-xs font-medium text-red-600">Solo hay {unitsText(usable, product.base_unit)} sin vencer.</p>}
                </div>

                <div className="bg-muted/40 grid gap-3 border-t px-5 py-3.5">
                    <div className="flex items-end justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-muted-foreground text-xs">Se envía</p>
                            <p className="text-sm font-semibold">
                                {units > 0 ? (breakdown ?? unitsText(units, product.base_unit)) : editing ? 'Se quita de la lista' : '—'}
                            </p>
                            {units > 0 && breakdown && <p className="text-muted-foreground num text-xs">{unitsText(units, product.base_unit)}</p>}
                        </div>
                        <div className="shrink-0 text-right">
                            <p className="text-muted-foreground text-xs">Valor al costo</p>
                            <p className="num text-2xl leading-none font-bold">{money(value)}</p>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant={editing && units === 0 ? 'destructive' : 'default'}
                            disabled={!canConfirm}
                            onClick={confirm}
                            className="disabled:opacity-100 disabled:[--btn-bg:var(--muted)] disabled:[--btn-fg:var(--muted-foreground)]"
                        >
                            {editing && units === 0 ? 'Quitar de la lista' : editing ? 'Actualizar' : 'Agregar al envío'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
