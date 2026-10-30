/**
 * EDITOR DE PRESENTACIONES POR NIVELES del formulario de producto (pages/admin/products/form.tsx).
 *
 * Una tabla: la primera fila es la unidad base (tableta) y cada empaque dice qué contiene
 * (Caja contiene 10 blísteres). Debajo: botones rápidos para agregar empaques y un resumen en palabras
 * ("1 Caja = 10 blísteres = 100 tabletas") para confirmar que quedó bien.
 * La lógica (factores, nombres, precios sugeridos) está en presentation-levels.ts.
 *
 *   <PresentationLevelsEditor rows={...} baseUnit={...} errors={...} onRowsChange={...} onBaseUnitChange={...} />
 */
import { ActionButton } from '@/components/admin/common/row-actions';
import { SimpleSelect } from '@/components/admin/common/simple-select';
import { BaseUnitHelp, COMMON_BASE_UNITS } from '@/components/admin/products/base-unit-help';
import {
    buyOnlyOutermost,
    contentsText,
    factorsOf,
    levelName,
    PACKAGE_TYPES,
    plural,
    repeatedInnerName,
    suggestedPrice,
    upperFirst,
    type LevelRow,
} from '@/components/admin/products/presentation-levels';
import InputError from '@/components/shared/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { CornerDownRight, Plus, ShoppingCart, Store, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface Props {
    rows: LevelRow[];
    baseUnit: string;
    errors: Record<string, string | undefined>;
    /** Recibe las filas nuevas (el formulario recalcula los precios sugeridos) */
    onRowsChange: (rows: LevelRow[]) => void;
    onBaseUnitChange: (value: string) => void;
}

/** Empaques que se agregan con un clic. */
const QUICK_PACKAGES = ['Blíster', 'Caja', 'Frasco', 'Sobre'];

const COLUMNS = 'lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,1.1fr)_4.5rem_4.5rem_minmax(0,1fr)_2.25rem]';

export function PresentationLevelsEditor({ rows, baseUnit, errors, onRowsChange, onBaseUnitChange }: Props) {
    const factors = factorsOf(rows);
    const units = plural(baseUnit) || 'unidades';

    // Mientras el usuario no toque "Se compra", al agregar o quitar empaques se compra solo el más grande.
    // Un producto que ya existe se respeta tal como está guardado.
    const [purchaseTouched, setPurchaseTouched] = useState(rows.some((r) => r.id !== undefined));
    const changeLevels = (next: LevelRow[]) => onRowsChange(purchaseTouched ? next : buyOnlyOutermost(next));

    const setRow = (index: number, patch: Partial<LevelRow>) => onRowsChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));

    // Un empaque nuevo contiene al último (el más grande hasta ahora)
    const addLevel = (pkg: string) =>
        changeLevels([
            ...rows,
            {
                parent: rows.length - 1,
                package: pkg,
                contains: '',
                sale_price: '',
                barcode: '',
                is_sellable: true,
                is_purchasable: true,
                auto: true,
            },
        ]);

    // Solo se quita un empaque que no contiene a otro; los de afuera corren su índice
    const removeLevel = (index: number) =>
        changeLevels(
            rows.filter((_, i) => i !== index).map((r) => ({ ...r, parent: r.parent !== null && r.parent > index ? r.parent - 1 : r.parent })),
        );

    // Para "contiene 10 ___": tabletas, blísteres (10 tabletas)
    const innerLabel = (index: number) =>
        upperFirst(index === 0 ? units : `${plural(rows[index].package) || 'empaques'} (${factors[index] || '?'} ${units})`);
    const depthOf = (index: number): number => (rows[index].parent === null ? 0 : 1 + depthOf(rows[index].parent as number));

    const soldNames = rows.flatMap((r, i) => (r.is_sellable ? [levelName(rows, i, baseUnit)] : []));
    const boughtNames = rows.flatMap((r, i) => (r.is_purchasable ? [levelName(rows, i, baseUnit)] : []));

    return (
        <div className="grid gap-4">
            <div className="overflow-hidden rounded-lg border">
                {/* Encabezado (solo en pantallas grandes; en el celular cada campo trae su etiqueta) */}
                <div
                    className={cn(
                        'bg-muted/60 text-muted-foreground hidden gap-3 px-3 py-2 text-[11px] font-semibold tracking-wider uppercase lg:grid',
                        COLUMNS,
                    )}
                >
                    <span>Presentación</span>
                    <span>Contiene</span>
                    <span>Precio de venta</span>
                    <span className="text-center">Se vende</span>
                    <span className="text-center">Se compra</span>
                    <span>Código de barras</span>
                    <span />
                </div>

                {rows.map((r, i) => {
                    const isBase = i === 0;
                    const price = Number(r.sale_price);
                    const suggested = suggestedPrice(rows, i);
                    const differs = !r.auto && suggested !== null && price > 0 && Math.abs(suggested - price) >= 0.01;
                    const hasOuter = rows.some((other) => other.parent === i);
                    const depth = Math.min(depthOf(i), 3);
                    const repeated = isBase ? null : repeatedInnerName(rows, i, baseUnit);
                    const packageError =
                        errors[`presentations.${i}.package`] ??
                        (repeated ? `No puede llamarse igual que lo que contiene (${repeated}). Ej: Caja, Paquete.` : undefined);

                    return (
                        <div
                            key={r.id ?? `new-${i}`}
                            className={cn(
                                'grid items-start gap-3 border-t px-3 py-3 first-of-type:border-t-0 sm:grid-cols-2',
                                COLUMNS,
                                isBase && 'bg-primary/[0.03]',
                            )}
                        >
                            {/* Presentación */}
                            <div className="grid gap-1.5" style={{ paddingLeft: depth > 1 ? `${(depth - 1) * 1}rem` : undefined }}>
                                <MobileLabel>Presentación</MobileLabel>
                                {isBase ? (
                                    <>
                                        <Input
                                            list="base-units"
                                            value={baseUnit}
                                            onChange={(e) => onBaseUnitChange(upperFirst(e.target.value))}
                                            placeholder="Tableta"
                                            aria-label="Unidad base"
                                        />
                                        <div className="flex items-center gap-2">
                                            <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[11px] font-semibold">
                                                Unidad base
                                            </span>
                                            <BaseUnitHelp />
                                        </div>
                                        <datalist id="base-units">
                                            {COMMON_BASE_UNITS.map((unit) => (
                                                <option key={unit} value={unit} />
                                            ))}
                                        </datalist>
                                        <InputError message={errors.base_unit} />
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-1.5">
                                            <CornerDownRight className="text-muted-foreground size-4 shrink-0" />
                                            <Input
                                                list="package-types"
                                                value={r.package}
                                                onChange={(e) => setRow(i, { package: upperFirst(e.target.value) })}
                                                placeholder="Caja"
                                                aria-label="Empaque"
                                                aria-invalid={!!packageError}
                                                className={cn(packageError && 'border-destructive')}
                                            />
                                        </div>
                                        <p className="text-muted-foreground truncate pl-5.5 text-xs">{levelName(rows, i, baseUnit)}</p>
                                        <InputError message={packageError} />
                                    </>
                                )}
                            </div>

                            {/* Contiene */}
                            <div className="grid gap-1.5">
                                <MobileLabel>Contiene</MobileLabel>
                                {isBase ? (
                                    <p className="text-muted-foreground text-xs lg:pt-2.5">Lo más chico que vendes. El stock se cuenta en {units}.</p>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number"
                                                min={2}
                                                value={r.contains}
                                                onChange={(e) => setRow(i, { contains: e.target.value })}
                                                placeholder="Cant."
                                                className="w-20 shrink-0"
                                                aria-label="Cuántas trae"
                                            />
                                            {i === 1 ? (
                                                <span className="text-sm">{innerLabel(0)}</span>
                                            ) : (
                                                <SimpleSelect
                                                    options={rows.slice(0, i).map((_, j) => ({ id: j, name: innerLabel(j) }))}
                                                    value={r.parent}
                                                    onChange={(v) => setRow(i, { parent: Number(v) })}
                                                    className="h-9 min-w-0 flex-1"
                                                />
                                            )}
                                        </div>
                                        {i > 1 && factors[i] > 0 && (
                                            <p className="text-muted-foreground text-xs">
                                                = {factors[i]} {units}
                                            </p>
                                        )}
                                        <InputError message={errors[`presentations.${i}.contains`] ?? errors[`presentations.${i}.parent_index`]} />
                                    </>
                                )}
                            </div>

                            {/* Precio */}
                            <div className="grid gap-1.5">
                                <MobileLabel>Precio de venta</MobileLabel>
                                <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={r.is_sellable ? r.sale_price : ''}
                                    disabled={!r.is_sellable}
                                    placeholder={r.is_sellable ? '0,00' : 'No se vende'}
                                    onChange={(e) => setRow(i, { sale_price: e.target.value, auto: false })}
                                    aria-label="Precio de venta"
                                />
                                {r.is_sellable && (
                                    <PriceHint
                                        unitPrice={factors[i] > 1 && price > 0 ? price / factors[i] : null}
                                        baseUnit={baseUnit}
                                        auto={r.auto && price > 0}
                                        suggested={differs ? suggested : null}
                                        price={price}
                                        onUseSuggested={() => suggested !== null && setRow(i, { sale_price: suggested.toFixed(2), auto: true })}
                                    />
                                )}
                                <InputError message={errors[`presentations.${i}.sale_price`]} />
                            </div>

                            {/* Se vende / se compra */}
                            <Toggle
                                checked={r.is_sellable}
                                onChange={(v) => setRow(i, { is_sellable: v })}
                                label="Se vende"
                                hint="en el punto de venta"
                            />
                            <Toggle
                                checked={r.is_purchasable}
                                onChange={(v) => {
                                    setPurchaseTouched(true);
                                    setRow(i, { is_purchasable: v });
                                }}
                                label="Se compra"
                                hint="al proveedor"
                            />

                            {/* Código de barras */}
                            <div className="grid gap-1.5">
                                <MobileLabel>Código de barras</MobileLabel>
                                <Input
                                    value={r.barcode}
                                    onChange={(e) => setRow(i, { barcode: e.target.value })}
                                    placeholder="Opcional"
                                    aria-label="Código de barras"
                                />
                                <InputError message={errors[`presentations.${i}.barcode`]} />
                            </div>

                            <div className="flex justify-end lg:pt-0.5">
                                {!isBase && (
                                    <ActionButton
                                        icon={Trash2}
                                        label="Quitar empaque"
                                        tone="danger"
                                        disabled={hasOuter}
                                        disabledReason="Primero quita el empaque que lo contiene"
                                        onClick={() => removeLevel(i)}
                                    />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <datalist id="package-types">
                {PACKAGE_TYPES.map((type) => (
                    <option key={type} value={type} />
                ))}
            </datalist>

            {/* Agregar empaque con un clic */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-sm">
                    {rows.length === 1 ? `¿Las ${units} vienen en blíster, caja o frasco? Agrégalo:` : 'Agregar otro empaque:'}
                </span>
                {QUICK_PACKAGES.map((pkg) => (
                    <Button key={pkg} type="button" size="sm" variant="outline" onClick={() => addLevel(pkg)}>
                        <Plus /> {pkg}
                    </Button>
                ))}
                <Button type="button" size="sm" variant="ghost" onClick={() => addLevel('')}>
                    <Plus /> Otro
                </Button>
            </div>

            {/* Resumen en palabras para confirmar */}
            <div className="bg-muted/40 grid gap-2 rounded-lg border p-3 text-sm">
                <p className="font-semibold">Así queda</p>
                {rows.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                        {rows.slice(1).map((_, k) => (
                            <span key={k} className="bg-card rounded-md border px-2 py-1 text-xs">
                                {contentsText(rows, k + 1, baseUnit)}
                            </span>
                        ))}
                    </div>
                )}
                <p className="flex flex-wrap items-center gap-1.5 text-xs">
                    <Store className="text-primary size-3.5" />
                    <span className="text-muted-foreground">En el punto de venta:</span>
                    <span className="font-medium">{soldNames.join(' · ') || 'ninguna'}</span>
                </p>
                <p className="flex flex-wrap items-center gap-1.5 text-xs">
                    <ShoppingCart className="text-primary size-3.5" />
                    <span className="text-muted-foreground">Al registrar compras:</span>
                    <span className="font-medium">{boughtNames.join(' · ') || 'ninguna'}</span>
                </p>
            </div>
        </div>
    );
}

function MobileLabel({ children }: { children: React.ReactNode }) {
    return <span className="text-muted-foreground text-xs font-medium lg:hidden">{children}</span>;
}

/** Casilla de la tabla: en pantallas grandes solo el check (el título está arriba); en el celular, con texto. */
function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint: string }) {
    return (
        <label className="flex cursor-pointer items-center gap-2 lg:h-9 lg:justify-center">
            <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} aria-label={label} />
            <span className="text-sm lg:hidden">
                {label} <span className="text-muted-foreground text-xs">({hint})</span>
            </span>
        </label>
    );
}

/**
 * Ayuda bajo el precio: cuánto sale cada unidad, si lo sugirió el sistema, o el sugerido cuando el
 * escrito es distinto (ej: caja con descuento) con un botón para usarlo.
 */
function PriceHint({
    unitPrice,
    baseUnit,
    auto,
    suggested,
    price,
    onUseSuggested,
}: {
    unitPrice: number | null;
    baseUnit: string;
    auto: boolean;
    suggested: number | null;
    price: number;
    onUseSuggested: () => void;
}) {
    const discount = suggested !== null && price < suggested ? Math.round((1 - price / suggested) * 100) : null;
    if (unitPrice === null && suggested === null) return null;
    return (
        <div className="text-muted-foreground grid gap-0.5 text-xs">
            {unitPrice !== null && (
                <p>
                    {money(unitPrice)} c/{baseUnit.toLowerCase() || 'unidad'}
                    {auto && ' · sugerido'}
                    {discount !== null && discount > 0 && <span className="text-emerald-700 dark:text-emerald-400"> · {discount}% menos</span>}
                </p>
            )}
            {suggested !== null && (
                <button type="button" onClick={onUseSuggested} className="text-primary w-fit text-left hover:underline">
                    Usar sugerido {money(suggested)}
                </button>
            )}
        </div>
    );
}
