'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from './Button';
import Input from './Input';

interface Shift {
    IdTurno: number;
    Turno: string;
    HoraInicio: string | null;
    HoraFin: string | null;
}

interface BranchShiftsModalProps {
    isOpen: boolean;
    onClose: () => void;
    branchId: string;
    branchName: string;
    projectId: number;
}

export default function BranchShiftsModal({ isOpen, onClose, branchId, branchName, projectId }: BranchShiftsModalProps) {
    const t = useTranslations('BranchShiftsModal');
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        shift: '',
        startTime: '',
        endTime: ''
    });

    useEffect(() => {
        if (isOpen && branchId) {
            fetchShifts();
        }
    }, [isOpen, branchId]);

    const fetchShifts = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/shifts?projectId=${projectId}&branchId=${branchId}`);
            const data = await response.json();
            if (data.success) {
                setShifts(data.data);
            }
        } catch (error) {
            console.error('Error fetching shifts:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddShift = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await fetch('/api/shifts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    branchId,
                    shift: formData.shift,
                    startTime: formData.startTime,
                    endTime: formData.endTime
                })
            });
            const data = await response.json();
            if (data.success) {
                fetchShifts();
                setFormData({ shift: '', startTime: '', endTime: '' });
            }
        } catch (error) {
            console.error('Error creating shift:', error);
        }
    };

    const handleDeleteShift = async (id: number) => {
        if (!confirm(t('confirmDelete'))) return;
        try {
            const response = await fetch(`/api/shifts/${id}?projectId=${projectId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                fetchShifts();
            }
        } catch (error) {
            console.error('Error deleting shift:', error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">{t('title')} - {branchName}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">✕</button>
                </div>

                <div className="space-y-6">
                    {/* Form to add new shift */}
                    <form onSubmit={handleAddShift} className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            ➕ {t('addNew')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input
                                label={t('shiftName')}
                                placeholder={t('shiftPlaceholder')}
                                value={formData.shift}
                                onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                                required
                            />
                            <Input
                                label={t('startTime')}
                                type="time"
                                value={formData.startTime}
                                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                            />
                            <Input
                                label={t('endTime')}
                                type="time"
                                value={formData.endTime}
                                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                            />
                        </div>
                        <div className="flex justify-end">
                            <Button type="submit">
                                {t('save')}
                            </Button>
                        </div>
                    </form>

                    {/* Shifts List */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            ⏰ {t('currentShifts')}
                        </h3>
                        {isLoading ? (
                            <div className="text-center py-4 text-gray-500 text-sm">{t('loading')}</div>
                        ) : shifts.length === 0 ? (
                            <div className="text-center py-4 text-gray-500 text-sm italic">{t('noShifts')}</div>
                        ) : (
                            <div className="border border-gray-200 rounded-xl overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-3">{t('shift')}</th>
                                            <th className="px-4 py-3">{t('hours')}</th>
                                            <th className="px-4 py-3 text-right">{t('actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 text-gray-700">
                                        {shifts.map((s) => (
                                            <tr key={s.IdTurno} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 font-medium uppercase">{s.Turno}</td>
                                                <td className="px-4 py-3 text-gray-500">
                                                    {s.HoraInicio?.substring(0, 5) || '--:--'} - {s.HoraFin?.substring(0, 5) || '--:--'}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        onClick={() => handleDeleteShift(s.IdTurno)}
                                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-lg"
                                                        title={t('delete')}
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-100">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm font-medium"
                        >
                            {t('close')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
