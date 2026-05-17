'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import Input from '@/components/Input';
import * as XLSX from 'xlsx';
import PageShell from '@/components/PageShell';
import { BarChart2 } from 'lucide-react';

interface Branch {
    IdSucursal: number;
    Sucursal: string;
}

interface MinMaxEntry {
    IdProducto: number;
    Producto: string;
    Codigo: string;
    Presentacion: string;
    IdCategoria: number;
    Categoria: string;
    ImagenCategoria?: string;
    ArchivoImagen?: string;
    Minimo: number;
    Maximo: number;
}

interface GroupedEntries {
    [categoria: string]: MinMaxEntry[];
}

export default function MinMaxPage() {
    const t = useTranslations('BranchMinMax');
    const tNav = useTranslations('Navigation');
    const tCommon = useTranslations('Common');
    const { colors } = useTheme();

    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [project, setProject] = useState<any>(null);
    const [entries, setEntries] = useState<MinMaxEntry[]>([]);
    const [editedValues, setEditedValues] = useState<Record<number, { min: number, max: number }>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchBranches();
            const savedBranch = localStorage.getItem('dashboardSelectedBranch');
            if (savedBranch) setSelectedBranch(savedBranch);
        }
    }, [project]);

    useEffect(() => {
        if (selectedBranch) {
            localStorage.setItem('dashboardSelectedBranch', selectedBranch);
            fetchMinMaxEntries();
        }
    }, [selectedBranch]);

    const fetchBranches = async () => {
        try {
            const response = await fetch(`/api/branches?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success && data.data.length > 0) {
                setBranches(data.data);
                if (!selectedBranch) {
                    setSelectedBranch(data.data[0].IdSucursal.toString());
                }
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        }
    };

    const fetchMinMaxEntries = async () => {
        if (!project || !selectedBranch) return;
        setIsLoading(true);
        try {
            const response = await fetch(`/api/branches/${selectedBranch}/min-max?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setEntries(data.data);
                const values: Record<number, { min: number, max: number }> = {};
                data.data.forEach((entry: MinMaxEntry) => {
                    values[entry.IdProducto] = {
                        min: entry.Minimo || 0,
                        max: entry.Maximo || 0
                    };
                });
                setEditedValues(values);
            }
        } catch (error) {
            console.error('Error fetching min-max entries:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleValueChange = (productId: number, field: 'min' | 'max', value: string) => {
        const numValue = parseFloat(value) || 0;
        setEditedValues(prev => ({
            ...prev,
            [productId]: {
                ...prev[productId],
                [field]: numValue
            }
        }));
    };

    const handleSaveAll = async () => {
        if (!project || !selectedBranch) return;

        setIsSaving(true);
        try {
            const updates = Object.entries(editedValues).map(([productId, values]) => ({
                productId: parseInt(productId),
                min: values.min,
                max: values.max
            }));

            const response = await fetch(`/api/branches/${selectedBranch}/min-max`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    updates
                })
            });

            if (response.ok) {
                alert(tCommon('successUpdate') || '¡Guardado con éxito!');
                fetchMinMaxEntries();
            } else {
                alert(tCommon('errorUpdate') || 'Error al guardar');
            }
        } catch (error) {
            console.error('Error saving min-max:', error);
            alert(tCommon('errorUpdate') || 'Error al guardar');
        } finally {
            setIsSaving(false);
        }
    };

    const handleExport = () => {
        if (entries.length === 0) return;

        const branchName = branches.find(b => b.IdSucursal.toString() === selectedBranch)?.Sucursal || 'Sucursal';
        
        const exportData = entries.map(entry => {
            const values = editedValues[entry.IdProducto] || { min: 0, max: 0 };
            return {
                [tCommon('category') || 'Categoría']: entry.Categoria || 'Sin Categoría',
                [t('product') || 'Producto']: entry.Producto,
                [t('code') || 'Código']: entry.Codigo,
                [t('presentation') || 'Presentación']: entry.Presentacion,
                [t('max') || 'Máximo']: values.max,
                [t('min') || 'Mínimo']: values.min,
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Maximos y Minimos');
        XLSX.writeFile(wb, `Maximos_Minimos_${branchName}.xlsx`);
    };

    const filteredEntries = entries.filter(entry => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            entry.Producto?.toLowerCase().includes(query) ||
            entry.Codigo?.toLowerCase().includes(query)
        );
    });

    const groupedEntries: GroupedEntries = filteredEntries.reduce((acc, entry) => {
        const categoria = entry.Categoria || 'Sin Categoría';
        if (!acc[categoria]) acc[categoria] = [];
        acc[categoria].push(entry);
        return acc;
    }, {} as GroupedEntries);

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    return (
        <PageShell
            title={t('title')}
            icon={BarChart2}
            actions={
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                            {tCommon('branch') || 'Sucursal'}
                        </label>
                        <select
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm font-bold bg-gray-50/50"
                        >
                            {branches.map(branch => (
                                <option key={branch.IdSucursal} value={branch.IdSucursal}>
                                    {branch.Sucursal}
                                </option>
                            ))}
                        </select>
                    </div>

                    <Button onClick={handleExport} variant="secondary" className="px-6 h-[42px] mt-4">
                        📊 {t('exportExcel') || 'Exportar Excel'}
                    </Button>
                    <Button onClick={handleSaveAll} isLoading={isSaving} className="px-8 h-[42px] mt-4">
                        💾 {tCommon('save')}
                    </Button>
                </div>
            }
        >

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                <div className="p-4 bg-gray-50 border-b flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3">🔍</span>
                        <input
                            type="text"
                            placeholder={t('searchProduct')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                        />
                    </div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        {filteredEntries.length} Productos
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-4 space-y-4" style={{ maxHeight: 'calc(100vh - 290px)' }}>
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">{t('loading')}</p>
                        </div>
                    ) : Object.keys(groupedEntries).length === 0 ? (
                        <div className="text-center py-20 text-gray-400 italic font-bold">
                            {t('noRecords')}
                        </div>
                    ) : (
                        Object.entries(groupedEntries).map(([categoria, entries]) => (
                            <div key={categoria} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                <div
                                    onClick={() => toggleCategory(categoria)}
                                    className="px-4 py-3 font-bold flex justify-between items-center cursor-pointer hover:bg-opacity-90 transition-all"
                                    style={{ backgroundColor: colors.colorFondo1, color: colors.colorLetra }}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm">{expandedCategories[categoria] ? '▼' : '▶'}</span>
                                        <span className="text-sm uppercase tracking-wide">
                                            {entries[0]?.ImagenCategoria ? `${entries[0].ImagenCategoria} ` : '📁 '}
                                            {categoria}
                                        </span>
                                    </div>
                                    <div className="bg-white/20 px-3 py-1 rounded-full border border-white/20 text-[10px] font-black uppercase">
                                        {entries.length} Items
                                    </div>
                                </div>

                                {expandedCategories[categoria] && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-gray-200">
                                                    <th className="px-4 py-2 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest w-16">Foto</th>
                                                    <th className="px-4 py-2 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Código</th>
                                                    <th className="px-4 py-2 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Producto</th>
                                                    <th className="px-4 py-2 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Presentación</th>
                                                    <th className="px-4 py-2 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest w-32">{t('max')}</th>
                                                    <th className="px-4 py-2 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest w-32">{t('min')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {entries.map((entry) => (
                                                    <tr key={entry.IdProducto} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="px-4 py-2">
                                                            {entry.ArchivoImagen ? (
                                                                <img src={entry.ArchivoImagen} alt={entry.Producto} className="w-8 h-8 object-cover rounded shadow-sm border" />
                                                            ) : (
                                                                <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">📷</div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2 text-xs font-bold text-gray-500">{entry.Codigo}</td>
                                                        <td className="px-4 py-2 text-sm font-bold text-gray-800">{entry.Producto}</td>
                                                        <td className="px-4 py-2 text-xs text-gray-500 font-medium">{entry.Presentacion || '-'}</td>
                                                        <td className="px-4 py-2">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={editedValues[entry.IdProducto]?.max ?? 0}
                                                                onChange={(e) => handleValueChange(entry.IdProducto, 'max', e.target.value)}
                                                                className="w-full px-2 py-1.5 border border-gray-200 rounded text-center text-sm font-bold focus:ring-2 focus:ring-primary-500 outline-none"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-2">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={editedValues[entry.IdProducto]?.min ?? 0}
                                                                onChange={(e) => handleValueChange(entry.IdProducto, 'min', e.target.value)}
                                                                className="w-full px-2 py-1.5 border border-gray-200 rounded text-center text-sm font-bold focus:ring-2 focus:ring-primary-500 outline-none"
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </PageShell>
    );
}
