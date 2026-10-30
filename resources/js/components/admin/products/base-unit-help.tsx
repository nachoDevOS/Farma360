/**
 * AYUDA "¿Cómo se cuenta el stock?" del formulario de producto (pages/admin/products/form.tsx).
 * Explica en tres pasos: la unidad base es solo el NOMBRE de la unidad más chica; el CÁLCULO sale de lo que
 * "Contiene" cada empaque; y qué hace el sistema solo con eso al comprar y vender.
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
export const COMMON_BASE_UNITS = ['Tableta', 'Cápsula', 'Comprimido', 'Frasco', 'Ampolla', 'Vial', 'Tubo', 'Sobre', 'Inhalador', 'Unidad'];

const examples: { product: string; baseUnit: string; presentations: string }[] = [
    {
        product: 'Caja con 10 blísteres de 10 tabletas',
        baseUnit: 'tableta',
        presentations: 'Blíster contiene 10 tabletas · Caja contiene 10 blísteres',
    },
    { product: 'Frasco con 30 tabletas', baseUnit: 'tableta', presentations: 'Frasco contiene 30 tabletas' },
    { product: 'Caja de 21 cápsulas', baseUnit: 'cápsula', presentations: 'Caja contiene 21 cápsulas' },
    { product: 'Caja de 5 ampollas', baseUnit: 'ampolla', presentations: 'Caja contiene 5 ampollas' },
    { product: 'Jarabe (se vende el frasco entero)', baseUnit: 'frasco', presentations: 'Caja contiene 12 frascos (si la compras así)' },
    { product: 'Crema o pomada', baseUnit: 'tubo', presentations: 'Ninguno: solo la unidad base' },
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
                            title="«Contiene» de cada empaque"
                            subtitle="Es el que CALCULA"
                            tone="primary"
                            text="Qué trae cada empaque: el blíster trae tabletas, la caja trae blísteres. El sistema multiplica y con eso suma y resta el stock."
                            example="Caja contiene 10 blísteres"
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
                                        <td className="px-3 py-2">Empaque «Blíster»</td>
                                        <td className="px-3 py-2">
                                            Contiene <span className="num font-semibold">10</span> tabletas
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2">Empaque «Caja»</td>
                                        <td className="px-3 py-2">
                                            Contiene <span className="num font-semibold">10</span> blísteres{' '}
                                            <span className="text-muted-foreground">(el sistema calcula 100 tabletas)</span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-muted-foreground mt-2 text-[13px]">
                            Si nunca vendes sueltas, desmarca «Se vende» en la unidad base: el stock se sigue contando en tabletas.
                        </p>
                    </div>

                    {/* 3: lo que hace el sistema solo */}
                    <div>
                        <p className="mb-2 flex items-center gap-2 font-semibold">
                            <StepNumber step={3} /> Lo que el sistema calcula solo
                        </p>
                        <ul className="grid gap-2">
                            <Calc sign="+" text="Compras 2 cajas" result="entran 200 tabletas" />
                            <Calc sign="-" text="Vendes 1 blíster" result="salen 10 · quedan 190" />
                            <Calc sign="-" text="Vendes 3 tabletas" result="salen 3 · quedan 187" />
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
                                        <th className="hidden px-3 py-2 text-left sm:table-cell">Empaques</th>
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
