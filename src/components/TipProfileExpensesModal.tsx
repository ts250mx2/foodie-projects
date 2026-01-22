'use client';

import { useState, useEffect } from 'react';
import Button from './Button';
import Input from './Input';

interface Expense {
    IdPerfilPropinaEgreso: number;
    Concepto: string;
    Porcentaje: number;
    FechaAct: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    profileId: number;
    profileName: string;
    projectId: number;
}

export default function TipProfileExpensesModal({ isOpen, onClose, profileId, profileName, projectId }: Props) {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [concepto, setConcepto] = useState('');
    const [porcentaje, setPorcentaje] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchExpenses();
        }
    }, [isOpen, profileId]);

    const fetchExpenses = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/tips-profiles/${profileId}/expenses?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                setExpenses(data.data);
            }
        } catch (error) {
            console.error('Error fetching expenses:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await fetch(`/api/tips-profiles/${profileId}/expenses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    concepto,
                    porcentaje: parseFloat(porcentaje) || 0
                })
            });

            if (response.ok) {
                fetchExpenses();
                setConcepto('');
                setPorcentaje('');
            }
        } catch (error) {
            console.error('Error saving expense:', error);
        }
    };

    const handleDelete = async (idEgreso: number) => {
        try {
            const response = await fetch(`/api/tips-profiles/${profileId}/expenses?projectId=${projectId}&idEgreso=${idEgreso}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                fetchExpenses();
            }
        } catch (error) {
            console.error('Error deleting expense:', error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Egresos - {profileName}</h2>
                        <p className="text-sm text-gray-500">Configuración de descuentos por concepto</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <span className="text-2xl">×</span>
                    </button>
                </div>

                <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 items-end p-4 bg-gray-50 rounded-lg">
                    <div className="md:col-span-1">
                        <Input
                            label="Concepto"
                            value={concepto}
                            onChange={(e) => setConcepto(e.target.value)}
                            placeholder="Ej. Comisión Bancaria"
                            required
                        />
                    </div>
                    <div>
                        <Input
                            label="Porcentaje (%)"
                            type="number"
                            step="0.01"
                            value={porcentaje}
                            onChange={(e) => setPorcentaje(e.target.value)}
                            placeholder="0.00"
                            required
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button type="submit" className="w-full">
                            Agregar
                        </Button>
                    </div>
                </form>

                <div className="bg-white border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-orange-500">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                    Concepto
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                    Porcentaje
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                    Fecha Act.
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">Cargando...</td>
                                </tr>
                            ) : expenses.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No hay egresos configurados</td>
                                </tr>
                            ) : (
                                expenses.map((expense) => (
                                    <tr key={expense.IdPerfilPropinaEgreso} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {expense.Concepto}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right pr-20">
                                            {expense.Porcentaje}%
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(expense.FechaAct).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleDelete(expense.IdPerfilPropinaEgreso)}
                                                className="text-xl hover:scale-110 transition-transform"
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

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
