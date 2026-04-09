'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
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
    TipoPago?: string;
}


export default function PayrollCapturePage() {
    const t = useTranslations('PayrollCapture');
    const tCommon = useTranslations('Common');
    const tModal = useTranslations('PayrollModal');
    const { colors } = useTheme();

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
        amount: '',
        paymentType: 'PAGO NOMINA'
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

            // Load persisted filters
            const savedBranch = localStorage.getItem('dashboardSelectedBranch');
            const savedMonth = localStorage.getItem('lastSelectedMonth');
            const savedYear = localStorage.getItem('lastSelectedYear');

            if (savedBranch) setSelectedBranch(savedBranch);
            if (savedMonth) setSelectedMonth(parseInt(savedMonth));
            if (savedYear) setSelectedYear(parseInt(savedYear));
        }
    }, [project]);

    // Listen for global branch changes
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'dashboardSelectedBranch' && e.newValue) {
                setSelectedBranch(e.newValue);
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    useEffect(() => {
        if (selectedBranch) localStorage.setItem('dashboardSelectedBranch', selectedBranch);
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

                const savedBranch = localStorage.getItem('dashboardSelectedBranch');
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
                month: date.getMonth().toString(),
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
                    amount: formData.paymentType === 'PENALIZACION' 
                        ? -Math.abs(parseFloat(formData.amount.replace(/[^0-9.-]+/g, ''))) 
                        : Math.abs(parseFloat(formData.amount.replace(/[^0-9.-]+/g, ''))),
                    paymentType: formData.paymentType
                })
            });


            if (response.ok) {
                fetchDailyPayroll(selectedDate);
                fetchMonthlyPayroll();
                setFormData({ ...formData, amount: '', employeeId: '', paymentType: 'PAGO NOMINA' });
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
        if (!window.confirm(tCommon('confirmDelete'))) return;
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

    const getDaysInMonth = (month: number, year: number) => {
        const date = new Date(year, month, 1);
        const days = [];
        const firstDayOfWeek = (date.getDay() + 6) % 7; // Monday = 0
        for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
        while (date.getMonth() === month) {
            days.push(new Date(date));
            date.setDate(date.getDate() + 1);
        }
        return days;
    };

    const calendarDays = getDaysInMonth(selectedMonth, selectedYear);
    const weekDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

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
            {/* Standardized Header */}
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
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            {branches.length === 0 && <option>{t('noBranches')}</option>}
                            {branches.map(branch => (
                                <option key={branch.IdSucursal} value={branch.IdSucursal}>
                                    {branch.Sucursal}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Month Selector */}
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1">{t('month')}</label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i} value={i}>{t(`months.${i}`)}</option>
                            ))}
                        </select>
                    </div>

                    {/* Year Selector */}
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1">{t('year')}</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            {years.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 flex flex-col">
                {/* Continuous Header */}
                <div
                    className="grid grid-cols-7"
                    style={{
                        background: `linear-gradient(to right, ${colors.colorFondo1}, ${colors.colorFondo2})`,
                        color: colors.colorLetra
                    }}
                >
                    {weekDays.map(day => (
                        <div
                            key={day}
                            className="text-center font-bold py-4 text-[10px] uppercase tracking-[0.2em]"
                        >
                            {t(`days.${day}`)}
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-gray-50/30">
                    <div className="grid grid-cols-7 gap-3">
                        {calendarDays.map((date, index) => {
                            if (!date) {
                                return <div key={`empty-${index}`} className="aspect-square" />;
                            }

                            const dayNum = date.getDate();
                            const details = monthlyPayrollDetails[dayNum];
                            const hasPayroll = details && details.length > 0;
                            const isToday = new Date().toDateString() === date.toDateString();

                            return (
                                <div
                                    key={index}
                                    onClick={() => handleDayClick(date)}
                                    className={`
                                    aspect-square rounded-xl p-3 cursor-pointer transition-all duration-300
                                    flex flex-col justify-between group relative overflow-hidden
                                    ${isToday
                                            ? 'bg-white border-2 border-indigo-400 shadow-indigo-100'
                                            : 'bg-white border border-slate-200/60 hover:border-blue-400 hover:shadow-blue-100'
                                        }
                                    hover:scale-[1.02] hover:shadow-xl shadow-sm
                                `}
                                >
                                    <div className="flex justify-between items-start z-10">
                                        <span className={`text-xl font-black ${isToday ? 'text-indigo-600' : hasPayroll ? 'text-slate-800' : 'text-slate-400 group-hover:text-blue-600'}`}>
                                            {dayNum}
                                        </span>
                                        {isToday && (
                                            <span className="text-[9px] font-extrabold bg-indigo-500 text-white px-2 py-0.5 rounded-full shadow-sm animate-pulse tracking-tighter">
                                                {t('today') || 'HOY'}
                                            </span>
                                        )}
                                    </div>
                                    {hasPayroll && (
                                        <div className="space-y-0.5 z-10">
                                            <div className="text-sm font-black text-indigo-600 leading-tight">
                                                {formatCurrency(details.reduce((sum, d) => sum + d.total, 0))}
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                {details.length} {details.length === 1 ? 'Pago' : 'Pagos'}
                                            </div>
                                        </div>
                                    )}
                                    {/* Decorative background element for hover */}
                                    <div className={`
                                    absolute -right-4 -bottom-4 w-12 h-12 rounded-full opacity-0 group-hover:opacity-10 transition-opacity duration-300
                                    ${isToday ? 'bg-indigo-600' : 'bg-blue-600'}
                                `} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && selectedDate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl transition-all">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center text-white" style={{ background: `linear-gradient(to right, ${colors.colorFondo1}, ${colors.colorFondo2})`, color: colors.colorLetra }}>
                            <div>
                                <h2 className="text-2xl font-black">{tModal('title')}</h2>
                                <p className="text-sm font-medium opacity-90">{selectedDate.toLocaleDateString()}</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
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
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block tracking-wider">💰 Nómina Total</label>
                                    <div className="text-xl font-black text-indigo-600">
                                        {formatCurrency(totalPayroll)}
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block tracking-wider">👥 Colaboradores Pagados</label>
                                    <div className="text-xl font-black text-gray-800">
                                        {dailyPayroll.length}
                                    </div>
                                </div>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-indigo-50 p-6 rounded-xl border border-indigo-100 items-end shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="flex flex-col relative">
                                    <label className="text-xs font-bold text-indigo-900/60 uppercase tracking-wider mb-2 ml-1">{tModal('employee')}</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className="w-full p-2.5 bg-white border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-gray-700"
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
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                                {filteredEmployees.length === 0 ? (
                                                    <div className="px-4 py-3 text-sm text-gray-400 italic">No se encontraron colaboradores</div>
                                                ) : (
                                                    filteredEmployees.map(e => (
                                                        <div
                                                            key={e.IdEmpleado}
                                                            className="px-4 py-2 hover:bg-indigo-50 cursor-pointer border-b last:border-0 border-gray-50"
                                                            onClick={() => {
                                                                setFormData({ ...formData, employeeId: e.IdEmpleado.toString() });
                                                                setEmployeeSearch(e.Empleado);
                                                                setIsDropdownOpen(false);
                                                            }}
                                                        >
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-sm text-gray-800">{e.Empleado}</span>
                                                                {e.Puesto && (
                                                                    <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">
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
                                    <label className="text-xs font-bold text-indigo-900/60 uppercase tracking-wider mb-2 ml-1">Tipo de Pago</label>
                                    <select
                                        className="w-full p-2.5 bg-white border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-gray-700"
                                        value={formData.paymentType}
                                        onChange={(e) => setFormData({ ...formData, paymentType: e.target.value })}
                                    >
                                        <option value="PAGO NOMINA">PAGO NOMINA</option>
                                        <option value="BONO">BONO</option>
                                        <option value="PRESTAMO">PRESTAMO</option>
                                        <option value="PENALIZACION">PENALIZACION</option>
                                    </select>
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-xs font-bold text-indigo-900/60 uppercase tracking-wider mb-2 ml-1">{tModal('amount')}</label>
                                    <input
                                        type="text"
                                        className={`w-full p-2.5 bg-white border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-black ${formData.paymentType === 'PENALIZACION' ? 'text-rose-600' : 'text-indigo-600'}`}
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
                                        placeholder="0.00"
                                    />
                                </div>

                                <button type="submit" className="bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700 font-bold transition-all shadow-md active:scale-95">
                                    💾 {tModal('save')}
                                </button>
                            </form>

                            {/* Payroll Table */}
                            <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col">
                                <div className="overflow-y-auto max-h-[400px]">
                                    <table className="min-w-full divide-y divide-gray-100">
                                        <thead className="bg-gray-50 sticky top-0 z-10 backdrop-blur-sm">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{tModal('employee')}</th>
                                                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo</th>
                                                <th className="px-6 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">{tModal('amount')}</th>
                                                <th className="px-6 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Acciones</th>
                                            </tr>

                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-50">
                                            {dailyPayroll.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-400 italic">No se encontraron registros para este día</td>
                                                </tr>

                                            ) : (
                                                dailyPayroll.map((pay, idx) => (
                                                    <tr key={idx} className="hover:bg-indigo-50/30 transition-colors group">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">{pay.Empleado}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-[10px] font-black text-slate-400 uppercase tracking-widest">{pay.TipoPago || 'PAGO NOMINA'}</td>
                                                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-black ${pay.Pago < 0 ? 'text-rose-600' : 'text-indigo-600'}`}>
                                                            {formatCurrency(pay.Pago)}
                                                        </td>

                                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDelete(pay.IdUsuario)}
                                                                className="text-gray-300 hover:text-red-500 transition-colors p-2"
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
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button onClick={() => setIsModalOpen(false)} className="px-8 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-bold transition-all">
                                {tModal('close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
