'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from './Button';

interface Employee {
    IdEmpleado: number;
    Empleado: string;
    Puesto?: string;
}

interface Branch {
    IdSucursal: number;
    Sucursal: string;
}

interface ScheduleTimelineModalProps {
    isOpen: boolean;
    onClose: () => void;
    employeeId?: number;
    branchId?: string;
    projectId: number;
    onSaveSuccess: () => void;
}

interface DaySchedule {
    date: string;
    slots: boolean[]; // 96 slots (24 hours * 4 quarters)
}

export default function ScheduleTimelineModal({
    isOpen,
    onClose,
    employeeId,
    branchId,
    projectId,
    onSaveSuccess
}: ScheduleTimelineModalProps) {
    const t = useTranslations('SchedulesModal');

    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(employeeId?.toString() || '');
    const [selectedBranchId, setSelectedBranchId] = useState<string>(branchId || '');
    const [branches, setBranches] = useState<Branch[]>([]);

    // Grid state: 7 days, 96 slots each
    const [weekSchedule, setWeekSchedule] = useState<DaySchedule[]>([]);
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
        const d = new Date();
        const day = d.getDay() || 7; // 1-7 (Mon-Sun)
        d.setDate(d.getDate() - day + 1);
        d.setHours(0, 0, 0, 0);
        return d;
    });

    useEffect(() => {
        if (isOpen && projectId) {
            fetchBranches();
            if (selectedBranchId) fetchEmployees(selectedBranchId);
            initializeWeek();
        }
    }, [isOpen, projectId]);

    useEffect(() => {
        if (isOpen && selectedEmployeeId && currentWeekStart) {
            fetchExistingSchedules();
        }
    }, [isOpen, selectedEmployeeId, currentWeekStart]);

    const fetchBranches = async () => {
        try {
            const resp = await fetch(`/api/branches?projectId=${projectId}`);
            const data = await resp.json();
            if (data.success) {
                setBranches(data.data);
                if (!selectedBranchId && data.data.length > 0) {
                    setSelectedBranchId(data.data[0].IdSucursal.toString());
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchEmployees = async (bId: string) => {
        try {
            const resp = await fetch(`/api/employees?projectId=${projectId}&branchId=${bId}`);
            const data = await resp.json();
            if (data.success) setEmployees(data.data);
        } catch (e) {
            console.error(e);
        }
    };

    const initializeWeek = () => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(currentWeekStart);
            d.setDate(d.getDate() + i);
            days.push({
                date: d.toISOString().split('T')[0],
                slots: new Array(96).fill(false)
            });
        }
        setWeekSchedule(days);
    };

    const timeToSlot = (timeStr: string): number => {
        if (!timeStr) return -1;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 4 + Math.floor(m / 15);
    };

    const slotToTime = (slot: number): string => {
        const h = Math.floor(slot / 4);
        const m = (slot % 4) * 15;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const fetchExistingSchedules = async () => {
        try {
            const month = currentWeekStart.getMonth();
            const year = currentWeekStart.getFullYear();

            const params = new URLSearchParams({
                projectId: projectId.toString(),
                branchId: selectedBranchId,
                month: month.toString(),
                year: year.toString(),
                employeeId: selectedEmployeeId
            });
            const resp = await fetch(`/api/payroll/schedules?${params}`);
            const data = await resp.json();

            if (data.success) {
                const existing = data.data;
                const updatedWeek = [...weekSchedule];

                updatedWeek.forEach(day => {
                    const found = existing.find((s: any) => s.Fecha.split('T')[0] === day.date);
                    if (found) {
                        const start = timeToSlot(found.HoraInicio);
                        const end = timeToSlot(found.HoraFin);
                        const bStart = timeToSlot(found.HoraInicioDescanso);
                        const bEnd = timeToSlot(found.HoraFinDescanso);

                        const newSlots = new Array(96).fill(false);
                        for (let s = start; s < end; s++) {
                            if (s !== -1 && (s < bStart || s >= bEnd || bStart === -1)) {
                                newSlots[s] = true;
                            }
                        }
                        day.slots = newSlots;
                    } else {
                        day.slots = new Array(96).fill(false);
                    }
                });
                setWeekSchedule(updatedWeek);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const toggleSlot = (dayIndex: number, slotIndex: number) => {
        const newWeek = [...weekSchedule];
        newWeek[dayIndex].slots[slotIndex] = !newWeek[dayIndex].slots[slotIndex];
        setWeekSchedule(newWeek);
    };

    const handleSave = async () => {
        if (!selectedEmployeeId) return;
        setLoading(true);

        try {
            for (const day of weekSchedule) {
                const selectedSlots = day.slots.map((s, i) => s ? i : -1).filter(s => s !== -1);

                if (selectedSlots.length === 0) continue;

                const startTime = slotToTime(selectedSlots[0]);
                const endTime = slotToTime(selectedSlots[selectedSlots.length - 1] + 1);

                let breakStart = '';
                let breakEnd = '';
                for (let i = 0; i < selectedSlots.length - 1; i++) {
                    if (selectedSlots[i + 1] > selectedSlots[i] + 1) {
                        breakStart = slotToTime(selectedSlots[i] + 1);
                        breakEnd = slotToTime(selectedSlots[i + 1]);
                        break;
                    }
                }

                await fetch('/api/payroll/schedules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectId,
                        employeeId: parseInt(selectedEmployeeId),
                        date: day.date,
                        startTime,
                        endTime,
                        breakStartTime: breakStart || null,
                        breakEndTime: breakEnd || null
                    })
                });
            }
            onSaveSuccess();
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] overflow-hidden p-4">
            <div className="bg-white rounded-2xl w-full max-w-6xl h-[95vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">{t('title')}</h2>
                        <p className="text-sm text-gray-500">Semana del {currentWeekStart.toLocaleDateString()} (15 min intervals)</p>
                    </div>

                    <div className="flex gap-4">
                        <select
                            value={selectedBranchId}
                            onChange={(e) => {
                                setSelectedBranchId(e.target.value);
                                fetchEmployees(e.target.value);
                            }}
                            className="p-2 border rounded-lg text-sm bg-white shadow-sm outline-none focus:ring-2 focus:ring-orange-500"
                        >
                            {branches.map(b => <option key={b.IdSucursal} value={b.IdSucursal}>{b.Sucursal}</option>)}
                        </select>

                        <select
                            value={selectedEmployeeId}
                            onChange={(e) => setSelectedEmployeeId(e.target.value)}
                            className="p-2 border rounded-lg text-sm bg-white shadow-sm outline-none focus:ring-2 focus:ring-orange-500 min-w-[200px]"
                        >
                            <option value="">Seleccionar Empleado...</option>
                            {employees.map(e => (
                                <option key={e.IdEmpleado} value={e.IdEmpleado}>
                                    {e.Empleado} {e.Puesto ? `(${e.Puesto})` : ''}
                                </option>
                            ))}
                        </select>

                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Grid Container */}
                <div className="flex-1 overflow-auto p-4 bg-gray-100 flex flex-col">
                    <div className="bg-white rounded-xl shadow-inner border overflow-hidden flex flex-col min-w-[800px]">
                        {/* Days Header */}
                        <div className="flex border-b sticky top-0 bg-white z-20">
                            <div className="w-24 p-3 border-r bg-gray-50 text-xs font-bold text-gray-400 uppercase text-center">Hora</div>
                            {weekSchedule.map((day, i) => (
                                <div key={day.date} className="flex-1 p-3 border-r last:border-r-0 text-center bg-orange-50/50">
                                    <div className="text-xs font-bold text-orange-600 uppercase">{dayNames[i]}</div>
                                    <div className="text-[10px] text-gray-500">{new Date(day.date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</div>
                                </div>
                            ))}
                        </div>

                        {/* Hours Interaction */}
                        <div className="flex-1">
                            {hours.map(h => (
                                <div key={h} className="flex border-b last:border-b-0 group">
                                    <div className="w-24 border-r bg-gray-50 flex flex-col sticky left-0 z-10">
                                        <div className="flex-1 border-b last:border-b-0 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                                            <span className="text-xs font-bold text-gray-600">{String(h).padStart(2, '0')}:00</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 flex flex-col">
                                        {[0, 1, 2, 3].map(q => {
                                            const slotRelIdx = q;
                                            return (
                                                <div key={q} className="flex border-b last:border-b-0 h-8">
                                                    {weekSchedule.map((day, dIdx) => {
                                                        const slotIdx = h * 4 + slotRelIdx;
                                                        return (
                                                            <div
                                                                key={`${day.date}-${slotIdx}`}
                                                                onClick={() => toggleSlot(dIdx, slotIdx)}
                                                                className={`
                                                                    flex-1 border-r last:border-r-0 cursor-pointer transition-all duration-75 group/slot relative
                                                                    ${day.slots[slotIdx]
                                                                        ? 'bg-orange-500'
                                                                        : 'hover:bg-orange-100/50'
                                                                    }
                                                                `}
                                                            >
                                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/slot:opacity-100 pointer-events-none">
                                                                    <span className="text-[8px] text-gray-400">{String(h).padStart(2, '0')}:{String(q * 15).padStart(2, '0')}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t bg-gray-50 flex justify-between items-center rounded-b-2xl">
                    <div className="flex gap-4">
                        <button
                            onClick={() => {
                                const newStart = new Date(currentWeekStart);
                                newStart.setDate(newStart.getDate() - 7);
                                setCurrentWeekStart(newStart);
                                initializeWeek();
                            }}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors border bg-white shadow-sm"
                        >
                            &larr; {t('prevWeek')}
                        </button>
                        <button
                            onClick={() => {
                                const newStart = new Date(currentWeekStart);
                                newStart.setDate(newStart.getDate() + 7);
                                setCurrentWeekStart(newStart);
                                initializeWeek();
                            }}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors border bg-white shadow-sm"
                        >
                            {t('nextWeek')} &rarr;
                        </button>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 border rounded-xl hover:bg-gray-200 transition-colors font-medium text-gray-700"
                        >
                            {t('close')}
                        </button>
                        <Button
                            onClick={handleSave}
                            isLoading={loading}
                            disabled={!selectedEmployeeId}
                            className="px-10 py-2 rounded-xl"
                        >
                            {t('save')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
