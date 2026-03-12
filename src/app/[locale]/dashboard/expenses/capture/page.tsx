'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';

interface Branch {
    IdSucursal: number;
    Sucursal: string;
}

interface ExpenseConcept {
    IdConceptoGasto: number;
    ConceptoGasto: string;
    ReferenciaObligatoria: number;
    IdCanalPago: number | null;
    CanalPago: string | null;
}

interface PaymentChannel {
    IdCanalPago: number;
    CanalPago: string;
}

export default function ExpensesCapturePage() {
    const t = useTranslations('ExpensesCapture');
    const tCommon = useTranslations('Common');
    const tModal = useTranslations('ExpensesModal');
    const { colors } = useTheme();

    // Basic state
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [project, setProject] = useState<any>(null);

    // Data for modal
    const [expenseConcepts, setExpenseConcepts] = useState<ExpenseConcept[]>([]);
    const [dailyExpenses, setDailyExpenses] = useState<any[]>([]);
    const [monthlyExpensesDetails, setMonthlyExpensesDetails] = useState<Record<number, Array<{ conceptName: string, total: number }>>>({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        conceptId: '',
        amount: '',
        reference: '',
        paymentChannelId: ''
    });
    const [conceptSearch, setConceptSearch] = useState('');
    const [showConceptDropdown, setShowConceptDropdown] = useState(false);
    const [selectedConcept, setSelectedConcept] = useState<ExpenseConcept | null>(null);
    const [paymentChannels, setPaymentChannels] = useState<PaymentChannel[]>([]);
    const [paymentChannelSearch, setPaymentChannelSearch] = useState('');
    const [showPaymentChannelDropdown, setShowPaymentChannelDropdown] = useState(false);
    const [selectedPaymentChannel, setSelectedPaymentChannel] = useState<PaymentChannel | null>(null);

    // File upload state (Grid)
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingExpenseKey, setUploadingExpenseKey] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

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
            fetchExpenseConcepts();
            fetchPaymentChannels();

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
            fetchMonthlyExpenses();
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

    const fetchExpenseConcepts = async () => {
        try {
            const response = await fetch(`/api/expense-concepts?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setExpenseConcepts(data.data);
            }
        } catch (error) {
            console.error('Error fetching expense concepts:', error);
        }
    };

    const fetchPaymentChannels = async () => {
        try {
            const response = await fetch(`/api/payment-channels?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setPaymentChannels(data.data);
            }
        } catch (error) {
            console.error('Error fetching payment channels:', error);
        }
    };

    const fetchMonthlyExpenses = async () => {
        if (!project || !selectedBranch) return;
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                month: selectedMonth.toString(),
                year: selectedYear.toString()
            });
            const response = await fetch(`/api/expenses/monthly?${params}`);
            const data = await response.json();
            if (data.success) {
                const detailsMap: Record<number, Array<{ conceptName: string, total: number }>> = {};
                data.data.forEach((item: any) => {
                    if (!detailsMap[item.day]) {
                        detailsMap[item.day] = [];
                    }
                    detailsMap[item.day].push({
                        conceptName: item.conceptName,
                        total: item.total
                    });
                });
                setMonthlyExpensesDetails(detailsMap);
            }
        } catch (error) {
            console.error('Error fetching monthly expenses:', error);
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
        await fetchDailyExpenses(date);
        setIsModalOpen(true);
    };

    const fetchDailyExpenses = async (date: Date) => {
        if (!project || !selectedBranch) return;
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                day: date.getDate().toString(),
                month: date.getMonth().toString(),
                year: date.getFullYear().toString()
            });
            const response = await fetch(`/api/expenses/daily?${params}`);
            const data = await response.json();
            if (data.success) {
                setDailyExpenses(data.data);
            }
        } catch (error) {
            console.error('Error fetching daily expenses:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDate || !project || !selectedBranch || !formData.conceptId) return;

        try {
            const formDataToSend = new FormData();
            formDataToSend.append('projectId', project.idProyecto.toString());
            formDataToSend.append('branchId', selectedBranch);
            formDataToSend.append('day', selectedDate.getDate().toString());
            formDataToSend.append('month', selectedDate.getMonth().toString());
            formDataToSend.append('year', selectedDate.getFullYear().toString());
            formDataToSend.append('conceptId', formData.conceptId);
            formDataToSend.append('amount', formData.amount.replace(/[^0-9.]/g, ''));
            formDataToSend.append('reference', formData.reference);
            formDataToSend.append('paymentChannelId', formData.paymentChannelId);

            const response = await fetch('/api/expenses/daily', {
                method: 'POST',
                body: formDataToSend
            });

            if (response.ok) {
                fetchDailyExpenses(selectedDate);
                fetchMonthlyExpenses();
                setFormData({ conceptId: '', amount: '', reference: '', paymentChannelId: '' });
                setConceptSearch('');
                setSelectedConcept(null);
                setPaymentChannelSearch('');
                setSelectedPaymentChannel(null);
            }
        } catch (error) {
            console.error('Error saving expense:', error);
        }
    };

    const handleDeleteExpense = async (expense: any) => {
        if (!window.confirm('¿Está seguro de que desea eliminar este gasto?')) return;

        try {
            const response = await fetch(`/api/expenses/daily?projectId=${project.idProyecto}&branchId=${selectedBranch}&day=${expense.Dia}&month=${expense.Mes - 1}&year=${expense.Anio}&conceptId=${expense.IdConceptoGasto}`, {
                method: 'DELETE'
            });

            if (response.ok && selectedDate) {
                fetchDailyExpenses(selectedDate);
                fetchMonthlyExpenses();
            }
        } catch (error) {
            console.error('Error deleting expense:', error);
        }
    };

    // --- File Upload (Grid) ---
    const handleFileSelect = (expense: any) => {
        const expenseKey = `${expense.Dia}-${expense.Mes}-${expense.Anio}-${expense.IdConceptoGasto}`;
        setUploadingExpenseKey(expenseKey);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && uploadingExpenseKey !== null) {
            const file = e.target.files[0];
            const [day, month, year, conceptId] = uploadingExpenseKey.split('-');
            await handleFileUpload(parseInt(day), parseInt(month), parseInt(year), parseInt(conceptId), file);
        }
    };

    const handleFileUpload = async (day: number, month: number, year: number, conceptId: number, file: File) => {
        setIsUploading(true);
        try {
            const formDataToSend = new FormData();
            formDataToSend.append('projectId', project.idProyecto.toString());
            formDataToSend.append('branchId', selectedBranch);
            formDataToSend.append('day', day.toString());
            formDataToSend.append('month', (month - 1).toString());
            formDataToSend.append('year', year.toString());
            formDataToSend.append('conceptId', conceptId.toString());
            formDataToSend.append('file', file);

            const response = await fetch('/api/expenses/daily', {
                method: 'PUT',
                body: formDataToSend
            });

            if (response.ok && selectedDate) {
                await fetchDailyExpenses(selectedDate);
            } else {
                alert('Error al subir el archivo');
            }
            setUploadingExpenseKey(null);
            setIsUploading(false);
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Error al subir el archivo');
            setIsUploading(false);
            setUploadingExpenseKey(null);
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

    const totalExpenses = dailyExpenses.reduce((sum, exp) => sum + (exp.Gasto || 0), 0);

    return (
        <div className="flex flex-col min-h-screen p-6 gap-4">
            <div className="sticky top-16 z-30 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-sm">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    💸 {t('title')}
                </h1>

                <div className="flex items-center gap-4">
                    {/* Branch Selector */}
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1">{t('selectBranch')}</label>
                        <select
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
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
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
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
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
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
                            const details = monthlyExpensesDetails[dayNum];
                            const hasExpenses = details && details.length > 0;
                            const isToday = new Date().toDateString() === date.toDateString();

                            return (
                                <div
                                    key={index}
                                    onClick={() => handleDayClick(date)}
                                    className={`
                                    aspect-square rounded-xl p-3 cursor-pointer transition-all duration-300
                                    flex flex-col justify-between group relative overflow-hidden
                                    ${isToday
                                            ? 'bg-white border-2 border-red-400 shadow-red-100'
                                            : 'bg-white border border-slate-200/60 hover:border-blue-400 hover:shadow-blue-100'
                                        }
                                    hover:scale-[1.02] hover:shadow-xl shadow-sm
                                `}
                                >
                                    <div className="flex justify-between items-start z-10">
                                        <span className={`text-xl font-black ${isToday ? 'text-red-600' : hasExpenses ? 'text-slate-800' : 'text-slate-400 group-hover:text-blue-600'}`}>
                                            {dayNum}
                                        </span>
                                        {isToday && (
                                            <span className="text-[9px] font-extrabold bg-red-500 text-white px-2 py-0.5 rounded-full shadow-sm animate-pulse tracking-tighter">
                                                {t('today') || 'HOY'}
                                            </span>
                                        )}
                                    </div>
                                    {hasExpenses && (
                                        <div className="space-y-0.5 z-10">
                                            <div className="text-sm font-black text-red-600 leading-tight">
                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(details.reduce((sum, d) => sum + d.total, 0))}
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                {details.length} {details.length === 1 ? 'Concepto' : 'Conceptos'}
                                            </div>
                                        </div>
                                    )}
                                    {/* Decorative background element for hover */}
                                    <div className={`
                                    absolute -right-4 -bottom-4 w-12 h-12 rounded-full opacity-0 group-hover:opacity-10 transition-opacity duration-300
                                    ${isToday ? 'bg-red-600' : 'bg-blue-600'}
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
                    <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
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

                        {/* Hidden File Input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif"
                            onChange={handleFileChange}
                        />

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block tracking-wider">💰 Gasto Total Capturado</label>
                                    <div className="text-xl font-black text-red-600">
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalExpenses)}
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block tracking-wider">🏷️ Conceptos Registrados</label>
                                    <div className="text-xl font-black text-gray-800">
                                        {dailyExpenses.length}
                                    </div>
                                </div>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-red-50 p-6 rounded-xl border border-red-100 items-end shadow-sm">
                                <div className="flex flex-col relative">
                                    <label className="text-xs font-bold text-red-900/60 uppercase tracking-wider mb-2 ml-1">{tModal('concept')}</label>
                                    <input
                                        type="text"
                                        className="w-full p-2.5 bg-white border border-red-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                        value={conceptSearch}
                                        onChange={(e) => {
                                            setConceptSearch(e.target.value);
                                            setShowConceptDropdown(true);
                                            setFormData({ ...formData, conceptId: '' });
                                            setSelectedConcept(null);
                                        }}
                                        onFocus={() => setShowConceptDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowConceptDropdown(false), 200)}
                                        placeholder={tModal('searchConcept')}
                                        required
                                    />
                                    {showConceptDropdown && (
                                        <div className="absolute z-20 w-full top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                            {expenseConcepts
                                                .filter(c => conceptSearch ? c.ConceptoGasto.toLowerCase().includes(conceptSearch.toLowerCase()) : true)
                                                .map(c => (
                                                    <div
                                                        key={c.IdConceptoGasto}
                                                        onClick={() => {
                                                            setSelectedConcept(c);
                                                            setFormData({ ...formData, conceptId: c.IdConceptoGasto.toString(), paymentChannelId: c.IdCanalPago?.toString() || '' });
                                                            setConceptSearch(c.ConceptoGasto);
                                                            setShowConceptDropdown(false);
                                                            if (c.IdCanalPago && c.CanalPago) {
                                                                setSelectedPaymentChannel({ IdCanalPago: c.IdCanalPago, CanalPago: c.CanalPago });
                                                                setPaymentChannelSearch(c.CanalPago);
                                                            } else {
                                                                setSelectedPaymentChannel(null);
                                                                setPaymentChannelSearch('');
                                                            }
                                                        }}
                                                        className="px-4 py-2 hover:bg-red-50 cursor-pointer border-b last:border-0 border-gray-50"
                                                    >
                                                        <div className="font-bold text-sm text-gray-800">{c.ConceptoGasto}</div>
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-xs font-bold text-red-900/60 uppercase tracking-wider mb-2 ml-1">
                                        Referencia
                                        {selectedConcept?.ReferenciaObligatoria === 1 && <span className="text-red-500 ml-1">*</span>}
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full p-2.5 bg-white border border-red-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                        value={formData.reference}
                                        onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                                        placeholder={selectedConcept?.ReferenciaObligatoria === 1 ? "Requerida" : "Opcional"}
                                        required={selectedConcept?.ReferenciaObligatoria === 1}
                                    />
                                </div>

                                <div className="flex flex-col relative">
                                    <label className="text-xs font-bold text-red-900/60 uppercase tracking-wider mb-2 ml-1">Canal de Pago</label>
                                    <input
                                        type="text"
                                        className="w-full p-2.5 bg-white border border-red-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                        value={paymentChannelSearch}
                                        onChange={(e) => {
                                            setPaymentChannelSearch(e.target.value);
                                            setShowPaymentChannelDropdown(true);
                                            setFormData({ ...formData, paymentChannelId: '' });
                                            setSelectedPaymentChannel(null);
                                        }}
                                        onFocus={() => setShowPaymentChannelDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowPaymentChannelDropdown(false), 200)}
                                        placeholder="Buscar canal..."
                                    />
                                    {showPaymentChannelDropdown && (
                                        <div className="absolute z-20 w-full top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                            {paymentChannels
                                                .filter(p => paymentChannelSearch ? p.CanalPago.toLowerCase().includes(paymentChannelSearch.toLowerCase()) : true)
                                                .map(p => (
                                                    <div
                                                        key={p.IdCanalPago}
                                                        onClick={() => {
                                                            setSelectedPaymentChannel(p);
                                                            setFormData({ ...formData, paymentChannelId: p.IdCanalPago.toString() });
                                                            setPaymentChannelSearch(p.CanalPago);
                                                            setShowPaymentChannelDropdown(false);
                                                        }}
                                                        className="px-4 py-2 hover:bg-red-50 cursor-pointer border-b last:border-0 border-gray-50"
                                                    >
                                                        <div className="font-bold text-sm text-gray-800">{p.CanalPago}</div>
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-xs font-bold text-red-900/60 uppercase tracking-wider mb-2 ml-1">{tModal('amount')}</label>
                                    <input
                                        type="text"
                                        className="w-full p-2.5 bg-white border border-red-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
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

                                <button type="submit" className="bg-red-500 text-white p-2.5 rounded-lg hover:bg-red-600 font-bold transition-all shadow-md active:scale-95 lg:col-span-4">
                                    {tModal('add') || 'Agregar Gasto'}
                                </button>
                            </form>

                            {/* Table */}
                            <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col">
                                <div className="overflow-y-auto max-h-[400px]">
                                    <table className="min-w-full divide-y divide-gray-100">
                                        <thead className="bg-gray-50 sticky top-0 z-10 backdrop-blur-sm">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{tModal('concept')}</th>
                                                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Referencia</th>
                                                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Canal</th>
                                                <th className="px-6 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">{tModal('amount')}</th>
                                                <th className="px-6 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Archivo</th>
                                                <th className="px-6 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-50">
                                            {dailyExpenses.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400 italic">No se encontraron registros</td>
                                                </tr>
                                            ) : (
                                                dailyExpenses.map((exp, idx) => (
                                                    <tr key={idx} className="hover:bg-red-50/30 transition-colors group">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">{exp.ConceptoGasto}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{exp.Referencia || '-'}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{exp.CanalPago || '-'}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-right font-black">
                                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(exp.Gasto))}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                                            {exp.NombreArchivo ? (
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <a
                                                                        href={`/api/expenses/download?projectId=${project.idProyecto}&branchId=${selectedBranch}&day=${exp.Dia}&month=${exp.Mes - 1}&year=${exp.Anio}&conceptId=${exp.IdConceptoGasto}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-blue-600 hover:scale-110 transition-transform flex items-center gap-1"
                                                                        title={exp.NombreArchivo}
                                                                    >
                                                                        📎
                                                                    </a>
                                                                    <button
                                                                        onClick={() => handleFileSelect(exp)}
                                                                        className="text-gray-400 hover:text-blue-600 transition-colors"
                                                                        disabled={isUploading}
                                                                        title="Cambiar Archivo"
                                                                    >
                                                                        🔄
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleFileSelect(exp)}
                                                                    className="text-green-600 hover:text-green-800 text-[10px] border border-green-200 bg-green-50 rounded px-2 py-1 flex items-center gap-1 mx-auto font-bold uppercase"
                                                                    disabled={isUploading}
                                                                >
                                                                    📤 Subir
                                                                </button>
                                                            )}
                                                            {isUploading && uploadingExpenseKey === `${exp.Dia}-${exp.Mes}-${exp.Anio}-${exp.IdConceptoGasto}` && (
                                                                <span className="text-[10px] text-blue-500 animate-pulse block mt-1">Subiendo...</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                                            <button
                                                                onClick={() => handleDeleteExpense(exp)}
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
