/** Qué gana cada persona de la farmacia. Son los roles que trae el sistema. */
import { stagger } from '@/components/public/effects';
import { SectionHeading } from '@/components/public/section-heading';
import { ClipboardCheck, PackageCheck, Store, UserRound } from 'lucide-react';

const roles = [
    { icon: Store, role: 'Dueño', text: 'Ves ventas, caja y stock de tus sucursales, y sabes quién hizo cada cosa.' },
    { icon: ClipboardCheck, role: 'Regente', text: 'Controlas lotes, vencimientos y medicamentos con receta.' },
    { icon: UserRound, role: 'Cajero', text: 'Vendes rápido, sin calcular empaques ni cambio a mano.' },
    { icon: PackageCheck, role: 'Almacenero', text: 'Recibes compras por lote y envías mercadería a cada sucursal.' },
];

export function TeamRoles() {
    return (
        <section id="equipo" className="pub-section scroll-mt-20 bg-white px-4 py-10 sm:px-6 lg:py-12">
            <SectionHeading title="Pensado para todo tu equipo" text="Cada persona entra con su usuario y ve solo lo que necesita." />
            <div className="mx-auto mt-6 grid max-w-[88rem] gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {roles.map(({ icon: Icon, role, text }, index) => (
                    <article
                        key={role}
                        style={stagger(index)}
                        className="pub-reveal pub-spot pub-lift group flex gap-3 rounded-xl border border-slate-200 bg-white p-4"
                    >
                        <span className="pub-icon bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
                            <Icon className="size-5" />
                        </span>
                        <div>
                            <h3 className="font-display font-bold text-slate-900">{role}</h3>
                            <p className="mt-0.5 text-sm leading-snug text-slate-600">{text}</p>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}
