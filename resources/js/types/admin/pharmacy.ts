/**
 * TIPOS DE LA FARMACIA: datos que envían los controladores de app/Http/Controllers/Admin/
 * (productos, compras, inventario, transferencias, promociones, caja, ventas, reportes).
 * Los montos llegan como texto ("12.50") porque Laravel los manda así: se muestran con money().
 */

/** Opción simple de un selector (sucursales, proveedores…). */
export interface Option {
    id: number;
    name: string;
}

/** Usuario resumido (quién registró, anuló…). */
export interface UserRef {
    id: number;
    name: string;
}

/** Presentación por niveles: la unidad base (parent_id null) o un empaque que contiene a otra. Ver ProductPresentation. */
export interface Presentation {
    id?: number;
    /** Presentación que contiene (la Caja contiene Blísteres). Null = unidad base */
    parent_id?: number | null;
    /** Tipo de empaque: Blíster, Caja… (en la unidad base: tableta) */
    package: string;
    /** Cuántas del nivel de adentro trae. Null en la unidad base */
    contains?: number | null;
    /** Nombre armado por el sistema: "Caja x10 blísteres (100 tabletas)" */
    name: string;
    factor: number;
    /** Null si no se vende */
    sale_price: string | null;
    is_sellable: boolean;
    is_purchasable: boolean;
    barcode?: string | null;
}

export interface Product {
    id: number;
    name: string;
    /** Nombre genérico (la sustancia: Paracetamol) */
    generic_name: string | null;
    concentration: string | null;
    pharmaceutical_form: string | null;
    /** Para qué sirve, en palabras */
    description: string | null;
    /** Foto: ruta del .avif en S3 (ver lib/storage.ts) */
    image?: string | null;
    laboratory_id: number | null;
    category_id: number | null;
    barcode: string | null;
    health_registry: string | null;
    base_unit: string;
    requires_prescription: boolean;
    is_controlled: boolean;
    min_stock: number;
    is_active: boolean;
    presentations: Presentation[];
    /** Usos / síntomas ("Dolor de cabeza", "Fiebre"…) */
    indications?: Option[];
    /** Solo al editar: los usos como texto (ProductController@edit) */
    indication_names?: string[];
    laboratory?: Option | null;
    category?: Option | null;
    /** Suma de los lotes (en la lista de productos y de inventario) */
    stock?: string | number | null;
    stock_value?: string | number | null;
    next_expiry?: string | null;
    /** Lista de inventario (detalle desplegable de la fila): lotes con stock de la sucursal, el que vence primero adelante */
    batches?: Pick<Batch, 'id' | 'batch_number' | 'expires_at' | 'received_quantity' | 'stock' | 'unit_cost'>[];
    /** Lista de inventario: unidades vendidas en la sucursal en los últimos 30 días */
    sold_30?: number;
    /** Lista de inventario: stock en las demás sucursales (solo las que tienen) */
    other_branches?: { branch_id: number; branch: string | null; stock: number }[];
    /** Lista de productos: stock por sucursal para el detalle desplegable de la fila */
    branch_stock?: BranchStock[];
    /** Quién lo registró y con qué rol (columnas de auditoría) */
    registered_by?: UserRef | null;
    registerRole?: string | null;
    created_at?: string;
    updated_at?: string;
}

/** Stock de un producto en una sucursal (suma de sus lotes con stock). Ver ProductController@index. */
export interface BranchStock {
    branch_id: number;
    branch: string | null;
    stock: number;
    /** Valor al costo (Σ unidades × costo del lote) */
    value: number;
    batches: number;
    next_expiry: string | null;
}

/** Fila del buscador de productos (una por presentación). Ver ProductController@lookup. */
// "type" (no "interface") porque la compra lo guarda en useForm de Inertia
export type ProductLookup = {
    product_id: number;
    product_name: string;
    /** Nombre comercial (sin concentración ni forma) */
    commercial_name: string;
    generic_name: string | null;
    concentration: string | null;
    pharmaceutical_form: string | null;
    /** Ruta de la foto en S3 (o null) */
    image: string | null;
    laboratory: string | null;
    category: string | null;
    requires_prescription: boolean;
    is_controlled: boolean;
    /** Código de la presentación, o del producto si la presentación no tiene */
    barcode: string | null;
    base_unit: string;
    presentation_id: number;
    presentation_name: string;
    /** Empaque que se compra, en minúscula: "caja", "blíster", "tableta" */
    package: string;
    /** Unidades base que trae: "100 tabletas" */
    contents: string;
    /** Nivel por nivel: cada caja contiene 3 blísteres, cada blíster contiene 10 tabletas. Vacío = unidad base */
    breakdown: { package: string; count: number; unit: string }[];
    factor: number;
    sale_price: string;
    stock: number;
};

/** Fila del buscador del punto de venta. Ver SaleController@search. */
// "type" (no "interface") porque el carrito del punto de venta lo guarda en useForm de Inertia
export type PosLookup = {
    product_id: number;
    product_name: string;
    /** Nombre comercial solo ("Alergin") y concentración aparte ("10 mg") */
    commercial_name: string;
    concentration: string | null;
    /** Ruta de la foto en S3 (o null) */
    image: string | null;
    laboratory: string | null;
    generic_name: string | null;
    pharmaceutical_form: string | null;
    category: string | null;
    /** Código de la presentación, o del producto si la presentación no tiene */
    barcode: string | null;
    /** Usos / síntomas, para mostrar "Sirve para: …" en el resultado */
    indications: string[];
    requires_prescription: boolean;
    is_controlled: boolean;
    presentation_id: number;
    presentation_name: string;
    /** Se buscó por el código de barras de esta presentación: el POS la agrega directo */
    scanned: boolean;
    /** Empaque que se vende, en minúscula: "caja", "blíster", "tableta" */
    package: string;
    /** Nivel por nivel: cada caja contiene 3 blísteres, cada blíster contiene 10 tabletas. Vacío = unidad suelta */
    breakdown: { package: string; count: number; unit: string }[];
    factor: number;
    sale_price: number;
    stock_units: number;
    next_expiry: string | null;
    promo_discount: number | null;
};

/** Lote con stock (buscador de transferencias). Ver InventoryController@batches. */
export interface BatchLookup {
    id: number;
    product_name: string;
    base_unit: string;
    batch_number: string;
    expires_at: string | null;
    /** Unidades base que quedan en el lote */
    stock: number;
    expired: boolean;
}

export interface BatchPromotion {
    id: number;
    discount_percent: string;
    source: 'regla' | 'manual';
    below_cost: boolean;
}

export interface Batch {
    id: number;
    product_id: number;
    branch_id: number;
    batch_number: string;
    expires_at: string | null;
    /** Unidades base que ENTRARON al lote (compra, ingreso sin compra, transferencia recibida). No baja al vender */
    received_quantity: number;
    /** Unidades base que QUEDAN ahora en el lote */
    stock: number;
    unit_cost: string;
    active_promotion?: BatchPromotion | null;
}

export interface StockMovement {
    id: number;
    type: string;
    quantity: number;
    unit_cost: string;
    balance: number;
    note: string | null;
    reference_type: string | null;
    reference_id: number | null;
    created_at: string;
    batch?: { id: number; batch_number: string } | null;
    registered_by?: UserRef | null;
}

export type DocumentStatus = 'registrada' | 'anulada' | 'enviada' | 'recibida' | 'completada' | 'abierta' | 'pendiente' | 'cerrada';

export interface PurchaseItem {
    id: number;
    quantity: number;
    factor: number;
    units: number;
    cost: string;
    unit_cost: string;
    subtotal: string;
    batch_number: string;
    expires_at: string | null;
    batch_id?: number;
    product: {
        id: number;
        name: string;
        concentration: string | null;
        generic_name?: string | null;
        pharmaceutical_form?: string | null;
        base_unit?: string;
        laboratory?: { id: number; name: string } | null;
        presentations?: Presentation[];
    };
    /** package: empaque en minúscula ("caja"); factor: unidades base que trae */
    presentation: { id: number; name: string; package: string; factor: number } | null;
    /** Lista de compras: el lote que creó (cuánto queda en él hoy) */
    batch?: { id: number; stock: number } | null;
    /** Ficha de la compra: lo que queda hoy en su lote */
    remaining?: number;
    /** Ficha de la compra: precio de venta de una unidad base (null = no se vende suelto) */
    sale_unit_price?: number | null;
}

export interface Purchase {
    id: number;
    number: string;
    invoice_number: string | null;
    purchased_at: string;
    total: string;
    status: DocumentStatus;
    note: string | null;
    cancelled_at: string | null;
    cancel_reason: string | null;
    created_at: string;
    items_count?: number;
    branch: Option;
    supplier: Option & { nit?: string | null; phone?: string | null };
    registered_by?: UserRef | null;
    registerRole?: string | null;
    cancelled_by?: UserRef | null;
    items?: PurchaseItem[];
}

export interface TransferItem {
    id: number;
    batch_number: string;
    expires_at: string | null;
    quantity: number;
    unit_cost: string;
    product: { id: number; name: string; concentration: string | null; pharmaceutical_form: string | null; base_unit: string };
}

export interface Transfer {
    id: number;
    number: string;
    status: DocumentStatus;
    note: string | null;
    created_at: string;
    received_at: string | null;
    cancelled_at: string | null;
    cancel_reason: string | null;
    items_count?: number;
    units?: string | number | null;
    from_branch: Option;
    to_branch: Option;
    registered_by?: UserRef | null;
    received_by?: UserRef | null;
    cancelled_by?: UserRef | null;
    items?: TransferItem[];
}

export interface Denomination {
    id: number;
    value: string;
    type: 'billete' | 'moneda';
}

export interface CashCount {
    id: number;
    moment: 'apertura' | 'cierre';
    value: string;
    quantity: number;
    subtotal: string;
}

export interface CashMovement {
    id: number;
    type: 'ingreso' | 'egreso' | 'retiro';
    amount: string;
    reason: string;
    created_at: string;
}

export interface CashSession {
    id: number;
    status: 'abierta' | 'pendiente' | 'cerrada';
    opened_at: string;
    closed_at: string | null;
    opening_amount: string;
    expected_amount: string | null;
    counted_amount: string | null;
    difference: string | null;
    close_note: string | null;
    review_note: string | null;
    reviewed_at: string | null;
    cash_register: Option;
    branch: Option;
    user?: UserRef;
    reviewed_by?: UserRef | null;
    counts?: CashCount[];
    movements?: CashMovement[];
}

/** Resumen del turno (CashService::summary). */
export interface CashSummary {
    opening: number;
    cash_sales: number;
    income: number;
    expense: number;
    withdrawals: number;
    expected: number;
    sales_count: number;
    sales_total: number;
    by_method: Record<string, number>;
}

/**
 * Turno abierto del usuario para el botón flotante "Mi caja" (HandleInertiaRequests::openCash).
 * summary.expected = null cuando la farmacia oculta el efectivo esperado (config farmacia.show_expected_cash).
 */
export interface OpenCash {
    id: number;
    register: string;
    branch: string;
    opened_at: string;
    show_expected: boolean;
    summary: Omit<CashSummary, 'expected'> & { expected: number | null };
    payment_methods: Record<string, string>;
}

export interface SalePayment {
    id: number;
    method: string;
    amount: string;
    reference?: string | null;
}

export interface SaleItem {
    id: number;
    units: number;
    factor: number;
    list_price: string;
    /** Sin descuento: list_price / factor × units */
    subtotal: string;
    /** Descuento en % */
    discount_percent: string;
    /** Descuento en Bs */
    discount_amount: string;
    /** Subtotal de la línea con su promoción: subtotal − discount_amount */
    total: string;
    unit_cost: string;
    product: { id: number; name: string; concentration: string | null; pharmaceutical_form: string | null; presentations?: Presentation[] };
    presentation: { id: number; name: string; package?: string } | null;
    batch: { id: number; batch_number: string; expires_at: string | null };
}

export interface Sale {
    id: number;
    number: string;
    /** Suma de los ítems, ya con su promoción */
    subtotal: string;
    /** Descuento general en Bs */
    discount: string;
    discount_reason: string | null;
    total: string;
    cash_received: string;
    change: string;
    status: 'completada' | 'anulada';
    customer_name: string | null;
    customer_document: string | null;
    prescription_number: string | null;
    prescription_doctor: string | null;
    cancelled_at: string | null;
    cancel_reason: string | null;
    created_at: string;
    branch: Option & { address?: string | null; phone?: string | null };
    registered_by?: UserRef | null;
    cancelled_by?: UserRef | null;
    payments: SalePayment[];
    items?: SaleItem[];
    cash_session?: { id: number; status: string };
}

/** Filtros comunes de las listas (viajan en la URL). */
export interface ListFilters {
    search?: string;
    branch?: string;
    status?: string;
    from?: string;
    to?: string;
    per_page?: string;
    [key: string]: string | undefined;
}
