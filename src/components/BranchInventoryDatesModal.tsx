'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/Button';
import Input from '@/components/Input';

interface InventoryDate {
    Dia: number;
    Mes: number;
    Anio: number;
    FechaInventario: string;
}

interface BranchInventoryDatesModalProps {
    isOpen: boolean;
    onClose: () => void;
    branchId: number;
    branchName: string;
    projectId: number;
    isTabMode?: boolean;
}

export default function BranchInventoryDatesModal({ isOpen, onClose, branchId, branchName, projectId, isTabMode }: BranchInventoryDatesModalProps) {
    const [inventories, setInventories] = useState<InventoryDate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if ((isOpen || isTabMode) && branchId) {
            fetchInventories();
        }
    }, [isOpen, isTabMode, branchId]);

    const fetchInventories = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/branches/${branchId}/inventories?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                setInventories(data.data);
            }
        } catch (error) {
            console.error('Error fetching inventory dates:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await fetch(`/api/branches/${branchId}/inventories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    date: selectedDate
                })
            });

            if (response.ok) {
                fetchInventories();
            }
        } catch (error) {
            console.error('Error saving inventory date:', error);
        }
    };

    const handleDelete = async (item: InventoryDate) => {
        if (!confirm('¿Estás seguro de eliminar esta fecha de inventario?')) return;

        try {
            const response = await fetch(`/api/branches/${branchId}/inventories?projectId=${projectId}&dia=${item.Dia}&mes=${item.Mes}&anio=${item.Anio}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchInventories();
            }
        } catch (error) {
            console.error('Error deleting inventory date:', error);
        }
    };

    if (!isOpen && !isTabMode) return null;

    const formatDate = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
        const dayStr = day.toString().padStart(2, '0');
        const monthName = months[month - 1];
        return `${dayStr}-${monthName}-${year}`;
    };

    const getDegradationClass = (dateStr: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [year, month, day] = dateStr.split('-').map(Number);
        const itemDate = new Date(year, month - 1, day);

        if (itemDate >= today) return "";

        const isOlderMonth = year < today.getFullYear() || (year === today.getFullYear() && (month - 1) < today.getMonth());

        if (isOlderMonth) return "opacity-40 grayscale brightness-95 transition-opacity hover:opacity-100";
        return "opacity-70 transition-opacity hover:opacity-100";
    };

    const content = (
        <div className={isTabMode ? "" : "bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] flex flex-col"}>
            {!isTabMode && (
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Fechas de Inventario - {branchName}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden">
                {/* Form Section */}
                <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-4 text-primary-600">Capturar Fecha</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input
                            label="Fecha Inventario"
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            required
                        />
                        <div className="flex justify-end pt-2">
                            <Button type="submit">Guardar</Button>
                        </div>
                    </form>
                </div>

                {/* History Section */}
                <div className="flex flex-col overflow-hidden">
                    <h3 className="font-semibold mb-4">Historial</h3>
                    <div className="flex-1 overflow-y-auto border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {isLoading ? (
                                    <tr><td colSpan={2} className="px-3 py-4 text-center text-sm text-gray-500">Cargando...</td></tr>
                                ) : inventories.length === 0 ? (
                                    <tr><td colSpan={2} className="px-3 py-4 text-center text-sm text-gray-500">No hay registros</td></tr>
                                ) : (
                                    inventories.map((item, idx) => (
                                        <tr key={`${item.Anio}-${item.Mes}-${item.Dia}`} className={`hover:bg-gray-50 text-xs ${getDegradationClass(item.FechaInventario)}`}>
                                            <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">
                                                {formatDate(item.FechaInventario)}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-right">
                                                <button
                                                    onClick={() => handleDelete(item)}
                                                    className="text-red-600 hover:text-red-900 ml-2"
                                                    title="Eliminar"
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );

    if (isTabMode) return content;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            {content}
        </div>
    );
}
