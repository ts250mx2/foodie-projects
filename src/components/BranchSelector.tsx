'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface Branch {
    idSucursal: number;
    nombre: string;
}

interface BranchSelectorProps {
    selectedBranch: number | null;
    onBranchChange: (branchId: number) => void;
}

export default function BranchSelector({ selectedBranch, onBranchChange }: BranchSelectorProps) {
    const t = useTranslations('PurchasesCapture');
    const [branches, setBranches] = useState<Branch[]>([]);
    const [project, setProject] = useState<any>(null);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchBranches();
        }
    }, [project]);

    const fetchBranches = async () => {
        try {
            const response = await fetch(`/api/branches?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setBranches(data.data);
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        }
    };

    return (
        <div className="flex flex-col min-w-[140px]">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1 ml-1">
                {t('selectBranch')}
            </label>
            <select
                value={selectedBranch || ''}
                onChange={(e) => onBranchChange(parseInt(e.target.value))}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm"
            >
                {!selectedBranch && <option value="">Seleccionar...</option>}
                {branches.map((branch) => (
                    <option key={branch.idSucursal} value={branch.idSucursal}>
                        {branch.nombre}
                    </option>
                ))}
            </select>
        </div>
    );
}
