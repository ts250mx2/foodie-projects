'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/Button';
import Input from '@/components/Input';

interface PayrollPeriod {
    IdPeriodoNomina: number;
    IdSucursal: number;
    FechaInicio: string;
    FechaFin: string;
}

interface BranchPayrollModalProps {
    isOpen: boolean;
    onClose: () => void;
    branchId: number;
    branchName: string;
    projectId: number;
    tipoNomina: number;
    initialTipoNomina: number;
    diaInicio: number;
    initialDiaInicio: number;
    onTipoNominaChange: (value: number) => void;
    onDiaInicioChange: (value: number) => void;
    onSaveTipoNomina: () => Promise<void>;
    isTabMode?: boolean;
}

export default function BranchPayrollModal({ 
    isOpen, 
    onClose, 
    branchId, 
    branchName, 
    projectId, 
    tipoNomina,
    initialTipoNomina,
    diaInicio,
    initialDiaInicio,
    onTipoNominaChange,
    onDiaInicioChange,
    onSaveTipoNomina,
    isTabMode 
}: BranchPayrollModalProps) {
    const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSavingTipo, setIsSavingTipo] = useState(false);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if ((isOpen || isTabMode) && branchId) {
            fetchPeriods();
        }
    }, [isOpen, isTabMode, branchId]);

    const fetchPeriods = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/branches/${branchId}/payroll-periods?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                setPeriods(data.data);
                if (data.data.length > 0) {
                    const lastPeriod = data.data[0]; // Ordered by FechaInicio DESC, so 0 is the latest
                    const lastEndDate = new Date(lastPeriod.FechaFin);
                    const nextStartDate = new Date(lastEndDate);
                    nextStartDate.setDate(lastEndDate.getDate() + 1);
                    setStartDate(nextStartDate.toISOString().split('T')[0]);
                    
                    // Also set end date to a week after start date by default
                    const nextEndDate = new Date(nextStartDate);
                    nextEndDate.setDate(nextStartDate.getDate() + 6);
                    setEndDate(nextEndDate.toISOString().split('T')[0]);
                }
            }
        } catch (error) {
            console.error('Error fetching payroll periods:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddPeriod = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await fetch(`/api/branches/${branchId}/payroll-periods`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    fechaInicio: startDate,
                    fechaFin: endDate
                })
            });

            if (response.ok) {
                fetchPeriods();
            } else {
                const errorData = await response.json();
                alert(errorData.message || 'Error al guardar el periodo');
            }
        } catch (error) {
            console.error('Error saving payroll period:', error);
            alert('Error de conexión al guardar el periodo');
        }
    };

    const handleDeletePeriod = async (id: number) => {
        if (!confirm('¿Estás seguro de eliminar este periodo de nómina?')) return;

        try {
            const response = await fetch(`/api/branches/${branchId}/payroll-periods?projectId=${projectId}&periodId=${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchPeriods();
            }
        } catch (error) {
            console.error('Error deleting payroll period:', error);
        }
    };

    if (!isOpen && !isTabMode) return null;

    const content = (
        <div className={isTabMode ? "" : "bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] flex flex-col"}>
            {!isTabMode && (
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Nómina - {branchName}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                </div>
            )}

            <div className="space-y-6">
                {/* Configuration Section */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h3 className="font-semibold mb-4 text-gray-800">Configuración de Nómina</h3>
                    <div className="flex items-end gap-4">
                        <div className="max-w-xs flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Tipo de Nómina
                            </label>
                            <select
                                value={tipoNomina}
                                onChange={(e) => onTipoNominaChange(parseInt(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-sm"
                            >
                                <option value={0}>Por Turno</option>
                                <option value={1}>Por Hora</option>
                            </select>
                        </div>
                        <div className="max-w-xs flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Día de Inicio de Semana
                            </label>
                            <select
                                value={diaInicio}
                                onChange={(e) => onDiaInicioChange(parseInt(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-sm"
                            >
                                <option value={1}>Lunes</option>
                                <option value={2}>Martes</option>
                                <option value={3}>Miércoles</option>
                                <option value={4}>Jueves</option>
                                <option value={5}>Viernes</option>
                                <option value={6}>Sábado</option>
                                <option value={7}>Domingo</option>
                            </select>
                        </div>
                        <Button 
                            onClick={async () => {
                                setIsSavingTipo(true);
                                await onSaveTipoNomina();
                                setIsSavingTipo(false);
                            }}
                            disabled={isSavingTipo || (tipoNomina === initialTipoNomina && diaInicio === initialDiaInicio)}
                        >
                            {isSavingTipo ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                        {tipoNomina === 0 ? "La nómina se calcula por turnos fijos." : "La nómina se calcula basándose en horas laboradas."}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden">
                    {/* Add Period Section */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <h3 className="font-semibold mb-4 text-primary-600">Agregar Periodo</h3>
                        <form onSubmit={handleAddPeriod} className="space-y-4">
                            <Input
                                label="Fecha Inicio"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                required
                            />
                            <Input
                                label="Fecha Fin"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                required
                            />
                            <div className="flex justify-end pt-2">
                                <Button type="submit">Agregar</Button>
                            </div>
                        </form>
                    </div>

                    {/* Periods Grid Section */}
                    <div className="flex flex-col overflow-hidden">
                        <h3 className="font-semibold mb-4">Periodos de Nómina</h3>
                        <div className="flex-1 overflow-y-auto border rounded-lg min-h-[300px]">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inicio</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fin</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {isLoading ? (
                                        <tr><td colSpan={3} className="px-3 py-4 text-center text-sm text-gray-500">Cargando...</td></tr>
                                    ) : periods.length === 0 ? (
                                        <tr><td colSpan={3} className="px-3 py-4 text-center text-sm text-gray-500">No hay registros</td></tr>
                                    ) : (
                                        periods.map((item) => (
                                            <tr key={item.IdPeriodoNomina} className="hover:bg-gray-50 text-xs">
                                                <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">
                                                    {item.FechaInicio}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">
                                                    {item.FechaFin}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-right">
                                                    <button
                                                        onClick={() => handleDeletePeriod(item.IdPeriodoNomina)}
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
        </div>
    );

    if (isTabMode) return content;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            {content}
        </div>
    );
}
