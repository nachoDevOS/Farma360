import { ExpiryBadge } from '@/components/admin/common/doc-status';
import { levelsOf, PackageChain } from '@/components/admin/common/package-chain';
import { countOf } from '@/components/admin/products/presentation-levels';
import { money } from '@/lib/format';
import { type Sale } from '@/types/admin/pharmacy';

/** Productos vendidos: empaque, de qué lote salieron, cantidad × precio, descuento por promoción y total de la línea. */
export function SaleItemsTable({ sale }: { sale: Sale }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
                <thead className="text-muted-foreground text-left text-[11px] tracking-wider uppercase">
                    <tr className="border-b">
                        <th className="px-4 py-2 font-medium">Producto</th>
                        <th className="px-4 py-2 font-medium">Lote</th>
                        <th className="px-4 py-2 font-medium">Vence</th>
                        <th className="px-4 py-2 text-right font-medium">Cantidad</th>
                        <th className="px-4 py-2 text-right font-medium">Descuento</th>
                        <th className="px-4 py-2 text-right font-medium">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {(sale.items ?? []).map((item) => {
                        const quantity = item.units / item.factor;
                        return (
                            <tr key={item.id}>
                                <td className="px-4 py-2">
                                    <p className="font-medium">
                                        {item.product.name} <span className="text-muted-foreground font-normal">{item.product.concentration}</span>
                                    </p>
                                    {item.presentation && (
                                        <PackageChain
                                            size="sm"
                                            pkg={item.presentation.package ?? item.presentation.name}
                                            levels={levelsOf(item.product.presentations ?? [], item.presentation.id)}
                                            className="mt-1"
                                        />
                                    )}
                                </td>
                                <td className="num px-4 py-2">{item.batch.batch_number}</td>
                                <td className="px-4 py-2">
                                    <ExpiryBadge date={item.batch.expires_at} emptyLabel="Sin vencimiento" />
                                </td>
                                <td className="num px-4 py-2 text-right">
                                    {item.presentation?.package ? countOf(quantity, item.presentation.package) : quantity} × {money(item.list_price)}
                                </td>
                                <td className="num px-4 py-2 text-right">
                                    {Number(item.discount_amount) > 0 ? (
                                        <span className="text-emerald-600 dark:text-emerald-400">
                                            {money(item.discount_amount)} ({Number(item.discount_percent)}%)
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground">—</span>
                                    )}
                                </td>
                                <td className="num px-4 py-2 text-right font-medium">{money(item.total)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
