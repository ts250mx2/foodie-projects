'use client';

import { useState, useEffect } from 'react';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';
import Button from '@/components/Button';

interface ProductionTotalExplosionModalProps {
    isOpen: boolean;
    onClose: () => void;
    date: Date;
    projectId: number;
    branchId: number;
}

interface ExplosionItem {
    Codigo: string;
    Producto: string;
    Categoria: string;
    Cantidad: number;
    Presentacion: string;
    Precio: number;
    Total: number;
}

interface GroupedCategory {
    categoryName: string;
    items: ExplosionItem[];
    subtotal: number;
}

export default function ProductionTotalExplosionModal({ isOpen, onClose, date, projectId, branchId }: ProductionTotalExplosionModalProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [groupedData, setGroupedData] = useState<GroupedCategory[]>([]);
    const [grandTotal, setGrandTotal] = useState(0);

    useEffect(() => {
        if (isOpen && projectId && branchId) {
            fetchExplosionData();
        }
    }, [isOpen, projectId, branchId, date]);

    const fetchExplosionData = async () => {
        setIsLoading(true);
        try {
            const dateStr = date.toISOString();
            const response = await fetch(`/api/production/explosion?projectId=${projectId}&branchId=${branchId}&date=${dateStr}`);
            const data = await response.json();

            if (data.success) {
                processData(data.data);
            }
        } catch (error) {
            console.error('Error fetching explosion data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const processData = (items: ExplosionItem[]) => {
        const categoriesMap: Record<string, GroupedCategory> = {};
        let total = 0;

        items.forEach(item => {
            const categoryName = item.Categoria || 'Sin Categoría';
            if (!categoriesMap[categoryName]) {
                categoriesMap[categoryName] = {
                    categoryName,
                    items: [],
                    subtotal: 0
                };
            }

            categoriesMap[categoryName].items.push(item);
            categoriesMap[categoryName].subtotal += item.Total; // Total comes pre-calculated from SQL
            total += item.Total;
        });

        // Convert map to array and sort logic could be added here if SQL order isn't sufficient, 
        // but SQL "ORDER BY C.Categoria, B.Producto" handles it.
        // Just need to ensure categoriesMap keys iteration order or convert to array.
        // Object.values is not guaranteed to be sorted, so we rely on the implementation or sort again.
        // Since SQL sorted, let's just push to array in order of appearance or re-sort.
        // The safest is to re-sort:
        const sortedGroups = Object.values(categoriesMap).sort((a, b) => a.categoryName.localeCompare(b.categoryName));
        setGroupedData(sortedGroups);
        setGrandTotal(total);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-orange-600 text-white rounded-t-lg">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            💥 Explosión de Materiales Total
                        </h2>
                        <div className="text-sm opacity-90 mt-1">
                            Fecha: {date.toLocaleDateString()}
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white hover:text-gray-200 text-2xl font-bold">
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    {isLoading ? (
                        <div className="text-center py-10 text-gray-500">Calculando explosión de materiales...</div>
                    ) : groupedData.length === 0 ? (
                        <div className="text-center py-10 text-gray-500 italic">No hay datos de producción o recetas configuradas para este día.</div>
                    ) : (
                        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                                <ThemedGridHeader>
                                    <ThemedGridHeaderCell>Código</ThemedGridHeaderCell>
                                    <ThemedGridHeaderCell>Insumo</ThemedGridHeaderCell>
                                    <ThemedGridHeaderCell className="text-right">Cant. Total</ThemedGridHeaderCell>
                                    <ThemedGridHeaderCell>Presentación</ThemedGridHeaderCell>
                                    <ThemedGridHeaderCell className="text-right">Precio Unit.</ThemedGridHeaderCell>
                                    <ThemedGridHeaderCell className="text-right">Total Costo</ThemedGridHeaderCell>
                                </ThemedGridHeader>
                                <tbody className="bg-white">
                                    {groupedData.map((group) => (
                                        <>
                                            {/* Category Header with Subtotal */}
                                            <tr key={`cat-${group.categoryName}`} className="bg-gray-100">
                                                <td colSpan={6} className="px-6 py-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                                                            {group.categoryName}
                                                        </span>
                                                        <span className="text-sm font-bold text-orange-700">
                                                            Subtotal: ${group.subtotal.toFixed(2)}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Items */}
                                            {group.items.map((item, idx) => (
                                                <tr key={`${group.categoryName}-${item.Codigo}-${idx}`} className="hover:bg-gray-50 border-b border-gray-100 last:border-0">
                                                    <td className="px-6 py-3 whitespace-nowrap text-xs text-gray-500">
                                                        {item.Codigo}
                                                    </td>
                                                    <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {item.Producto}
                                                    </td>
                                                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                                                        {item.Cantidad.toFixed(4)}
                                                    </td>
                                                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                                                        {item.Presentacion}
                                                    </td>
                                                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                                                        ${item.Precio.toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                                                        ${item.Total.toFixed(2)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 bg-white flex justify-end gap-6 items-center rounded-b-lg">
                    <div className="text-lg font-medium text-gray-600">Total General de Insumos:</div>
                    <div className="text-2xl font-bold text-blue-600">
                        ${grandTotal.toFixed(2)}
                    </div>
                    <Button onClick={onClose} className="bg-gray-500 ml-4">
                        Cerrar
                    </Button>
                </div>
            </div>
        </div>
    );
}
