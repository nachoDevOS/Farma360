/**
 * PRESENTACIONES POR NIVELES del formulario de producto (pages/admin/products/form.tsx).
 *
 * La fila 0 es la unidad base (tableta). Cada fila siguiente CONTIENE a una anterior:
 *   Tableta → Blíster contiene 10 tabletas (= 10) → Caja contiene 10 blísteres (= 100)
 * El usuario no escribe el factor ni el nombre: se calculan aquí para la vista previa
 * y el servidor los vuelve a calcular al guardar (ProductPresentation::arrange).
 *
 * Además: precios sugeridos (precio unitario × cantidad) y qué se compra por defecto.
 */
import { type Presentation } from '@/types/admin/pharmacy';

// "type" (no "interface"): useForm de Inertia necesita tipos que acepten cualquier clave
export type LevelRow = {
    id?: number;
    /** Índice de la fila que contiene (null = unidad base) */
    parent: number | null;
    package: string;
    contains: string;
    sale_price: string;
    barcode: string;
    is_sellable: boolean;
    is_purchasable: boolean;
    /** true = el precio lo pone el sistema (sugerido) hasta que el usuario lo escriba */
    auto: boolean;
};

/** Tipos de empaque más comunes (se sugieren al escribir). */
export const PACKAGE_TYPES = ['Blíster', 'Caja', 'Frasco', 'Sobre', 'Tira', 'Tubo', 'Paquete', 'Display', 'Bolsa'];

/** Formas farmacéuticas más comunes (solo se sugieren al escribir). */
export const PHARMACEUTICAL_FORMS = [
    'Tableta',
    'Comprimido',
    'Cápsula',
    'Jarabe',
    'Suspensión',
    'Solución',
    'Gotas',
    'Inyectable',
    'Crema',
    'Pomada',
    'Gel',
    'Sobre',
    'Óvulo',
    'Supositorio',
    'Inhalador',
];

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** Producto nuevo: solo la unidad base, que se vende y se compra. */
export const defaultRows = (): LevelRow[] => [
    { parent: null, package: 'Unidad', contains: '', sale_price: '', barcode: '', is_sellable: true, is_purchasable: true, auto: false },
];

/** Filas del formulario a partir de lo guardado (vienen ordenadas por factor: el de adentro siempre antes). */
export function rowsFromPresentations(presentations: Presentation[]): LevelRow[] {
    return presentations.map((p) => ({
        id: p.id,
        parent: p.parent_id ? presentations.findIndex((other) => other.id === p.parent_id) : null,
        package: p.package,
        contains: p.contains ? String(p.contains) : '',
        sale_price: p.sale_price ?? '',
        barcode: p.barcode ?? '',
        is_sellable: p.is_sellable,
        is_purchasable: p.is_purchasable,
        auto: false,
    }));
}

/** Unidades base de cada fila (0 si falta la cantidad). */
export function factorsOf(rows: LevelRow[]): number[] {
    const factors: number[] = [];
    rows.forEach((r, i) => {
        factors[i] = r.parent === null ? 1 : (factors[r.parent] ?? 0) * (Number(r.contains) || 0);
    });
    return factors;
}

/** Plural simple en español: tableta → tabletas, blíster → blísteres. Igual que ProductPresentation::plural. */
export function plural(word: string): string {
    const w = word.trim().toLowerCase();
    if (w === '') return w;
    if (/[aeiouáéó]$/.test(w)) return `${w}s`;
    if (w.endsWith('z')) return `${w.slice(0, -1)}ces`;
    return `${w}es`;
}

const capitalize = (word: string) => upperFirst(word.trim());

/** Primera letra en mayúscula (mientras escribe, sin quitar espacios): "caja" → "Caja". */
export const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Nombre que tendrá la fila: "Tableta", "Blíster x10", "Caja x10 blísteres (100 tabletas)". */
export function levelName(rows: LevelRow[], index: number, baseUnit: string): string {
    const r = rows[index];
    if (r.parent === null) return capitalize(baseUnit) || 'Unidad base';
    const pkg = capitalize(r.package) || 'Empaque';
    const contains = r.contains || '?';
    const inner = rows[r.parent];
    if (inner.parent === null) return `${pkg} x${contains}`;
    const factor = factorsOf(rows)[index];
    return `${pkg} x${contains} ${plural(inner.package)} (${factor || '?'} ${plural(baseUnit)})`;
}

/** ¿Es el mismo nombre de empaque? Sin mayúsculas, tildes ni plural: "Frasco" = "frascos". Igual que ProductPresentation::sameName. */
export function sameName(a: string, b: string): boolean {
    const x = normalize(a);
    const y = normalize(b);
    return x !== '' && (x === y || plural(x) === y || x === plural(y));
}

/**
 * Si el empaque se llama igual que algo que contiene (la unidad base o un empaque de adentro), devuelve ese nombre.
 * Ej: unidad base "frasco" y empaque "Frasco" → "frasco" (no se permite: "Frasco contiene 12 frascos" confunde).
 */
export function repeatedInnerName(rows: LevelRow[], index: number, baseUnit: string): string | null {
    for (let inner = rows[index].parent; inner !== null; inner = rows[inner].parent) {
        const name = inner === 0 ? baseUnit : rows[inner].package;
        if (sameName(rows[index].package, name)) return name;
    }
    return null;
}

/**
 * Lo que trae un empaque, en palabras, de afuera hacia adentro (para el resumen del formulario):
 *   "1 Caja = 10 blísteres = 100 tabletas"
 */
export function contentsText(rows: LevelRow[], index: number, baseUnit: string): string {
    const factors = factorsOf(rows);
    const parts = [`1 ${capitalize(rows[index].package) || 'Empaque'}`];
    for (let inner = rows[index].parent; inner !== null; inner = rows[inner].parent) {
        const amount = factors[index] && factors[inner] ? factors[index] / factors[inner] : '?';
        parts.push(`${amount} ${plural(inner === 0 ? baseUnit : rows[inner].package) || 'unidades'}`);
    }
    return parts.join(' = ');
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Precio de UNA unidad base que sirve de referencia: el de la presentación más chica que se vende
 * y cuyo precio escribió el usuario.
 */
export function referenceUnitPrice(rows: LevelRow[]): number | null {
    const factors = factorsOf(rows);
    const candidates = rows
        .map((r, i) => ({ r, factor: factors[i] }))
        .filter(({ r, factor }) => !r.auto && r.is_sellable && factor > 0 && Number(r.sale_price) > 0)
        .sort((a, b) => a.factor - b.factor);
    return candidates.length ? Number(candidates[0].r.sale_price) / candidates[0].factor : null;
}

/** Precio sugerido de una fila: precio unitario de referencia × sus unidades. */
export function suggestedPrice(rows: LevelRow[], index: number): number | null {
    const unit = referenceUnitPrice(rows);
    const factor = factorsOf(rows)[index];
    return unit === null || factor === 0 ? null : round2(unit * factor);
}

/**
 * "Se compra" por defecto: solo los empaques más grandes (los que ningún otro contiene). Normalmente
 * al proveedor se le compra la caja; si se compra por blíster o unidad, el usuario lo marca a mano.
 */
export function buyOnlyOutermost(rows: LevelRow[]): LevelRow[] {
    return rows.map((r, i) => ({ ...r, is_purchasable: !rows.some((other) => other.parent === i) }));
}

/** Llena el precio de las filas que todavía no escribió el usuario (auto) con el sugerido. */
export function withSuggestedPrices(rows: LevelRow[]): LevelRow[] {
    return rows.map((r, i) => {
        if (!r.auto || !r.is_sellable) return r;
        const price = suggestedPrice(rows, i);
        return price === null ? r : { ...r, sale_price: price.toFixed(2) };
    });
}
