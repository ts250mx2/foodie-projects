'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from './Button';
import Input from './Input';

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
                    amount: data.data.Monto.toString()
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
                    sales: formData.sales,
                    percentage: formData.percentage,
                    amount: formData.amount
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
        const sales = parseFloat(formData.sales) || 0;
        const percentage = parseFloat(formData.percentage) || 0;
        const amount = parseFloat(formData.amount) || 0;
        return (sales * percentage / 100) + amount;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">
                        {t('title')} - {date.toLocaleDateString()}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">✕</button>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Form Section */}
                        <div className="lg:col-span-1">
                            <div className="bg-gradient-to-br from-orange-50 to-pink-50 p-6 rounded-xl border border-orange-200">
                                <h3 className="text-sm font-bold text-orange-600 mb-4 uppercase">{t('addNew')}</h3>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    {/* Shift Selector */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {t('shift')}
                                        </label>
                                        <select
                                            value={formData.shiftId}
                                            onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
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

                                    {/* Employee Search */}
                                    <div className="relative">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {t('employee')}
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.employeeSearch}
                                            onChange={(e) => {
                                                setFormData({ ...formData, employeeSearch: e.target.value });
                                                setShowEmployeeDropdown(true);
                                            }}
                                            onFocus={() => setShowEmployeeDropdown(true)}
                                            placeholder={t('searchEmployee')}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            required
                                        />
                                        {showEmployeeDropdown && filteredEmployees.length > 0 && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                                {filteredEmployees.map((emp) => (
                                                    <div
                                                        key={emp.IdEmpleado}
                                                        onClick={() => handleEmployeeSelect(emp)}
                                                        className="px-3 py-2 hover:bg-orange-50 cursor-pointer"
                                                    >
                                                        <div className="font-medium">{emp.Empleado}</div>
                                                        <div className="text-xs text-gray-500">{emp.Puesto}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Position Display */}
                                    {selectedEmployee && (
                                        <Input
                                            label={t('position')}
                                            value={selectedEmployee.Puesto}
                                            disabled
                                        />
                                    )}

                                    {/* Tip Profile Selector */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {t('tipProfile')}
                                        </label>
                                        <select
                                            value={formData.profileId}
                                            onChange={(e) => setFormData({ ...formData, profileId: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
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

                                    {/* Percentage (disabled) */}
                                    <Input
                                        label={t('percentage')}
                                        value={formData.percentage}
                                        disabled
                                        type="number"
                                    />

                                    {/* Amount (disabled) */}
                                    <Input
                                        label={t('amount')}
                                        value={formData.amount}
                                        disabled
                                        type="number"
                                    />

                                    {/* Sales Input */}
                                    <Input
                                        label={t('sales')}
                                        value={formData.sales}
                                        onChange={(e) => setFormData({ ...formData, sales: e.target.value })}
                                        type="number"
                                        step="0.01"
                                        required
                                    />

                                    {/* Calculated Tip */}
                                    <div className="bg-white p-3 rounded-lg border-2 border-orange-300">
                                        <div className="text-xs text-gray-600 mb-1">{t('calculatedTip')}</div>
                                        <div className="text-2xl font-bold text-orange-600">
                                            ${calculateTip().toFixed(2)}
                                        </div>
                                    </div>

                                    <Button type="submit" className="w-full">
                                        {t('save')}
                                    </Button>
                                </form>
                            </div>
                        </div>

                        {/* Daily Tips Grid */}
                        <div className="lg:col-span-2">
                            <h3 className="text-sm font-bold text-gray-600 mb-4 uppercase">{t('dailyTips')}</h3>
                            {dailyTips.length === 0 ? (
                                <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg">
                                    {t('noTips')}
                                </div>
                            ) : (
                                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">{t('employee')}</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">{t('shift')}</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">{t('profile')}</th>
                                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">{t('sales')}</th>
                                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">{t('tipAmount')}</th>
                                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">{t('actions')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {dailyTips.map((tip) => (
                                                <tr key={tip.IdPropinaEmpleado} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{tip.Empleado}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-600">{tip.Turno}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-600">{tip.PerfilPropina}</td>
                                                    <td className="px-4 py-3 text-sm text-right text-gray-900">${tip.Venta.toFixed(2)}</td>
                                                    <td className="px-4 py-3 text-sm text-right font-bold text-orange-600">${tip.MontoPropina.toFixed(2)}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button
                                                            onClick={() => handleDelete(tip)}
                                                            className="text-lg hover:scale-125 transition-transform"
                                                            title={t('delete')}
                                                        >
                                                            🗑️
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                                            <tr>
                                                <td colSpan={4} className="px-4 py-3 text-right text-sm font-bold text-gray-700">
                                                    {t('total')}:
                                                </td>
                                                <td className="px-4 py-3 text-right text-lg font-bold text-orange-600">
                                                    ${dailyTips.reduce((sum, tip) => sum + tip.MontoPropina, 0).toFixed(2)}
                                                </td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm font-medium"
                    >
                        {t('close')}
                    </button>
                </div>
            </div>
        </div>
    );
}
