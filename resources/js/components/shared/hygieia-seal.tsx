/**
 * EMBLEMA DEL LOGIN: la copa de Higía, símbolo de la farmacia, como una copa de vidrio iluminada.
 * Al cargar se dibujan las líneas, la copa se llena de color, sube la serpiente y al final sale una onda de luz (app.css → .seal-*).
 * Toma el color principal del tema (--primary): si cambia el tema, cambia la copa.
 */
const SNAKE_PATH =
    'M150 412C190 430 260 400 250 372C242 350 160 356 150 332C142 308 258 312 250 288C244 268 150 270 148 236C146 200 256 206 256 170C256 130 240 70 205 62C185 58 172 66 170 78';
const BOWL_OUTLINE = 'M82 110C84 190 130 250 200 252C270 250 316 190 318 110';
const NIGHT = 'var(--color-brand-navy)';
const LINE_COLOR = 'color-mix(in oklab, var(--primary) 35%, white)';

export function HygieiaSeal({ className = '' }: { className?: string }) {
    return (
        <svg viewBox="0 0 400 480" className={className} aria-hidden="true">
            <defs>
                <linearGradient id="seal-glass" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" style={{ stopColor: 'color-mix(in oklab, var(--primary) 60%, white)' }} />
                    <stop offset="0.55" style={{ stopColor: 'var(--primary)' }} />
                    <stop offset="1" style={{ stopColor: `color-mix(in oklab, var(--primary) 45%, ${NIGHT})` }} />
                </linearGradient>
                <linearGradient id="seal-snake" gradientUnits="userSpaceOnUse" x1="0" y1="420" x2="0" y2="60">
                    <stop offset="0" stopColor="#a7f3d0" />
                    <stop offset="1" stopColor="#ffffff" />
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

            <path className="seal-snake" d={SNAKE_PATH} pathLength={1} fill="none" stroke={NIGHT} strokeWidth="18" strokeLinecap="round" />
            <path className="seal-snake" d={SNAKE_PATH} pathLength={1} fill="none" stroke="url(#seal-snake)" strokeWidth="10" strokeLinecap="round" />

            {/* El tramo del tallo que pasa por delante: así la serpiente se enrosca en vez de cruzar por encima */}
            <g className="seal-fill">
                <rect x="192" y="298" width="16" height="26" fill="var(--primary)" />
                <path d="M192 298V324M208 298V324" stroke={LINE_COLOR} strokeWidth="2" />
            </g>

            <g className="seal-head">
                <path d="M169 68C184 72 186 94 169 108C152 94 154 72 169 68Z" fill={NIGHT} />
                <path d="M169 72C181 76 182 92 169 103C156 92 157 76 169 72Z" fill="#ffffff" />
                <circle cx="164.5" cy="86" r="1.6" fill={NIGHT} />
                <circle cx="173.5" cy="86" r="1.6" fill={NIGHT} />
                <path d="M169 103V110L166 114M169 110L172 114" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
            </g>
        </svg>
    );
}
