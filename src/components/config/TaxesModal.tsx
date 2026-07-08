'use client';

import BaseModal from '@/components/BaseModal';
import Button from '@/components/Button';
import TaxesPanel from '@/components/config/TaxesPanel';

/**
 * Modal de administración de impuestos. Se abre desde el botón "Impuestos" de la
 * pestaña Proyecto (Configuración General). El contenido vive en TaxesPanel.
 */
export default function TaxesModal({
    isOpen,
    onClose,
    projectId,
}: {
    isOpen: boolean;
    onClose: () => void;
    projectId: number;
}) {
    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title="Impuestos"
            subtitle="Administra los impuestos del proyecto"
            size="xl"
            footer={<div className="flex justify-end"><Button variant="secondary" onClick={onClose}>Cerrar</Button></div>}
        >
            {isOpen && <TaxesPanel projectId={projectId} />}
        </BaseModal>
    );
}
