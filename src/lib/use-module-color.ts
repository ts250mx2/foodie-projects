'use client';

import { usePathname, useParams } from 'next/navigation';
import { getModuleTheme } from '@/lib/menu-items';

/**
 * Color del módulo al que pertenece la página actual — el mismo que PageShell
 * pinta en su encabezado. Sirve para que el grid, los modales y los filtros de
 * la página hereden ese color en vez de traer cada uno el suyo.
 *
 * Devuelve null si la ruta no está en el menú; el llamador decide el fallback.
 */
export function useModuleColor(): string | null {
    const pathname = usePathname();
    const params = useParams();
    const locale = params?.locale as string | undefined;

    // Misma normalización que PageShell: /es/dashboard/... → /dashboard/...
    const path = locale && pathname?.startsWith(`/${locale}/`)
        ? pathname.slice(locale.length + 1)
        : pathname ?? '';

    return getModuleTheme(path)?.color ?? null;
}
