/**
 * AYUDA "¿Cómo se cuenta el stock?" del formulario de producto (pages/admin/products/form.tsx).
 * Explica en tres pasos: la unidad base es solo el NOMBRE de la unidad más chica; el CÁLCULO lo hacen las
 * "Unidades" de cada presentación; y qué hace el sistema solo con eso al comprar y vender.
 *
 *   <BaseUnitHelp />                         → enlace "¿Qué es esto?"
 *   <BaseUnitHelp label="¿Cómo lleno esto?" />
 */
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { AlertTriangle, ArrowRight, Calculator, CircleHelp, Minus, Plus, Tag } from 'lucide-react';

/** Unidades base más comunes (se sugieren al escribir el campo). */
export const COMMON_BASE_UNITS = ['tableta', 'cápsula', 'comprimido', 'frasco', 'ampolla', 'vial', 'tubo', 'sobre', 'inhalador', 'unidad'];

const examples: { product: string; baseUnit: string; presentations: string }[] = [
    { product: 'Caja con 10 blísteres de 10 tabletas', baseUnit: 'tableta', presentations: 'Unidad 1 · Blíster x10 = 10 · Caja = 100' },
    { product: 'Frasco con 30 tabletas', baseUnit: 'tableta', presentations: 'Unidad 1 · Frasco x30 = 30' },
    { product: 'Caja de 21 cápsulas', baseUnit: 'cápsula', presentations: 'Unidad 1 · Caja x21 = 21' },
    { product: 'Caja de 5 ampollas', baseUnit: 'ampolla', presentations: 'Unidad 1 · Caja x5 = 5' },
    { product: 'Jarabe (se vende el frasco entero)', baseUnit: 'frasco', presentations: 'Frasco 1 · Caja x12 = 12' },
    { product: 'Crema o pomada', baseUnit: 'tubo', presentations: 'Tubo 1' },
];

export function BaseUnitHelp({ label = '¿Qué es esto?' }: { label?: string }) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <button type="button" className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline">
                    <CircleHelp className="size-3.5" /> {label}
                </button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>¿Cómo se cuenta el stock de un producto?</DialogTitle>
                    <DialogDescription>Con dos datos del formulario. Uno es solo un nombre y el otro es el que hace las cuentas.</DialogDescription>
                </DialogHeader>

                <div className="space-y-6 text-sm">
                    {/* 1 y 2: las dos piezas */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Piece
                            step={1}
                            icon={Tag}
                            title="Unidad base"
                            subtitle="Es solo un NOMBRE"
                            tone="slate"
                            text="El nombre de la parte más pequeña que vendes. Aparece en pantalla, por ejemplo: «Stock: 200 tableta»."
                            example="tableta"
                        />
                        <Piece
                            step={2}
                            icon={Calculator}
                            title="«Unidades» de cada presentación"
                            subtitle="Es el que CALCULA"
                            tone="primary"
                            text="Cuántas unidades base trae cada forma de venta. Con este número el sistema suma y resta el stock."
                            example="Caja = 100"
                        />
                    </div>

                    {/* Ejemplo visual */}
                    <div>
                        <p className="mb-2 font-semibold">Ejemplo: una caja de Paracetamol trae 10 blísteres, y cada blíster 10 tabletas</p>
                        <div className="bg-muted/40 flex flex-wrap items-center justify-center gap-2 rounded-lg border p-4 text-center">
                            <Box label="1 Caja" detail="= 100 tabletas" strong />
                            <ArrowRight className="text-muted-foreground size-4" />
                            <Box label="10 Blísteres" detail="de 10 tabletas" />
                            <ArrowRight className="text-muted-foreground size-4" />
                            <Box label="100 tabletas" detail="la unidad base" />
                        </div>
                        <p className="mt-3 mb-2 text-[13px]">Así se llena el formulario:</p>
                        <div className="overflow-hidden rounded-lg border">
                            <table className="w-full text-[13px]">
                                <thead className="bg-muted/60 text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Campo</th>
                                        <th className="px-3 py-2 text-left">Qué poner</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    <tr>
                                        <td className="px-3 py-2">Unidad base</td>
                                        <td className="px-3 py-2 font-semibold">tableta</td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2">Presentación «Unidad»</td>
                                        <td className="px-3 py-2">
                                            Unidades: <span className="num font-semibold">1</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2">Presentación «Blíster x10»</td>
                                        <td className="px-3 py-2">
                                            Unidades: <span className="num font-semibold">10</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2">Presentación «Caja x100»</td>
                                        <td className="px-3 py-2">
                                            Unidades: <span className="num font-semibold">100</span>{' '}
                                            <span className="text-muted-foreground">(10 blísteres × 10 tabletas, no pongas 10)</span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-muted-foreground mt-2 text-[13px]">
                            Si nunca vendes sueltas, no agregues «Unidad»: la unidad base sigue siendo tableta y puedes agregarla el día que quieras.
                        </p>
                    </div>

                    {/* 3: lo que hace el sistema solo */}
                    <div>
                        <p className="mb-2 flex items-center gap-2 font-semibold">
                            <StepNumber step={3} /> Lo que el sistema calcula solo
                        </p>
                        <ul className="grid gap-2">
                            <Calc sign="+" text="Compras 2 «Caja x100»" result="entran 200 tabletas" />
                            <Calc sign="-" text="Vendes 1 «Blíster x10»" result="salen 10 · quedan 190" />
                            <Calc sign="-" text="Vendes 3 «Unidad»" result="salen 3 · quedan 187" />
                            <Calc text="La caja cuesta Bs 25 al comprar" result="cada tableta cuesta Bs 0,25 (para la ganancia)" />
                        </ul>
                    </div>

                    {/* Cómo elegir */}
                    <div>
                        <p className="mb-2 font-semibold">¿Qué pongo como unidad base?</p>
                        <p className="mb-2 text-[13px]">
                            Pregúntate: <strong>¿alguna vez voy a vender una parte de lo que hay dentro del envase?</strong>
                        </p>
                        <div className="mb-3 grid gap-2 sm:grid-cols-2">
                            <div className="rounded-lg border p-3 text-[13px]">
                                <p className="font-semibold text-emerald-700 dark:text-emerald-400">Sí</p>
                                <p className="text-muted-foreground">Esa parte: tableta, cápsula, ampolla.</p>
                            </div>
                            <div className="rounded-lg border p-3 text-[13px]">
                                <p className="font-semibold text-amber-700 dark:text-amber-400">No</p>
                                <p className="text-muted-foreground">El envase entero: frasco (jarabe), tubo (crema).</p>
                            </div>
                        </div>
                        <div className="overflow-hidden rounded-lg border">
                            <table className="w-full text-[13px]">
                                <thead className="bg-muted/60 text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Cómo viene</th>
                                        <th className="px-3 py-2 text-left">Unidad base</th>
                                        <th className="hidden px-3 py-2 text-left sm:table-cell">Presentaciones (Unidades)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {examples.map((e) => (
                                        <tr key={e.product}>
                                            <td className="px-3 py-2">
                                                {e.product}
                                                <p className="text-muted-foreground text-xs sm:hidden">{e.presentations}</p>
                                            </td>
                                            <td className="px-3 py-2 font-semibold">{e.baseUnit}</td>
                                            <td className="text-muted-foreground hidden px-3 py-2 text-xs sm:table-cell">{e.presentations}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-muted-foreground mt-2 text-[13px]">
                            Tamaños distintos (jarabe de 60 ml y de 120 ml) van como productos distintos. La unidad base no sirve para clasificar:
                            para eso está «Categoría», y para buscar por síntoma, «Usos / síntomas».
                        </p>
                    </div>

                    {/* Aviso */}
                    <div className="flex gap-3 rounded-lg border border-amber-300/70 bg-amber-50 p-3.5 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                        <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                        <p className="text-[13px]">
                            <span className="font-semibold">Elígela bien al crear el producto.</span> Como es solo un nombre, si después la cambias el
                            stock no se convierte: 200 tabletas pasarían a verse como «200 caja».
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button className="btn-brand">Entendido</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function StepNumber({ step }: { step: number }) {
    return (
        <span className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
            {step}
        </span>
    );
}

interface PieceProps {
    step: number;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    subtitle: string;
    text: string;
    example: string;
    tone: 'slate' | 'primary';
}

/** Tarjeta de una de las dos piezas (nombre / cálculo). */
function Piece({ step, icon: Icon, title, subtitle, text, example, tone }: PieceProps) {
    return (
        <div className={cn('rounded-lg border p-3.5', tone === 'primary' && 'border-primary/30 bg-primary/5')}>
            <div className="flex items-center gap-2">
                <StepNumber step={step} />
                <Icon className={cn('size-4', tone === 'primary' ? 'text-primary' : 'text-muted-foreground')} />
                <p className="font-semibold">{title}</p>
            </div>
            <p className={cn('mt-1.5 text-[11px] font-bold tracking-wider uppercase', tone === 'primary' ? 'text-primary' : 'text-muted-foreground')}>
                {subtitle}
            </p>
            <p className="text-muted-foreground mt-1 text-[13px]">{text}</p>
            <p className="mt-2 text-[13px]">
                Ej: <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{example}</span>
            </p>
        </div>
    );
}

/** Caja del dibujo caja → blíster → tableta. */
function Box({ label, detail, strong }: { label: string; detail: string; strong?: boolean }) {
    return (
        <div className={cn('bg-card min-w-28 rounded-lg border px-3 py-2', strong && 'border-primary/40')}>
            <p className="font-semibold">{label}</p>
            <p className="text-muted-foreground text-xs">{detail}</p>
        </div>
    );
}

/** Fila "acción → resultado" de lo que calcula el sistema. */
function Calc({ sign, text, result }: { sign?: '+' | '-'; text: string; result: string }) {
    const Icon = sign === '+' ? Plus : sign === '-' ? Minus : Calculator;
    return (
        <li className="flex items-center gap-3 rounded-lg border px-3 py-2 text-[13px]">
            <span
                className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full',
                    sign === '+' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                    sign === '-' && 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                    !sign && 'bg-primary/10 text-primary',
                )}
            >
                <Icon className="size-3.5" />
            </span>
            <span className="flex-1">{text}</span>
            <ArrowRight className="text-muted-foreground size-3.5 shrink-0" />
            <span className="font-medium sm:text-right">{result}</span>
        </li>
    );
}
