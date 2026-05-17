'use client';

import { useState, useEffect } from 'react';
import MenuSectionsModal from '@/components/MenuSectionsModal';
import PageShell from '@/components/PageShell';
import { LayoutList } from 'lucide-react';

export default function MenuSectionsPage() {
    const [project, setProject] = useState<any>(null);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    // On this standalone page, the modal is always "open" conceptually, 
    // but we render it as the main content.
    // However, to keep it simple and consistent with the user's request 
    // that the modal contains the "same thing", I'll just render the modal 
    // and handle the "close" by redirecting or just keeping it open.
    // A better way is to extract the TABLE into a component.
    // But since the user specifically asked for a modal that contains the same thing,
    // I already implemented everything inside MenuSectionsModal.

    if (!project) return <div className="p-6">Cargando...</div>;

    return (
        <PageShell title="Secciones de Menú" icon={LayoutList}>
            <MenuSectionsModal
                isOpen={true}
                onClose={() => window.history.back()}
                projectId={project.idProyecto}
            />
            <div className="text-gray-400 text-sm mt-4 italic">
                Tip: Ahora puedes gestionar las secciones directamente desde la pantalla de Platillos Menu.
            </div>
        </PageShell>
    );
}
