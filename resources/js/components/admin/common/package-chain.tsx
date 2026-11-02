/**
 * CÓMO VIENE UN EMPAQUE: la presentación destacada en una píldora y, como información, lo que trae adentro nivel por nivel.
 *
 *   [▣ CAJA] › cada caja contiene 3 blísteres › cada blíster contiene 10 tabletas (= 30 tabletas)
 *
 *   <PackageChain pkg="caja" levels={levelsOf(product.presentations, presentation.id)} />
 *   <PackageChain pkg="caja" levels={item.breakdown} />          → niveles ya armados por el servidor (buscadores)
 *   describeLevels(levels)                                        → lo mismo en una frase (ayudas, tickets)
 *
 * Los niveles los arma ProductPresentation::breakdown() en el servidor o levelsOf() aquí, con las presentaciones del producto.
 */
import { plural } from '@/components/admin/products/presentation-levels';
import { cn } from '@/lib/utils';
import { ChevronRight, Package } from 'lucide-react';

/** Un nivel: cada {package} contiene {count} {unit} ("cada caja contiene 3 blísteres") */
export type PackageLevel = { package: string; count: number; unit: string };

type PresentationLike = { id?: number; parent_id?: number | null; package: string; contains?: number | null };

/** Niveles de una presentación, de afuera hacia adentro, buscando los de adentro en las presentaciones del producto. */
export function levelsOf(presentations: PresentationLike[], presentationId: number | null | undefined): PackageLevel[] {
    const levels: PackageLevel[] = [];
    let level = presentations.find((p) => p.id === presentationId);
    while (level?.parent_id) {
        const inner = presentations.find((p) => p.id === level?.parent_id);
        if (!inner || !level.contains) {
            break;
        }
        levels.push({
            package: level.package.trim().toLowerCase(),
            count: level.contains,
            unit: level.contains === 1 ? inner.package.trim().toLowerCase() : plural(inner.package),
        });
        level = inner;
    }
    return levels;
}

/** Total de unidades base que trae (3 × 10 = "30 tabletas"); null si tiene un solo nivel (ya se lee en la cadena). */
export function levelsTotal(levels: PackageLevel[]): string | null {
    if (levels.length < 2) {
        return null;
    }
    const total = levels.reduce((product, level) => product * level.count, 1);
    return `${total.toLocaleString('es')} ${levels[levels.length - 1].unit}`;
}

/** "Cada caja contiene 3 blísteres y cada blíster contiene 10 tabletas (30 tabletas en total)"; '' si es la unidad suelta. */
export function describeLevels(levels: PackageLevel[]): string {
    const text = levels.map((level) => `cada ${level.package} contiene ${level.count} ${level.unit}`).join(' y ');
    const total = levelsTotal(levels);
    return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}${total ? ` (${total} en total)` : ''}` : '';
}

/**
 * Píldora del empaque (con brillo al pasar el mouse) y la cadena de lo que trae.
 * size="sm" para filas de tablas y tickets; withLevels={false} muestra solo la píldora.
 */
export function PackageChain({
    pkg,
    levels,
    size = 'md',
    withLevels = true,
    className,
}: {
    pkg: string;
    levels: PackageLevel[];
    size?: 'sm' | 'md';
    withLevels?: boolean;
    className?: string;
}) {
    const total = levelsTotal(levels);
    return (
        <div className={cn('group/pkg flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1', size === 'sm' ? 'text-[11px]' : 'text-xs', className)}>
            <span
                className={cn(
                    'from-primary relative inline-flex shrink-0 items-center gap-1 overflow-hidden rounded-full bg-gradient-to-r to-sky-500 font-semibold tracking-wider text-white uppercase shadow-sm ring-1 shadow-sky-500/30 ring-white/20 ring-inset',
                    'transition-shadow duration-300 group-hover/pkg:shadow-md group-hover/pkg:shadow-sky-500/40',
                    'before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/35 before:to-transparent before:transition-transform before:duration-700 before:ease-out group-hover/pkg:before:translate-x-full motion-reduce:before:hidden',
                    size === 'sm' ? 'py-px pr-1.5 pl-1 text-[10px]' : 'py-0.5 pr-2 pl-1.5 text-[11px]',
                )}
            >
                <Package className={size === 'sm' ? 'size-2.5' : 'size-3'} />
                {pkg.trim().toLowerCase()}
            </span>
            {withLevels &&
                (levels.length === 0 ? (
                    <span className="text-muted-foreground">unidad suelta</span>
                ) : (
                    <>
                        {levels.map((level, i) => (
                            <span key={i} className="text-muted-foreground inline-flex items-center gap-1.5">
                                <ChevronRight className="size-3 opacity-50" />
                                <span>
                                    cada {level.package} contiene <span className="num text-foreground/80 font-semibold">{level.count}</span>{' '}
                                    {level.unit}
                                </span>
                            </span>
                        ))}
                        {total && (
                            <span className="bg-background text-muted-foreground num ring-border ml-0.5 rounded-full px-1.5 py-px text-[10px] ring-1 ring-inset">
                                = {total}
                            </span>
                        )}
                    </>
                ))}
        </div>
    );
}
