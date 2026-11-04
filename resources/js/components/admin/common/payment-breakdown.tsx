import { money } from '@/lib/format';
import { type SalePayment } from '@/types/admin/pharmacy';

/** Cuánto se pagó con cada medio en una venta (el efectivo ya sin el cambio): una línea por medio. */
export function PaymentBreakdown({ payments, labels }: { payments: SalePayment[]; labels: Record<string, string> }) {
    return (
        <div className="grid gap-0.5 whitespace-nowrap">
            {payments.map((payment) => (
                <span key={payment.id}>
                    {labels[payment.method] ?? payment.method} <span className="num text-foreground">{money(payment.amount)}</span>
                </span>
            ))}
        </div>
    );
}
