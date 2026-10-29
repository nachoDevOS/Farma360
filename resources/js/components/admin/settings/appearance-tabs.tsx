/**
 * Selector de tema (Claro / Oscuro / Sistema) de la página Ajustes > Apariencia.
 */
import { Appearance, useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import { Check, LucideIcon, Monitor, Moon, Sun } from 'lucide-react';
import { HTMLAttributes } from 'react';

/** Dibujo en miniatura de cómo se ve el panel en cada tema. */
function Preview({ dark }: { dark: boolean }) {
    return (
        <div className={cn('flex h-24 overflow-hidden rounded-lg border', dark ? 'border-white/10 bg-[#0a0a0c]' : 'border-slate-200 bg-[#f4f6f9]')}>
            <div className={cn('w-1/4 space-y-1.5 p-2', dark ? 'bg-[#070709]' : 'bg-[#0b1b33]')}>
                <div className="h-1.5 w-3/4 rounded-full bg-blue-400" />
                <div className="h-1.5 w-full rounded-full bg-white/15" />
                <div className="h-1.5 w-2/3 rounded-full bg-white/15" />
            </div>
            <div className="flex-1 space-y-2 p-2">
                <div className={cn('h-2 w-1/2 rounded-full', dark ? 'bg-white/30' : 'bg-slate-400')} />
                <div className="grid grid-cols-2 gap-1.5">
                    <div className={cn('h-8 rounded-md', dark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-white shadow-sm')} />
                    <div className={cn('h-8 rounded-md', dark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-white shadow-sm')} />
                </div>
                <div className="h-1.5 w-1/3 rounded-full bg-blue-500" />
            </div>
        </div>
    );
}

export default function AppearanceToggleTab({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
    const { appearance, updateAppearance } = useAppearance();

    const tabs: { value: Appearance; icon: LucideIcon; label: string; hint: string }[] = [
        { value: 'light', icon: Sun, label: 'Claro', hint: 'Fondo claro, ideal de día' },
        { value: 'dark', icon: Moon, label: 'Oscuro', hint: 'Cómodo con poca luz' },
        { value: 'system', icon: Monitor, label: 'Sistema', hint: 'Cambia solo según tu equipo' },
    ];

    return (
        <div className={cn('grid gap-4 sm:grid-cols-3', className)} {...props}>
            {tabs.map(({ value, icon: Icon, label, hint }) => {
                const active = appearance === value;
                return (
                    <button
                        key={value}
                        onClick={() => updateAppearance(value)}
                        className={cn(
                            'relative space-y-3 rounded-lg border p-3 text-left transition-[border-color,box-shadow] duration-150',
                            active ? 'border-primary ring-primary/20 ring-3' : 'hover:border-foreground/25',
                        )}
                    >
                        {value === 'system' ? (
                            <div className="grid grid-cols-2 gap-1 overflow-hidden rounded-lg">
                                <div className="[&>div]:rounded-none">
                                    <Preview dark={false} />
                                </div>
                                <div className="[&>div]:rounded-none">
                                    <Preview dark />
                                </div>
                            </div>
                        ) : (
                            <Preview dark={value === 'dark'} />
                        )}
                        <div className="flex items-center gap-2">
                            <Icon className={cn('size-4', active ? 'text-primary' : 'text-muted-foreground')} />
                            <span className="text-sm font-medium">{label}</span>
                            {active && (
                                <span className="bg-primary text-primary-foreground ml-auto flex size-5 items-center justify-center rounded-full">
                                    <Check className="size-3" />
                                </span>
                            )}
                        </div>
                        <p className="text-muted-foreground -mt-2 text-xs">{hint}</p>
                    </button>
                );
            })}
        </div>
    );
}
