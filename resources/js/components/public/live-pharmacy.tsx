/**
 * Simulación de una farmacia vendiendo, con datos de ejemplo: cada venta nueva suma a la caja y baja el stock.
 * Solo avanza mientras se ve en pantalla. Con "reducir movimiento" queda quieta.
 */
import { SectionHeading } from '@/components/public/section-heading';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Package, Receipt, Wallet } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const SALE_EVERY_MS = 2400;
const VISIBLE_SALES = 4;
const OPENING_CASH = 200;

/** units: cuánto baja del stock, en la unidad base del producto. */
const CATALOG = [
    { product: 'Dolofen 500 mg', pack: '1 blíster', amount: 4.5, units: 10, stock: 760, unit: 'tabletas' },
    { product: 'Alergin 10 mg', pack: '1 caja', amount: 8.1, units: 10, stock: 200, unit: 'tabletas' },
    { product: 'Amoxil 500 mg', pack: '6 cápsulas', amount: 9, units: 6, stock: 189, unit: 'cápsulas' },
    { product: 'Gastrozol 20 mg', pack: '1 caja', amount: 15, units: 14, stock: 161, unit: 'cápsulas' },
    { product: 'Tosfin jarabe', pack: '1 frasco', amount: 28, units: 1, stock: 12, unit: 'frascos' },
];

const INITIAL_SALES = 3;

function saleAt(count: number) {
    return CATALOG[count % CATALOG.length];
}

function stockAfter(count: number, productIndex: number): number {
    const sold = Array.from({ length: count }, (_, index) => index).filter((index) => index % CATALOG.length === productIndex).length;

    return CATALOG[productIndex].stock - sold * CATALOG[productIndex].units;
}

export function LivePharmacy() {
    const panel = useRef<HTMLDivElement>(null);
    const [salesCount, setSalesCount] = useState(INITIAL_SALES);

    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !panel.current) {
            return;
        }

        let timer = 0;
        const observer = new IntersectionObserver(([entry]) => {
            window.clearInterval(timer);
            if (entry.isIntersecting) {
                timer = window.setInterval(() => setSalesCount((count) => count + 1), SALE_EVERY_MS);
            }
        });
        observer.observe(panel.current);

        return () => {
            observer.disconnect();
            window.clearInterval(timer);
        };
    }, []);

    const recentSales = Array.from({ length: Math.min(VISIBLE_SALES, salesCount) }, (_, index) => salesCount - 1 - index);
    const collected = Array.from({ length: salesCount }, (_, index) => saleAt(index).amount).reduce((sum, amount) => sum + amount, 0);
    const lastProductIndex = (salesCount - 1) % CATALOG.length;
    const lastProduct = CATALOG[lastProductIndex];
    const lastStock = stockAfter(salesCount, lastProductIndex);

    return (
        <section className="bg-white px-6 pb-20">
            <SectionHeading title="Así se ve tu farmacia funcionando" text="Cada venta actualiza la caja y el stock al instante, sin anotar nada." />

            <div
                ref={panel}
                className="pub-reveal bg-brand-navy mx-auto mt-10 grid max-w-[76rem] gap-4 rounded-3xl p-5 text-white sm:p-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
            >
                <div className="rounded-2xl bg-white/[0.07] p-5">
                    <h3 className="font-display flex items-center gap-2 font-semibold">
                        <Receipt className="size-5" /> Ventas de hoy
                        <span aria-hidden="true" className="pub-live ml-auto size-2.5 rounded-full bg-white" />
                    </h3>
                    <ul className="mt-4 space-y-2" aria-live="off">
                        {recentSales.map((count, index) => {
                            const { product, pack, amount } = saleAt(count);

                            return (
                                <li
                                    key={count}
                                    className={cn(
                                        'flex items-center justify-between gap-3 rounded-lg bg-white/[0.07] px-4 py-2.5',
                                        index === 0 && 'pub-new-sale',
                                    )}
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate font-semibold">{product}</span>
                                        <span className="block text-sm text-white/75">
                                            V-{String(count + 1).padStart(6, '0')} · {pack}
                                        </span>
                                    </span>
                                    <span className="shrink-0 font-bold tabular-nums">{money(amount)}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <div className="grid gap-4">
                    <div className="rounded-2xl bg-white/[0.07] p-5">
                        <h3 className="font-display flex items-center gap-2 font-semibold">
                            <Wallet className="size-5" /> Debe haber en caja
                        </h3>
                        <p key={salesCount} className="pub-bump font-display mt-2 text-4xl font-bold tabular-nums">
                            {money(OPENING_CASH + collected)}
                        </p>
                        <p className="mt-1 text-sm text-white/75">
                            {salesCount} ventas · fondo inicial {money(OPENING_CASH)}
                        </p>
                    </div>

                    <div className="rounded-2xl bg-white/[0.07] p-5">
                        <h3 className="font-display flex items-center gap-2 font-semibold">
                            <Package className="size-5" /> Stock actualizado
                        </h3>
                        <p className="mt-2 truncate font-semibold">{lastProduct.product}</p>
                        <p key={salesCount} className="pub-bump font-display text-3xl font-bold tabular-nums">
                            {lastStock} <span className="text-base font-medium text-white/75">{lastProduct.unit}</span>
                        </p>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
                            <div
                                className="h-full rounded-full bg-white transition-[width] duration-500"
                                style={{ width: `${Math.max(4, (lastStock / lastProduct.stock) * 100)}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>
            <p className="mt-3 text-center text-sm text-slate-500">Simulación con datos de ejemplo.</p>
        </section>
    );
}
