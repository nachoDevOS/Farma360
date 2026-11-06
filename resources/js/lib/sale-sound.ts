/**
 * SONIDO DE VENTA REALIZADA: caja registradora (public/sounds/cash_register.mp3).
 * Cada navegador recuerda si se silenció (localStorage), para que en una caja se pueda apagar sin afectar a las demás.
 */
const MUTED_STORAGE_KEY = 'sale-sound-muted';
const SOUND_URL = '/sounds/cash_register.mp3';

export function isSaleSoundMuted(): boolean {
    return localStorage.getItem(MUTED_STORAGE_KEY) === 'true';
}

export function setSaleSoundMuted(muted: boolean): void {
    localStorage.setItem(MUTED_STORAGE_KEY, String(muted));
}

/** Si el navegador no deja reproducir, la venta sigue igual: la franja ya la anuncia. */
export function playSaleSound(): void {
    if (isSaleSoundMuted()) {
        return;
    }

    new Audio(SOUND_URL).play().catch(() => undefined);
}
