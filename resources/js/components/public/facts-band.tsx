/** Franja de datos del sistema. Son características reales, no cifras de clientes: esas van solo cuando existan. */
import { CountUp, stagger } from '@/components/public/effects';
import { Boxes, CalendarClock, LayoutGrid, Wallet } from 'lucide-react';

const facts = [
    { icon: LayoutGrid, value: 8, label: 'módulos en un solo sistema' },
    { icon: Boxes, value: 9, label: 'tipos de empaque listos, y puedes crear los tuyos' },
    { icon: CalendarClock, value: 90, label: 'días de aviso antes del vencimiento' },
    { icon: Wallet, value: 3, label: 'formas de cobrar: efectivo, QR y mixto' },
];

export function FactsBand() {
    return (
        <section className="pub-section bg-brand-navy px-4 py-8 text-white sm:px-6">
            <dl className="mx-auto grid max-w-[88rem] grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4">
                {facts.map(({ icon: Icon, value, label }, index) => (
                    <div
                        key={label}
                        style={stagger(index)}
                        className="pub-reveal flex flex-col items-center gap-1 text-center lg:flex-row lg:gap-3 lg:text-left"
                    >
                        <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 lg:flex">
                            <Icon className="size-5" />
                        </span>
                        <dd className="font-display text-3xl font-bold tabular-nums lg:text-4xl">
                            <CountUp value={value} />
                        </dd>
                        <dt className="text-sm leading-snug text-white/80">{label}</dt>
                    </div>
                ))}
            </dl>
        </section>
    );
}
