/**
 * Migas de pan del header: Administración > Usuarios.
 */
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem as BreadcrumbItemType } from '@/types';
import { Fragment } from 'react';

export function Breadcrumbs({ breadcrumbs }: { breadcrumbs: BreadcrumbItemType[] }) {
    return (
        <>
            {breadcrumbs.length > 0 && (
                <Breadcrumb>
                    <BreadcrumbList>
                        {breadcrumbs.map((item, index) => {
                            const isLast = index === breadcrumbs.length - 1;
                            return (
                                <Fragment key={index}>
                                    {/* En celular solo se ve la página actual */}
                                    <BreadcrumbItem className={cn(!isLast && 'hidden md:inline-flex', 'min-w-0')}>
                                        {isLast ? (
                                            <BreadcrumbPage className="truncate">{item.title}</BreadcrumbPage>
                                        ) : (
                                            <BreadcrumbLink href={item.href}>{item.title}</BreadcrumbLink>
                                        )}
                                    </BreadcrumbItem>
                                    {!isLast && <BreadcrumbSeparator className="hidden md:block" />}
                                </Fragment>
                            );
                        })}
                    </BreadcrumbList>
                </Breadcrumb>
            )}
        </>
    );
}
