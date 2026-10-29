import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

/*
 * BOTONES DEL SISTEMA (personalizados para Farma360; el resto de components/ui/ es shadcn sin cambios).
 * Compactos y planos: 32 px de alto, texto de 13 px y esquinas de 6 px.
 * Los botones con relleno usan la clase .btn-solid de resources/css/app.css; el color sale de --btn-bg / --btn-fg,
 * así cada variante solo cambia esas dos variables.
 * ver · editar · eliminar: las acciones de siempre con su color fijo (azul mira, ámbar cambia, rojo saca),
 * iguales en toda pantalla para que el color diga qué hace el botón antes de leerlo.
 */
const buttonVariants = cva(
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-medium ring-offset-background transition-[color,background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    {
        variants: {
            variant: {
                default: 'btn-solid [--btn-bg:var(--primary)] [--btn-fg:var(--primary-foreground)]',
                destructive: 'btn-solid [--btn-bg:var(--destructive)] [--btn-fg:var(--destructive-foreground)]',
                success: 'btn-solid [--btn-bg:#16a34a] [--btn-fg:#fff] dark:[--btn-bg:#15803d]',
                outline: 'border border-input bg-card text-foreground shadow-xs hover:bg-muted dark:bg-background/60',
                secondary: 'bg-primary/10 text-primary hover:bg-primary/15',
                ghost: 'text-foreground/80 hover:bg-muted hover:text-foreground',
                link: 'text-primary underline-offset-4 hover:underline active:scale-100',
                ver: 'border border-sky-300 bg-card text-sky-700 hover:bg-sky-50 hover:text-sky-800 dark:border-sky-500/40 dark:text-sky-300 dark:hover:bg-sky-500/10',
                editar: 'border border-amber-300 bg-card text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/10',
                eliminar:
                    'border border-rose-300 bg-card text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10',
            },
            size: {
                default: 'h-8 px-3',
                sm: 'h-7 px-2.5 text-xs [&_svg]:size-3.5',
                lg: 'h-9 px-5 text-sm',
                icon: 'size-8',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };
