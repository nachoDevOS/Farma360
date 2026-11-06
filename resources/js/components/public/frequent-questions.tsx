/** Preguntas frecuentes. Las respuestas deben coincidir con lo que el sistema hace hoy. */
import { SectionHeading } from '@/components/public/section-heading';
import { Plus } from 'lucide-react';

const questions = [
    { question: '¿Emite factura?', answer: 'No. Hoy imprime un ticket interno sin valor fiscal: el sistema no está conectado al SIAT.' },
    {
        question: '¿Sirve para varias sucursales?',
        answer: 'Sí. Cada sucursal tiene su stock y sus cajas, y puedes transferir mercadería entre ellas.',
    },
    { question: '¿Puedo limitar lo que ve cada empleado?', answer: 'Sí. Cada usuario tiene un rol con sus permisos, y puedes crear roles a medida.' },
    {
        question: '¿Controla medicamentos con receta?',
        answer: 'Sí. Al vender un producto controlado, el sistema pide el número de receta y el médico.',
    },
    {
        question: '¿Qué pasa si alguien borra algo por error?',
        answer: 'Nada se borra de verdad: el registro queda guardado, con quién lo eliminó y el motivo.',
    },
    {
        question: '¿Se puede usar desde el celular?',
        answer: 'Sí. Es un sistema web y se adapta a la pantalla, aunque para vender rinde mejor en computadora con lector de códigos.',
    },
];

export function FrequentQuestions() {
    return (
        <section id="preguntas" className="pub-section scroll-mt-20 bg-[#f4f6f9] px-4 py-10 sm:px-6 lg:py-12">
            <SectionHeading title="Preguntas frecuentes" text="Lo que suelen preguntar antes de empezar." />
            <div className="mx-auto mt-6 grid max-w-5xl items-start gap-2 lg:grid-cols-2">
                {questions.map(({ question, answer }) => (
                    <details key={question} className="group rounded-xl bg-white px-4 shadow-sm shadow-slate-900/5">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                            {question}
                            <Plus className="text-primary size-5 shrink-0 transition-transform duration-200 group-open:rotate-45" />
                        </summary>
                        <p className="pb-3 text-sm leading-relaxed text-slate-600">{answer}</p>
                    </details>
                ))}
            </div>
        </section>
    );
}
