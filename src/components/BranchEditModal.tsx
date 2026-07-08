'use client';

import { X } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import BranchEditContent from './BranchEditContent';

interface BranchEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    branch: any;
    projectId: number;
    initialTab?: string;
    onUpdate: () => void;
}

/**
 * Modal de edición de sucursal. El contenido editable (pestañas General, Costos,
 * Inventarios, Nómina, Turnos, Canales de Venta, Formas de Pago) vive en
 * BranchEditContent, que también se reutiliza incrustado en Configuración General.
 */
export default function BranchEditModal({
    isOpen,
    onClose,
    branch,
    projectId,
    initialTab = 'general',
    onUpdate
}: BranchEditModalProps) {
    const { colors } = useTheme();

    if (!isOpen) return null;

    const isNewBranch = !branch || branch.IdSucursal === 0;

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
            <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-5 py-3 relative overflow-hidden" style={{ backgroundColor: 'var(--color-brand-orange)', color: colors.colorLetra }}>
                    <span aria-hidden="true" className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10" />
                    <div className="flex justify-between items-start gap-4 relative z-10">
                        <div className="flex-1">
                            <h1 className="brand-heading text-lg font-semibold leading-tight">
                                {isNewBranch ? 'Nueva Sucursal' : branch?.Sucursal}
                            </h1>
                            <p className="text-[12px] leading-tight opacity-80 mt-0.5">
                                {isNewBranch ? 'Completa la información de la nueva sucursal' : `Editando: ${branch?.Sucursal}`}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white hover:bg-white/20 rounded-lg p-1 flex-shrink-0"
                        >
                            <X size={16} strokeWidth={2} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto bg-white">
                    <BranchEditContent
                        key={branch?.IdSucursal ?? 'new'}
                        branch={branch}
                        projectId={projectId}
                        initialTab={initialTab}
                        onUpdate={onUpdate}
                        onClose={onClose}
                    />
                </div>
            </div>
        </div>
    );
}
