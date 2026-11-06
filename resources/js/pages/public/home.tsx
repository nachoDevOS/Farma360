/*
 * PÁGINA PÚBLICA de SIVEFARMA (ruta /). Sus secciones están en components/public.
 * Datos: HomeController. "Probar sistema" solo aparece con DEMO_MODE=true y WhatsApp solo con SIVEFARMA_WHATSAPP (ver config/demo.php).
 * Colores: blanco, gris perla, azul noche y el color principal del tema. Solo van cosas que el sistema hace de verdad.
 */
import { DetailBlocks } from '@/components/public/detail-blocks';
import { moveSpotlight } from '@/components/public/effects';
import { FactsBand } from '@/components/public/facts-band';
import { FrequentQuestions } from '@/components/public/frequent-questions';
import { HeroSection } from '@/components/public/hero-section';
import { LivePharmacy } from '@/components/public/live-pharmacy';
import { ModuleGrid } from '@/components/public/module-grid';
import { PainSection } from '@/components/public/pain-section';
import { ReceiptSection } from '@/components/public/receipt-section';
import { SaleShowcase } from '@/components/public/sale-showcase';
import { SiteFooter } from '@/components/public/site-footer';
import { SiteHeader } from '@/components/public/site-header';
import { StartSteps } from '@/components/public/start-steps';
import { TeamRoles } from '@/components/public/team-roles';
import { type Testimonial, Testimonials } from '@/components/public/testimonials';
import { Button } from '@/components/ui/button';
import { type SharedData } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { ArrowRight, MessageCircle, Play } from 'lucide-react';

interface Props {
    demoEnabled: boolean;
    whatsappUrl: string | null;
    phone: string | null;
    testimonials: Testimonial[];
}

const SYSTEM_DESCRIPTION = 'Sistema de Inventario y Ventas de Farmacia';

function PrimaryAction({ demoEnabled, whatsappUrl, large = false }: Omit<Props, 'testimonials' | 'phone'> & { large?: boolean }) {
    const size = large ? 'pub-cta h-11 px-6' : 'h-10 px-4';

    if (demoEnabled) {
        return (
            <Button className={`btn-brand ${size}`} onClick={() => router.post(route('demo.login'))}>
                <Play /> Probar sistema
            </Button>
        );
    }

    if (whatsappUrl) {
        return (
            <Button asChild className={`btn-brand ${size}`}>
                <a href={whatsappUrl} target="_blank" rel="noreferrer">
                    <MessageCircle /> Pedir información
                </a>
            </Button>
        );
    }

    return (
        <Button asChild className={`btn-brand ${size}`}>
            <a href="#modulos">
                Ver módulos <ArrowRight />
            </a>
        </Button>
    );
}

export default function Home({ demoEnabled, whatsappUrl, phone, testimonials }: Props) {
    const { name } = usePage<SharedData>().props;
    const actionProps = { demoEnabled, whatsappUrl };

    return (
        <div onPointerMove={moveSpotlight} className="selection:bg-primary/20 min-h-dvh overflow-x-clip bg-white text-slate-900">
            <Head title={SYSTEM_DESCRIPTION} />
            <SiteHeader name={name}>
                <PrimaryAction {...actionProps} />
            </SiteHeader>

            <HeroSection name={name} description={SYSTEM_DESCRIPTION}>
                <PrimaryAction {...actionProps} large />
            </HeroSection>

            <PainSection name={name} />
            <LivePharmacy />
            <ModuleGrid />
            <SaleShowcase />
            <ReceiptSection />
            <DetailBlocks />
            <FactsBand />
            <TeamRoles />
            <Testimonials testimonials={testimonials} />
            <StartSteps />
            <FrequentQuestions />

            <section className="pub-section bg-white px-4 py-10 sm:px-6 lg:py-12">
                <div className="pub-reveal bg-brand-navy relative mx-auto flex max-w-5xl flex-col items-center gap-3 overflow-hidden rounded-2xl px-6 py-8 text-center text-white">
                    <div
                        aria-hidden="true"
                        className="pub-drift absolute top-full left-1/2 size-[50rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
                        style={{ background: 'radial-gradient(closest-side, color-mix(in oklab, var(--primary) 55%, transparent), transparent)' }}
                    />
                    <h2 className="font-display relative text-2xl leading-tight font-semibold tracking-[-0.02em] text-balance sm:text-[2rem]">
                        Deja el cuaderno. Tu farmacia merece un sistema
                    </h2>
                    <p className="relative max-w-xl text-white/90">Menos papeles, menos pérdidas y más tiempo para atender a tus clientes.</p>
                    <PrimaryAction {...actionProps} large />
                </div>
            </section>

            <SiteFooter name={name} description={SYSTEM_DESCRIPTION} phone={phone} whatsappUrl={whatsappUrl} />

            {whatsappUrl && (
                <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Escríbenos por WhatsApp"
                    className="pub-pulse bg-primary fixed right-5 bottom-5 z-40 flex size-14 items-center justify-center rounded-full text-white shadow-xl shadow-slate-900/30 transition-transform duration-200 hover:scale-110"
                >
                    <MessageCircle className="size-6" />
                </a>
            )}
        </div>
    );
}
