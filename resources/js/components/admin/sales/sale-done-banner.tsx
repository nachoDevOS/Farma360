/**
 * FRANJA "VENTA REALIZADA": entra por la derecha del Punto de venta al cobrar, con el total, lo que hay que entregar al cliente
 * y los botones Imprimir / Ver venta (solo con permiso ventas.ver: sin él, esa página responde 403).
 * Los datos llegan de SaleController@store (->with('sale', ...)). Se va sola al terminar la barra de tiempo, que dura más si hay
 * cambio que entregar; con el mouse o el foco encima se detiene. Animaciones: app.css → .sale-banner.
 * Al aparecer suena una vez (lib/sale-sound.ts); el botón del parlante lo silencia en este navegador.
 */
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { money } from '@/lib/format';
import { isSaleSoundMuted, playSaleSound, setSaleSoundMuted } from '@/lib/sale-sound';
import { cn } from '@/lib/utils';
import { type SaleDone, type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { ArrowRight, Printer, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const COUNT_UP_MS = 700;
const SECONDS_ON_SCREEN = 8;
const SECONDS_ON_SCREEN_WITH_CHANGE = 14;

/** Al volver atrás Inertia repite el aviso de la historia: se recuerda la última venta para no anunciarla dos veces, ni recargando. */
const LAST_SHOWN_SALE_KEY = 'last-shown-sale-id';

/** Monto que sube desde 0 hasta el total, frenando al final. */
function CountUpAmount({ value }: { value: number }) {
    const skipsMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const [shown, setShown] = useState(skipsMotion ? value : 0);

    useEffect(() => {
        if (skipsMotion) {
            return;
        }

        const startedAt = performance.now();
        let frame = requestAnimationFrame(function tick(now) {
            const progress = Math.min((now - startedAt) / COUNT_UP_MS, 1);
            setShown(value * (1 - (1 - progress) ** 3));
            if (progress < 1) {
                frame = requestAnimationFrame(tick);
            }
        });

        return () => cancelAnimationFrame(frame);
    }, [value, skipsMotion]);

    return <>{money(shown)}</>;
}

export function SaleDoneBanner() {
    const { flash } = usePage<SharedData>().props;
    const canSeeSale = useCan()('ventas.ver');
    const [isMuted, setIsMuted] = useState(isSaleSoundMuted);
    const [sale, setSale] = useState<SaleDone | null>(null);
    const [isLeaving, setIsLeaving] = useState(false);

    useEffect(() => {
        const incoming = flash?.sale;
        if (!incoming || sessionStorage.getItem(LAST_SHOWN_SALE_KEY) === String(incoming.id)) {
            return;
        }

        sessionStorage.setItem(LAST_SHOWN_SALE_KEY, String(incoming.id));
        setSale(incoming);
        setIsLeaving(false);
        playSaleSound();
    }, [flash?.sale]);

    if (!sale) {
        return null;
    }

    const change = Number(sale.change);
    const hasChange = change > 0;

    return (
        <aside
            key={sale.id}
            role="status"
            className={cn(
                'sale-banner bg-background fixed right-0 bottom-6 z-50 w-[28rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-l-xl border border-r-0 shadow-xl',
                isLeaving && 'sale-banner-out',
            )}
            onAnimationEnd={(event) => {
                if (isLeaving && event.target === event.currentTarget) {
                    setSale(null);
                }
            }}
        >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 pr-3 pl-4">
                <span className="sale-check relative size-8 shrink-0 text-emerald-600 dark:text-emerald-400">
                    <svg viewBox="0 0 40 40" className="size-8" aria-hidden="true">
                        <circle className="sale-check-circle" cx="20" cy="20" r="17" pathLength="1" />
                        <path className="sale-check-mark" d="M12.5 20.5l5.5 5.5 10-11" pathLength="1" />
                    </svg>
                </span>
                <div className="sale-rise min-w-28 flex-1 [animation-delay:0.15s]">
                    <p className="text-sm leading-tight font-semibold">Venta realizada</p>
                    <p className="text-muted-foreground truncate text-xs">
                        {[sale.number, sale.payment_labels.join(' + '), sale.customer_name].filter(Boolean).join(' · ')}
                    </p>
                </div>
                <dl className={cn('sale-rise order-2 grid w-full gap-2 [animation-delay:0.22s]', hasChange && 'grid-cols-2')}>
                    <div className="bg-muted/50 rounded-md px-2.5 py-1">
                        <dt className="text-muted-foreground text-[11px] leading-tight">Total cobrado</dt>
                        <dd className="font-display leading-tight font-bold tabular-nums">
                            <CountUpAmount value={Number(sale.total)} />
                        </dd>
                    </div>
                    {hasChange && (
                        <div className="sale-change-glow rounded-md bg-emerald-500/10 px-2.5 py-1">
                            <dt className="text-[11px] leading-tight text-emerald-700 dark:text-emerald-400">Entregar al cliente</dt>
                            <dd className="font-display leading-tight font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
                                <CountUpAmount value={change} />
                            </dd>
                        </div>
                    )}
                </dl>
                {canSeeSale && (
                    <div className="sale-rise order-3 ml-auto flex gap-1.5 [animation-delay:0.3s]">
                        <Button asChild size="sm" variant="outline">
                            <Link href={route('admin.sales.show', { sale: sale.id, imprimir: 1 })}>
                                <Printer /> Imprimir
                            </Link>
                        </Button>
                        <Button asChild size="sm">
                            <Link href={route('admin.sales.show', sale.id)}>
                                Ver venta <ArrowRight />
                            </Link>
                        </Button>
                    </div>
                )}
                <button
                    type="button"
                    onClick={() => {
                        setSaleSoundMuted(!isMuted);
                        setIsMuted(!isMuted);
                    }}
                    className="text-muted-foreground hover:text-foreground order-1"
                    aria-label={isMuted ? 'Activar sonido de venta' : 'Silenciar sonido de venta'}
                    aria-pressed={isMuted}
                >
                    {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                </button>
                <button
                    type="button"
                    onClick={() => setIsLeaving(true)}
                    className="text-muted-foreground hover:text-foreground order-1"
                    aria-label="Cerrar"
                >
                    <X className="size-4" />
                </button>
            </div>
            <div
                className="sale-banner-timer"
                style={{ animationDuration: `${hasChange ? SECONDS_ON_SCREEN_WITH_CHANGE : SECONDS_ON_SCREEN}s` }}
                onAnimationEnd={() => setIsLeaving(true)}
            />
        </aside>
    );
}
