'use client';

import { useState, useEffect } from 'react';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';
import Button from '@/components/Button';

interface ProductionDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    productionItem: {
        IdProducto: number;
        Producto: string;
        Cantidad: number; // Produced quantity
    };
    projectId: number;
}

interface RecipeItem {
    IdProductoHijo: number;
    Codigo: string;
    Producto: string;
    Cantidad: number; // Unit quantity
    Precio: number;
    Categoria: string;
    IdCategoria: number;
    Presentacion: string;
}

interface GroupedCategory {
    categoryName: string;
    items: RecipeItem[];
    subtotal: number;
}

export default function ProductionDetailModal({ isOpen, onClose, productionItem, projectId }: ProductionDetailModalProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [groupedData, setGroupedData] = useState<GroupedCategory[]>([]);
    const [grandTotal, setGrandTotal] = useState(0);

    useEffect(() => {
        if (isOpen && productionItem?.IdProducto && projectId) {
            fetchRecipeDetails();
        }
    }, [isOpen, productionItem, projectId]);

    const fetchRecipeDetails = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/production/costing?projectId=${projectId}&productId=${productionItem.IdProducto}`);
            const data = await response.json();

            if (data.success) {
                processData(data.data);
            }
        } catch (error) {
            console.error('Error fetching recipe details:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const processData = (items: RecipeItem[]) => {
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

            // Scale quantity by produced amount
            const totalQty = item.Cantidad * productionItem.Cantidad;
            const totalCost = totalQty * item.Precio;

            categoriesMap[categoryName].items.push(item);
            categoriesMap[categoryName].subtotal += totalCost;
            total += totalCost;
        });

        const sortedGroups = Object.values(categoriesMap).sort((a, b) => a.categoryName.localeCompare(b.categoryName));
        setGroupedData(sortedGroups);
        setGrandTotal(total);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-orange-500 text-white rounded-t-lg">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            📝 Detalle de Producción
                        </h2>
                        <div className="text-sm opacity-90 mt-1">
                            {productionItem.Producto} - Cantidad Producida: {productionItem.Cantidad}
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white hover:text-gray-200 text-2xl font-bold">
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    {isLoading ? (
                        <div className="text-center py-10 text-gray-500">Cargando detalle de receta...</div>
                    ) : groupedData.length === 0 ? (
                        <div className="text-center py-10 text-gray-500 italic">Este producto no tiene una receta configurada (Kits).</div>
                    ) : (
                        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                                <ThemedGridHeader>
                                    <ThemedGridHeaderCell>Código</ThemedGridHeaderCell>
                                    <ThemedGridHeaderCell>Insumo</ThemedGridHeaderCell>
                                    <ThemedGridHeaderCell className="text-right">Cant. Total</ThemedGridHeaderCell>
                                    <ThemedGridHeaderCell>Presentación</ThemedGridHeaderCell>
                                    <ThemedGridHeaderCell className="text-right">Precio Unit.</ThemedGridHeaderCell>
                                    <ThemedGridHeaderCell className="text-right">Total</ThemedGridHeaderCell>
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
                                            {group.items.map((item, idx) => {
                                                const totalQty = item.Cantidad * productionItem.Cantidad;
                                                const totalCost = totalQty * item.Precio;

                                                return (
                                                    <tr key={`${group.categoryName}-${item.IdProductoHijo}-${idx}`} className="hover:bg-gray-50 border-b border-gray-100 last:border-0">
                                                        <td className="px-6 py-3 whitespace-nowrap text-xs text-gray-500">
                                                            {item.Codigo}
                                                        </td>
                                                        <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                                            {item.Producto}
                                                        </td>
                                                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                                                            {totalQty.toFixed(4)}
                                                        </td>
                                                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                                                            {item.Presentacion}
                                                        </td>
                                                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                                                            ${item.Precio.toFixed(2)}
                                                        </td>
                                                        <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                                                            ${totalCost.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 bg-white flex justify-end gap-6 items-center rounded-b-lg">
                    <div className="text-lg font-medium text-gray-600">Total General:</div>
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
