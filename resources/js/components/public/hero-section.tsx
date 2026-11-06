/** Portada de borde a borde: el mensaje, la copa con el sistema real y el comprobante, y abajo tres puntos fuertes. */
import { BrowserFrame } from '@/components/public/browser-frame';
import { moveParallax, RisingWords, stagger } from '@/components/public/effects';
import { ExpiryCard, SaleCard } from '@/components/public/hero-cards';
import { ExampleReceipt } from '@/components/public/receipt-section';
import { HygieiaSeal } from '@/components/shared/hygieia-seal';
import { CalendarClock, ShoppingCart, Wallet } from 'lucide-react';
import { type CSSProperties } from 'react';

const pillars = [
    {
        icon: ShoppingCart,
        title: 'Venta rápida',
        text: 'Busca por síntoma o código de barras y vende cada producto en todas sus presentaciones.',
        color: 'bg-brand-navy',
    },
    { icon: CalendarClock, title: 'Lotes y vencimientos', text: 'Sale primero lo que vence antes, con aviso 90 días antes.' },
    { icon: Wallet, title: 'Caja clara', text: 'Turnos por cajero, con la diferencia a la vista al cerrar.' },
];

export function HeroSection({ name, description, children }: { name: string; description: string; children: React.ReactNode }) {
    return (
        <section id="inicio" onPointerMove={moveParallax} className="bg-brand-navy relative flex scroll-mt-20 flex-col overflow-hidden text-white">
            <div
                aria-hidden="true"
                className="pub-drift absolute top-[42%] left-[62%] size-[90rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ background: 'radial-gradient(closest-side, color-mix(in oklab, var(--primary) 46%, transparent), transparent)' }}
            />

            <div className="pub-hero-exit relative mx-auto grid w-full max-w-[110rem] flex-1 items-center gap-6 px-4 pt-7 pb-5 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:px-12 xl:gap-16">
                <div>
                    <p className="pub-fade font-display font-semibold text-white/80">{description}</p>
                    <h1 className="font-display mt-2 max-w-2xl text-[clamp(2rem,3vw,3rem)] leading-[1.1] font-semibold tracking-[-0.025em] text-balance">
                        <RisingWords text="Tu farmacia bajo control, de la caja al estante" />
                    </h1>
                    <p className="pub-fade mt-3 max-w-xl leading-relaxed text-white/85 xl:text-lg">
                        Deja atrás el cuaderno y el Excel. Vende, controla tu stock y cierra la caja en un solo sistema web, pensado para el mostrador
                        de una farmacia.
                    </p>
                    <div className="pub-fade mt-5 flex flex-wrap items-center gap-5">
                        {children}
                        <a href="#venta" className="pub-link text-base font-semibold text-white">
                            Ver una venta
                        </a>
                    </div>
                </div>

                <div className="relative mx-auto w-full lg:h-[min(26rem,60dvh)]">
                    <div className="pub-layer lg:absolute lg:top-[4%] lg:right-[13%] lg:w-[61%]" style={{ '--depth': '26px' } as CSSProperties}>
                        <BrowserFrame>
                            <img src="/images/landing/pos.jpg" alt={`${name}: punto de venta con productos en el carrito`} className="w-full" />
                        </BrowserFrame>
                    </div>

                    <div className="pub-layer relative z-10 lg:absolute lg:bottom-0 lg:left-[-7%]" style={{ '--depth': '-16px' } as CSSProperties}>
                        <HygieiaSeal className="mx-auto mt-4 h-40 sm:h-56 lg:mt-0 lg:h-[min(24rem,56dvh)]" />
                    </div>

                    <ExpiryCard className="pub-card-first pub-float pub-layer absolute top-[-3%] left-[36%] z-20 hidden min-[1280px]:flex" />
                    <SaleCard className="pub-card-third pub-float pub-layer absolute right-[16%] bottom-[1%] z-20 hidden min-[1280px]:block" />

                    <div
                        aria-hidden="true"
                        className="pub-card pub-card-second pub-float pub-ticket pub-layer absolute z-20 hidden rotate-2 lg:top-[2%] lg:right-[-1%] lg:block lg:w-[122px]"
                    >
                        <ExampleReceipt className="w-[304px] origin-top-left scale-[0.4]" />
                    </div>
                </div>
            </div>

            <ul className="relative mx-auto grid w-full max-w-[110rem] gap-3 px-4 pb-5 sm:px-6 md:grid-cols-3 lg:px-12">
                {pillars.map(({ icon: Icon, title, text }, index) => (
                    <li
                        key={title}
                        style={stagger(index)}
                        className="pub-pillar pub-lift flex items-center gap-3 rounded-xl bg-white/[0.08] p-3 ring-1 ring-white/15"
                    >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                            <Icon className="size-4" />
                        </span>
                        <span>
                            <span className="font-display block font-bold">{title}</span>
                            <span className="block text-sm leading-snug text-white/85">{text}</span>
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
