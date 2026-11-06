/**
 * EMBLEMA DEL LOGIN: la copa de Higía, símbolo de la farmacia, como una copa de vidrio iluminada.
 * Al cargar se dibujan las líneas y la copa se llena de color (app.css → .seal-*). Luego la víbora trepa con la cabeza por delante:
 * su cuerpo se recalcula en cada cuadro siguiendo SNAKE_PATH, con las escamas moviéndose junto a ella. Al llegar saca la lengua y sale una onda de luz.
 * Toma el color principal del tema (--primary): si cambia el tema, cambia la copa.
 */
import { useEffect, useMemo, useState } from 'react';

const SNAKE_PATH =
    'M150 412C190 430 260 400 250 372C242 350 160 356 150 332C142 308 258 312 250 288C244 268 150 270 148 236C146 198 250 222 256 170C260 128 240 70 205 62C185 58 172 66 170 78';
const BOWL_OUTLINE = 'M82 110C84 190 130 250 200 252C270 250 316 190 318 110';
const NIGHT = 'var(--color-brand-navy)';
const LINE_COLOR = 'color-mix(in oklab, var(--primary) 35%, white)';

const SAMPLES_PER_SEGMENT = 40;
const SCALE_SPACING = 6.5;
const SCALE_ROWS = [-0.72, -0.44, -0.16, 0.16, 0.44, 0.72];
const DIAMOND_SPACING = 25;
const VIPER_MAX_HALF_WIDTH = 9.5;
const CLIMB_DELAY_MS = 900;
const CLIMB_DURATION_MS = 2500;
const SWAY_SIZE = 4;
const SWAY_WAVELENGTH = 0.05;
const SWAY_SPEED = 0.07;
const HEAD_GROWTH_DISTANCE = 140;
const SMALLEST_HEAD = 0.6;

interface BodyPoint {
    x: number;
    y: number;
    tangentX: number;
    tangentY: number;
    distance: number;
}

/** Recorre la curva de la serpiente y guarda cada punto con su dirección y la distancia desde la cola. */
function sampleBody(): BodyPoint[] {
    const numbers = SNAKE_PATH.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const points: BodyPoint[] = [];
    let distance = 0;

    for (let index = 0; index + 7 < numbers.length; index += 6) {
        const [x0, y0, x1, y1, x2, y2, x3, y3] = numbers.slice(index, index + 8);

        for (let step = index === 0 ? 0 : 1; step <= SAMPLES_PER_SEGMENT; step++) {
            const t = step / SAMPLES_PER_SEGMENT;
            const u = 1 - t;
            const x = u ** 3 * x0 + 3 * u ** 2 * t * x1 + 3 * u * t ** 2 * x2 + t ** 3 * x3;
            const y = u ** 3 * y0 + 3 * u ** 2 * t * y1 + 3 * u * t ** 2 * y2 + t ** 3 * y3;
            const tangentX = 3 * u ** 2 * (x1 - x0) + 6 * u * t * (x2 - x1) + 3 * t ** 2 * (x3 - x2);
            const tangentY = 3 * u ** 2 * (y1 - y0) + 6 * u * t * (y2 - y1) + 3 * t ** 2 * (y3 - y2);
            const length = Math.hypot(tangentX, tangentY) || 1;
            const previous = points[points.length - 1];
            distance += previous ? Math.hypot(x - previous.x, y - previous.y) : 0;
            points.push({ x, y, tangentX: tangentX / length, tangentY: tangentY / length, distance });
        }
    }

    return points;
}

const BODY = sampleBody();
const BODY_LENGTH = BODY[BODY.length - 1].distance;

/** Media anchura del cuerpo: cola en punta, panza gruesa en el centro y cuello más fino. */
function halfWidthAt(distance: number): number {
    const progress = distance / BODY_LENGTH;
    const taper = progress < 0.55 ? Math.sin((progress / 0.55) * (Math.PI / 2)) : 1 - 0.42 * ((progress - 0.55) / 0.45) ** 2;

    return Math.max(0.8, VIPER_MAX_HALF_WIDTH * taper);
}

function pointAt(distance: number): BodyPoint {
    let low = 0;
    let high = BODY.length - 1;

    while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (BODY[middle].distance < distance) {
            low = middle + 1;
        } else {
            high = middle;
        }
    }

    return BODY[low];
}

function offsetPoint(point: BodyPoint, lateral: number, along = 0): string {
    const x = point.x + point.tangentX * along - point.tangentY * lateral;
    const y = point.y + point.tangentY * along + point.tangentX * lateral;

    return `${x.toFixed(1)} ${y.toFixed(1)}`;
}

function easeInOut(progress: number): number {
    return progress < 0.5 ? 2 * progress ** 2 : 1 - (-2 * progress + 2) ** 2 / 2;
}

/** Ondulación mientras trepa. Se apaga al llegar, para que la víbora quede exactamente sobre SNAKE_PATH. */
function swayAt(distance: number, headDistance: number): number {
    const fadeOut = 1 - headDistance / BODY_LENGTH;

    return SWAY_SIZE * fadeOut * Math.sin(distance * SWAY_WAVELENGTH - headDistance * SWAY_SPEED);
}

/**
 * Dibuja la víbora con la cabeza en headDistance. Cada escama y rombo se ubica según su distancia a la cabeza, así el dibujo
 * sube con ella. El ancho es el menor entre la forma final y la cola, para que siempre termine en punta.
 */
function buildViper(headDistance: number) {
    const visible = BODY.filter((point) => point.distance <= headDistance);
    const hidden = BODY_LENGTH - headDistance;
    const widthAt = (distance: number) => Math.min(halfWidthAt(distance), halfWidthAt(distance + hidden));
    const lateralAt = (point: BodyPoint, side: number) => swayAt(point.distance, headDistance) + widthAt(point.distance) * side;

    const ribbon = (fromSide: number, toSide: number) => {
        if (visible.length < 2) {
            return '';
        }

        const first = visible.map((point) => offsetPoint(point, lateralAt(point, fromSide)));
        const second = visible.map((point) => offsetPoint(point, lateralAt(point, toSide))).reverse();

        return `M${[...first, ...second].join('L')}Z`;
    };

    const rhombus = (point: BodyPoint, side: number, halfLength: number, halfWidth: number) => {
        const lateral = lateralAt(point, side);

        return `M${offsetPoint(point, lateral, -halfLength)}L${offsetPoint(point, lateral + halfWidth)}L${offsetPoint(point, lateral, halfLength)}L${offsetPoint(point, lateral - halfWidth)}Z`;
    };

    let scalesCenter = '';
    let scalesSide = '';
    for (let position = 4, row = 0; position < BODY_LENGTH; position += SCALE_SPACING, row++) {
        const distance = position - hidden;
        if (distance < 0) {
            continue;
        }

        const point = pointAt(distance);
        SCALE_ROWS.forEach((side, column) => {
            if ((row + column) % 2 === 0) {
                const scale = rhombus(point, side, 3.1, Math.max(0.5, widthAt(point.distance) * 0.13));
                if (Math.abs(side) < 0.3) {
                    scalesCenter += scale;
                } else {
                    scalesSide += scale;
                }
            }
        });
    }

    let diamonds = '';
    for (let position = 34; position < BODY_LENGTH - 8; position += DIAMOND_SPACING) {
        const distance = position - hidden;
        if (distance >= 0) {
            const point = pointAt(distance);
            diamonds += rhombus(point, 0, 10, widthAt(point.distance) * 0.62);
        }
    }

    const neck = pointAt(headDistance);
    const sway = swayAt(neck.distance, headDistance);
    const neckX = neck.x - neck.tangentY * sway - neck.tangentX * 3;
    const neckY = neck.y + neck.tangentX * sway - neck.tangentY * 3;
    const angle = (Math.atan2(neck.tangentY, neck.tangentX) * 180) / Math.PI - 90;
    const headSize = SMALLEST_HEAD + (1 - SMALLEST_HEAD) * Math.min(1, headDistance / HEAD_GROWTH_DISTANCE);

    return {
        body: ribbon(-1, 1),
        back: ribbon(-0.68, 0.68),
        shine: ribbon(-0.56, -0.22),
        scalesCenter,
        scalesSide,
        diamonds,
        head: `translate(${neckX.toFixed(1)} ${neckY.toFixed(1)}) rotate(${angle.toFixed(1)}) scale(${headSize.toFixed(2)})`,
    };
}

/** Avanza la cabeza una sola vez al cargar. Con "reducir movimiento" la víbora ya está arriba. */
function useClimbingHead(): number {
    const [headDistance, setHeadDistance] = useState(() => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? BODY_LENGTH : 0));

    useEffect(() => {
        if (headDistance === BODY_LENGTH) {
            return;
        }

        const startedAt = performance.now() + CLIMB_DELAY_MS;
        let frame = requestAnimationFrame(function climb(now) {
            const progress = Math.min(1, Math.max(0, (now - startedAt) / CLIMB_DURATION_MS));
            setHeadDistance(easeInOut(progress) * BODY_LENGTH);
            if (progress < 1) {
                frame = requestAnimationFrame(climb);
            }
        });

        return () => cancelAnimationFrame(frame);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return headDistance;
}

export function HygieiaSeal({ className = '' }: { className?: string }) {
    const headDistance = useClimbingHead();
    const viper = useMemo(() => buildViper(headDistance), [headDistance]);

    return (
        <svg viewBox="0 0 400 480" className={className} aria-hidden="true">
            <defs>
                <linearGradient id="seal-glass" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" style={{ stopColor: 'color-mix(in oklab, var(--primary) 60%, white)' }} />
                    <stop offset="0.55" style={{ stopColor: 'var(--primary)' }} />
                    <stop offset="1" style={{ stopColor: `color-mix(in oklab, var(--primary) 45%, ${NIGHT})` }} />
                </linearGradient>
                <linearGradient id="seal-viper-head" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#15803d" />
                    <stop offset="0.6" stopColor="#22c55e" />
                    <stop offset="1" stopColor="#86efac" />
                </linearGradient>
            </defs>

            <circle cx="200" cy="240" r="192" fill="none" stroke="#ffffff" strokeOpacity="0.07" />
            <circle cx="200" cy="240" r="232" fill="none" stroke="#ffffff" strokeOpacity="0.04" />
            <circle className="seal-ripple" cx="200" cy="240" r="192" fill="none" stroke={LINE_COLOR} strokeWidth="2" opacity="0" />

            <g className="seal-fill">
                <path d="M82 110A118 24 0 0 0 318 110C316 190 270 250 200 252C130 250 84 190 82 110Z" fill="url(#seal-glass)" />
                <ellipse cx="200" cy="110" rx="118" ry="24" fill="url(#seal-glass)" />
                <ellipse cx="200" cy="116" rx="100" ry="15" fill={NIGHT} fillOpacity="0.45" />
                <rect x="192" y="252" width="16" height="150" fill="var(--primary)" />
                <ellipse cx="200" cy="268" rx="18" ry="7" fill="var(--primary)" />
                <path d="M192 400C192 416 150 420 128 432A72 13 0 0 0 272 432C250 420 208 416 208 400Z" fill="url(#seal-glass)" />
                <path d="M104 142C112 182 136 212 166 228" fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="5" strokeLinecap="round" />
            </g>

            <g fill="none" stroke={LINE_COLOR} strokeWidth="2" strokeLinecap="round">
                <ellipse className="seal-line" cx="200" cy="110" rx="118" ry="24" pathLength={1} />
                <path className="seal-line" d={BOWL_OUTLINE} pathLength={1} />
                <path className="seal-line" d="M192 252V400C192 416 150 420 128 432" pathLength={1} />
                <path className="seal-line" d="M208 252V400C208 416 250 420 272 432" pathLength={1} />
                <path className="seal-line" d="M128 432A72 13 0 0 0 272 432" pathLength={1} />
            </g>

            <g>
                <path
                    d={viper.body}
                    fill="#000000"
                    fillOpacity="0.35"
                    stroke="#000000"
                    strokeOpacity="0.35"
                    strokeWidth="5"
                    strokeLinejoin="round"
                    transform="translate(2 5)"
                />
                <path d={viper.body} fill="#14532d" stroke={NIGHT} strokeWidth="5" strokeLinejoin="round" paintOrder="stroke" />
                <path d={viper.back} fill="#16a34a" />
                <path d={viper.shine} fill="#86efac" fillOpacity="0.45" />
                <path d={viper.scalesSide} fill="#052e16" fillOpacity="0.55" />
                <path d={viper.scalesCenter} fill="#bbf7d0" fillOpacity="0.55" />
                <path d={viper.diamonds} fill="#052e16" stroke="#d9f99d" strokeOpacity="0.85" strokeWidth="0.9" strokeLinejoin="round" />
            </g>

            {/* El tramo del tallo que pasa por delante: así la serpiente se enrosca en vez de cruzar por encima */}
            <g className="seal-fill">
                <rect x="192" y="298" width="16" height="26" fill="var(--primary)" />
                <path d="M192 298V324M208 298V324" stroke={LINE_COLOR} strokeWidth="2" />
            </g>

            {headDistance > 0 && (
                <g transform={viper.head}>
                    <path
                        className="seal-tongue"
                        d="M0 40V50L-3.5 55M0 50L3.5 55"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path d="M-7 -2C-19 5 -22 16 -17 25C-13 33 -5 41 0 43C5 41 13 33 17 25C22 16 19 5 7 -2Z" fill={NIGHT} />
                    <path d="M-6 0C-17 6 -20 16 -15 24C-12 32 -5 39 0 41C5 39 12 32 15 24C20 16 17 6 6 0Z" fill="url(#seal-viper-head)" />
                    <path d="M0 3L-9 15L0 31L9 15Z" fill="#052e16" stroke="#d9f99d" strokeOpacity="0.85" strokeWidth="0.9" strokeLinejoin="round" />
                    <path d="M-14 18C-11 15 -8 15 -6 17M14 18C11 15 8 15 6 17" fill="none" stroke="#052e16" strokeWidth="1.8" strokeLinecap="round" />
                    <circle cx="-11.5" cy="21" r="3.4" fill="#facc15" stroke="#052e16" strokeWidth="1" />
                    <circle cx="11.5" cy="21" r="3.4" fill="#facc15" stroke="#052e16" strokeWidth="1" />
                    <ellipse cx="-11.5" cy="21" rx="0.9" ry="3" fill="#000000" />
                    <ellipse cx="11.5" cy="21" rx="0.9" ry="3" fill="#000000" />
                    <circle cx="-3.5" cy="35.5" r="0.9" fill="#052e16" />
                    <circle cx="3.5" cy="35.5" r="0.9" fill="#052e16" />
                </g>
            )}
        </svg>
    );
}
