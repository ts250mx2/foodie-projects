'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import PageShell from '@/components/PageShell';
import { Banknote, X, Save, Plus, DollarSign, Users, Trash2, Gift, CreditCard, AlertTriangle, User, Pencil, Check } from 'lucide-react';
import ThemedGridHeader, { ThemedGridHeaderCell, TableBody, TableRow, TableCell } from '@/components/ThemedGridHeader';

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

    // Edit state
    const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
    const [editFormData, setEditFormData] = useState({
        amount: '',
        paymentType: 'PAGO NOMINA'
    });


    const [employeeSearch, setEmployeeSearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);

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

    const handleNewPayment = () => {
        setIsFormOpen(true);
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

    const handleStartEdit = (pay: PayrollEntry) => {
        setEditingEmployeeId(pay.IdUsuario);
        const absoluteAmount = Math.abs(pay.Pago);
        setEditFormData({
            amount: formatCurrency(absoluteAmount),
            paymentType: pay.TipoPago || 'PAGO NOMINA'
        });
    };

    const handleCancelEdit = () => {
        setEditingEmployeeId(null);
        setEditFormData({
            amount: '',
            paymentType: 'PAGO NOMINA'
        });
    };

    const handleEditAmountBlur = () => {
        const numericValue = parseFloat(editFormData.amount.replace(/[^0-9.-]+/g, '')) || 0;
        setEditFormData({ ...editFormData, amount: formatCurrency(numericValue) });
    };

    const handleEditAmountFocus = () => {
        const value = editFormData.amount.replace(/[^0-9.-]+/g, '');
        setEditFormData({ ...editFormData, amount: value });
    };

    const handleSaveEdit = async (employeeId: number) => {
        if (!selectedDate || !project || !selectedBranch || !editFormData.amount) return;

        try {
            const rawAmount = parseFloat(editFormData.amount.replace(/[^0-9.-]+/g, ''));
            const finalAmount = editFormData.paymentType === 'PENALIZACION'
                ? -Math.abs(rawAmount)
                : Math.abs(rawAmount);

            const response = await fetch('/api/payroll/daily', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    branchId: selectedBranch,
                    day: selectedDate.getDate(),
                    month: selectedDate.getMonth(),
                    year: selectedDate.getFullYear(),
                    employeeId,
                    amount: finalAmount,
                    paymentType: editFormData.paymentType
                })
            });

            if (response.ok) {
                setEditingEmployeeId(null);
                await fetchDailyPayroll(selectedDate);
                await fetchMonthlyPayroll();
            }
        } catch (error) {
            console.error('Error updating payroll:', error);
        }
    };

    return (
        <PageShell
            title={t('title') || 'Captura de Nómina'}
            icon={Banknote}
            actions={
                <div className="flex items-center gap-3 flex-wrap">
                    <select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-700 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {branches.length === 0 && <option>{t('noBranches')}</option>}
                        {branches.map(branch => (
                            <option key={branch.IdSucursal} value={branch.IdSucursal}>
                                {branch.Sucursal}
                            </option>
                        ))}
                    </select>

                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-700 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i} value={i}>{t(`months.${i}`)}</option>
                        ))}
                    </select>

                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-700 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {years.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>
            }
        >

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col h-[calc(100vh-200px)] overflow-y-auto">
                {/* Sticky Header */}
                <div
                    className="sticky top-0 z-10 grid grid-cols-7 gap-0 px-4 py-4 shadow-sm flex-shrink-0"
                    style={{
                        backgroundColor: 'var(--color-brand-orange)',
                        color: colors.colorLetra
                    }}
                >
                    {weekDays.map(day => (
                        <div
                            key={day}
                            className="text-center font-bold text-sm uppercase tracking-wider"
                        >
                            {t(`days.${day}`)}
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-white">
                    <div className="grid grid-cols-7 gap-3">
                        {calendarDays.map((date, index) => {
                            if (!date) {
                                return <div key={`empty-${index}`} className="aspect-square" />;
                            }

                            const dayNum = date.getDate();
                            const details = monthlyPayrollDetails[dayNum];
                            const hasPayroll = details && details.length > 0;

                            return (
                                <div
                                    key={index}
                                    onClick={() => handleDayClick(date)}
                                    className={`
                                    aspect-square rounded-xl p-3 cursor-pointer transition-all duration-300
                                    flex flex-col justify-between group relative overflow-hidden
                                    ${hasPayroll
                                            ? 'bg-white border-2 border-green-100 shadow-sm hover:border-green-400 hover:shadow-green-100'
                                            : 'bg-white border border-slate-200/60 hover:border-blue-400 hover:shadow-blue-100'
                                        }
                                    hover:scale-[1.02] hover:shadow-xl
                                `}
                                >
                                    <div className="flex justify-between items-start z-10">
                                        <span className={`text-xl font-black ${hasPayroll ? 'text-green-700' : 'text-slate-400 group-hover:text-blue-600'}`}>
                                            {dayNum}
                                        </span>
                                    </div>
                                    {hasPayroll && (
                                        <div className="space-y-0.5 z-10">
                                            <div className="text-sm font-black text-green-600 leading-tight">
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
                                    ${hasPayroll ? 'bg-green-600' : 'bg-blue-600'}
                                `} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && selectedDate && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
                    <div className="relative w-full bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-w-5xl" style={{ maxHeight: '90vh' }}>
                        {/* Header */}
                        <div
                            className="sticky top-0 z-20 flex items-start justify-between px-5 py-4 gap-4 border-b border-black/5 shrink-0"
                            style={{ backgroundColor: 'var(--color-brand-orange)' }}
                        >
                            <div className="flex flex-col gap-0.5 min-w-0">
                                <h2 className="text-[15px] font-semibold leading-tight flex items-center gap-2" style={{ color: colors.colorLetra }}>
                                    <Banknote size={16} /> {tModal('title')}
                                </h2>
                                <p className="text-[12px] leading-tight" style={{ color: colors.colorLetra, opacity: 0.8 }}>
                                    {selectedDate.toLocaleDateString()}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                aria-label="Cerrar"
                                className="shrink-0 mt-0.5 p-1.5 rounded-lg active:scale-95 transition-all duration-100 hover:bg-white/10"
                                style={{ color: colors.colorLetra }}
                            >
                                <X size={16} strokeWidth={2} />
                            </button>
                        </div>

                        {/* Summary Cards */}
                        <div className="shrink-0 px-5 py-3 bg-gray-50/50 border-b border-gray-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <DollarSign size={14} className="text-gray-400" />
                                        <div>
                                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Nómina Total</p>
                                            <p className="text-sm font-bold text-gray-900">{formatCurrency(totalPayroll)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Users size={14} className="text-gray-400" />
                                        <div>
                                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Colaboradores</p>
                                            <p className="text-sm font-bold text-gray-900">{dailyPayroll.length}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* New Payment Button */}
                        {!isFormOpen && (
                            <div className="shrink-0 px-5 py-3 bg-gray-50/50 border-b border-gray-100">
                                <Button
                                    onClick={handleNewPayment}
                                    variant="secondary"
                                    size="sm"
                                    leftIcon={Plus}
                                    iconBox
                                >
                                    {tModal('new')}
                                </Button>
                            </div>
                        )}

                        {/* Content: Form + Table */}
                        <div className="flex-1 overflow-y-auto">
                            {/* Form */}
                            {isFormOpen && (
                                <form onSubmit={handleSubmit} className="shrink-0 px-5 py-4 bg-gray-50/50 border-b border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                    <div className="flex flex-col">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{tModal('employee')}</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                className="w-full p-2 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-semibold text-gray-700 transition-all"
                                                placeholder="Seleccionar..."
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
                                                <div className="absolute z-[510] w-full mt-1 bg-white border-2 border-blue-300 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                                                    {filteredEmployees.length === 0 ? (
                                                        <div className="px-3 py-2 text-sm text-gray-400 italic">No hay colaboradores</div>
                                                    ) : (
                                                        filteredEmployees.map(e => (
                                                            <div
                                                                key={e.IdEmpleado}
                                                                className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-0 border-gray-50"
                                                                onClick={() => {
                                                                    setFormData({ ...formData, employeeId: e.IdEmpleado.toString() });
                                                                    setEmployeeSearch(e.Empleado);
                                                                    setIsDropdownOpen(false);
                                                                }}
                                                            >
                                                                <div className="font-semibold text-sm text-gray-800">{e.Empleado}</div>
                                                                {e.Puesto && (
                                                                    <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold flex items-center gap-1">
                                                                        {e.ImagenTipoPuesto || <User size={12} />} {e.Puesto}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Tipo</label>
                                        <select
                                            className="w-full p-2 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-semibold text-gray-700 transition-all"
                                            value={formData.paymentType}
                                            onChange={(e) => setFormData({ ...formData, paymentType: e.target.value })}
                                        >
                                            <option value="PAGO NOMINA">Pago</option>
                                            <option value="BONO">Bono</option>
                                            <option value="PRESTAMO">Préstamo</option>
                                            <option value="PENALIZACION">Penalización</option>
                                        </select>
                                    </div>

                                    <div className="flex flex-col">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{tModal('amount')}</label>
                                        <input
                                            type="text"
                                            className={`w-full p-2 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-black transition-all ${formData.paymentType === 'PENALIZACION' ? 'text-rose-600' : 'text-gray-900'}`}
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

                                    <Button
                                        type="submit"
                                        variant="solid"
                                        size="sm"
                                        leftIcon={Save}
                                        iconBox
                                    >
                                        {tModal('save')}
                                    </Button>
                                </form>
                            )}

                            {/* Payroll Table */}
                            <div className="flex-1 overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm m-5">
                                <table className="w-full border-collapse">
                                    <ThemedGridHeader className="sticky top-0 z-10 shadow-sm">
                                        <ThemedGridHeaderCell>
                                            {tModal('employee')}
                                        </ThemedGridHeaderCell>
                                        <ThemedGridHeaderCell>
                                            Tipo
                                        </ThemedGridHeaderCell>
                                        <ThemedGridHeaderCell align="right">
                                            {tModal('amount')}
                                        </ThemedGridHeaderCell>
                                        <ThemedGridHeaderCell align="center">
                                            Acción
                                        </ThemedGridHeaderCell>
                                    </ThemedGridHeader>
                                    <TableBody
                                        loading={false}
                                        empty={dailyPayroll.length === 0}
                                        emptyMessage="Sin registros para este día"
                                        colSpan={4}
                                    >
                                        {dailyPayroll.map((pay, idx) => {
                                            const isEditing = editingEmployeeId === pay.IdUsuario;
                                            return (
                                                <TableRow key={idx}>
                                                    <TableCell>
                                                        <span className="font-medium text-gray-900">{pay.Empleado}</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        {isEditing ? (
                                                            <select
                                                                className="w-full p-1 bg-white border border-blue-200 rounded-lg text-sm outline-none font-semibold text-gray-700 transition-all"
                                                                value={editFormData.paymentType}
                                                                onChange={(e) => setEditFormData({ ...editFormData, paymentType: e.target.value })}
                                                            >
                                                                <option value="PAGO NOMINA">Pago</option>
                                                                <option value="BONO">Bono</option>
                                                                <option value="PRESTAMO">Préstamo</option>
                                                                <option value="PENALIZACION">Penalización</option>
                                                            </select>
                                                        ) : (
                                                            <span className="text-sm text-gray-600">{pay.TipoPago || 'Pago'}</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {isEditing ? (
                                                            <input
                                                                type="text"
                                                                className={`w-28 p-1 bg-white border border-blue-200 rounded-lg text-sm text-right outline-none font-black transition-all ${editFormData.paymentType === 'PENALIZACION' ? 'text-rose-600' : 'text-gray-900'}`}
                                                                value={editFormData.amount}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    if (/^[0-9.$,-]*$/.test(val)) {
                                                                        setEditFormData({ ...editFormData, amount: val });
                                                                    }
                                                                }}
                                                                onBlur={handleEditAmountBlur}
                                                                onFocus={handleEditAmountFocus}
                                                                required
                                                            />
                                                        ) : (
                                                            <span className={`font-bold ${pay.Pago < 0 ? 'text-rose-600' : 'text-gray-900'}`}>
                                                                {formatCurrency(pay.Pago)}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        {isEditing ? (
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSaveEdit(pay.IdUsuario)}
                                                                    className="p-1.5 hover:bg-green-50 text-green-600 rounded-lg transition-colors"
                                                                    title={tModal('save') || 'Guardar'}
                                                                >
                                                                    <Check size={16} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={handleCancelEdit}
                                                                    className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg transition-colors"
                                                                    title={tModal('cancel') || 'Cancelar'}
                                                                >
                                                                    <X size={16} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStartEdit(pay)}
                                                                    className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                                                                    title={tModal('edit') || 'Editar'}
                                                                >
                                                                    <Pencil size={16} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDelete(pay.IdUsuario)}
                                                                    className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                                                    title="Eliminar"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </table>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 px-5 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-2">
                            <Button
                                onClick={() => setIsModalOpen(false)}
                                variant="secondary"
                                size="sm"
                                leftIcon={X}
                            >
                                {tModal('close')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </PageShell>
    );
}
