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
        <section id="preguntas" className="scroll-mt-20 bg-[#f4f6f9] px-6 py-20">
            <SectionHeading title="Preguntas frecuentes" text="Lo que suelen preguntar antes de empezar." />
            <div className="mx-auto mt-10 max-w-3xl space-y-3">
                {questions.map(({ question, answer }) => (
                    <details key={question} className="group rounded-xl bg-white px-5 shadow-sm shadow-slate-900/5">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                            {question}
                            <Plus className="text-primary size-5 shrink-0 transition-transform duration-200 group-open:rotate-45" />
                        </summary>
                        <p className="pb-4 leading-relaxed text-slate-600">{answer}</p>
                    </details>
                ))}
            </div>
        </section>
    );
}
