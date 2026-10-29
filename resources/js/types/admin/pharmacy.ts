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

export interface Presentation {
    id?: number;
    name: string;
    factor: number;
    sale_price: string;
    barcode?: string | null;
}

export interface Product {
    id: number;
    name: string;
    active_ingredient_id: number | null;
    concentration: string | null;
    pharmaceutical_form: string | null;
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
    active_ingredient?: Option | null;
    laboratory?: Option | null;
    category?: Option | null;
    /** Suma de los lotes (en la lista de productos y de inventario) */
    stock?: string | number | null;
    stock_value?: string | number | null;
    next_expiry?: string | null;
}

/** Fila del buscador de productos (una por presentación). Ver ProductController@lookup. */
export interface ProductLookup {
    product_id: number;
    product_name: string;
    active_ingredient: string | null;
    base_unit: string;
    presentation_id: number;
    presentation_name: string;
    factor: number;
    sale_price: string;
    stock: number;
}

/** Fila del buscador del punto de venta. Ver SaleController@search. */
// "type" (no "interface") porque el carrito del punto de venta lo guarda en useForm de Inertia
export type PosLookup = {
    product_id: number;
    product_name: string;
    active_ingredient: string | null;
    requires_prescription: boolean;
    is_controlled: boolean;
    presentation_id: number;
    presentation_name: string;
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
    expires_at: string;
    quantity: number;
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
    expires_at: string;
    quantity: number;
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
    expires_at: string;
    product: { id: number; name: string; concentration: string | null; pharmaceutical_form: string | null };
    presentation: { id: number; name: string } | null;
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
    supplier: Option & { nit?: string | null };
    registered_by?: UserRef | null;
    cancelled_by?: UserRef | null;
    items?: PurchaseItem[];
}

export interface TransferItem {
    id: number;
    batch_number: string;
    expires_at: string;
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
    discount_percent: string;
    subtotal: string;
    unit_cost: string;
    product: { id: number; name: string; concentration: string | null; pharmaceutical_form: string | null };
    presentation: { id: number; name: string } | null;
    batch: { id: number; batch_number: string; expires_at: string };
}

export interface Sale {
    id: number;
    number: string;
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
