/**
 * CAMPO DE CANTIDAD ENTERA (compras, transferencias, ajustes de inventario…).
 * El stock siempre se cuenta en enteros: lo fraccionado se vende con una presentación más chica
 * (blíster, tableta), nunca "1,5 cajas". Este campo no deja escribir decimales y, si lo intentan,
 * avisa en el momento cómo cargar esa parte.
 *
 *   <QuantityInput value={data.quantity} onChange={(v) => setData('quantity', v)} min={1} />
 *
 * Para un <input> propio (ej: el del punto de venta) usar blockFractionKeys en onKeyDown.
 */
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const DEFAULT_HINT = 'Solo números enteros. Para una parte, usa una presentación más chica (blíster o unidad).';

/** onKeyDown que no deja escribir punto, coma, signos ni exponente en un campo de cantidad. Devuelve true si bloqueó una fracción. */
export function blockFractionKeys(e: React.KeyboardEvent<HTMLInputElement>): boolean {
    if (['e', 'E', '+', '-'].includes(e.key)) {
        e.preventDefault();
        return false;
    }
    if (e.key === '.' || e.key === ',') {
        e.preventDefault();
        return true;
    }
    return false;
}

type Props = Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
    value: string | number;
    onChange: (value: string) => void;
    /** Aviso al intentar un decimal (null = sin aviso) */
    fractionHint?: string | null;
    /** Clases del contenedor (el campo y su aviso) */
    wrapperClassName?: string;
};

export function QuantityInput({ value, onChange, fractionHint = DEFAULT_HINT, wrapperClassName, onKeyDown, ...props }: Props) {
    const [warned, setWarned] = useState(false);

    return (
        <div className={cn('grid gap-1', wrapperClassName)}>
            <Input
                {...props}
                type="number"
                inputMode="numeric"
                step={1}
                value={value}
                onKeyDown={(e) => {
                    if (blockFractionKeys(e)) setWarned(true);
                    onKeyDown?.(e);
                }}
                onChange={(e) => {
                    // Si pegan "1.5" queda solo la parte entera
                    const raw = e.target.value;
                    const whole = raw.split(/[.,]/)[0];
                    setWarned(whole !== raw);
                    onChange(whole);
                }}
            />
            {warned && fractionHint && <p className="text-xs text-amber-700 dark:text-amber-400">{fractionHint}</p>}
        </div>
    );
}
