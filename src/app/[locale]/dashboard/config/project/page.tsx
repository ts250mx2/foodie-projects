'use client';

import { useState, useEffect, useCallback } from 'react';
import PageShell from '@/components/PageShell';
import BaseModal from '@/components/BaseModal';
import Button from '@/components/Button';
import { Settings, FolderOpen, MapPin, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import ProjectPanel from '@/components/config/ProjectPanel';
import BranchEditContent from '@/components/BranchEditContent';

interface Branch {
    IdSucursal: number;
    Sucursal: string;
    [key: string]: any;
}

const EMPTY_BRANCH = {
    IdSucursal: 0,
    Sucursal: '',
    Telefonos: '',
    CorreoElectronico: '',
    Calle: '',
    IdEmpleadoGerente: null,
    Status: 0,
};

export default function GeneralConfigPage() {
    const { colors } = useTheme();
    const [project, setProject] = useState<any>(null);
    const [branches, setBranches] = useState<Branch[]>([]);
    // active: 'project' | 'new' | `b:${IdSucursal}`
    const [active, setActive] = useState<string>('project');
    const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('project');
        if (stored) setProject(JSON.parse(stored));
    }, []);

    const fetchBranches = useCallback(async (): Promise<Branch[]> => {
        if (!project?.idProyecto) return [];
        try {
            const res = await fetch(`/api/branches?projectId=${project.idProyecto}`);
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                setBranches(data.data);
                return data.data as Branch[];
            }
        } catch (e) {
            console.error('Error fetching branches:', e);
        }
        return [];
    }, [project]);

    useEffect(() => { fetchBranches(); }, [fetchBranches]);

    const activeBranch = active.startsWith('b:')
        ? branches.find((b) => `b:${b.IdSucursal}` === active) || null
        : null;

    const handleCreated = async (id: number) => {
        await fetchBranches();
        setActive(`b:${id}`);
    };

    const handleDelete = async () => {
        if (!deleteTarget || !project?.idProyecto) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/branches/${deleteTarget.IdSucursal}?projectId=${project.idProyecto}`, { method: 'DELETE' });
            if (res.ok) {
                if (active === `b:${deleteTarget.IdSucursal}`) setActive('project');
                await fetchBranches();
                setDeleteTarget(null);
            }
        } catch (e) {
            console.error('Error deleting branch:', e);
        } finally {
            setIsDeleting(false);
        }
    };

    const tabs = [
        { id: 'project', label: 'Proyecto', icon: FolderOpen },
        ...branches.map((b) => ({ id: `b:${b.IdSucursal}`, label: b.Sucursal || 'Sucursal', icon: MapPin })),
        { id: 'new', label: 'Nueva sucursal', icon: Plus },
    ];

    return (
        <PageShell
            title="Configuración General"
            subtitle="Datos del proyecto y sucursales"
            icon={Settings}
        >
            {/* Pestañas: Proyecto + una por sucursal + Nueva */}
            <div className="border-b border-gray-200 mb-4">
                <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {tabs.map((item) => {
                        const isActive = active === item.id;
                        const Icon = item.icon;
                        const isNew = item.id === 'new';

                        // La pestaña "Nueva sucursal" es una acción: chip amarillo de marca
                        // con texto oscuro (legible), resaltado con anillo cuando está activa.
                        if (isNew) {
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setActive(item.id)}
                                    className={`relative px-4 py-2.5 flex items-center gap-2 text-sm font-bold transition-all whitespace-nowrap rounded-t-lg hover:brightness-105 ${isActive ? 'ring-2 ring-yellow-500/60 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]' : ''}`}
                                    style={{ backgroundColor: 'var(--color-brand-yellow)', color: '#0a0a0a' }}
                                >
                                    <Icon size={16} />
                                    {item.label}
                                </button>
                            );
                        }

                        return (
                            <button
                                key={item.id}
                                onClick={() => setActive(item.id)}
                                className={`relative px-4 py-2.5 flex items-center gap-2 text-sm transition-all whitespace-nowrap rounded-t-lg ${isActive
                                    ? 'bg-white text-gray-900 font-semibold shadow-[0_-2px_8px_rgba(0,0,0,0.06)] border border-b-0 border-gray-200'
                                    : 'text-gray-500 hover:text-gray-800 hover:bg-white/60 font-medium'
                                    }`}
                                style={isActive ? { borderBottom: `3px solid ${colors.colorFondo1}`, marginBottom: '-1px' } : {}}
                            >
                                <Icon size={16} style={isActive ? { color: colors.colorFondo1 } : {}} />
                                {item.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Contenido de la pestaña activa */}
            {active === 'project' && <ProjectPanel />}

            {project?.idProyecto && active === 'new' && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <BranchEditContent
                        key="new"
                        branch={EMPTY_BRANCH}
                        projectId={project.idProyecto}
                        onUpdate={fetchBranches}
                        onCreated={handleCreated}
                    />
                </div>
            )}

            {project?.idProyecto && activeBranch && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <MapPin size={16} className="text-gray-400" />
                            {activeBranch.Sucursal}
                        </h2>
                        <Button variant="danger" size="sm" leftIcon={Trash2} onClick={() => setDeleteTarget(activeBranch)}>
                            Eliminar sucursal
                        </Button>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <BranchEditContent
                            key={activeBranch.IdSucursal}
                            branch={activeBranch}
                            projectId={project.idProyecto}
                            onUpdate={fetchBranches}
                        />
                    </div>
                </div>
            )}

            {/* Confirmación de borrado */}
            <BaseModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                title="Eliminar sucursal"
                size="sm"
                onConfirm={handleDelete}
                confirmVariant="danger"
                confirmLabel="Sí, eliminar"
                confirmLoading={isDeleting}
            >
                <div className="flex flex-col items-center gap-4 py-2 text-center">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                        <AlertTriangle size={24} className="text-red-500" />
                    </div>
                    <div>
                        <p className="font-semibold text-gray-800">¿Eliminar “{deleteTarget?.Sucursal}”?</p>
                        <p className="text-sm text-gray-500 mt-1">Esta acción no se puede deshacer.</p>
                    </div>
                </div>
            </BaseModal>
        </PageShell>
    );
}
