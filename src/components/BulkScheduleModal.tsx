'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from './Button';

interface Employee {
    IdEmpleado: number;
    Empleado: string;
    Puesto: string;
}

interface BulkScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: Date | null;
    selectedEmployeeIds: number[];
    employees: Employee[];
    projectId: number;
    branchId: string;
    initialData?: {
        startTime: string;
        endTime: string;
        breakStart: string;
        breakEnd: string;
    } | null;
    onSaveSuccess: () => void;
}

export default function BulkScheduleModal({
    isOpen,
    onClose,
    selectedDate,
    selectedEmployeeIds,
    employees,
    projectId,
    branchId,
    initialData,
    onSaveSuccess
}: BulkScheduleModalProps) {
    const t = useTranslations('SchedulesModal');

    const selectedNames = employees
        .filter(e => selectedEmployeeIds.includes(e.IdEmpleado))
        .map(e => e.Empleado)
        .join(', ');

    const [formData, setFormData] = useState({
        startTime: '',
        endTime: '',
        breakStart: '',
        breakEnd: ''
    });

    const [loading, setLoading] = useState(false);

    // Effect to pre-fill or reset form
    useEffect(() => {
        if (isOpen) {
            if (selectedEmployeeIds.length === 1 && initialData) {
                setFormData(initialData);
            } else {
                setFormData({
                    startTime: '',
                    endTime: '',
                    breakStart: '',
                    breakEnd: ''
                });
            }
        }
    }, [isOpen, selectedEmployeeIds, initialData]);

    const formatLocalDate = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const handleImportPreviousDay = async () => {
        if (!selectedDate || selectedEmployeeIds.length === 0) return;

        setLoading(true);
        try {
            const prevDate = new Date(selectedDate);
            prevDate.setDate(prevDate.getDate() - 1);
            const formattedDate = formatLocalDate(prevDate);
            const employeeId = selectedEmployeeIds[0];

            const params = new URLSearchParams({
                projectId: projectId.toString(),
                employeeId: employeeId.toString(),
                date: formattedDate
            });

            const response = await fetch(`/api/payroll/schedules?${params}`);
            const data = await response.json();

            if (data.success && data.data && data.data.length > 0) {
                const prevSchedule = data.data[0];
                setFormData({
                    startTime: prevSchedule.HoraInicio.substring(0, 5),
                    endTime: prevSchedule.HoraFin.substring(0, 5),
                    breakStart: prevSchedule.HoraInicioDescanso?.substring(0, 5) || '',
                    breakEnd: prevSchedule.HoraFinDescanso?.substring(0, 5) || ''
                });
            } else {
                alert(t('noPreviousSchedule'));
            }
        } catch (error) {
            console.error('Error importing from previous day:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedDate || selectedEmployeeIds.length !== 1) return;
        if (!confirm(t('confirmDelete'))) return;

        setLoading(true);
        try {
            const formattedDate = formatLocalDate(selectedDate);
            const params = new URLSearchParams({
                projectId: projectId.toString(),
                employeeId: selectedEmployeeIds[0].toString(),
                date: formattedDate
            });

            const response = await fetch(`/api/payroll/schedules?${params}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                onSaveSuccess();
                onClose();
            }
        } catch (error) {
            console.error('Error deleting schedule:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDate || selectedEmployeeIds.length === 0) return;

        setLoading(true);
        try {
            const formattedDate = formatLocalDate(selectedDate);
            const response = await fetch('/api/payroll/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    employeeIds: selectedEmployeeIds,
                    branchId,
                    date: formattedDate,
                    startTime: formData.startTime,
                    endTime: formData.endTime,
                    breakStartTime: formData.breakStart,
                    breakEndTime: formData.breakEnd
                })
            });

            if (response.ok) {
                onSaveSuccess();
                onClose();
            }
        } catch (error) {
            console.error('Error saving bulk schedules:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !selectedDate) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex-1">
                        <h2 className="text-xl font-bold text-gray-800">
                            {t('title')} - {selectedDate.toLocaleDateString()}
                            <div className="text-xs font-normal text-orange-600 mt-2 line-clamp-2 bg-orange-50 p-2 rounded-md border border-orange-100">
                                {selectedNames}
                            </div>
                        </h2>
                        {selectedEmployeeIds.length === 1 && (
                            <button
                                type="button"
                                onClick={handleImportPreviousDay}
                                disabled={loading}
                                className="mt-4 flex items-center gap-2 px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 transition-all shadow-sm hover:shadow active:scale-95"
                            >
                                <span>📥</span>
                                {t('importPrevious')}
                            </button>
                        )}
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl font-bold transition-colors p-2">✕</button>
                </div>

                <form onSubmit={handleSave} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Work Hours */}
                        <div className="space-y-4 p-4 bg-orange-50/50 rounded-xl border border-orange-100">
                            <h3 className="text-xs font-bold text-orange-700 uppercase tracking-wider">Labores</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">{t('startTime')}</label>
                                    <input
                                        type="time"
                                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 outline-none"
                                        value={formData.startTime}
                                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">{t('endTime')}</label>
                                    <input
                                        type="time"
                                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 outline-none"
                                        value={formData.endTime}
                                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Break Hours */}
                        <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Descanso</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">{t('breakStart')}</label>
                                    <input
                                        type="time"
                                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 outline-none"
                                        value={formData.breakStart}
                                        onChange={(e) => setFormData({ ...formData, breakStart: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">{t('breakEnd')}</label>
                                    <input
                                        type="time"
                                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 outline-none"
                                        value={formData.breakEnd}
                                        onChange={(e) => setFormData({ ...formData, breakEnd: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center gap-3 pt-4 border-t border-gray-100">
                        <div>
                            {selectedEmployeeIds.length === 1 && initialData && (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={loading}
                                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors flex items-center gap-2 border border-red-100"
                                >
                                    <span>🗑️</span>
                                    {t('delete')}
                                </button>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                            >
                                {t('close')}
                            </button>
                            <Button
                                type="submit"
                                disabled={loading || selectedEmployeeIds.length === 0}
                            >
                                {loading ? '...' : t('save')}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
