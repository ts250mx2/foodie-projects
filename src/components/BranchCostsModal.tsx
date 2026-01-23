'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/Button';
import Input from '@/components/Input';

interface BranchCost {
    Mes: number;
    Anio: number;
    ObjetivoVentas: number | null;
    CostoMateriaPrima: number | null;
    CostoNomina: number | null;
    GastoOperativo: number | null;
}

interface BranchCostsModalProps {
    isOpen: boolean;
    onClose: () => void;
    branchId: number;
    branchName: string;
    projectId: number;
}

export default function BranchCostsModal({ isOpen, onClose, branchId, branchName, projectId }: BranchCostsModalProps) {
    const [costs, setCosts] = useState<BranchCost[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [formData, setFormData] = useState({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        salesObjective: '',
        rawMaterialCost: '',
        payrollCost: '',
        operatingExpense: ''
    });

    useEffect(() => {
        if (isOpen && branchId) {
            fetchCosts();
        }
    }, [isOpen, branchId]);

    useEffect(() => {
        const selectedCost = costs.find(c => c.Mes === formData.month && c.Anio === formData.year);
        if (selectedCost) {
            setFormData(prev => ({
                ...prev,
                salesObjective: selectedCost.ObjetivoVentas ? selectedCost.ObjetivoVentas.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
                rawMaterialCost: selectedCost.CostoMateriaPrima ? selectedCost.CostoMateriaPrima.toFixed(2) : '',
                payrollCost: selectedCost.CostoNomina ? selectedCost.CostoNomina.toFixed(2) : '',
                operatingExpense: selectedCost.GastoOperativo ? selectedCost.GastoOperativo.toFixed(2) : ''
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                salesObjective: '',
                rawMaterialCost: '',
                payrollCost: '',
                operatingExpense: ''
            }));
        }
    }, [formData.month, formData.year, costs]);

    const fetchCosts = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/branches/${branchId}/costs?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                setCosts(data.data);
            }
        } catch (error) {
            console.error('Error fetching costs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await fetch(`/api/branches/${branchId}/costs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    month: parseInt(formData.month.toString()),
                    year: parseInt(formData.year.toString()),
                    salesObjective: formData.salesObjective ? parseFloat(formData.salesObjective.toString().replace(/,/g, '')) : null,
                    rawMaterialCost: formData.rawMaterialCost ? parseFloat(formData.rawMaterialCost.toString().replace(/,/g, '')) : null,
                    payrollCost: formData.payrollCost ? parseFloat(formData.payrollCost.toString().replace(/,/g, '')) : null,
                    operatingExpense: formData.operatingExpense ? parseFloat(formData.operatingExpense.toString().replace(/,/g, '')) : null
                })
            });

            if (response.ok) {
                fetchCosts();
                // Form data intentionally not cleared to keep the view in sync with the selected month/year
            }
        } catch (error) {
            console.error('Error saving costs:', error);
        }
    };

    const handleDelete = async (month: number, year: number) => {
        if (!confirm(`¿Está seguro de eliminar el registro de ${months[month - 1]} ${year}?`)) return;
        try {
            const response = await fetch(`/api/branches/${branchId}/costs?projectId=${projectId}&month=${month}&year=${year}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                fetchCosts();
            }
        } catch (error) {
            console.error('Error deleting cost:', error);
        }
    };

    if (!isOpen) return null;

    const months = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const years = [];
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 2; i <= currentYear + 1; i++) {
        years.push(i);
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Objetivos y Costos - {branchName}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden">
                    {/* Form Section */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-semibold mb-4 text-orange-600">Capturar Objetivo/Costo</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
                                    <select
                                        value={formData.month}
                                        onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        required
                                    >
                                        {months.map((m, i) => (
                                            <option key={i + 1} value={i + 1}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
                                    <select
                                        value={formData.year}
                                        onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        required
                                    >
                                        {years.map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <Input
                                label="Objetivo Venta Mensual"
                                type="text"
                                value={formData.salesObjective}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    // Allow numbers, commas, and one dot
                                    if (/^[\d,]*\.?\d*$/.test(value)) {
                                        setFormData({ ...formData, salesObjective: value });
                                    }
                                }}
                                onBlur={() => {
                                    const value = formData.salesObjective;
                                    if (value) {
                                        const number = parseFloat(value.toString().replace(/,/g, ''));
                                        if (!isNaN(number)) {
                                            setFormData(prev => ({
                                                ...prev,
                                                salesObjective: number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                            }));
                                        }
                                    }
                                }}
                                onFocus={() => {
                                    const value = formData.salesObjective;
                                    if (value) {
                                        setFormData(prev => ({
                                            ...prev,
                                            salesObjective: value.toString().replace(/,/g, '')
                                        }));
                                    }
                                }}
                                placeholder="0.00"
                            />

                            <Input
                                label="Costo Materia Prima %"
                                type="text"
                                value={formData.rawMaterialCost}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    if (/^[\d]*\.?\d*$/.test(value)) {
                                        setFormData({ ...formData, rawMaterialCost: value });
                                    }
                                }}
                                onBlur={() => {
                                    const value = formData.rawMaterialCost;
                                    if (value) {
                                        const number = parseFloat(value);
                                        if (!isNaN(number)) {
                                            setFormData(prev => ({
                                                ...prev,
                                                rawMaterialCost: number.toFixed(2)
                                            }));
                                        }
                                    }
                                }}
                                placeholder="0.00"
                            />

                            <Input
                                label="Costo Nómina %"
                                type="text"
                                value={formData.payrollCost}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    if (/^[\d]*\.?\d*$/.test(value)) {
                                        setFormData({ ...formData, payrollCost: value });
                                    }
                                }}
                                onBlur={() => {
                                    const value = formData.payrollCost;
                                    if (value) {
                                        const number = parseFloat(value);
                                        if (!isNaN(number)) {
                                            setFormData(prev => ({
                                                ...prev,
                                                payrollCost: number.toFixed(2)
                                            }));
                                        }
                                    }
                                }}
                                placeholder="0.00"
                            />

                            <Input
                                label="Gasto Operativo %"
                                type="text"
                                value={formData.operatingExpense}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    if (/^[\d]*\.?\d*$/.test(value)) {
                                        setFormData({ ...formData, operatingExpense: value });
                                    }
                                }}
                                onBlur={() => {
                                    const value = formData.operatingExpense;
                                    if (value) {
                                        const number = parseFloat(value);
                                        if (!isNaN(number)) {
                                            setFormData(prev => ({
                                                ...prev,
                                                operatingExpense: number.toFixed(2)
                                            }));
                                        }
                                    }
                                }}
                                placeholder="0.00"
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
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Año/Mes</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Objetivo</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Mat. Prima</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Nómina</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">G. Operativo</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {isLoading ? (
                                        <tr><td colSpan={6} className="px-3 py-4 text-center text-sm text-gray-500">Cargando...</td></tr>
                                    ) : costs.length === 0 ? (
                                        <tr><td colSpan={6} className="px-3 py-4 text-center text-sm text-gray-500">No hay registros</td></tr>
                                    ) : (
                                        costs.map((cost, idx) => (
                                            <tr key={`${cost.Anio}-${cost.Mes}`} className="hover:bg-gray-50 text-xs">
                                                <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">
                                                    {cost.Anio} - {months[cost.Mes - 1]}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-right text-gray-600">
                                                    $ {cost.ObjetivoVentas?.toLocaleString() || '0'}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-right text-gray-600">
                                                    {cost.CostoMateriaPrima?.toFixed(2) || '0.00'} %
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-right text-gray-600">
                                                    {cost.CostoNomina?.toFixed(2) || '0.00'} %
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-right text-gray-600">
                                                    {cost.GastoOperativo?.toFixed(2) || '0.00'} %
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-right">
                                                    <button
                                                        onClick={() => handleDelete(cost.Mes, cost.Anio)}
                                                        className="text-red-600 hover:text-red-800 text-lg"
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
        </div>
    );
}
