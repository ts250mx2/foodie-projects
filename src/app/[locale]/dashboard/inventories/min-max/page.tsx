'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import Input from '@/components/Input';
import * as XLSX from 'xlsx';
import PageShell from '@/components/PageShell';
import { Scale, Search, Image as ImageIcon, ChevronDown, BarChart2 } from 'lucide-react';

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

    const recordsWithValues = entries.filter(entry => {
        const values = editedValues[entry.IdProducto];
        return values && (values.min > 0 || values.max > 0);
    }).length;

    return (
        <PageShell
            title={t('title')}
            subtitle={`${filteredEntries.length} ${filteredEntries.length === 1 ? 'producto' : 'productos'} • ${recordsWithValues} con valor`}
            icon={Scale}
            actions={
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative w-full sm:w-64">
                        <Search
                            size={14}
                            className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors pointer-events-none text-gray-400"
                        />
                        <input
                            type="text"
                            placeholder="Buscar producto..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none transition-all placeholder:text-gray-400 text-gray-700"
                        />
                    </div>

                    <select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-700 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {branches.map(branch => (
                            <option key={branch.IdSucursal} value={branch.IdSucursal}>
                                {branch.Sucursal}
                            </option>
                        ))}
                    </select>

                    <Button onClick={handleExport} variant="secondary" size="md" leftIcon={BarChart2} iconBox>
                        {t('exportExcel') || 'Exportar Excel'}
                    </Button>
                    <Button onClick={handleSaveAll} isLoading={isSaving} variant="solid" size="md" leftIcon={undefined} iconBox={false}>
                        {tCommon('save')}
                    </Button>
                </div>
            }
        >

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
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
                                    className="px-4 py-2 flex justify-between items-center cursor-pointer hover:bg-opacity-90 transition-all"
                                    style={{ backgroundColor: colors.colorFondo1, color: colors.colorLetra }}
                                >
                                    <div className="flex items-center gap-2">
                                        <ChevronDown size={16} className={`transition-transform ${expandedCategories[categoria] ? 'rotate-0' : '-rotate-90'}`} />
                                        <span className="text-[13px] font-semibold uppercase tracking-wide">
                                            {entries[0]?.ImagenCategoria ? `${entries[0].ImagenCategoria} ` : ''}
                                            {categoria}
                                        </span>
                                    </div>
                                    <div className="text-xs font-medium">
                                        {entries.length} Items
                                    </div>
                                </div>

                                {expandedCategories[categoria] && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-gray-50 sticky top-0 z-10">
                                                <tr className="border-b border-gray-200">
                                                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest w-16">Foto</th>
                                                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Código</th>
                                                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Producto</th>
                                                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Presentación</th>
                                                    <th className="px-5 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest w-32">{t('max')}</th>
                                                    <th className="px-5 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest w-32">{t('min')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {entries.map((entry) => (
                                                    <tr key={entry.IdProducto} className="border-t border-gray-50 hover:bg-gray-50/60 transition-colors">
                                                        <td className="px-5 py-3">
                                                            {entry.ArchivoImagen ? (
                                                                <img src={entry.ArchivoImagen} alt={entry.Producto} className="w-8 h-8 object-cover rounded shadow-sm border" />
                                                            ) : (
                                                                <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                                                                    <ImageIcon size={16} className="text-gray-400" />
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3 text-sm text-gray-600">{entry.Codigo}</td>
                                                        <td className="px-5 py-3 text-sm font-medium text-gray-900">{entry.Producto}</td>
                                                        <td className="px-5 py-3 text-sm text-gray-600">{entry.Presentacion || '-'}</td>
                                                        <td className="px-5 py-3">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={editedValues[entry.IdProducto]?.max ?? 0}
                                                                onChange={(e) => handleValueChange(entry.IdProducto, 'max', e.target.value)}
                                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-center text-sm focus:ring-2 focus:ring-primary-500/30 outline-none"
                                                            />
                                                        </td>
                                                        <td className="px-5 py-3">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={editedValues[entry.IdProducto]?.min ?? 0}
                                                                onChange={(e) => handleValueChange(entry.IdProducto, 'min', e.target.value)}
                                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-center text-sm focus:ring-2 focus:ring-primary-500/30 outline-none"
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
