'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';

interface Branch {
    IdSucursal: number;
    Sucursal: string;
}

export default function SalesChannelsCapturePage() {
    const t = useTranslations('SalesChannelsCapture');
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
    const [channels, setChannels] = useState<any[]>([]);
    const [dailySales, setDailySales] = useState<any[]>([]);
    const [monthlySalesDetails, setMonthlySalesDetails] = useState<Record<number, Array<{ shiftName: string, total: number, commission: number }>>>({});
    const [monthlyPaymentDetails, setMonthlyPaymentDetails] = useState<Record<number, number>>({});
    const [monthlyDailyTotals, setMonthlyDailyTotals] = useState<Record<number, number>>({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [activeTab, setActiveTab] = useState<'channels' | 'payments'>('channels');

    // Payments data
    const [terminals, setTerminals] = useState<any[]>([]);
    const [paymentDailySales, setPaymentDailySales] = useState<any[]>([]);

    // Form state
    const [formData, setFormData] = useState({
        shiftId: '',
        channelId: '',
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

            // Load persisted filters - Standardized to dashboardSelectedBranch
            const savedBranch = localStorage.getItem('dashboardSelectedBranch');
            const savedMonth = localStorage.getItem('lastSelectedMonth');
            const savedYear = localStorage.getItem('lastSelectedYear');

            if (savedBranch) setSelectedBranch(savedBranch);
            if (savedMonth) setSelectedMonth(parseInt(savedMonth));
            if (savedYear) setSelectedYear(parseInt(savedYear));
        }
    }, [project]);

    useEffect(() => {
        if (project?.idProyecto && selectedBranch) {
            fetchDropdowns(selectedBranch);
            // Reset form selections on branch change
            setFormData(prev => ({
                ...prev,
                shiftId: '',
                channelId: '',
                terminalId: '',
                amount: ''
            }));
        }
    }, [project, selectedBranch]);

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

    const fetchDropdowns = async (branchId: string) => {
        try {
            const [resShifts, resChannels, resTerminals] = await Promise.all([
                fetch(`/api/shifts?projectId=${project.idProyecto}&branchId=${branchId}`).then(r => r.json()),
                fetch(`/api/branches/${branchId}/sales-channels?projectId=${project.idProyecto}`).then(r => r.json()),
                fetch(`/api/branches/${branchId}/payment-methods?projectId=${project.idProyecto}`).then(r => r.json())
            ]);

            if (resShifts.success) setShifts(resShifts.data);
            if (resChannels.success) setChannels(resChannels.data);
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

            const [resChannels, resPayments, resDailyTotals] = await Promise.all([
                fetch(`/api/sales/channels/monthly?${params}`).then(r => r.json()),
                fetch(`/api/sales/terminals/monthly?${params}`).then(r => r.json()),
                fetch(`/api/sales/daily-total?${params}`).then(r => r.json())
            ]);

            if (resChannels.success) {
                const detailsMap: Record<number, Array<{ shiftName: string, total: number, commission: number }>> = {};
                resChannels.data.forEach((item: any) => {
                    if (!detailsMap[item.day]) detailsMap[item.day] = [];
                    detailsMap[item.day].push({ 
                        shiftName: item.shiftName, 
                        total: item.total, 
                        commission: item.commission || 0
                    });
                });
                setMonthlySalesDetails(detailsMap);
            }

            if (resPayments.success) {
                const paymentMap: Record<number, number> = {};
                resPayments.data.forEach((item: any) => {
                    paymentMap[item.day] = (paymentMap[item.day] || 0) + item.total;
                });
                setMonthlyPaymentDetails(paymentMap);
            }

            if (resDailyTotals.success) {
                const totalsMap: Record<number, number> = {};
                resDailyTotals.data.forEach((item: any) => {
                    totalsMap[item.day] = item.sales;
                });
                setMonthlyDailyTotals(totalsMap);
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
            fetchPaymentDailySales(date),
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
            const response = await fetch(`/api/sales/channels/daily?${params}`);
            const data = await response.json();
            if (data.success) {
                setDailySales(data.data);
            }
        } catch (error) {
            console.error('Error fetching daily sales:', error);
        }
    };

    const fetchPaymentDailySales = async (date: Date) => {
        if (!project || !selectedBranch) return;
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                day: date.getDate().toString(),
                month: date.getMonth().toString(), // 0-11
                year: date.getFullYear().toString()
            });
            const response = await fetch(`/api/sales/terminals/daily?${params}`);
            const data = await response.json();
            if (data.success) {
                setPaymentDailySales(data.data);
            }
        } catch (error) {
            console.error('Error fetching payment daily sales:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDate || !project || !selectedBranch) return;

        const isPayments = activeTab === 'payments';
        const url = isPayments ? '/api/sales/terminals/daily' : '/api/sales/channels/daily';
        
        const body: any = {
            projectId: project.idProyecto,
            branchId: selectedBranch,
            day: selectedDate.getDate(),
            month: selectedDate.getMonth(),
            year: selectedDate.getFullYear(),
            shiftId: formData.shiftId,
            amount: parseFloat(formData.amount.replace(/[^0-9.]/g, '')) || 0
        };

        if (isPayments) {
            body.terminalId = formData.terminalId;
            
            if (!formData.shiftId) {
                alert('Seleccione un turno');
                return;
            }
            if (!formData.terminalId) {
                alert('Seleccione una forma de pago');
                return;
            }
        } else {
            body.channelId = formData.channelId;
            if (!formData.shiftId) {
                alert('Seleccione un turno');
                return;
            }
            if (!formData.channelId) {
                alert('Seleccione un canal de venta');
                return;
            }
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                if (isPayments) fetchPaymentDailySales(selectedDate);
                else fetchDailySales(selectedDate);
                fetchMonthlySales();
                setFormData({ ...formData, amount: '' });
            } else {
                alert(`Error al guardar: ${result.message || 'Error desconocido'}`);
            }
        } catch (error) {
            console.error('Error saving sale:', error);
            alert('Error de red al guardar la venta');
        }
    };

    const handleDelete = async (shiftId: number, idItem: number) => {
        if (!selectedDate || !project || !selectedBranch) return;
        const isPayments = activeTab === 'payments';
        const url = isPayments ? '/api/sales/terminals/daily' : '/api/sales/channels/daily';
        const itemParam = isPayments ? 'terminalId' : 'channelId';
        
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                day: selectedDate.getDate().toString(),
                month: selectedDate.getMonth().toString(),
                year: selectedDate.getFullYear().toString(),
                shiftId: shiftId.toString(),
                [itemParam]: idItem.toString()
            });
            const response = await fetch(`${url}?${params}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                if (isPayments) fetchPaymentDailySales(selectedDate);
                else fetchDailySales(selectedDate);
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

    const totalSales = dailySales.reduce((sum, sale) => sum + (parseFloat(sale.Venta) || 0), 0);

    const filteredShifts = useMemo(() => {
        if (!selectedBranch) return shifts;
        return shifts.filter((shift: any) => shift.IdSucursal === parseInt(selectedBranch));
    }, [shifts, selectedBranch]);

    return (
        <div className="flex flex-col min-h-screen p-6 gap-4">
            <div className="sticky top-16 z-30 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-sm">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    🏪 {t('title')}
                </h1>

                <div className="flex items-center gap-4">
                    {/* Branch Selector */}
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1">{t('selectBranch')}</label>
                        <select
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
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
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
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
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
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
                                            ? 'bg-white border-2 border-orange-400 shadow-orange-100'
                                            : 'bg-white border border-slate-200/60 hover:border-blue-400 hover:shadow-blue-100'
                                        }
                                    hover:scale-[1.02] hover:shadow-xl shadow-sm
                                `}
                                >
                                    <div className="flex justify-between items-start z-10">
                                        <span className={`text-xl font-black ${isToday ? 'text-orange-600' : hasSales ? 'text-slate-800' : 'text-slate-400 group-hover:text-blue-600'}`}>
                                            {dayNum}
                                        </span>
                                        {isToday && (
                                            <span className="text-[9px] font-extrabold bg-orange-500 text-white px-2 py-0.5 rounded-full shadow-sm animate-pulse tracking-tighter">
                                                {t('today') || 'HOY'}
                                            </span>
                                        )}
                                    </div>
                                    {(hasSales || monthlyDailyTotals[dayNum] || monthlyPaymentDetails[dayNum]) && (() => {
                                        const reported = monthlyDailyTotals[dayNum] || 0;
                                        const channelsTotal = details?.reduce((sum, s) => sum + s.total, 0) || 0;
                                        const paymentsTotal = monthlyPaymentDetails[dayNum] || 0;
                                        const diffChannels = channelsTotal - reported;
                                        const diffPayments = paymentsTotal - reported;

                                        return (
                                            <div className="space-y-1 z-10">
                                                {monthlyDailyTotals[dayNum] !== undefined && (
                                                    <div className="flex flex-col mb-1">
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Reportado</div>
                                                        <div className="text-[13px] font-black text-slate-800 leading-tight">
                                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(reported)}
                                                        </div>
                                                    </div>
                                                )}
                                                {(hasSales || reported > 0) && (
                                                    <div className="flex flex-col border-t border-gray-100/50 pt-1">
                                                        <div className="flex justify-between items-baseline gap-1">
                                                            <div 
                                                                className="text-[10px] font-bold uppercase tracking-tighter transition-colors truncate"
                                                                style={{ color: Math.abs(diffChannels) < 0.01 ? '#94a3b8' : diffChannels > 0 ? '#9333ea' : '#dc2626' }}
                                                            >
                                                                Canales
                                                            </div>
                                                        </div>
                                                        <div className="text-[13px] font-black leading-tight flex flex-wrap items-baseline gap-1">
                                                            <span className="text-green-600">
                                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(channelsTotal)}
                                                            </span>
                                                            {Math.abs(diffChannels) >= 0.01 && (
                                                                <span 
                                                                    className="text-[10px] font-bold"
                                                                    style={{ color: diffChannels > 0 ? '#9333ea' : '#dc2626' }}
                                                                >
                                                                    ({diffChannels > 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(diffChannels)})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                {(monthlyPaymentDetails[dayNum] !== undefined || reported > 0) && (
                                                    <div className="flex flex-col border-t border-gray-100/50 pt-1">
                                                        <div className="flex justify-between items-baseline gap-1">
                                                            <div 
                                                                className="text-[10px] font-bold uppercase tracking-tighter transition-colors truncate"
                                                                style={{ color: Math.abs(diffPayments) < 0.01 ? '#94a3b8' : diffPayments > 0 ? '#9333ea' : '#dc2626' }}
                                                            >
                                                                Pagos
                                                            </div>
                                                        </div>
                                                        <div className="text-[13px] font-black leading-tight flex flex-wrap items-baseline gap-1">
                                                            <span className="text-blue-600">
                                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(paymentsTotal)}
                                                            </span>
                                                            {Math.abs(diffPayments) >= 0.01 && (
                                                                <span 
                                                                    className="text-[10px] font-bold"
                                                                    style={{ color: diffPayments > 0 ? '#9333ea' : '#dc2626' }}
                                                                >
                                                                    ({diffPayments > 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(diffPayments)})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                    {/* Decorative background element for hover */}
                                    <div className={`
                                    absolute -right-4 -bottom-4 w-12 h-12 rounded-full opacity-0 group-hover:opacity-10 transition-opacity duration-300
                                    ${isToday ? 'bg-orange-600' : 'bg-blue-600'}
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
                                className="text-white hover:bg-white/20 rounded-full p-2 transition-all"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Summary Cards */}
                        <div className="p-6 bg-gray-50/50 border-b border-gray-100">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* 1. Venta Total Reportada (Editable) */}
                                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm relative group flex flex-col justify-center">
                                    <div className="flex items-center gap-1 mb-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">💰 Venta Total Reportada</label>
                                        <span className="text-xs opacity-40 group-hover:opacity-100 transition-opacity">✏️</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="bg-transparent text-2xl font-black text-gray-800 w-full focus:outline-none focus:ring-2 focus:ring-orange-200 rounded p-1"
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
                                            className="bg-orange-500 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-orange-600 transition-colors shadow-sm active:scale-95"
                                        >
                                            {isSavingDailyTotal ? '...' : '💾'}
                                        </button>
                                    </div>
                                </div>

                                {/* 2. Capturada (Canales) con Diferencia */}
                                {(() => {
                                    const reportedVal = parseFloat(dailyTotalSale.replace(/[^0-9.]/g, '')) || 0;
                                    const diffVal = totalSales - reportedVal;
                                    const isMatch = Math.abs(diffVal) < 0.01;
                                    
                                    return (
                                        <div 
                                            className="bg-white p-5 rounded-xl border shadow-sm relative overflow-hidden transition-all duration-300"
                                            style={{ borderColor: isMatch ? '#f0fdf4' : diffVal > 0 ? '#f3e8ff' : '#fee2e2' }}
                                        >
                                            <label 
                                                className="text-[10px] font-bold uppercase mb-1 block tracking-widest"
                                                style={{ color: isMatch ? '#9ca3af' : diffVal > 0 ? '#9333ea' : '#dc2626' }}
                                            >
                                                📦 Capturada (Canales)
                                            </label>
                                            <div className="flex flex-col gap-1">
                                                <div className="text-2xl font-black text-green-600 line-height-none">
                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalSales)}
                                                </div>
                                                <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                                                    <span 
                                                        className="text-[10px] font-bold uppercase tracking-tighter"
                                                        style={{ color: isMatch ? '#9ca3af' : diffVal > 0 ? '#9333ea' : '#dc2626' }}
                                                    >
                                                        Dif:
                                                    </span>
                                                    <span 
                                                        className="text-sm font-black"
                                                        style={{ color: isMatch ? '#16a34a' : diffVal > 0 ? '#9333ea' : '#dc2626' }}
                                                    >
                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(diffVal)}
                                                    </span>
                                                </div>
                                            </div>
                                            {/* Small background indicator */}
                                            <div 
                                                className="absolute top-0 right-0 w-1.5 h-full" 
                                                style={{ backgroundColor: isMatch ? '#22c55e' : diffVal > 0 ? '#9333ea' : '#dc2626' }}
                                            />
                                        </div>
                                    );
                                })()}

                                {/* 3. Capturada (Forma Pago) con Diferencia */}
                                {(() => {
                                    const reportedVal = parseFloat(dailyTotalSale.replace(/[^0-9.]/g, '')) || 0;
                                    const paymentTotal = paymentDailySales.reduce((sum, s) => sum + (parseFloat(s.Venta) || 0), 0);
                                    const diffVal = paymentTotal - reportedVal;
                                    const isMatch = Math.abs(diffVal) < 0.01;

                                    return (
                                        <div 
                                            className="bg-white p-5 rounded-xl border shadow-sm relative overflow-hidden transition-all duration-300"
                                            style={{ borderColor: isMatch ? '#f0fdf4' : diffVal > 0 ? '#f3e8ff' : '#fee2e2' }}
                                        >
                                            <label 
                                                className="text-[10px] font-bold uppercase mb-1 block tracking-widest"
                                                style={{ color: isMatch ? '#9ca3af' : diffVal > 0 ? '#9333ea' : '#dc2626' }}
                                            >
                                                💳 Capturada (Forma Pago)
                                            </label>
                                            <div className="flex flex-col gap-1">
                                                <div className="text-2xl font-black text-blue-600 line-height-none">
                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(paymentTotal)}
                                                </div>
                                                <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                                                    <span 
                                                        className="text-[10px] font-bold uppercase tracking-tighter"
                                                        style={{ color: isMatch ? '#9ca3af' : diffVal > 0 ? '#9333ea' : '#dc2626' }}
                                                    >
                                                        Dif:
                                                    </span>
                                                    <span 
                                                        className="text-sm font-black"
                                                        style={{ color: isMatch ? '#16a34a' : diffVal > 0 ? '#9333ea' : '#dc2626' }}
                                                    >
                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(diffVal)}
                                                    </span>
                                                </div>
                                            </div>
                                            {/* Small background indicator */}
                                            <div 
                                                className="absolute top-0 right-0 w-1.5 h-full" 
                                                style={{ backgroundColor: isMatch ? '#22c55e' : diffVal > 0 ? '#9333ea' : '#dc2626' }}
                                            />
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Tab Switcher */}
                        <div className="flex gap-2 mt-0 overflow-x-auto relative px-6 bg-gray-50/50 border-b border-gray-100" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                            {[
                                { id: 'channels', label: '📦 Canales de Venta' },
                                { id: 'payments', label: '💳 Formas de Pago' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`px-6 py-3 rounded-t-xl transition-all duration-300 whitespace-nowrap relative flex items-center justify-center ${activeTab === tab.id
                                        ? 'bg-white text-gray-900 text-sm font-bold z-30 translate-y-[1px] border-t border-l border-r border-gray-200 shadow-[4px_-4px_10px_rgba(0,0,0,0.05)]'
                                        : 'text-xs font-normal text-gray-400 hover:text-gray-600 hover:-translate-y-0.5'
                                    }`}
                                >
                                    {tab.label}
                                    {activeTab === tab.id && (
                                        <div className="absolute -bottom-[2px] left-0 right-0 h-[3px] bg-white z-40"></div>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto flex flex-col gap-6">
                            {/* Form */}
                            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-gray-50 p-6 rounded-xl border border-gray-100 items-end shadow-sm mx-6 mt-6">
                                <div className="flex flex-col">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">{tModal('shift')}</label>
                                    <select
                                        className="w-full p-2.5 bg-white border border-orange-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                                        value={formData.shiftId}
                                        onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
                                        required
                                    >
                                        <option value="">{tModal('select')}</option>
                                        {filteredShifts.map(s => <option key={s.IdTurno} value={s.IdTurno}>{s.Turno}</option>)}
                                    </select>
                                </div>

                                {activeTab === 'channels' ? (
                                    <div className="flex flex-col">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Canal</label>
                                        <select
                                            className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                                            value={formData.channelId}
                                            onChange={(e) => setFormData({ ...formData, channelId: e.target.value })}
                                            required={activeTab === 'channels'}
                                        >
                                            <option value="">{tModal('select')}</option>
                                            {channels.map(c => <option key={c.IdCanalVenta} value={c.IdCanalVenta}>{c.CanalVenta}</option>)}
                                        </select>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex flex-col">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Forma de Pago</label>
                                            <select
                                                className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                                                value={formData.terminalId}
                                                onChange={(e) => setFormData({ ...formData, terminalId: e.target.value })}
                                                required={activeTab === 'payments'}
                                            >
                                                <option value="">{tModal('select')}</option>
                                                {terminals.map(t => <option key={t.IdTerminal} value={t.IdTerminal}>{t.Terminal}</option>)}
                                            </select>
                                        </div>
                                    </>
                                )}

                                <div className="flex flex-col">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">{tModal('amount')}</label>
                                    <input
                                        type="text"
                                        className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
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
                                <Button type="submit" className="w-full">
                                    {tModal('add')}
                                </Button>
                            </form>

                            {/* Table */}
                            <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col mx-6 mb-6">
                                <div className="overflow-y-auto max-h-[400px]">
                                    {activeTab === 'channels' ? (
                                        <table className="min-w-full divide-y divide-gray-100">
                                            <thead className="bg-gray-50 sticky top-0 z-10 backdrop-blur-sm">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{tModal('shift')}</th>
                                                    <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Canal</th>
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
                                                        const commissionAmount = parseFloat(sale.Venta) * ((sale.Comision || 0) / 100);
                                                        return (
                                                            <tr key={idx} className="hover:bg-orange-50/30 transition-colors group">
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">{sale.Turno}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sale.CanalVenta}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-black">
                                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(sale.Venta))}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 text-right font-bold">
                                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(commissionAmount)}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                                    <button
                                                                        onClick={() => handleDelete(sale.IdTurno, sale.IdCanalVenta)}
                                                                        className="text-gray-300 hover:text-red-600 transition-colors p-1"
                                                                    >
                                                                        🗑️
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                            <tfoot className="bg-gray-50 sticky bottom-0 z-10 shadow-[0_-2px_4px_rgba(0,0,0,0.02)]">
                                                <tr className="divide-x divide-gray-100">
                                                    <td colSpan={2} className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Total Capturado</td>
                                                    <td className="px-6 py-4 text-right text-base font-black text-green-600 leading-none">
                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dailySales.reduce((sum, s) => sum + (parseFloat(s.Venta) || 0), 0))}
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-base font-black text-blue-600 leading-none">
                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dailySales.reduce((sum, s) => sum + (parseFloat(s.Venta) * ((s.Comision || 0) / 100)), 0))}
                                                    </td>
                                                    <td className="bg-gray-50/50"></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    ) : (
                                        <table className="min-w-full divide-y divide-gray-100">
                                            <thead className="bg-gray-50 sticky top-0 z-10 backdrop-blur-sm">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{tModal('shift')}</th>
                                                    <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Forma de Pago</th>
                                                    <th className="px-6 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">{tModal('amount')}</th>
                                                    <th className="px-6 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Comisión</th>
                                                    <th className="px-6 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-50">
                                                {paymentDailySales.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400 italic">No se encontraron registros</td>
                                                    </tr>
                                                ) : (
                                                    paymentDailySales.map((sale, idx) => {
                                                        const commissionAmount = parseFloat(sale.Venta) * ((sale.Comision || 0) / 100);
                                                        return (
                                                            <tr key={idx} className="hover:bg-blue-50/30 transition-colors group">
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">{sale.Turno}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sale.Terminal}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-black">
                                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(sale.Venta))}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 text-right font-bold">
                                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(commissionAmount)}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                                    <button
                                                                        onClick={() => handleDelete(sale.IdTurno, sale.IdTerminal)}
                                                                        className="text-gray-300 hover:text-red-600 transition-colors p-1"
                                                                    >
                                                                        🗑️
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                            <tfoot className="bg-gray-50 sticky bottom-0 z-10 shadow-[0_-2px_4px_rgba(0,0,0,0.02)]">
                                                <tr className="divide-x divide-gray-100">
                                                    <td colSpan={2} className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Total Capturado</td>
                                                    <td className="px-6 py-4 text-right text-base font-black text-green-600 leading-none">
                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(paymentDailySales.reduce((sum, s) => sum + (parseFloat(s.Venta) || 0), 0))}
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-base font-black text-blue-600 leading-none">
                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(paymentDailySales.reduce((sum, s) => sum + (parseFloat(s.Venta) * ((s.Comision || 0) / 100)), 0))}
                                                    </td>
                                                    <td className="bg-gray-50/50"></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <Button onClick={() => setIsModalOpen(false)}>
                                {tModal('close')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
