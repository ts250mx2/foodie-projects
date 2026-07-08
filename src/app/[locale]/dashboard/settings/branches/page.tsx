'use client';

import { useTranslations } from 'next-intl';
import PageShell from '@/components/PageShell';
import BranchesPanel from '@/components/config/BranchesPanel';
import { MapPin } from 'lucide-react';

/**
 * Ruta directa de Sucursales. El contenido vive ahora también como pestaña dentro
 * de "Configuración General" (/dashboard/config/project); ambos comparten
 * BranchesPanel. Se conserva esta ruta para no romper enlaces existentes.
 */
export default function BranchesPage() {
    const t = useTranslations('Branches');
    return (
        <PageShell
            title={t('title')}
            subtitle="Gestiona la información de tus sucursales y sus detalles de contacto"
            icon={MapPin}
        >
            <BranchesPanel />
        </PageShell>
    );
}
