'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface Employee {
    IdEmpleado: number;
    Empleado: string;
    Puesto: string;
}

interface ScheduleCaptureModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: Date | null;
    projectId: number;
    branchId: string;
    onSaveSuccess: () => void;
}

export default function ScheduleCaptureModal({
    isOpen,
    onClose,
    selectedDate,
    projectId,
    branchId,
    onSaveSuccess
}: ScheduleCaptureModalProps) {
    const t = useTranslations('SchedulesModal');

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

    const [formData, setFormData] = useState({
        startTime: '',
        endTime: '',
        breakStart: '',
        breakEnd: ''
    });

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && projectId && branchId) {
            fetchEmployees();
        }
    }, [isOpen, projectId, branchId]);

    const fetchEmployees = async () => {
        try {
            const response = await fetch(`/api/employees?projectId=${projectId}&branchId=${branchId}`);
            const data = await response.json();
            if (data.success) {
                setEmployees(data.data);
            }
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDate || !selectedEmployeeId) return;

        setLoading(true);
        try {
            const formattedDate = selectedDate.toISOString().split('T')[0];
            const response = await fetch('/api/payroll/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    employeeId: parseInt(selectedEmployeeId),
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
            console.error('Error saving schedule:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !selectedDate) return null;

    const filteredEmployees = employees.filter(e =>
        e.Empleado.toLowerCase().includes(employeeSearch.toLowerCase()) ||
        e.Puesto?.toLowerCase().includes(employeeSearch.toLowerCase())
    );

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">
                        {t('title')} - {selectedDate.toLocaleDateString()}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl font-bold transition-colors">✕</button>
                </div>

                <form onSubmit={handleSave} className="space-y-6">
                    {/* Employee Search/Select */}
                    <div className="flex flex-col">
                        <label className="text-sm font-semibold text-gray-700 mb-1">{t('employee')}</label>
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                                placeholder={t('searchEmployee')}
                                value={employeeSearch}
                                onChange={(e) => {
                                    setEmployeeSearch(e.target.value);
                                    if (selectedEmployeeId) setSelectedEmployeeId('');
                                }}
                            />
                            {employeeSearch && !selectedEmployeeId && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                    {filteredEmployees.map(e => (
                                        <div
                                            key={e.IdEmpleado}
                                            className="p-3 hover:bg-orange-50 cursor-pointer text-sm border-b last:border-b-0"
                                            onClick={() => {
                                                setSelectedEmployeeId(e.IdEmpleado.toString());
                                                setEmployeeSearch(`${e.Empleado} (${e.Puesto || ''})`);
                                            }}
                                        >
                                            <span className="font-semibold text-gray-900">{e.Empleado}</span>
                                            <span className="text-gray-500 ml-2">({e.Puesto || '-'})</span>
                                        </div>
                                    ))}
                                    {filteredEmployees.length === 0 && (
                                        <div className="p-3 text-sm text-gray-400 italic">
                                            {t('noResults')}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

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

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                        >
                            {t('close')}
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !selectedEmployeeId}
                            className="px-10 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-bold shadow-lg shadow-orange-200 disabled:opacity-50 disabled:shadow-none transition-all"
                        >
                            {loading ? '...' : t('save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
