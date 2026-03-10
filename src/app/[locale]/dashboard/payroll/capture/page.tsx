'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/Button';

interface Employee {
    IdEmpleado: number;
    Empleado: string;
    IdSucursal: number | null;
    Puesto?: string;
    ImagenTipoPuesto?: string;
}

interface Branch {
    IdSucursal: number;
    Sucursal: string;
}

interface PayrollEntry {
    Dia: number;
    Mes: number;
    Anio: number;
    IdUsuario: number;
    Pago: number;
    Empleado: string;
}

export default function PayrollCapturePage() {
    const t = useTranslations('PayrollCapture');
    const tCommon = useTranslations('Common');
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [project, setProject] = useState<any>(null);

    // Data for modal
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [dailyPayroll, setDailyPayroll] = useState<PayrollEntry[]>([]);
    const [monthlyPayrollDetails, setMonthlyPayrollDetails] = useState<Record<number, Array<{ employeeName: string, total: number }>>>({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        employeeId: '',
        amount: ''
    });

    const [employeeSearch, setEmployeeSearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Generate years
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 7 }, (_, i) => currentYear - 5 + i);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchBranches();
            fetchEmployees();

            // Load persisted filters
            const savedBranch = localStorage.getItem('lastSelectedBranch');
            const savedMonth = localStorage.getItem('lastSelectedMonth');
            const savedYear = localStorage.getItem('lastSelectedYear');

            if (savedBranch) setSelectedBranch(savedBranch);
            if (savedMonth) setSelectedMonth(parseInt(savedMonth));
            if (savedYear) setSelectedYear(parseInt(savedYear));
        }
    }, [project]);

    useEffect(() => {
        if (selectedBranch) localStorage.setItem('lastSelectedBranch', selectedBranch);
    }, [selectedBranch]);

    useEffect(() => {
        localStorage.setItem('lastSelectedMonth', selectedMonth.toString());
    }, [selectedMonth]);

    useEffect(() => {
        localStorage.setItem('lastSelectedYear', selectedYear.toString());
    }, [selectedYear]);

    useEffect(() => {
        if (project?.idProyecto && selectedBranch) {
            fetchEmployees();
            fetchMonthlyPayroll();
        }
    }, [project, selectedBranch, selectedMonth, selectedYear]);

    const fetchBranches = async () => {
        try {
            const response = await fetch(`/api/branches?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success && data.data.length > 0) {
                setBranches(data.data);

                // Only set default if no branch is selected or persisted
                const savedBranch = localStorage.getItem('lastSelectedBranch');
                if (!savedBranch && !selectedBranch) {
                    setSelectedBranch(data.data[0].IdSucursal.toString());
                }
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        }
    };

    const fetchEmployees = async () => {
        if (!selectedBranch) return;
        try {
            const response = await fetch(`/api/employees?projectId=${project.idProyecto}&branchId=${selectedBranch}`);
            const data = await response.json();
            if (data.success) {
                setEmployees(data.data);
            }
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    const fetchMonthlyPayroll = async () => {
        if (!project || !selectedBranch) return;
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                month: selectedMonth.toString(),
                year: selectedYear.toString()
            });
            const response = await fetch(`/api/payroll/monthly?${params}`);
            const data = await response.json();
            if (data.success) {
                // Group payroll by day and employee
                const detailsMap: Record<number, Array<{ employeeName: string, total: number }>> = {};
                data.data.forEach((item: any) => {
                    if (!detailsMap[item.day]) {
                        detailsMap[item.day] = [];
                    }
                    detailsMap[item.day].push({
                        employeeName: item.employeeName,
                        total: item.total
                    });
                });
                setMonthlyPayrollDetails(detailsMap);
            }
        } catch (error) {
            console.error('Error fetching monthly payroll:', error);
        }
    };

    const handleDayClick = async (date: Date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (date > today) {
            alert(tCommon('errorFutureDate'));
            return;
        }

        setSelectedDate(date);
        await fetchDailyPayroll(date);
        setIsModalOpen(true);
    };

    const fetchDailyPayroll = async (date: Date) => {
        if (!project || !selectedBranch) return;
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                day: date.getDate().toString(),
                month: date.getMonth().toString(), // 0-11
                year: date.getFullYear().toString()
            });
            const response = await fetch(`/api/payroll/daily?${params}`);
            const data = await response.json();
            if (data.success) {
                setDailyPayroll(data.data);
            }
        } catch (error) {
            console.error('Error fetching daily payroll:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDate || !project || !selectedBranch || !formData.employeeId || !formData.amount) return;

        try {
            const response = await fetch('/api/payroll/daily', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    branchId: selectedBranch,
                    day: selectedDate.getDate(),
                    month: selectedDate.getMonth(),
                    year: selectedDate.getFullYear(),
                    employeeId: formData.employeeId,
                    amount: parseFloat(formData.amount.replace(/[^0-9.-]+/g, ''))
                })
            });

            if (response.ok) {
                fetchDailyPayroll(selectedDate);
                fetchMonthlyPayroll(); // Refresh monthly totals
                setFormData({ ...formData, amount: '', employeeId: '' });
                setEmployeeSearch('');
            }
        } catch (error) {
            console.error('Error saving payroll:', error);
        }
    };

    const filteredEmployees = useMemo(() => {
        if (!employeeSearch) return employees;
        return employees.filter(e =>
            e.Empleado.toLowerCase().includes(employeeSearch.toLowerCase())
        );
    }, [employees, employeeSearch]);

    const handleDelete = async (employeeId: number) => {
        let confirmMsg = '¿Estás seguro de que deseas borrar este registro?';
        try {
            const translated = tCommon('confirmDelete');
            if (translated && translated !== 'Common.confirmDelete') {
                confirmMsg = translated;
            }
        } catch (e) {
            console.warn('Translation missing');
        }

        if (!window.confirm(confirmMsg)) return;
        if (!project || !selectedDate || !selectedBranch) return;

        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto.toString(),
                branchId: selectedBranch,
                employeeId: employeeId.toString(),
                day: selectedDate.getDate().toString(),
                month: selectedDate.getMonth().toString(),
                year: selectedDate.getFullYear().toString()
            });

            const response = await fetch(`/api/payroll/daily?${params}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await fetchDailyPayroll(selectedDate);
                await fetchMonthlyPayroll();
            }
        } catch (error) {
            console.error('Error deleting payroll:', error);
        }
    };

    // Calendar logic
    const getDaysInMonth = (month: number, year: number) => {
        const date = new Date(year, month, 1);
        const days = [];
        const firstDayOfWeek = (date.getDay() + 6) % 7; // Monday = 0

        for (let i = 0; i < firstDayOfWeek; i++) {
            days.push(null);
        }

        while (date.getMonth() === month) {
            days.push(new Date(date));
            date.setDate(date.getDate() + 1);
        }

        return days;
    };

    const calendarDays = getDaysInMonth(selectedMonth, selectedYear);
    const weekDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

    // Modal translations
    const tModal = useTranslations('PayrollModal');

    const totalPayroll = dailyPayroll.reduce((sum, pay) => sum + (pay.Pago || 0), 0);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(val);
    };

    const handleAmountBlur = () => {
        const numericValue = parseFloat(formData.amount.replace(/[^0-9.-]+/g, '')) || 0;
        setFormData({ ...formData, amount: formatCurrency(numericValue) });
    };

    const handleAmountFocus = () => {
        const value = formData.amount.replace(/[^0-9.-]+/g, '');
        setFormData({ ...formData, amount: value });
    };

    return (
        <div className="flex flex-col min-h-screen p-6 gap-4">
            <div className="sticky top-16 z-30 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-sm">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    👥 {t('title')}
                </h1>

                <div className="flex items-center gap-4">
                    {/* Branch Selector */}
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1">{t('selectBranch')}</label>
                        <select
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {branches.length === 0 && <option>{t('noBranches')}</option>}
                            {branches.map(branch => (
                                <option key={branch.IdSucursal} value={branch.IdSucursal}>
                                    {branch.Sucursal}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1">{t('month')}</label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i} value={i}>{t(`months.${i}`)}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1">{t('year')}</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {years.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Calendar */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col">
                <div className="grid grid-cols-7 bg-blue-500 border-b border-blue-600">
                    {weekDays.map(day => (
                        <div key={day} className="py-3 text-center text-sm font-semibold text-white uppercase tracking-wider">
                            {t(`days.${day}`)}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 flex-1 auto-rows-[1fr]">
                    {calendarDays.map((date, index) => {
                        if (!date) {
                            return <div key={`empty-${index}`} className="bg-gray-50/50 border-b border-r border-gray-300" />;
                        }

                        const isToday = new Date().toDateString() === date.toDateString();
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                        return (
                            <div
                                key={date.toISOString()}
                                onClick={() => handleDayClick(date)}
                                className={`
                                    relative border-b border-r border-gray-300 p-2 transition-all hover:bg-blue-50 cursor-pointer group min-h-[120px] flex flex-col
                                    ${isToday ? 'bg-blue-50/30' : ''}
                                `}
                            >
                                <span className={`
                                    text-sm font-medium
                                    ${isToday ? 'bg-blue-500 text-white px-2 py-1 rounded-full' : isWeekend ? 'text-gray-400' : 'text-gray-700'}
                                `}>
                                    {date.getDate()}
                                </span>
                                {monthlyPayrollDetails[date.getDate()] && (
                                    <>
                                        <div className="mt-6 space-y-1 flex-1">
                                            {monthlyPayrollDetails[date.getDate()].map((emp, idx) => (
                                                <div key={idx} className="text-xs">
                                                    <div className="font-medium text-gray-700">{emp.employeeName}</div>
                                                    <div className="font-semibold text-green-600">{formatCurrency(emp.total)}</div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                            <div className="text-xs font-bold text-blue-700">
                                                Total: {formatCurrency(monthlyPayrollDetails[date.getDate()].reduce((sum, emp) => sum + emp.total, 0))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && selectedDate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h2 className="text-2xl font-black text-gray-800">
                                    {tModal('title')}
                                </h2>
                                <p className="text-sm text-gray-500 font-medium">{selectedDate.toLocaleDateString()}</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-all font-bold text-xl"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8">
                            {/* Form */}
                            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-blue-50/50 p-6 rounded-2xl items-end border border-blue-100/50 shadow-sm">
                                <div className="flex flex-col relative">
                                    <label className="text-xs font-bold text-blue-900/60 uppercase tracking-wider mb-2 ml-1">{tModal('employee')}</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className="w-full p-3 border-0 rounded-xl text-sm bg-white shadow-sm ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-gray-700"
                                            placeholder={tModal('select')}
                                            value={employeeSearch}
                                            onChange={(e) => {
                                                setEmployeeSearch(e.target.value);
                                                setIsDropdownOpen(true);
                                                if (!e.target.value) setFormData({ ...formData, employeeId: '' });
                                            }}
                                            onFocus={() => setIsDropdownOpen(true)}
                                            onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                                            required
                                        />
                                        {isDropdownOpen && (
                                            <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                                {filteredEmployees.length === 0 ? (
                                                    <div className="p-3 text-sm text-gray-500 italic">No se encontraron resultados</div>
                                                ) : (
                                                    filteredEmployees.map(e => (
                                                        <div
                                                            key={e.IdEmpleado}
                                                            className="p-3 text-sm hover:bg-blue-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0"
                                                            onClick={() => {
                                                                setFormData({ ...formData, employeeId: e.IdEmpleado.toString() });
                                                                setEmployeeSearch(e.Empleado);
                                                                setIsDropdownOpen(false);
                                                            }}
                                                        >
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-gray-800">{e.Empleado}</span>
                                                                {e.Puesto && (
                                                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-1">
                                                                        {e.ImagenTipoPuesto || '👤'} {e.Puesto}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-xs font-bold text-blue-900/60 uppercase tracking-wider mb-2 ml-1">{tModal('amount')}</label>
                                    <input
                                        type="text"
                                        className="p-3 border-0 rounded-xl text-sm bg-white shadow-sm ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-gray-700"
                                        value={formData.amount}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (/^[0-9.$,-]*$/.test(val)) {
                                                setFormData({ ...formData, amount: val });
                                            }
                                        }}
                                        onBlur={handleAmountBlur}
                                        onFocus={handleAmountFocus}
                                        required
                                    />
                                </div>
                                <Button type="submit" className="h-[46px]">
                                    {tModal('save')}
                                </Button>
                            </form>

                            {/* Grid */}
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1 flex flex-col">
                                <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
                                    <table className="min-w-full divide-y divide-gray-100">
                                        <thead className="bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{tModal('employee')}</th>
                                                <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">{tModal('amount')}</th>
                                                <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 bg-white">
                                            {dailyPayroll.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} className="px-6 py-20 text-center text-sm text-gray-400 italic">No se encontraron registros</td>
                                                </tr>
                                            ) : (
                                                dailyPayroll.map((pay, idx) => (
                                                    <tr key={idx} className="hover:bg-blue-50/30 transition-colors group">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">{pay.Empleado}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-black">
                                                            {formatCurrency(pay.Pago)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDelete(pay.IdUsuario)}
                                                                className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-all font-bold"
                                                                title="Borrar registro"
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

                                <div className="bg-gray-50/80 p-6 border-t border-gray-100 mt-auto">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{tModal('total')}</span>
                                        <span className="text-2xl font-black text-blue-600">{formatCurrency(totalPayroll)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-gray-100 bg-gray-50/30 flex justify-end">
                            <Button
                                variant="outline"
                                onClick={() => setIsModalOpen(false)}
                                className="px-10"
                            >
                                {tModal('close')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
