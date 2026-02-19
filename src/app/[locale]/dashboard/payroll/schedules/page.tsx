'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import BulkScheduleModal from '@/components/BulkScheduleModal';
import Button from '@/components/Button';

interface Branch {
    IdSucursal: number;
    Sucursal: string;
}

interface Employee {
    IdEmpleado: number;
    Empleado: string;
    Puesto: string;
    IdSucursal: number;
    ArchivoFoto: string | null;
}

interface ScheduleEntry {
    IdHorario: number;
    IdEmpleado: number;
    Empleado: string;
    Puesto: string;
    Fecha: string;
    HoraInicio: string;
    HoraFin: string;
    HoraInicioDescanso?: string;
    HoraFinDescanso?: string;
}

export default function SchedulesPage() {
    const t = useTranslations('SchedulesCapture');
    const tModal = useTranslations('SchedulesModal');

    // Basic state
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [project, setProject] = useState<any>(null);

    // Data state
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);

    // Modal state
    const [isCaptureModalOpen, setIsCaptureModalOpen] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [targetEmployeeId, setTargetEmployeeId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [filterText, setFilterText] = useState('');
    const [viewAllEmployees, setViewAllEmployees] = useState(false);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchBranches();
        }
    }, [project]);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchEmployees();
        }
    }, [project, selectedBranch, viewAllEmployees]);

    useEffect(() => {
        if (project?.idProyecto && selectedBranch) {
            fetchSchedules();
        }
    }, [project, selectedBranch, currentDate]);

    const fetchBranches = async () => {
        try {
            const response = await fetch(`/api/branches?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success && data.data.length > 0) {
                setBranches(data.data);
                const savedBranch = localStorage.getItem('lastSelectedBranch');
                if (savedBranch) {
                    setSelectedBranch(savedBranch);
                } else {
                    setSelectedBranch(data.data[0].IdSucursal.toString());
                }
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        }
    };

    const fetchEmployees = async () => {
        if (!project?.idProyecto) return;
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto.toString()
            });

            if (!viewAllEmployees && selectedBranch) {
                params.append('branchId', selectedBranch);
            }

            const response = await fetch(`/api/employees?${params}`);
            const data = await response.json();
            if (data.success) {
                const sorted = data.data.sort((a: Employee, b: Employee) => a.Empleado.localeCompare(b.Empleado));
                setEmployees(sorted);
            }
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    const fetchSchedules = async () => {
        if (!project?.idProyecto || !selectedBranch) return;
        try {
            const currentWeek = getWeekDays();
            const startDate = formatLocalDate(currentWeek[0]);
            const endDate = formatLocalDate(currentWeek[6]);

            const params = new URLSearchParams({
                projectId: project.idProyecto.toString(),
                branchId: selectedBranch,
                startDate,
                endDate
            });
            const response = await fetch(`/api/payroll/schedules?${params}`, { cache: 'no-store' });
            const data = await response.json();
            if (data.success) {
                setSchedules(data.data);
            }
        } catch (error) {
            console.error('Error fetching schedules:', error);
        }
    };

    const handleEmployeeSelect = (id: number) => {
        setSelectedEmployeeIds(prev =>
            prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
        );
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedEmployeeIds(employees.map(e => e.IdEmpleado));
        } else {
            setSelectedEmployeeIds([]);
        }
    };

    const navigateWeek = (direction: number) => {
        const nextDate = new Date(currentDate);
        nextDate.setDate(currentDate.getDate() + (direction * 7));
        setCurrentDate(nextDate);
    };

    const getWeekDays = () => {
        const startOfWeek = new Date(currentDate);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);

        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            return d;
        });
    };

    const formatLocalDate = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const weekDays = getWeekDays();
    const weekDaysLabels = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.Empleado.toLowerCase().includes(filterText.toLowerCase()) ||
            (emp.Puesto && emp.Puesto.toLowerCase().includes(filterText.toLowerCase()));

        const matchesBranch = viewAllEmployees || emp.IdSucursal === parseInt(selectedBranch);

        return matchesSearch && matchesBranch;
    });

    const getScheduleForCell = (employeeId: number, date: Date) => {
        const dateStr = formatLocalDate(date);
        return schedules.find(s => {
            const sDate = new Date(s.Fecha).toISOString().split('T')[0];
            return s.IdEmpleado === employeeId && sDate === dateStr;
        });
    };

    const [bulkTargetIds, setBulkTargetIds] = useState<number[]>([]);
    const [initialModalData, setInitialModalData] = useState<any>(null);

    const handleAssignBulk = (date: Date) => {
        if (selectedEmployeeIds.length === 0) {
            alert(t('noEmployeesSelected'));
            return;
        }
        setBulkTargetIds(selectedEmployeeIds);
        setInitialModalData(null);
        setSelectedDate(date);
        setIsBulkModalOpen(true);
    };

    const handleCellClick = (employeeId: number, date: Date) => {
        const schedule = getScheduleForCell(employeeId, date);
        setBulkTargetIds([employeeId]);

        if (schedule) {
            setInitialModalData({
                startTime: schedule.HoraInicio.substring(0, 5),
                endTime: schedule.HoraFin.substring(0, 5),
                breakStart: schedule.HoraInicioDescanso?.substring(0, 5) || '',
                breakEnd: schedule.HoraFinDescanso?.substring(0, 5) || ''
            });
        } else {
            setInitialModalData(null);
        }

        setSelectedDate(date);
        setIsBulkModalOpen(true);
    };

    const handleDragStart = (e: React.DragEvent, schedule: ScheduleEntry) => {
        e.dataTransfer.setData('sourceSchedule', JSON.stringify(schedule));
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = async (e: React.DragEvent, targetEmployeeId: number, targetDate: Date) => {
        e.preventDefault();
        const data = e.dataTransfer.getData('sourceSchedule');
        if (!data) return;

        const sourceSchedule: ScheduleEntry = JSON.parse(data);
        const sourceDate = new Date(sourceSchedule.Fecha);

        // Don't do anything if dropped on the same cell
        if (sourceSchedule.IdEmpleado === targetEmployeeId && sourceDate.getTime() === targetDate.getTime()) {
            return;
        }

        try {
            const formattedTargetDate = formatLocalDate(targetDate);

            // 1. Save to new location (Copying)
            const saveResponse = await fetch('/api/payroll/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    employeeId: targetEmployeeId,
                    branchId: selectedBranch,
                    date: formattedTargetDate,
                    startTime: sourceSchedule.HoraInicio,
                    endTime: sourceSchedule.HoraFin,
                    breakStartTime: sourceSchedule.HoraInicioDescanso,
                    breakEndTime: sourceSchedule.HoraFinDescanso
                })
            });

            if (saveResponse.ok) {
                // Refresh to show the duplicated schedule
                fetchSchedules();
            }
        } catch (error) {
            console.error('Error copying schedule:', error);
        }
    };

    const handleDeleteSchedule = async (id: number) => {
        if (!confirm(t('confirmDelete'))) return;

        try {
            const response = await fetch(`/api/payroll/schedules?projectId=${project.idProyecto}&id=${id}`, {
                method: 'DELETE',
            });
            const data = await response.json();
            if (data.success) {
                setSchedules(prev => prev.filter(s => s.IdHorario !== id));
            }
        } catch (error) {
            console.error('Error deleting schedule:', error);
        }
    };

    const handleImportPreviousWeek = async () => {
        if (!confirm(t('confirmImportPreviousWeek'))) return;

        setLoading(true);
        try {
            const prevWeekDays = weekDays.map(d => {
                const prev = new Date(d);
                prev.setDate(d.getDate() - 7);
                return prev;
            });

            const startDate = formatLocalDate(prevWeekDays[0]);
            const endDate = formatLocalDate(prevWeekDays[6]);

            const params = new URLSearchParams({
                projectId: project.idProyecto.toString(),
                branchId: selectedBranch,
                startDate,
                endDate
            });

            const response = await fetch(`/api/payroll/schedules?${params}`);
            const data = await response.json();

            if (data.success && data.data.length > 0) {
                const bulkSchedules = data.data.map((oldSchedule: any) => {
                    // Use UTC to avoid timezone shifts when manipulating dates
                    const oldDate = new Date(oldSchedule.Fecha);
                    const newDate = new Date(oldDate);
                    newDate.setUTCDate(oldDate.getUTCDate() + 7);

                    return {
                        employeeId: oldSchedule.IdEmpleado,
                        branchId: selectedBranch,
                        date: newDate.toISOString().split('T')[0],
                        startTime: oldSchedule.HoraInicio,
                        endTime: oldSchedule.HoraFin,
                        breakStartTime: oldSchedule.HoraInicioDescanso,
                        breakEndTime: oldSchedule.HoraFinDescanso
                    };
                });

                const saveResponse = await fetch('/api/payroll/schedules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectId: project.idProyecto,
                        bulk: bulkSchedules
                    })
                });

                if (saveResponse.ok) {
                    fetchSchedules();
                }
            } else {
                alert(t('noPreviousWeekData'));
            }
        } catch (error) {
            console.error('Error importing previous week:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatWeekRange = () => {
        const start = weekDays[0];
        const end = weekDays[6];
        return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    };

    return (
        <div className="flex flex-col min-h-screen p-6 gap-4 bg-gray-50">
            {/* Header / Toolbar */}
            <div className="sticky top-16 z-30 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-md border border-gray-200">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-gray-800">{t('title')}</h1>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200">
                            <button onClick={() => navigateWeek(-1)} className="p-2 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-600">◀</button>
                            <span className="px-4 font-bold text-gray-700 min-w-[200px] text-center">{formatWeekRange()}</span>
                            <button onClick={() => navigateWeek(1)} className="p-2 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-600">▶</button>
                        </div>
                        <button
                            onClick={handleImportPreviousWeek}
                            disabled={loading || selectedBranch === ''}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 transition-all shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                        >
                            {loading ? (
                                <span className="animate-spin text-lg">⏳</span>
                            ) : (
                                <span>📅</span>
                            )}
                            {t('importPreviousWeek')}
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {branches.length > 1 && (
                        <button
                            onClick={() => setViewAllEmployees(!viewAllEmployees)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all shadow-sm font-bold select-none ${viewAllEmployees
                                ? 'bg-orange-600 border-orange-700 text-white shadow-orange-200'
                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            <span className={`w-5 h-5 flex items-center justify-center rounded border ${viewAllEmployees ? 'bg-white text-orange-600 border-white' : 'bg-gray-100 border-gray-300'}`}>
                                {viewAllEmployees && (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 stroke-[4px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </span>
                            {t('viewAllEmployees')}
                        </button>
                    )}

                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1">{t('selectBranch')}</label>
                        <select
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white font-medium shadow-sm"
                        >
                            {branches.map(branch => (
                                <option key={branch.IdSucursal} value={branch.IdSucursal}>
                                    {branch.Sucursal}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Weekly Board */}
            <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse">
                        <thead>
                            <tr className="bg-orange-600 text-white">
                                <th className="sticky left-0 z-30 bg-orange-600 p-4 text-center border-r border-orange-500 w-16">
                                    <div
                                        onClick={() => handleSelectAll(selectedEmployeeIds.length !== employees.length || employees.length === 0)}
                                        className={`w-7 h-7 mx-auto rounded-md border-2 flex items-center justify-center cursor-pointer transition-all shadow-md ${selectedEmployeeIds.length === employees.length && employees.length > 0
                                            ? 'bg-white border-white text-orange-600'
                                            : 'bg-orange-700 border-orange-400'
                                            }`}
                                    >
                                        {(selectedEmployeeIds.length === employees.length && employees.length > 0) && (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 stroke-[4px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                </th>
                                <th className="sticky left-16 z-20 bg-orange-600 p-4 text-left border-r border-orange-400 min-w-[200px]">
                                    <div className="flex flex-col gap-2">
                                        <span>{t('employee')}</span>
                                        <input
                                            type="text"
                                            value={filterText}
                                            onChange={(e) => setFilterText(e.target.value)}
                                            placeholder="..."
                                            className="w-full px-2 py-1 text-xs text-gray-800 bg-white/20 border border-white/30 rounded focus:bg-white outline-none transition-all placeholder:text-white/50"
                                        />
                                    </div>
                                </th>
                                {weekDays.map((date, i) => (
                                    <th key={i} className="p-2 border-r border-orange-400/30 text-center min-w-[150px]">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex flex-col">
                                                <span className="text-xs opacity-80 uppercase tracking-widest">{t(`days.${weekDaysLabels[i]}`)}</span>
                                                <span className="text-lg font-bold">{date.getDate()}</span>
                                            </div>
                                            <button
                                                onClick={() => handleAssignBulk(date)}
                                                className="bg-white/20 hover:bg-white/30 transition-colors py-1 px-2 rounded-md text-[10px] font-bold uppercase"
                                            >
                                                ➕ {t('assignSchedules')}
                                            </button>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredEmployees.map((employee) => {
                                const isSelected = selectedEmployeeIds.includes(employee.IdEmpleado);
                                return (
                                    <tr key={employee.IdEmpleado} className={`${isSelected ? 'bg-orange-50' : 'hover:bg-gray-50/50'} transition-colors group`}>
                                        <td className={`sticky left-0 z-10 ${isSelected ? 'bg-orange-50' : 'bg-white'} group-hover:bg-gray-50 p-4 text-center border-r border-gray-200 shadow-[2px_0_5px_rgba(0,0,0,0.05)] w-16`}>
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEmployeeSelect(employee.IdEmpleado);
                                                }}
                                                className={`w-7 h-7 mx-auto rounded-md border-2 flex items-center justify-center cursor-pointer transition-all ${isSelected
                                                    ? 'bg-orange-600 border-orange-600 text-white shadow-sm'
                                                    : 'bg-white border-gray-300 hover:border-orange-400'
                                                    }`}
                                            >
                                                {isSelected && (
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 stroke-[4px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                        </td>
                                        <td className={`sticky left-16 z-10 ${isSelected ? 'bg-orange-50' : 'bg-white'} group-hover:bg-gray-50 p-4 border-r border-gray-200 shadow-[2px_0_5px_rgba(0,0,0,0.05)]`}>
                                            <div className="flex items-center gap-3">
                                                {employee.ArchivoFoto ? (
                                                    <img src={employee.ArchivoFoto} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-md" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 border italic underline">👤</div>
                                                )}
                                                <div>
                                                    <div className="font-bold text-gray-800 text-sm whitespace-nowrap">{employee.Empleado}</div>
                                                    <div className="text-[10px] text-gray-500 uppercase tracking-tighter">{employee.Puesto || '-'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        {weekDays.map((date, i) => {
                                            const schedule = getScheduleForCell(employee.IdEmpleado, date);
                                            return (
                                                <td
                                                    key={i}
                                                    className="p-2 border-r border-gray-100 text-center relative hover:bg-orange-50 cursor-pointer group/cell transition-all min-h-[80px]"
                                                    onClick={() => handleCellClick(employee.IdEmpleado, date)}
                                                    onDragOver={handleDragOver}
                                                    onDrop={(e) => handleDrop(e, employee.IdEmpleado, date)}
                                                >
                                                    {schedule ? (
                                                        <div
                                                            draggable
                                                            onDragStart={(e) => handleDragStart(e, schedule)}
                                                            className="relative bg-orange-100 p-2 rounded-lg border border-orange-200 text-orange-800 shadow-sm animate-in fade-in slide-in-from-top-1 cursor-grab active:cursor-grabbing hover:border-orange-400 hover:shadow-md transition-all h-full flex flex-col justify-center"
                                                        >
                                                            <div className="font-bold text-xs">{schedule.HoraInicio.substring(0, 5)} - {schedule.HoraFin.substring(0, 5)}</div>
                                                            {schedule.HoraInicioDescanso && schedule.HoraFinDescanso && (
                                                                <div className="mt-1 bg-white/50 rounded flex items-center justify-center gap-1 text-[9px] font-bold border border-orange-200/50 uppercase tracking-tighter pointer-events-none">
                                                                    <span className="opacity-60">☕</span>
                                                                    <span>{schedule.HoraInicioDescanso.substring(0, 5)} - {schedule.HoraFinDescanso.substring(0, 5)}</span>
                                                                </div>
                                                            )}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteSchedule(schedule.IdHorario);
                                                                }}
                                                                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-md flex items-center justify-center text-[10px] shadow-sm hover:bg-red-600 transition-all opacity-0 group-hover/cell:opacity-100 z-10 font-bold"
                                                                title={t('delete')}
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="text-gray-300 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                                            <span className="text-xl">➕</span>
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {project && (
                <>
                    <BulkScheduleModal
                        isOpen={isBulkModalOpen}
                        onClose={() => setIsBulkModalOpen(false)}
                        selectedDate={selectedDate}
                        selectedEmployeeIds={bulkTargetIds}
                        employees={employees}
                        projectId={project.idProyecto}
                        branchId={selectedBranch}
                        initialData={initialModalData}
                        onSaveSuccess={fetchSchedules}
                    />
                </>
            )}
        </div>
    );
}
