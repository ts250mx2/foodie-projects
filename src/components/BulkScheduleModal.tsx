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
        horasLaboradas?: number;
        bonoDescuento?: number;
        conceptoBonoDescuento?: string;
    } | null;
    isAttendanceMode: boolean;
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
    isAttendanceMode,
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
        breakEnd: '',
        horasLaboradas: 0,
        attended: true,
        amountType: 'Bono',
        amountValue: 0,
        concept: ''
    });

    const [loading, setLoading] = useState(false);

    // Effect to pre-fill or reset form
    useEffect(() => {
        if (isOpen) {
            if (selectedEmployeeIds.length === 1 && initialData) {
                setFormData({
                    ...initialData,
                    horasLaboradas: initialData.horasLaboradas || 0,
                    attended: (initialData.horasLaboradas || 0) > 0,
                    amountType: (initialData.bonoDescuento || 0) < 0 ? 'Descuento' : 'Bono',
                    amountValue: Math.abs(initialData.bonoDescuento || 0),
                    concept: initialData.conceptoBonoDescuento || ''
                });
            } else {
                setFormData({
                    startTime: '',
                    endTime: '',
                    breakStart: '',
                    breakEnd: '',
                    horasLaboradas: 0,
                    attended: true,
                    amountType: 'Bono',
                    amountValue: 0,
                    concept: ''
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
                    breakEnd: prevSchedule.HoraFinDescanso?.substring(0, 5) || '',
                    horasLaboradas: prevSchedule.HorasLaboradas || 0,
                    attended: (prevSchedule.HorasLaboradas || 0) > 0,
                    amountType: (prevSchedule.BonoDescuento || 0) < 0 ? 'Descuento' : 'Bono',
                    amountValue: Math.abs(prevSchedule.BonoDescuento || 0),
                    concept: prevSchedule.ConceptoBonoDescuento || ''
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

    const calculateWorkedHours = (start: string, end: string, bStart: string, bEnd: string) => {
        if (!start || !end) return 0;
        
        try {
            const getMinutes = (timeStr: string) => {
                if (!timeStr) return 0;
                const [h, m] = timeStr.split(':').map(Number);
                return (h * 60) + m;
            };

            let workMinutes = getMinutes(end) - getMinutes(start);
            if (workMinutes < 0) workMinutes += 1440; // Over midnight

            let breakMinutes = 0;
            if (bStart && bEnd) {
                breakMinutes = getMinutes(bEnd) - getMinutes(bStart);
                if (breakMinutes < 0) breakMinutes += 1440;
            }

            return Math.max(0, (workMinutes - breakMinutes) / 60);
        } catch (e) {
            return 0;
        }
    };

    const handleAttendanceToggle = (attended: boolean) => {
        if (attended) {
            const hours = calculateWorkedHours(formData.startTime, formData.endTime, formData.breakStart, formData.breakEnd);
            setFormData({ ...formData, attended: true, horasLaboradas: hours });
        } else {
            setFormData({ ...formData, attended: false, horasLaboradas: 0 });
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
                    breakEndTime: formData.breakEnd,
                    horasLaboradas: formData.horasLaboradas,
                    bonoDescuento: formData.amountType === 'Descuento' ? -Math.abs(formData.amountValue) : Math.abs(formData.amountValue),
                    conceptoBonoDescuento: formData.concept
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

                    {isAttendanceMode && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-4">
                            <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wider">Control de Asistencia</h3>
                            <div className="flex items-center gap-6">
                                <div className="flex bg-white p-1 rounded-lg border border-blue-200 shadow-sm">
                                    <button
                                        type="button"
                                        onClick={() => handleAttendanceToggle(true)}
                                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${formData.attended 
                                            ? 'bg-blue-600 text-white shadow-md' 
                                            : 'text-blue-600 hover:bg-blue-50'}`}
                                    >
                                        Asistió
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleAttendanceToggle(false)}
                                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${!formData.attended 
                                            ? 'bg-red-600 text-white shadow-md' 
                                            : 'text-red-600 hover:bg-red-50'}`}
                                    >
                                        No asistió
                                    </button>
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-xs text-blue-800 font-medium mb-1 uppercase tracking-tighter">Horas Laboradas</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-24 p-2 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold text-blue-900"
                                        value={formData.horasLaboradas}
                                        onChange={(e) => setFormData({ ...formData, horasLaboradas: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-blue-100 flex flex-col gap-4">
                                <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wider">Bonos / Descuentos</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="flex flex-col">
                                        <label className="text-xs text-blue-800 font-medium mb-1 uppercase tracking-tighter">Tipo</label>
                                        <select
                                            className="w-full p-2 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold text-blue-900"
                                            value={formData.amountType}
                                            onChange={(e) => setFormData({ ...formData, amountType: e.target.value as 'Bono' | 'Descuento' })}
                                        >
                                            <option value="Bono">Bono</option>
                                            <option value="Descuento">Descuento</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-xs text-blue-800 font-medium mb-1 uppercase tracking-tighter">Monto</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full p-2 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold text-blue-900"
                                            placeholder="0.00"
                                            value={formData.amountValue || ''}
                                            onChange={(e) => setFormData({ ...formData, amountValue: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="flex flex-col md:col-span-3">
                                        <label className="text-xs text-blue-800 font-medium mb-1 uppercase tracking-tighter">
                                            Concepto {formData.amountValue > 0 && <span className="text-red-500 font-bold">*</span>}
                                        </label>
                                        <input
                                            type="text"
                                            className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white transition-all ${formData.amountValue > 0 && !formData.concept ? 'border-red-400 bg-red-50' : 'border-blue-300'}`}
                                            placeholder="Motivo del bono o descuento..."
                                            value={formData.concept}
                                            onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                                            required={formData.amountValue > 0}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

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
