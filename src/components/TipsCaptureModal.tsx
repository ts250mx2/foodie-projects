'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';

interface TipsCaptureModalProps {
    isOpen: boolean;
    onClose: () => void;
    date: Date;
    branchId: string;
    projectId: number;
}

interface Employee {
    IdEmpleado: number;
    Empleado: string;
    IdPuesto: number;
    Puesto: string;
}

interface TipProfile {
    IdPerfilPropina: number;
    PerfilPropina: string;
}

interface DailyTip {
    IdPropinaEmpleado: number;
    IdEmpleado: number;
    Empleado: string;
    IdTurno: number;
    Turno: string;
    IdPerfilPropina: number;
    PerfilPropina: string;
    Venta: number;
    Porcentaje: number;
    Monto: number;
    MontoPropina: number;
}

export default function TipsCaptureModal({ isOpen, onClose, date, branchId, projectId }: TipsCaptureModalProps) {
    const t = useTranslations('TipsCaptureModal');
    const { colors } = useTheme();

    const [shifts, setShifts] = useState<any[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
    const [tipProfiles, setTipProfiles] = useState<TipProfile[]>([]);
    const [dailyTips, setDailyTips] = useState<DailyTip[]>([]);

    const [formData, setFormData] = useState({
        shiftId: '',
        employeeId: '',
        employeeSearch: '',
        profileId: '',
        sales: '',
        percentage: '0',
        amount: '0'
    });

    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    useEffect(() => {
        if (isOpen) {
            fetchShifts();
            fetchEmployees();
            fetchTipProfiles();
            fetchDailyTips();
        }
    }, [isOpen]);

    useEffect(() => {
        // Filter employees based on search
        if (formData.employeeSearch) {
            const filtered = employees.filter(emp =>
                emp.Empleado.toLowerCase().includes(formData.employeeSearch.toLowerCase())
            );
            setFilteredEmployees(filtered);
        } else {
            setFilteredEmployees(employees);
        }
    }, [formData.employeeSearch, employees]);

    useEffect(() => {
        // Auto-select profile if only one exists
        if (tipProfiles.length === 1 && !formData.profileId) {
            setFormData(prev => ({ ...prev, profileId: tipProfiles[0].IdPerfilPropina.toString() }));
        }
    }, [tipProfiles]);

    useEffect(() => {
        // Fetch earnings configuration when employee and profile are selected
        if (selectedEmployee && formData.profileId) {
            fetchEarningsConfig();
        }
    }, [selectedEmployee, formData.profileId]);

    const fetchShifts = async () => {
        try {
            const response = await fetch(`/api/shifts?projectId=${projectId}&branchId=${branchId}`);
            const data = await response.json();
            if (data.success) {
                setShifts(data.data);
            }
        } catch (error) {
            console.error('Error fetching shifts:', error);
        }
    };

    const fetchEmployees = async () => {
        try {
            const response = await fetch(`/api/employees?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                // Filter only active employees with Status = 0
                const activeEmployees = data.data.filter((emp: any) => emp.Status === 0);
                setEmployees(activeEmployees);
                setFilteredEmployees(activeEmployees);
            }
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    const fetchTipProfiles = async () => {
        try {
            const response = await fetch(`/api/tips-profiles?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                // Filter only active profiles with Status = 0 and EsActivo = 1
                const activeProfiles = data.data.filter((profile: any) =>
                    profile.Status === 0 && profile.EsActivo === 1
                );
                setTipProfiles(activeProfiles);
            }
        } catch (error) {
            console.error('Error fetching tip profiles:', error);
        }
    };

    const fetchEarningsConfig = async () => {
        if (!selectedEmployee || !formData.profileId) return;

        try {
            const response = await fetch(
                `/api/tips/profile-earnings?projectId=${projectId}&profileId=${formData.profileId}&positionId=${selectedEmployee.IdPuesto}`
            );
            const data = await response.json();
            if (data.success) {
                setFormData(prev => ({
                    ...prev,
                    percentage: data.data.Porcentaje.toString(),
                    amount: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(data.data.Monto)
                }));
            }
        } catch (error) {
            console.error('Error fetching earnings config:', error);
        }
    };

    const fetchDailyTips = async () => {
        try {
            const response = await fetch(
                `/api/tips/daily?projectId=${projectId}&branchId=${branchId}&day=${day}&month=${month}&year=${year}`
            );
            const data = await response.json();
            if (data.success) {
                setDailyTips(data.data);
            }
        } catch (error) {
            console.error('Error fetching daily tips:', error);
        }
    };

    const handleEmployeeSelect = (employee: Employee) => {
        setSelectedEmployee(employee);
        setFormData(prev => ({
            ...prev,
            employeeId: employee.IdEmpleado.toString(),
            employeeSearch: employee.Empleado
        }));
        setShowEmployeeDropdown(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.shiftId || !formData.employeeId || !formData.profileId || !formData.sales) {
            alert(t('fillAllFields'));
            return;
        }

        try {
            const response = await fetch('/api/tips/daily', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    employeeId: formData.employeeId,
                    branchId,
                    shiftId: formData.shiftId,
                    day,
                    month,
                    year,
                    profileId: formData.profileId,
                    sales: parseFloat(formData.sales.replace(/[^0-9.]/g, '')),
                    percentage: formData.percentage,
                    amount: parseFloat(formData.amount.replace(/[^0-9.]/g, ''))
                })
            });

            if (response.ok) {
                // Reset form
                setFormData({
                    shiftId: '',
                    employeeId: '',
                    employeeSearch: '',
                    profileId: tipProfiles.length === 1 ? tipProfiles[0].IdPerfilPropina.toString() : '',
                    sales: '',
                    percentage: '0',
                    amount: '0'
                });
                setSelectedEmployee(null);
                fetchDailyTips();
            }
        } catch (error) {
            console.error('Error saving tip:', error);
        }
    };

    const handleDelete = async (tip: DailyTip) => {
        if (!confirm(t('confirmDelete'))) return;

        try {
            const response = await fetch(
                `/api/tips/daily?projectId=${projectId}&employeeId=${tip.IdEmpleado}&branchId=${branchId}&shiftId=${tip.IdTurno}&day=${day}&month=${month}&year=${year}`,
                { method: 'DELETE' }
            );

            if (response.ok) {
                fetchDailyTips();
            }
        } catch (error) {
            console.error('Error deleting tip:', error);
        }
    };

    const calculateTip = () => {
        const sales = parseFloat(formData.sales.replace(/[^0-9.]/g, '')) || 0;
        const percentage = parseFloat(formData.percentage) || 0;
        const amount = parseFloat(formData.amount.replace(/[^0-9.]/g, '')) || 0;
        return (sales * percentage / 100) + amount;
    };

    if (!isOpen) return null;

    const totalTips = dailyTips.reduce((sum, tip) => sum + tip.MontoPropina, 0);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center text-white" style={{ background: `linear-gradient(to right, ${colors.colorFondo1}, ${colors.colorFondo2})`, color: colors.colorLetra }}>
                    <div>
                        <h2 className="text-2xl font-black">{t('title')}</h2>
                        <p className="text-sm font-medium opacity-90">{date.toLocaleDateString()}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-all font-bold text-xl"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block tracking-wider">💰 Propina Capturada</label>
                            <div className="text-xl font-black text-primary-600">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalTips)}
                            </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block tracking-wider">👥 Colaboradores</label>
                            <div className="text-xl font-black text-gray-800">
                                {dailyTips.length}
                            </div>
                        </div>
                    </div>

                    {/* Form Section */}
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-primary-50 p-6 rounded-xl border border-primary-100 items-end shadow-sm">
                        <div className="flex flex-col">
                            <label className="text-xs font-bold text-primary-900/60 uppercase tracking-wider mb-2 ml-1">{t('shift')}</label>
                            <select
                                className="w-full p-2.5 bg-white border border-primary-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                value={formData.shiftId}
                                onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
                                required
                            >
                                <option value="">{t('selectShift')}</option>
                                {shifts.map((shift) => (
                                    <option key={shift.IdTurno} value={shift.IdTurno}>
                                        {shift.Turno}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col relative">
                            <label className="text-xs font-bold text-primary-900/60 uppercase tracking-wider mb-2 ml-1">{t('employee')}</label>
                            <input
                                type="text"
                                className="w-full p-2.5 bg-white border border-primary-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                value={formData.employeeSearch}
                                onChange={(e) => {
                                    setFormData({ ...formData, employeeSearch: e.target.value });
                                    setShowEmployeeDropdown(true);
                                }}
                                onFocus={() => setShowEmployeeDropdown(true)}
                                onBlur={() => setTimeout(() => setShowEmployeeDropdown(false), 200)}
                                placeholder={t('searchEmployee')}
                                required
                            />
                            {showEmployeeDropdown && filteredEmployees.length > 0 && (
                                <div className="absolute z-20 w-full top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                    {filteredEmployees.map((emp) => (
                                        <div
                                            key={emp.IdEmpleado}
                                            onClick={() => handleEmployeeSelect(emp)}
                                            className="px-4 py-2 hover:bg-primary-50 cursor-pointer border-b last:border-0 border-gray-50"
                                        >
                                            <div className="font-bold text-sm text-gray-800">{emp.Empleado}</div>
                                            <div className="text-[10px] uppercase font-bold text-gray-400">{emp.Puesto}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col">
                            <label className="text-xs font-bold text-primary-900/60 uppercase tracking-wider mb-2 ml-1">{t('tipProfile')}</label>
                            <select
                                className="w-full p-2.5 bg-white border border-primary-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                value={formData.profileId}
                                onChange={(e) => setFormData({ ...formData, profileId: e.target.value })}
                                required
                            >
                                <option value="">{t('selectProfile')}</option>
                                {tipProfiles.map((profile) => (
                                    <option key={profile.IdPerfilPropina} value={profile.IdPerfilPropina}>
                                        {profile.PerfilPropina}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col">
                            <label className="text-xs font-bold text-primary-900/60 uppercase tracking-wider mb-2 ml-1">{t('sales')}</label>
                            <input
                                type="text"
                                className="w-full p-2.5 bg-white border border-primary-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                value={formData.sales}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9.]/g, '');
                                    if ((val.match(/\./g) || []).length > 1) return;
                                    setFormData({ ...formData, sales: val });
                                }}
                                onBlur={(e) => {
                                    const val = parseFloat(e.target.value.replace(/[^0-9.]/g, '') || '0');
                                    setFormData({ ...formData, sales: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val) });
                                }}
                                onFocus={(e) => {
                                    const val = e.target.value.replace(/[^0-9.]/g, '');
                                    setFormData({ ...formData, sales: val === '0.00' || val === '0' ? '' : val });
                                }}
                                required
                                placeholder="0.00"
                            />
                        </div>

                        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-4 items-end">
                            <div className="bg-white/50 p-2 rounded-lg border border-primary-100">
                                <span className="text-[10px] font-bold text-primary-900/40 uppercase block mb-1">Porcentaje</span>
                                <span className="text-sm font-bold text-gray-700">{formData.percentage}%</span>
                            </div>
                            <div className="bg-white/50 p-2 rounded-lg border border-primary-100">
                                <span className="text-[10px] font-bold text-primary-900/40 uppercase block mb-1">Fijo</span>
                                <span className="text-sm font-bold text-gray-700">{formData.amount}</span>
                            </div>
                            <div className="bg-white p-2 rounded-lg border-2 border-primary-300 col-span-2 md:col-span-1">
                                <span className="text-[10px] font-bold text-primary-600 uppercase block mb-1">Cálculo Estimado</span>
                                <span className="text-lg font-black text-primary-600 block leading-none">
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(calculateTip())}
                                </span>
                            </div>
                        </div>

                        <button type="submit" className="bg-primary-500 text-white p-2.5 rounded-lg hover:bg-primary-600 font-bold transition-all shadow-md active:scale-95">
                            {t('add') || 'Agregar'}
                        </button>
                    </form>

                    {/* Table */}
                    <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col">
                        <div className="overflow-y-auto max-h-[400px]">
                            <table className="min-w-full divide-y divide-gray-100">
                                <thead className="bg-gray-50 sticky top-0 z-10 backdrop-blur-sm">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('employee')}</th>
                                        <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('shift')}</th>
                                        <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('profile')}</th>
                                        <th className="px-6 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('sales')}</th>
                                        <th className="px-6 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('tipAmount')}</th>
                                        <th className="px-6 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-50">
                                    {dailyTips.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400 italic">{t('noTips')}</td>
                                        </tr>
                                    ) : (
                                        dailyTips.map((tip) => (
                                            <tr key={tip.IdPropinaEmpleado} className="hover:bg-primary-50/30 transition-colors group">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">{tip.Empleado}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tip.Turno}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tip.PerfilPropina}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(tip.Venta)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-primary-600 text-right font-black">
                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(tip.MontoPropina)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <button
                                                        onClick={() => handleDelete(tip)}
                                                        className="text-gray-300 hover:text-red-500 transition-colors p-1"
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

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <button onClick={onClose} className="px-8 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-bold transition-all">
                        {t('close')}
                    </button>
                </div>
            </div>
        </div>
    );
}
