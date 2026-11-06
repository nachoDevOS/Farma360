/**
 * Efectos de la página pública que necesitan JavaScript. Los demás están en app.css → .pub-*
 * Con "reducir movimiento" en el sistema operativo no se mueve nada y se ve todo completo.
 */
import { type CSSProperties, type PointerEvent, useEffect, useRef, useState } from 'react';

const COUNT_UP_MS = 1100;

function prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Posición en una lista: cada elemento aparece un poco después del anterior. */
export function stagger(index: number): CSSProperties {
    return { '--i': index } as CSSProperties;
}

/** Título que sube palabra por palabra al cargar. */
export function RisingWords({ text }: { text: string }) {
    return text.split(' ').map((word, index) => (
        <span key={`${word}-${index}`} className="inline-block overflow-hidden pb-[0.12em] align-top">
            <span className="pub-word inline-block" style={stagger(index)}>
                {word}
            </span>
            {' '}
        </span>
    ));
}

/** Número que sube desde 0 cuando entra en pantalla. */
export function CountUp({ value }: { value: number }) {
    const element = useRef<HTMLSpanElement>(null);
    const [shown, setShown] = useState(value);

    useEffect(() => {
        if (prefersReducedMotion() || !element.current) {
            return;
        }

        setShown(0);
        let frame = 0;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) {
                    return;
                }

                observer.disconnect();
                const startedAt = performance.now();
                frame = requestAnimationFrame(function climb(now) {
                    const progress = Math.min(1, (now - startedAt) / COUNT_UP_MS);
                    setShown(Math.round(value * (1 - (1 - progress) ** 3)));
                    if (progress < 1) {
                        frame = requestAnimationFrame(climb);
                    }
                });
            },
            { threshold: 0.6 },
        );
        observer.observe(element.current);

        return () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
        };
    }, [value]);

    return <span ref={element}>{shown}</span>;
}

/** Luz que sigue al cursor sobre las tarjetas .pub-spot. Va en el contenedor de la página. */
export function moveSpotlight(event: PointerEvent<HTMLElement>): void {
    const card = (event.target as Element).closest<HTMLElement>('.pub-spot');
    if (!card) {
        return;
    }

    const box = card.getBoundingClientRect();
    card.style.setProperty('--spot-x', `${event.clientX - box.left}px`);
    card.style.setProperty('--spot-y', `${event.clientY - box.top}px`);
}

/** Profundidad de la portada: las capas .pub-layer se mueven un poco con el mouse. */
export function moveParallax(event: PointerEvent<HTMLElement>): void {
    if (event.pointerType !== 'mouse' || prefersReducedMotion()) {
        return;
    }

    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--px', ((event.clientX - box.left) / box.width - 0.5).toFixed(3));
    event.currentTarget.style.setProperty('--py', ((event.clientY - box.top) / box.height - 0.5).toFixed(3));
}
