'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';

interface InventoryEntry {
    IdProducto: number;
    Cantidad: number;
    Precio: number;
    Codigo: string;
    Producto: string;
    Presentacion: string;
    Categoria: string;
}

interface MinMaxSetting {
    IdProducto: number;
    Minimo: number;
    Maximo: number;
}

interface ComparisonEntry extends InventoryEntry {
    Minimo: number;
    Maximo: number;
    Estado: 'OK' | 'Overstock' | 'Shortage';
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    inventoryEntries: InventoryEntry[];
    editedQuantities: Record<number, number>;
    branchId: string;
    projectId: number;
    dateLabel: string;
}

export default function InventoryMaxMinComparisonModal({
    isOpen,
    onClose,
    inventoryEntries,
    editedQuantities,
    branchId,
    projectId,
    dateLabel
}: Props) {
    const t = useTranslations('InventoryComparison');
    const tCommon = useTranslations('Common');
    const { colors } = useTheme();

    const [comparisonData, setComparisonData] = useState<ComparisonEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && branchId && projectId) {
            fetchComparisonData();
        }
    }, [isOpen, branchId, projectId]);

    const fetchComparisonData = async () => {
        setIsLoading(true);
        try {
            // Fetch Min/Max settings for the branch
            const response = await fetch(`/api/branches/${branchId}/min-max?projectId=${projectId}`);
            const data = await response.json();

            if (data.success) {
                const settings: Record<number, { Minimo: number, Maximo: number }> = {};
                data.data.forEach((s: any) => {
                    settings[s.IdProducto] = {
                        Minimo: s.Minimo || 0,
                        Maximo: s.Maximo || 0
                    };
                });

                // Merge with current inventory state
                const combined: ComparisonEntry[] = inventoryEntries
                    .map(entry => {
                        const setting = settings[entry.IdProducto] || { Minimo: 0, Maximo: 0 };
                        const currentQty = editedQuantities[entry.IdProducto] ?? entry.Cantidad;
                        
                        let estado: 'OK' | 'Overstock' | 'Shortage' = 'OK';
                        if (setting.Maximo > 0 && currentQty > setting.Maximo) {
                            estado = 'Overstock';
                        } else if (setting.Minimo > 0 && currentQty < setting.Minimo) {
                            estado = 'Shortage';
                        }

                        return {
                            ...entry,
                            Cantidad: currentQty,
                            Minimo: setting.Minimo,
                            Maximo: setting.Maximo,
                            Estado: estado
                        };
                    })
                    // Only include products with Min or Max defined
                    .filter(entry => entry.Minimo > 0 || entry.Maximo > 0);

                setComparisonData(combined);
            }
        } catch (error) {
            console.error('Error fetching comparison data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const exportToExcel = () => {
        const rows = comparisonData.map(item => ({
            [t('product')]: item.Producto,
            [t('code')]: item.Codigo,
            [tCommon('category') || 'Categoría']: item.Categoria,
            [t('min')]: item.Minimo,
            [t('max')]: item.Maximo,
            [t('captured')]: item.Cantidad,
            [t('status')]: t(`status${item.Estado}`)
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Reabastecimiento');
        XLSX.writeFile(wb, `Reabastecimiento_${dateLabel.replace(/\//g, '-')}.xlsx`);
    };

    const exportToPdf = () => {
        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.text(t('title'), 14, 22);
        
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`${tCommon('branch')}: ${branchId} | ${dateLabel}`, 14, 30);

        const tableData = comparisonData.map(item => [
            item.Producto,
            item.Codigo,
            item.Minimo.toString(),
            item.Maximo.toString(),
            item.Cantidad.toString(),
            t(`status${item.Estado}`)
        ]);

        autoTable(doc, {
            startY: 35,
            head: [[t('product'), t('code'), t('min'), t('max'), t('captured'), t('status')]],
            body: tableData,
            headStyles: { fillColor: [249, 115, 22] }, // Orange color matching Theme
            alternateRowStyles: { fillColor: [250, 250, 250] },
        });

        doc.save(`Reabastecimiento_${dateLabel.replace(/\//g, '-')}.pdf`);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100">
                {/* Header */}
                <div 
                    className="px-6 py-4 text-white flex justify-between items-center"
                    style={{ background: `linear-gradient(to right, ${colors.colorFondo1}, ${colors.colorFondo2})`, color: colors.colorLetra }}
                >
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tight">{t('title')}</h2>
                        <p className="text-xs opacity-80 font-bold">{dateLabel}</p>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors">✕</button>
                </div>

                {/* Actions */}
                <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest">
                        {comparisonData.length} Productos analizados
                    </div>
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={exportToExcel} disabled={isLoading || comparisonData.length === 0} className="text-xs py-1.5 px-3">
                            📊 {t('exportExcel')}
                        </Button>
                        <Button variant="secondary" onClick={exportToPdf} disabled={isLoading || comparisonData.length === 0} className="text-xs py-1.5 px-3">
                            📄 {t('exportPdf')}
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{tCommon('loading')}</p>
                        </div>
                    ) : comparisonData.length === 0 ? (
                        <div className="text-center py-20 text-gray-400 font-bold italic">
                            {t('noData')}
                        </div>
                    ) : (
                        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('product')}</th>
                                        <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest w-24">{t('min')}</th>
                                        <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest w-24">{t('max')}</th>
                                        <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest w-24">{t('captured')}</th>
                                        <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest w-40">{t('status')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {comparisonData.map((item) => (
                                        <tr key={item.IdProducto} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-gray-800">{item.Producto}</div>
                                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{item.Codigo}</div>
                                            </td>
                                            <td className="px-4 py-3 text-center font-bold text-gray-600">{item.Minimo}</td>
                                            <td className="px-4 py-3 text-center font-bold text-gray-600">{item.Maximo}</td>
                                            <td className="px-4 py-3 text-center font-bold text-orange-600">{item.Cantidad}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`
                                                    px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm border
                                                    ${item.Estado === 'OK' ? 'bg-green-100 text-green-700 border-green-200' : ''}
                                                    ${item.Estado === 'Overstock' ? 'bg-purple-100 text-purple-700 border-purple-200' : ''}
                                                    ${item.Estado === 'Shortage' ? 'bg-red-100 text-red-700 border-red-200' : ''}
                                                `}>
                                                    {t(`status${item.Estado}`)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t flex justify-end">
                    <Button onClick={onClose} variant="secondary" className="px-8">
                        {t('close')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
