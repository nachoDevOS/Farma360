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
        <section className="bg-brand-navy px-6 py-14 text-white">
            <dl className="mx-auto grid max-w-[88rem] gap-8 sm:grid-cols-2 lg:grid-cols-4">
                {facts.map(({ icon: Icon, value, label }, index) => (
                    <div key={label} style={stagger(index)} className="pub-reveal text-center">
                        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-white/10">
                            <Icon className="size-5" />
                        </span>
                        <dd className="font-display mt-3 text-5xl font-bold tabular-nums">
                            <CountUp value={value} />
                        </dd>
                        <dt className="mt-1 text-white/80">{label}</dt>
                    </div>
                ))}
            </dl>
        </section>
    );
}
