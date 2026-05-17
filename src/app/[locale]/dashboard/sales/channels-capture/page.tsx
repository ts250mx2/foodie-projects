'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import POSInsertModal from '@/components/POSInsertModal';
import PageShell from '@/components/PageShell';
import { Store, X, Save, Plus, CreditCard, FileText, DollarSign, ShoppingCart, Smartphone, Send, Trash2 } from 'lucide-react';

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
    const [inventoryDaysDetails, setInventoryDaysDetails] = useState<Record<number, { isMarkedInventoryDay: boolean }>>({});
    const [monthlyPaymentDetails, setMonthlyPaymentDetails] = useState<Record<number, number>>({});
    const [monthlyDailyTotals, setMonthlyDailyTotals] = useState<Record<number, number>>({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [activeTab, setActiveTab] = useState<'channels' | 'payments' | 'notes'>('channels');

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

    // Notes state
    const tNotes = useTranslations('NotesModal');
    const [notes, setNotes] = useState<any[]>([]);
    const [isLoadingNotes, setIsLoadingNotes] = useState(false);
    const [editingNote, setEditingNote] = useState<any>(null);
    const [noteFormData, setNoteFormData] = useState({
        note: '',
        file: null as string | null
    });

    // POS state
    const [isPOSModalOpen, setIsPOSModalOpen] = useState(false);
    const [isSavingPOS, setIsSavingPOS] = useState(false);
    const [posItems, setPosItems] = useState<any[]>([]);

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

    const fetchInventoryDates = async () => {
        if (!project?.idProyecto || !selectedBranch) return;
        try {
            const params = new URLSearchParams({
                projectId: String(project.idProyecto),
                branchId: String(selectedBranch),
                month: String(selectedMonth),
                year: String(selectedYear)
            });
            const response = await fetch(`/api/inventories/monthly?${params}`);
            const data = await response.json();
            
            if (data.success && Array.isArray(data.data)) {
                const detailsMap: Record<number, { isMarkedInventoryDay: boolean }> = {};
                data.data.forEach((item: any) => {
                    const dayNum = item.Dia;
                    if (dayNum && item.isMarkedInventoryDay === 1) {
                        detailsMap[dayNum] = {
                            isMarkedInventoryDay: true
                        };
                    }
                });
                setInventoryDaysDetails(detailsMap);
            }
        } catch (error) {
            console.error('Error fetching inventory dates:', error);
        }
    };

    useEffect(() => {
        if (project?.idProyecto && selectedBranch) {
            // Clear details before fetching to avoid showing old data
            setMonthlySalesDetails({});
            setInventoryDaysDetails({});
            setMonthlyPaymentDetails({});
            setMonthlyDailyTotals({});
            
            fetchMonthlySales();
            fetchInventoryDates();
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
            fetchDailyTotalSale(date),
            fetchNotes(date)
        ]);
        setActiveTab('channels');
        setIsModalOpen(true);
        fetchPOSSales(date);
    };

    const fetchPOSSales = async (date: Date) => {
        if (!project || !selectedBranch) return;
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                day: date.getDate().toString(),
                month: date.getMonth().toString(),
                year: date.getFullYear().toString()
            });
            const response = await fetch(`/api/sales/pos?${params}`);
            const data = await response.json();
            if (data.success) {
                setPosItems(data.data);
            }
        } catch (error) {
            console.error('Error fetching POS sales:', error);
        }
    };

    const handleSavePOS = async (items: any[]) => {
        if (!selectedDate || !project || !selectedBranch) return;
        setIsSavingPOS(true);
        try {
            const response = await fetch('/api/sales/pos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    branchId: selectedBranch,
                    day: selectedDate.getDate(),
                    month: selectedDate.getMonth(),
                    year: selectedDate.getFullYear(),
                    items
                })
            });

            if (response.ok) {
                await fetchPOSSales(selectedDate);
                setIsPOSModalOpen(false);
                alert('Ventas POS guardadas correctamente');
            } else {
                alert('Error al guardar ventas POS');
            }
        } catch (error) {
            console.error('Error saving POS sales:', error);
            alert('Error al guardar ventas POS');
        } finally {
            setIsSavingPOS(false);
        }
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

    const fetchNotes = async (date: Date) => {
        if (!project || !selectedBranch) return;
        setIsLoadingNotes(true);
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                day: date.getDate().toString(),
                month: date.getMonth().toString(),
                year: date.getFullYear().toString()
            });
            const response = await fetch(`/api/notes?${params}`);
            const data = await response.json();
            if (data.success) {
                setNotes(data.data);
            }
        } catch (error) {
            console.error('Error fetching notes:', error);
        } finally {
            setIsLoadingNotes(false);
        }
    };

    const handleNoteSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDate || !project || !selectedBranch) return;

        try {
            const url = '/api/notes';
            const method = editingNote ? 'PUT' : 'POST';
            const body: any = editingNote ? {
                projectId: project.idProyecto,
                noteId: editingNote.IdNota,
                note: noteFormData.note,
                ...(noteFormData.file !== editingNote.archivnota ? { file: noteFormData.file } : {})
            } : {
                projectId: project.idProyecto,
                branchId: selectedBranch,
                day: selectedDate.getDate(),
                month: selectedDate.getMonth(),
                year: selectedDate.getFullYear(),
                note: noteFormData.note,
                file: noteFormData.file
            };

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                await fetchNotes(selectedDate);
                setNoteFormData({ note: '', file: null });
                setEditingNote(null);
            }
        } catch (error) {
            console.error('Error saving note:', error);
        }
    };

    const handleDeleteNote = async (noteId: number) => {
        if (!window.confirm(tNotes('confirmDelete'))) return;
        try {
            const response = await fetch('/api/notes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    noteId,
                    status: 2
                })
            });
            if (response.ok && selectedDate) {
                await fetchNotes(selectedDate);
            }
        } catch (error) {
            console.error('Error deleting note:', error);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setNoteFormData(prev => ({ ...prev, file: reader.result as string }));
            };
            reader.readAsDataURL(file);
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
        <PageShell title={t('title')} icon={Store} actions={<div className="flex items-center gap-3 flex-wrap">
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
                </div>}>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col h-[calc(100vh-200px)] overflow-y-auto">
                {/* Header fijo sticky */}
                <div
                    className="sticky top-0 z-10 grid grid-cols-7 gap-0 px-4 py-4 shadow-sm flex-shrink-0"
                    style={{
                        backgroundColor: colors.colorFondo1,
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

                {/* Calendario expandido */}
                <div className="p-4 bg-white">
                    <div className="grid grid-cols-7 gap-3">
                        {calendarDays.map((date, index) => {
                            if (!date) {
                                return <div key={`empty-${index}`} />;
                            }

                            const dayNum = date.getDate();
                            const details = monthlySalesDetails[dayNum];
                            const hasSales = details && details.length > 0;
                            const isToday = new Date().toDateString() === date.toDateString();
                            const isInventory = inventoryDaysDetails[dayNum]?.isMarkedInventoryDay;

                            return (
                                <div
                                    key={index}
                                    onClick={() => handleDayClick(date)}
                                    className={`
                                    aspect-square rounded-xl p-3 cursor-pointer transition-all duration-200
                                    flex flex-col justify-between group relative overflow-hidden
                                    ${isToday
                                            ? 'bg-red-50 border-2 border-red-400 shadow-md hover:shadow-lg'
                                            : isInventory
                                            ? 'bg-green-50 border-2 border-green-400 shadow-md hover:shadow-lg'
                                            : hasSales
                                            ? 'bg-blue-50 border-2 border-blue-300 shadow-sm hover:shadow-md'
                                            : 'bg-white border-2 border-gray-200 shadow-sm hover:shadow-md'
                                        }
                                    hover:scale-105 hover:-translate-y-1
                                `}
                                >
                                    <div className="flex justify-between items-start z-10">
                                        <span className={`text-xl font-black
                                            ${isToday ? 'text-red-600' : isInventory ? 'text-green-700' : hasSales ? 'text-blue-700' : 'text-gray-400'}
                                        `}>
                                            {dayNum}
                                        </span>
                                        {isToday && (
                                            <span className="text-[7px] font-bold bg-red-500 text-white px-1 py-0.5 rounded-full animate-pulse">
                                                HOY
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
                                                    <div>
                                                        <div className="text-[8px] font-bold text-gray-500 uppercase">Reportado</div>
                                                        <div className="text-xs font-black text-gray-800">
                                                            ${Math.round(reported)}
                                                        </div>
                                                    </div>
                                                )}
                                                {(hasSales || reported > 0) && (
                                                    <div className="border-t border-gray-200/50 pt-1">
                                                        <div className="text-[8px] font-bold text-green-600 uppercase">Canales</div>
                                                        <div className="text-xs font-black text-green-700">
                                                            ${Math.round(channelsTotal)}
                                                        </div>
                                                        {Math.abs(diffChannels) >= 0.01 && (
                                                            <div className="text-[10px] font-bold" style={{ color: diffChannels > 0 ? '#a855f7' : '#dc2626' }}>
                                                                {diffChannels > 0 ? '+' : ''}{Math.round(diffChannels)}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {(monthlyPaymentDetails[dayNum] !== undefined || reported > 0) && (
                                                    <div className="border-t border-gray-200/50 pt-1">
                                                        <div className="text-[8px] font-bold text-blue-600 uppercase">Pagos</div>
                                                        <div className="text-xs font-black text-blue-700">
                                                            ${Math.round(paymentsTotal)}
                                                        </div>
                                                        {Math.abs(diffPayments) >= 0.01 && (
                                                            <div className="text-[10px] font-bold" style={{ color: diffPayments > 0 ? '#a855f7' : '#dc2626' }}>
                                                                {diffPayments > 0 ? '+' : ''}{Math.round(diffPayments)}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && selectedDate && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-4" aria-modal="true" role="dialog">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
                        onClick={() => setIsModalOpen(false)}
                    />

                    {/* Panel */}
                    <div
                        className="relative w-full bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-w-5xl animate-in zoom-in-95 fade-in duration-200"
                        style={{ maxHeight: '90vh' }}
                    >
                        {/* Header */}
                        <div
                            className="shrink-0 flex items-start justify-between px-5 py-4 gap-4 border-b border-black/5"
                            style={{ backgroundColor: colors.colorFondo1 }}
                        >
                            <div className="flex flex-col gap-0.5 min-w-0">
                                <h2
                                    className="text-[15px] font-semibold leading-tight"
                                    style={{ color: colors.colorLetra }}
                                >
                                    {t('title')}
                                </h2>
                                <p
                                    className="text-[12px] leading-tight"
                                    style={{ color: colors.colorLetra, opacity: 0.8 }}
                                >
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
                        <div className="shrink-0 px-6 py-5 bg-gray-50/50 border-b border-gray-100">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                {/* 1. Venta Total Reportada (Editable) */}
                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm relative group flex flex-col justify-center">
                                    <div className="flex items-center gap-2 mb-2">
                                        <DollarSign size={14} className="text-gray-400" />
                                        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Venta Total Reportada</label>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="text"
                                            className="bg-transparent text-xl font-bold text-gray-800 w-full focus:outline-none focus:ring-2 focus:ring-primary-500/30 rounded px-1 py-0.5"
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
                                        <Button
                                            type="button"
                                            onClick={handleSaveDailyTotal}
                                            disabled={isSavingDailyTotal}
                                            variant="solid"
                                            size="sm"
                                            leftIcon={Save}
                                            iconBox
                                            isLoading={isSavingDailyTotal}
                                            title="Guardar"
                                        >
                                            Guardar
                                        </Button>
                                    </div>
                                </div>

                                {/* Insertar Ventas POS Button (Visible only on inventory days) */}
                                {inventoryDaysDetails[selectedDate.getDate()]?.isMarkedInventoryDay && (
                                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-sm relative group flex flex-col justify-center">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Smartphone size={14} className="text-emerald-600" />
                                            <label className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Punto de Venta Detalle</label>
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            <div className="text-lg font-bold text-emerald-700">
                                                {posItems.length > 0 ? (
                                                    <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(posItems.reduce((s, i) => s + (parseFloat(i.Total) || 0), 0))}</span>
                                                ) : (
                                                    <span className="text-sm font-semibold text-gray-500">Sin captura POS</span>
                                                )}
                                            </div>
                                            <Button
                                                onClick={() => setIsPOSModalOpen(true)}
                                                variant="solid"
                                                size="sm"
                                                leftIcon={Plus}
                                                iconBox
                                                className="w-full"
                                            >
                                                {posItems.length > 0 ? 'Actualizar POS' : 'Insertar POS'}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Capturada - Canales + Pagos lado a lado */}
                                <div className="flex flex-col gap-2">
                                    {(() => {
                                        const reportedVal = parseFloat(dailyTotalSale.replace(/[^0-9.]/g, '')) || 0;
                                        const diffVal = totalSales - reportedVal;
                                        const isMatch = Math.abs(diffVal) < 0.01;

                                        return (
                                            <div
                                                className="bg-white p-4 rounded-xl border shadow-sm relative overflow-hidden transition-all duration-300 flex-1"
                                                style={{ borderColor: isMatch ? '#dcfce7' : diffVal > 0 ? '#fce7f3' : '#fee2e2' }}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <ShoppingCart size={14} className="text-green-600" />
                                                    <label
                                                        className="text-[11px] font-semibold uppercase tracking-wider"
                                                        style={{ color: isMatch ? '#16a34a' : diffVal > 0 ? '#9333ea' : '#dc2626' }}
                                                    >
                                                        Canales
                                                    </label>
                                                </div>
                                                <div className="text-lg font-bold text-green-600">
                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalSales)}
                                                </div>
                                                {Math.abs(diffVal) >= 0.01 && (
                                                    <div className="text-xs font-semibold mt-1" style={{ color: diffVal > 0 ? '#9333ea' : '#dc2626' }}>
                                                        Dif: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(diffVal)}
                                                    </div>
                                                )}
                                                <div
                                                    className="absolute top-0 right-0 w-1 h-full"
                                                    style={{ backgroundColor: isMatch ? '#22c55e' : diffVal > 0 ? '#9333ea' : '#dc2626' }}
                                                />
                                            </div>
                                        );
                                    })()}

                                    {(() => {
                                        const reportedVal = parseFloat(dailyTotalSale.replace(/[^0-9.]/g, '')) || 0;
                                        const paymentTotal = paymentDailySales.reduce((sum, s) => sum + (parseFloat(s.Venta) || 0), 0);
                                        const diffVal = paymentTotal - reportedVal;
                                        const isMatch = Math.abs(diffVal) < 0.01;

                                        return (
                                            <div
                                                className="bg-white p-4 rounded-xl border shadow-sm relative overflow-hidden transition-all duration-300 flex-1"
                                                style={{ borderColor: isMatch ? '#dcfce7' : diffVal > 0 ? '#fce7f3' : '#fee2e2' }}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <CreditCard size={14} className="text-blue-600" />
                                                    <label
                                                        className="text-[11px] font-semibold uppercase tracking-wider"
                                                        style={{ color: isMatch ? '#16a34a' : diffVal > 0 ? '#9333ea' : '#dc2626' }}
                                                    >
                                                        Pagos
                                                    </label>
                                                </div>
                                                <div className="text-lg font-bold text-blue-600">
                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(paymentTotal)}
                                                </div>
                                                {Math.abs(diffVal) >= 0.01 && (
                                                    <div className="text-xs font-semibold mt-1" style={{ color: diffVal > 0 ? '#9333ea' : '#dc2626' }}>
                                                        Dif: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(diffVal)}
                                                    </div>
                                                )}
                                                <div
                                                    className="absolute top-0 right-0 w-1 h-full"
                                                    style={{ backgroundColor: isMatch ? '#22c55e' : diffVal > 0 ? '#9333ea' : '#dc2626' }}
                                                />
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Tab Switcher */}
                        <div className="shrink-0 flex border-b border-gray-200 px-6 py-0 bg-gray-50/50" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                            {[
                                { id: 'channels', label: 'Canales de Venta', icon: Store },
                                { id: 'payments', label: 'Formas de Pago', icon: CreditCard },
                                { id: 'notes', label: tNotes('title'), icon: FileText }
                            ].map(tab => {
                                const TabIcon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={`px-6 py-4 border-b-2 flex items-center gap-2 whitespace-nowrap transition-all duration-200 font-medium ${activeTab === tab.id
                                            ? `text-[13px]`
                                            : 'text-[13px] text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
                                        }`}
                                        style={activeTab === tab.id ? {
                                            color: colors.colorFondo1,
                                            borderBottomColor: colors.colorFondo1
                                        } : {}}
                                    >
                                        <TabIcon size={16} />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto flex flex-col">
                            {(activeTab === 'channels' || activeTab === 'payments') && (
                                <>
                                    {/* Form */}
                                    <form onSubmit={handleSubmit} className="shrink-0 grid grid-cols-1 sm:grid-cols-5 gap-4 bg-gray-50/50 border border-gray-100 rounded-xl p-5 mx-6 mt-5 items-end">
                                        <div className="flex flex-col">
                                            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">{tModal('shift')}</label>
                                            <select
                                                className="w-full h-9 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                                                value={formData.shiftId}
                                                onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
                                                required
                                            >
                                                <option value="">{tModal('select')}</option>
                                                {filteredShifts.map(s => <option key={s.IdTurno} value={s.IdTurno}>{s.Turno}</option>)}
                                            </select>
                                        </div>

                                        {activeTab === 'channels' ? (
                                            <div className="flex flex-col sm:col-span-2">
                                                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Canal</label>
                                                <select
                                                    className="w-full h-9 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                                                    value={formData.channelId}
                                                    onChange={(e) => setFormData({ ...formData, channelId: e.target.value })}
                                                    required={activeTab === 'channels'}
                                                >
                                                    <option value="">{tModal('select')}</option>
                                                    {channels.map(c => <option key={c.IdCanalVenta} value={c.IdCanalVenta}>{c.CanalVenta}</option>)}
                                                </select>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col sm:col-span-2">
                                                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Forma de Pago</label>
                                                <select
                                                    className="w-full h-9 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                                                    value={formData.terminalId}
                                                    onChange={(e) => setFormData({ ...formData, terminalId: e.target.value })}
                                                    required={activeTab === 'payments'}
                                                >
                                                    <option value="">{tModal('select')}</option>
                                                    {terminals.map(t => <option key={t.IdTerminal} value={t.IdTerminal}>{t.Terminal}</option>)}
                                                </select>
                                            </div>
                                        )}

                                        <div className="flex flex-col">
                                            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">{tModal('amount')}</label>
                                            <input
                                                type="text"
                                                className="w-full h-9 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 text-right font-semibold"
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
                                        <Button type="submit" variant="solid" size="md" leftIcon={Plus} iconBox className="w-full mt-[22px]">
                                            {tModal('add')}
                                        </Button>
                                    </form>

                                    {/* Table */}
                                    <div className="shrink-0 border border-gray-100 rounded-xl overflow-hidden mx-6 mb-5">
                                        <div className="overflow-y-auto max-h-[350px]">
                                            {activeTab === 'channels' ? (
                                                <table className="min-w-full">
                                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                                        <tr className="border-b border-gray-100">
                                                            <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">{tModal('shift')}</th>
                                                            <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Canal</th>
                                                            <th className="px-5 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">{tModal('amount')}</th>
                                                            <th className="px-5 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Comisión</th>
                                                            <th className="px-5 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Acciones</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {dailySales.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={5} className="px-5 py-12 text-center text-sm text-gray-400">Sin registros</td>
                                                            </tr>
                                                        ) : (
                                                            dailySales.map((sale, idx) => {
                                                                const commissionAmount = parseFloat(sale.Venta) * ((sale.Comision || 0) / 100);
                                                                return (
                                                                    <tr key={idx} className="border-t border-gray-50 hover:bg-gray-50/60 transition-colors">
                                                                        <td className="px-5 py-3 text-sm text-gray-700 font-semibold">{sale.Turno}</td>
                                                                        <td className="px-5 py-3 text-sm text-gray-700">{sale.CanalVenta}</td>
                                                                        <td className="px-5 py-3 text-sm text-gray-900 text-right font-semibold tabular-nums">
                                                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(sale.Venta))}
                                                                        </td>
                                                                        <td className="px-5 py-3 text-sm text-blue-600 text-right font-semibold tabular-nums">
                                                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(commissionAmount)}
                                                                        </td>
                                                                        <td className="px-5 py-3 text-center">
                                                                            <button
                                                                                onClick={() => handleDelete(sale.IdTurno, sale.IdCanalVenta)}
                                                                                className="text-gray-300 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50"
                                                                                title="Eliminar"
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })
                                                        )}
                                                    </tbody>
                                                    {dailySales.length > 0 && (
                                                        <tfoot className="bg-gray-50/80 border-t border-gray-100">
                                                            <tr>
                                                                <td colSpan={2} className="px-5 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</td>
                                                                <td className="px-5 py-3 text-right text-sm font-bold text-green-600 tabular-nums">
                                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dailySales.reduce((sum, s) => sum + (parseFloat(s.Venta) || 0), 0))}
                                                                </td>
                                                                <td className="px-5 py-3 text-right text-sm font-bold text-blue-600 tabular-nums">
                                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dailySales.reduce((sum, s) => sum + (parseFloat(s.Venta) * ((s.Comision || 0) / 100)), 0))}
                                                                </td>
                                                                <td></td>
                                                            </tr>
                                                        </tfoot>
                                                    )}
                                                </table>
                                            ) : (
                                                <table className="min-w-full">
                                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                                        <tr className="border-b border-gray-100">
                                                            <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">{tModal('shift')}</th>
                                                            <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Forma de Pago</th>
                                                            <th className="px-5 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">{tModal('amount')}</th>
                                                            <th className="px-5 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Comisión</th>
                                                            <th className="px-5 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Acciones</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {paymentDailySales.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={5} className="px-5 py-12 text-center text-sm text-gray-400">Sin registros</td>
                                                            </tr>
                                                        ) : (
                                                            paymentDailySales.map((sale, idx) => {
                                                                const commissionAmount = parseFloat(sale.Venta) * ((sale.Comision || 0) / 100);
                                                                return (
                                                                    <tr key={idx} className="border-t border-gray-50 hover:bg-gray-50/60 transition-colors">
                                                                        <td className="px-5 py-3 text-sm text-gray-700 font-semibold">{sale.Turno}</td>
                                                                        <td className="px-5 py-3 text-sm text-gray-700">{sale.Terminal}</td>
                                                                        <td className="px-5 py-3 text-sm text-gray-900 text-right font-semibold tabular-nums">
                                                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(sale.Venta))}
                                                                        </td>
                                                                        <td className="px-5 py-3 text-sm text-blue-600 text-right font-semibold tabular-nums">
                                                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(commissionAmount)}
                                                                        </td>
                                                                        <td className="px-5 py-3 text-center">
                                                                            <button
                                                                                onClick={() => handleDelete(sale.IdTurno, sale.IdTerminal)}
                                                                                className="text-gray-300 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50"
                                                                                title="Eliminar"
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })
                                                        )}
                                                    </tbody>
                                                    {paymentDailySales.length > 0 && (
                                                        <tfoot className="bg-gray-50/80 border-t border-gray-100">
                                                            <tr>
                                                                <td colSpan={2} className="px-5 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</td>
                                                                <td className="px-5 py-3 text-right text-sm font-bold text-green-600 tabular-nums">
                                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(paymentDailySales.reduce((sum, s) => sum + (parseFloat(s.Venta) || 0), 0))}
                                                                </td>
                                                                <td className="px-5 py-3 text-right text-sm font-bold text-blue-600 tabular-nums">
                                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(paymentDailySales.reduce((sum, s) => sum + (parseFloat(s.Venta) * ((s.Comision || 0) / 100)), 0))}
                                                                </td>
                                                                <td></td>
                                                            </tr>
                                                        </tfoot>
                                                    )}
                                                </table>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {activeTab === 'notes' && (
                                <div className="flex-1 flex flex-col gap-5 px-6 py-5 overflow-y-auto">
                                    <form onSubmit={handleNoteSubmit} className="shrink-0 flex flex-col gap-4 bg-gray-50/50 border border-gray-100 rounded-xl p-5">
                                        <div className="flex flex-col">
                                            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">{tNotes('label')}</label>
                                            <textarea
                                                className="w-full min-h-[90px] text-sm border border-gray-200 rounded-lg px-3 py-2.5 resize-none focus:ring-2 focus:ring-primary-500/30 focus:outline-none"
                                                value={noteFormData.note}
                                                onChange={(e) => setNoteFormData(prev => ({ ...prev, note: e.target.value }))}
                                                placeholder={tNotes('placeholder')}
                                                required
                                            />
                                        </div>
                                        <div className="flex flex-col md:flex-row gap-3 items-end">
                                            <div className="flex flex-col flex-1">
                                                <div className="flex justify-between items-center mb-1.5">
                                                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{tNotes('file')}</label>
                                                    {noteFormData.file && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setNoteFormData(prev => ({ ...prev, file: null }))}
                                                            className="text-[10px] text-red-600 font-semibold hover:underline"
                                                        >
                                                            Limpiar
                                                        </button>
                                                    )}
                                                </div>
                                                <input
                                                    type="file"
                                                    onChange={handleFileChange}
                                                    className="text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 w-full"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                {editingNote && (
                                                    <Button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingNote(null);
                                                            setNoteFormData({ note: '', file: null });
                                                        }}
                                                        variant="secondary"
                                                        size="sm"
                                                    >
                                                        {tCommon('cancel')}
                                                    </Button>
                                                )}
                                                <Button
                                                    type="submit"
                                                    variant="solid"
                                                    size="sm"
                                                    leftIcon={Send}
                                                    iconBox
                                                >
                                                    {editingNote ? tCommon('save') : tNotes('save')}
                                                </Button>
                                            </div>
                                        </div>
                                    </form>

                                    <div className="flex flex-col gap-3">
                                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Historial de Notas</h3>
                                        <div className="grid gap-3 max-h-[350px] overflow-y-auto">
                                            {isLoadingNotes ? (
                                                <div className="text-center py-8 text-gray-400 text-sm">{tCommon('loading')}</div>
                                            ) : notes.length === 0 ? (
                                                <div className="text-center py-8 bg-gray-50/50 rounded-xl border border-gray-100 text-gray-400 text-sm">
                                                    {tNotes('noNotes')}
                                                </div>
                                            ) : (
                                                notes.map((note: any) => (
                                                    <div key={note.IdNota} className="bg-white border border-gray-100 rounded-xl p-4 group">
                                                        <div className="flex justify-between items-start gap-2">
                                                            <div className="flex flex-col flex-1 min-w-0">
                                                                <span className="text-[10px] font-semibold text-gray-400 uppercase">{new Date(note.FechaAct).toLocaleString()}</span>
                                                                <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{note.Nota}</p>
                                                            </div>
                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingNote(note);
                                                                        setNoteFormData({ note: note.Nota, file: note.archivnota });
                                                                    }}
                                                                    className="p-1 hover:bg-blue-50 text-blue-600 hover:text-blue-700 rounded transition-colors"
                                                                    title="Editar"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteNote(note.IdNota);
                                                                    }}
                                                                    className="p-1 hover:bg-red-50 text-red-600 hover:text-red-700 rounded transition-colors"
                                                                    title="Eliminar"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {note.archivnota && (
                                                            <div className="mt-3 pt-3 border-t border-gray-100">
                                                                <a
                                                                    href={note.archivnota}
                                                                    download={`nota_${note.IdNota}`}
                                                                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                                                                >
                                                                    ↓ Descargar adjunto
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end">
                            <Button variant="secondary" size="md" leftIcon={X} onClick={() => setIsModalOpen(false)}>
                                {tModal('close')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            {isPOSModalOpen && (
                <POSInsertModal
                    isOpen={isPOSModalOpen}
                    onClose={() => setIsPOSModalOpen(false)}
                    onSave={handleSavePOS}
                    isSaving={isSavingPOS}
                    projectId={project.idProyecto}
                    initialItems={posItems}
                />
            )}
        </PageShell>
    );
}
