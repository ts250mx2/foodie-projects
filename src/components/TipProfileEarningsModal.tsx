'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/Button';
import Input from '@/components/Input';

interface Earning {
    IdPerfilPropina: number;
    IdPuesto: number;
    Porcentaje: number;
    Monto: number;
    FechaAct: string;
    PuestoNombre: string;
}

interface Position {
    IdPuesto: number;
    Puesto: string;
}

interface TipProfileEarningsModalProps {
    isOpen: boolean;
    onClose: () => void;
    profileId: number;
    profileName: string;
    projectId: number;
}

export default function TipProfileEarningsModal({
    isOpen,
    onClose,
    profileId,
    profileName,
    projectId
}: TipProfileEarningsModalProps) {
    const [earnings, setEarnings] = useState<Earning[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [selectedPuestoId, setSelectedPuestoId] = useState<number>(0);
    const [porcentaje, setPorcentaje] = useState<string>('0');
    const [monto, setMonto] = useState<string>('0');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && profileId) {
            fetchEarnings();
            fetchPositions();
        }
    }, [isOpen, profileId]);

    const fetchEarnings = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/tips-profiles/${profileId}/earnings?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                setEarnings(data.data);
            }
        } catch (error) {
            console.error('Error fetching earnings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPositions = async () => {
        try {
            const response = await fetch(`/api/positions?projectId=${projectId}&hasTips=1`);
            const data = await response.json();
            if (data.success) {
                setPositions(data.data);
            }
        } catch (error) {
            console.error('Error fetching positions:', error);
        }
    };

    const handleMontoBlur = () => {
        if (monto) {
            const val = parseFloat(monto.replace(/,/g, ''));
            if (!isNaN(val)) {
                setMonto(val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
            }
        }
    };

    const handleMontoFocus = () => {
        if (monto) {
            const val = parseFloat(monto.replace(/,/g, ''));
            if (!isNaN(val)) {
                setMonto(val.toString());
            }
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await fetch(`/api/tips-profiles/${profileId}/earnings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    idPuesto: selectedPuestoId,
                    porcentaje: parseFloat(porcentaje),
                    monto: parseFloat(monto.replace(/,/g, ''))
                })
            });

            if (response.ok) {
                fetchEarnings();
                setSelectedPuestoId(0);
                setPorcentaje('0');
                setMonto('0');
            }
        } catch (error) {
            console.error('Error saving earnings:', error);
        }
    };

    const handleDelete = async (idPuesto: number) => {
        if (!confirm('¿Está seguro de eliminar este registro?')) return;
        try {
            const response = await fetch(`/api/tips-profiles/${profileId}/earnings?projectId=${projectId}&idPuesto=${idPuesto}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                fetchEarnings();
            }
        } catch (error) {
            console.error('Error deleting earnings:', error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">
                        Configuración de Ingresos - {profileName}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                </div>

                <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8 bg-gray-50 p-4 rounded-lg">
                    <div className="md:col-span-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Puesto</label>
                        <select
                            value={selectedPuestoId}
                            onChange={(e) => setSelectedPuestoId(parseInt(e.target.value))}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm"
                        >
                            <option value={0}>Default</option>
                            {positions.map((pos) => (
                                <option key={pos.IdPuesto} value={pos.IdPuesto}>
                                    {pos.Puesto}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <Input
                            label="Porcentaje (%)"
                            type="number"
                            step="0.01"
                            value={porcentaje}
                            onChange={(e) => setPorcentaje(e.target.value)}
                            required
                        />
                    </div>
                    <div className="md:col-span-6 flex items-end gap-2">
                        <div className="flex-1">
                            <Input
                                label="Monto ($)"
                                type="text"
                                value={monto}
                                onChange={(e) => {
                                    // Allow numbers and dots only
                                    const val = e.target.value;
                                    if (/^[\d.,]*$/.test(val)) {
                                        setMonto(val);
                                    }
                                }}
                                onBlur={handleMontoBlur}
                                onFocus={handleMontoFocus}
                                required
                            />
                        </div>
                        <Button type="submit" className="mb-[2px]">Agregar</Button>
                    </div>
                </form>

                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Puesto
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Porcentaje
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Monto
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">Cargando...</td>
                                </tr>
                            ) : earnings.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No hay registros</td>
                                </tr>
                            ) : (
                                earnings.map((earning) => (
                                    <tr key={earning.IdPuesto} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {earning.PuestoNombre}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {earning.Porcentaje}%
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            ${parseFloat(earning.Monto.toString()).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleDelete(earning.IdPuesto)}
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
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
