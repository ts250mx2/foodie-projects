'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import PageShell from '@/components/PageShell';
import { Monitor } from 'lucide-react';

interface Branch {
    IdSucursal: number;
    Sucursal: string;
}

export default function SalesTerminalsCapturePage() {
    const t = useTranslations('SalesTerminalsCapture');
    const tModal = useTranslations('SalesModal');
    const tCommon = useTranslations('Common');
    const { colors } = useTheme();

    // Basic state
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [project, setProject] = useState<any>(null);

    // Data for modal
    const [shifts, setShifts] = useState<any[]>([]);
    const [terminals, setTerminals] = useState<any[]>([]);
    const [dailySales, setDailySales] = useState<any[]>([]);
    const [monthlySalesDetails, setMonthlySalesDetails] = useState<Record<number, Array<{ shiftName: string, total: number, commission: number }>>>({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        shiftId: '',
        terminalId: '',
        amount: ''
    });
    const [dailyTotalSale, setDailyTotalSale] = useState<string>('');
    const [isSavingDailyTotal, setIsSavingDailyTotal] = useState(false);

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
            fetchDropdowns();

            // Load persisted filters - Standardized to dashboardSelectedBranch
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
            fetchMonthlySales();
        }
    }, [project, selectedBranch, selectedMonth, selectedYear]);

    const fetchBranches = async () => {
        try {
            const response = await fetch(`/api/branches?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success && data.data.length > 0) {
                setBranches(data.data);

                // Only set default if no branch is selected or persisted
                const savedBranch = localStorage.getItem('dashboardSelectedBranch');
                if (!savedBranch && !selectedBranch) {
                    setSelectedBranch(data.data[0].IdSucursal.toString());
                }
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        }
    };

    const fetchDropdowns = async () => {
        try {
            const [resShifts, resTerminals] = await Promise.all([
                fetch(`/api/shifts?projectId=${project.idProyecto}`).then(r => r.json()),
                fetch(`/api/terminals?projectId=${project.idProyecto}`).then(r => r.json())
            ]);

            if (resShifts.success) setShifts(resShifts.data);
            if (resTerminals.success) setTerminals(resTerminals.data);
        } catch (error) {
            console.error('Error fetching dropdowns:', error);
        }
    };

    const fetchMonthlySales = async () => {
        if (!project || !selectedBranch) return;
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                month: selectedMonth.toString(),
                year: selectedYear.toString()
            });
            const response = await fetch(`/api/sales/terminals/monthly?${params}`);
            const data = await response.json();
            if (data.success) {
                const detailsMap: Record<number, Array<{ shiftName: string, total: number, commission: number }>> = {};
                data.data.forEach((item: any) => {
                    if (!detailsMap[item.day]) {
                        detailsMap[item.day] = [];
                    }
                    detailsMap[item.day].push({
                        shiftName: item.shiftName,
                        total: item.total,
                        commission: item.commission || 0
                    });
                });
                setMonthlySalesDetails(detailsMap);
            }
        } catch (error) {
            console.error('Error fetching monthly sales:', error);
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
        await Promise.all([
            fetchDailySales(date),
            fetchDailyTotalSale(date)
        ]);
        setIsModalOpen(true);
    };

    const fetchDailyTotalSale = async (date: Date) => {
        if (!project || !selectedBranch) return;
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                day: date.getDate().toString(),
                month: date.getMonth().toString(),
                year: date.getFullYear().toString()
            });
            const response = await fetch(`/api/sales/daily-total?${params}`);
            const data = await response.json();
            if (data.success) {
                const amount = data.data.sales || 0;
                setDailyTotalSale(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount));
            }
        } catch (error) {
            console.error('Error fetching daily total sale:', error);
        }
    };

    const handleSaveDailyTotal = async () => {
        if (!selectedDate || !project || !selectedBranch) return;

        setIsSavingDailyTotal(true);
        try {
            const response = await fetch('/api/sales/daily-total', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    branchId: selectedBranch,
                    day: selectedDate.getDate(),
                    month: selectedDate.getMonth(),
                    year: selectedDate.getFullYear(),
                    amount: parseFloat(dailyTotalSale.replace(/[^0-9.]/g, '')) || 0
                })
            });

            if (response.ok) {
                alert('Venta total del día guardada correctamente');
            } else {
                alert('Error al guardar la venta total del día');
            }
        } catch (error) {
            console.error('Error saving daily total sale:', error);
            alert('Error al guardar la venta total del día');
        } finally {
            setIsSavingDailyTotal(false);
        }
    };

    const fetchDailySales = async (date: Date) => {
        if (!project || !selectedBranch) return;
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                day: date.getDate().toString(),
                month: date.getMonth().toString(),
                year: date.getFullYear().toString()
            });
            const response = await fetch(`/api/sales/terminals/daily?${params}`);
            const data = await response.json();
            if (data.success) {
                setDailySales(data.data);
            }
        } catch (error) {
            console.error('Error fetching daily sales:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDate || !project || !selectedBranch) return;

        try {
            const response = await fetch('/api/sales/terminals/daily', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    branchId: selectedBranch,
                    day: selectedDate.getDate(),
                    month: selectedDate.getMonth(),
                    year: selectedDate.getFullYear(),
                    shiftId: formData.shiftId,
                    terminalId: formData.terminalId,
                    amount: parseFloat(formData.amount.replace(/[^0-9.]/g, ''))
                })
            });

            if (response.ok) {
                fetchDailySales(selectedDate);
                fetchMonthlySales();
                setFormData({ ...formData, amount: '' });
            }
        } catch (error) {
            console.error('Error saving sale:', error);
        }
    };

    const handleDelete = async (shiftId: number, terminalId: number) => {
        if (!selectedDate || !project || !selectedBranch) return;
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                day: selectedDate.getDate().toString(),
                month: selectedDate.getMonth().toString(),
                year: selectedDate.getFullYear().toString(),
                shiftId: shiftId.toString(),
                terminalId: terminalId.toString()
            });
            const response = await fetch(`/api/sales/terminals/daily?${params}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchDailySales(selectedDate);
                fetchMonthlySales();
            }
        } catch (error) {
            console.error('Error deleting sale:', error);
        }
    };

    // Calendar logic
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

    const totalSales = dailySales.reduce((sum, sale) => sum + (sale.Venta || 0), 0);

    const filteredShifts = useMemo(() => {
        if (!selectedBranch) return shifts;
        return shifts.filter((shift: any) => shift.IdSucursal === parseInt(selectedBranch));
    }, [shifts, selectedBranch]);

    return (
        <PageShell
            title={t('title')}
            icon={Monitor}
            actions={
                <>
                    <select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="px-2 py-1.5 text-xs rounded-lg border border-white/30 bg-white/20 text-white focus:outline-none"
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
                        className="px-2 py-1.5 text-xs rounded-lg border border-white/30 bg-white/20 text-white focus:outline-none"
                    >
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i} value={i}>{t(`months.${i}`)}</option>
                        ))}
                    </select>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="px-2 py-1.5 text-xs rounded-lg border border-white/30 bg-white/20 text-white focus:outline-none"
                    >
                        {years.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </>
            }
        >
            <div className="flex flex-col gap-4">

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
                            const details = monthlySalesDetails[dayNum];
                            const hasSales = details && details.length > 0;
                            const isToday = new Date().toDateString() === date.toDateString();

                            return (
                                <div
                                    key={index}
                                    onClick={() => handleDayClick(date)}
                                    className={`
                                    aspect-square rounded-xl p-3 cursor-pointer transition-all duration-300
                                    flex flex-col justify-between group relative overflow-hidden
                                    ${isToday
                                            ? 'bg-white border-2 border-primary-400 shadow-primary-100'
                                            : 'bg-white border border-slate-200/60 hover:border-blue-400 hover:shadow-blue-100'
                                        }
                                    hover:scale-[1.02] hover:shadow-xl shadow-sm
                                `}
                                >
                                    <div className="flex justify-between items-start z-10">
                                        <span className={`text-xl font-black ${isToday ? 'text-primary-600' : hasSales ? 'text-slate-800' : 'text-slate-400 group-hover:text-blue-600'}`}>
                                            {dayNum}
                                        </span>
                                        {isToday && (
                                            <span className="text-[9px] font-extrabold bg-primary-500 text-white px-2 py-0.5 rounded-full shadow-sm animate-pulse tracking-tighter">
                                                {t('today') || 'HOY'}
                                            </span>
                                        )}
                                    </div>
                                    {hasSales && (
                                        <div className="space-y-0.5 z-10">
                                            <div className="text-sm font-black text-green-600 leading-tight">
                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(details.reduce((sum, s) => sum + s.total, 0))}
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                {details.length} {details.length === 1 ? 'Turno' : 'Turnos'}
                                            </div>
                                        </div>
                                    )}
                                    {/* Decorative background element for hover */}
                                    <div className={`
                                    absolute -right-4 -bottom-4 w-12 h-12 rounded-full opacity-0 group-hover:opacity-10 transition-opacity duration-300
                                    ${isToday ? 'bg-primary-600' : 'bg-blue-600'}
                                `} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && selectedDate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center text-white" style={{ background: `linear-gradient(to right, ${colors.colorFondo1}, ${colors.colorFondo2})`, color: colors.colorLetra }}>
                            <div>
                                <h2 className="text-2xl font-black">{t('title')}</h2>
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
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block tracking-wider">💰 Venta Total Reportada</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="bg-transparent text-xl font-black text-gray-800 w-full focus:outline-none focus:ring-2 focus:ring-primary-200 rounded p-1"
                                            value={dailyTotalSale}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                                if ((val.match(/\./g) || []).length > 1) return;
                                                setDailyTotalSale(val);
                                            }}
                                            onBlur={(e) => {
                                                const val = parseFloat(e.target.value.replace(/[^0-9.]/g, '') || '0');
                                                setDailyTotalSale(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val));
                                            }}
                                            onFocus={(e) => {
                                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                                setDailyTotalSale(val === '0.00' || val === '0' ? '' : val);
                                            }}
                                            placeholder="$0.00"
                                        />
                                        <button
                                            onClick={handleSaveDailyTotal}
                                            disabled={isSavingDailyTotal}
                                            className="bg-primary-500 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-primary-600 transition-colors"
                                        >
                                            {isSavingDailyTotal ? '...' : '💾'}
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block tracking-wider">🛒 Venta Capturada</label>
                                    <div className="text-xl font-black text-primary-600">
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalSales)}
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block tracking-wider">⚖️ Diferencia</label>
                                    <div className={`text-xl font-black ${(parseFloat(dailyTotalSale.replace(/[^0-9.]/g, '')) || 0) - totalSales < -0.01 ? 'text-red-500' : 'text-blue-500'}`}>
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((parseFloat(dailyTotalSale.replace(/[^0-9.]/g, '')) || 0) - totalSales)}
                                    </div>
                                </div>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-primary-50 p-6 rounded-xl border border-primary-100 items-end shadow-sm">
                                <div className="flex flex-col">
                                    <label className="text-xs font-bold text-primary-900/60 uppercase tracking-wider mb-2 ml-1">{tModal('shift')}</label>
                                    <select
                                        className="w-full p-2.5 bg-white border border-primary-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                        value={formData.shiftId}
                                        onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
                                        required
                                    >
                                        <option value="">{tModal('select')}</option>
                                        {filteredShifts.map(s => <option key={s.IdTurno} value={s.IdTurno}>{s.Turno}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-xs font-bold text-primary-900/60 uppercase tracking-wider mb-2 ml-1">{tModal('terminal')}</label>
                                    <select
                                        className="w-full p-2.5 bg-white border border-primary-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                        value={formData.terminalId}
                                        onChange={(e) => setFormData({ ...formData, terminalId: e.target.value })}
                                        required
                                    >
                                        <option value="">{tModal('select')}</option>
                                        {terminals.map(ter => <option key={ter.IdTerminal} value={ter.IdTerminal}>{ter.Terminal}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-xs font-bold text-primary-900/60 uppercase tracking-wider mb-2 ml-1">{tModal('amount')}</label>
                                    <input
                                        type="text"
                                        className="w-full p-2.5 bg-white border border-primary-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                        value={formData.amount}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9.]/g, '');
                                            if ((val.match(/\./g) || []).length > 1) return;
                                            setFormData({ ...formData, amount: val });
                                        }}
                                        onBlur={(e) => {
                                            const val = parseFloat(e.target.value.replace(/[^0-9.]/g, '') || '0');
                                            setFormData({ ...formData, amount: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val) });
                                        }}
                                        onFocus={(e) => {
                                            const val = e.target.value.replace(/[^0-9.]/g, '');
                                            setFormData({ ...formData, amount: val === '0.00' || val === '0' ? '' : val });
                                        }}
                                        required
                                        placeholder="0.00"
                                    />
                                </div>
                                <button type="submit" className="bg-primary-500 text-white p-2.5 rounded-lg hover:bg-primary-600 font-bold transition-all shadow-md active:scale-95">
                                    {tModal('add')}
                                </button>
                            </form>

                            {/* Table */}
                            <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col">
                                <div className="overflow-y-auto max-h-[300px]">
                                    <table className="min-w-full divide-y divide-gray-100">
                                        <thead className="bg-gray-50 sticky top-0 z-10 backdrop-blur-sm">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{tModal('shift')}</th>
                                                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{tModal('terminal')}</th>
                                                <th className="px-6 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">{tModal('amount')}</th>
                                                <th className="px-6 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Comisión</th>
                                                <th className="px-6 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-50">
                                            {dailySales.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400 italic">No se encontraron registros</td>
                                                </tr>
                                            ) : (
                                                dailySales.map((sale, idx) => {
                                                    return (
                                                        <tr key={idx} className="hover:bg-primary-50/30 transition-colors group">
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">{sale.Turno}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sale.Terminal}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-black">
                                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(sale.Venta))}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 text-right font-bold">
                                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(sale.ComisionMonto || 0))}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                                <button
                                                                    onClick={() => handleDelete(sale.IdTurno, sale.IdTerminal)}
                                                                    className="text-gray-300 hover:text-red-500 transition-colors p-1"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
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
        </PageShell>
    );
}
