'use client';

import { useState, useEffect } from 'react';
import PageShell from '@/components/PageShell';
import TaxesPanel from '@/components/config/TaxesPanel';
import { Receipt } from 'lucide-react';

/**
 * Ruta directa de Impuestos. El contenido vive ahora también en el botón
 * "Impuestos" de la pestaña Proyecto (Configuración General); ambos comparten
 * TaxesPanel. Se conserva esta ruta para no romper enlaces existentes.
 */
export default function TaxesPage() {
    const [project, setProject] = useState<any>(null);

    useEffect(() => {
        const stored = localStorage.getItem('project');
        if (stored) setProject(JSON.parse(stored));
    }, []);

    return (
        <PageShell title="Impuestos" subtitle="Administra los impuestos del proyecto" icon={Receipt}>
            {project?.idProyecto && <TaxesPanel projectId={project.idProyecto} />}
        </PageShell>
    );
}
