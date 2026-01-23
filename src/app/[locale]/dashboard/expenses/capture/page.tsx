'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

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
                const savedBranch = localStorage.getItem('lastSelectedBranch');
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
                // Group expenses by day and concept
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
                month: date.getMonth().toString(), // 0-11
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
            formDataToSend.append('amount', formData.amount);
            formDataToSend.append('reference', formData.reference);
            formDataToSend.append('paymentChannelId', formData.paymentChannelId);

            const response = await fetch('/api/expenses/daily', {
                method: 'POST',
                body: formDataToSend
            });

            if (response.ok) {
                fetchDailyExpenses(selectedDate);
                fetchMonthlyExpenses(); // Refresh monthly totals
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
                fetchMonthlyExpenses(); // Refresh monthly totals
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
            formDataToSend.append('month', (month - 1).toString()); // Convert from SQL (1-12) to JS (0-11)
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
    const tModal = useTranslations('ExpensesModal');

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

            {/* Calendar */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col">
                <div className="grid grid-cols-7 bg-red-500 border-b border-red-600">
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
                                    relative border-b border-r border-gray-300 p-2 transition-all hover:bg-red-50 cursor-pointer group min-h-[120px] flex flex-col
                                    ${isToday ? 'bg-red-50/30' : ''}
                                `}
                            >
                                <span className={`
                                    text-sm font-medium
                                    ${isToday ? 'bg-red-500 text-white px-2 py-1 rounded-full' : isWeekend ? 'text-gray-400' : 'text-gray-700'}
                                `}>
                                    {date.getDate()}
                                </span>
                                {monthlyExpensesDetails[date.getDate()] && (
                                    <>
                                        <div className="mt-6 space-y-1 flex-1">
                                            {monthlyExpensesDetails[date.getDate()].map((exp, idx) => (
                                                <div key={idx} className="text-xs">
                                                    <div className="font-medium text-gray-700">{exp.conceptName}</div>
                                                    <div className="font-semibold text-red-600">${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(exp.total)}</div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                            <div className="text-xs font-bold text-red-700">
                                                Total: ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(monthlyExpensesDetails[date.getDate()].reduce((sum, exp) => sum + exp.total, 0))}
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col gap-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">
                                {tModal('title')} - {selectedDate.toLocaleDateString()}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700 text-xl font-bold">✕</button>
                        </div>

                        {/* Hidden File Input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif"
                            onChange={handleFileChange}
                        />


                        {/* Form */}
                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg items-end">
                            {/* 1. Concepto */}
                            <div className="flex flex-col relative">
                                <label className="text-xs font-semibold text-gray-600 mb-1">{tModal('concept')}</label>
                                <input
                                    type="text"
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
                                    className="p-2 border rounded text-sm w-full"
                                    required
                                />
                                {showConceptDropdown && (
                                    <div className="absolute z-10 w-full mt-1 top-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
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

                                                        // Auto-fill payment channel if concept has default
                                                        if (c.IdCanalPago && c.CanalPago) {
                                                            setSelectedPaymentChannel({
                                                                IdCanalPago: c.IdCanalPago,
                                                                CanalPago: c.CanalPago
                                                            });
                                                            setPaymentChannelSearch(c.CanalPago);
                                                        } else {
                                                            setSelectedPaymentChannel(null);
                                                            setPaymentChannelSearch('');
                                                        }
                                                    }}
                                                    className="px-3 py-2 hover:bg-red-50 cursor-pointer"
                                                >
                                                    <div className="font-medium text-sm">{c.ConceptoGasto}</div>
                                                </div>
                                            ))}
                                        {expenseConcepts.filter(c => conceptSearch ? c.ConceptoGasto.toLowerCase().includes(conceptSearch.toLowerCase()) : true).length === 0 && (
                                            <div className="px-3 py-2 text-sm text-gray-400 italic">
                                                {tModal('noResults')}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* 2. Referencia */}
                            <div className="flex flex-col">
                                <label className="text-xs font-semibold text-gray-600 mb-1">
                                    Referencia/Concepto
                                    {selectedConcept?.ReferenciaObligatoria === 1 && (
                                        <span className="text-red-500 ml-1">*</span>
                                    )}
                                </label>
                                <input
                                    type="text"
                                    className="p-2 border rounded text-sm"
                                    value={formData.reference}
                                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                                    placeholder={selectedConcept?.ReferenciaObligatoria === 1 ? "Referencia requerida" : "Referencia opcional"}
                                    required={selectedConcept?.ReferenciaObligatoria === 1}
                                />
                            </div>

                            {/* 3. Canal de Pago */}
                            <div className="flex flex-col relative">
                                <label className="text-xs font-semibold text-gray-600 mb-1">Canal de Pago</label>
                                <input
                                    type="text"
                                    value={paymentChannelSearch}
                                    onChange={(e) => {
                                        setPaymentChannelSearch(e.target.value);
                                        setShowPaymentChannelDropdown(true);
                                        setFormData({ ...formData, paymentChannelId: '' });
                                        setSelectedPaymentChannel(null);
                                    }}
                                    onFocus={() => setShowPaymentChannelDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowPaymentChannelDropdown(false), 200)}
                                    placeholder="Buscar canal de pago"
                                    className="p-2 border rounded text-sm w-full"
                                />
                                {showPaymentChannelDropdown && (
                                    <div className="absolute z-10 w-full mt-1 top-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
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
                                                    className="px-3 py-2 hover:bg-red-50 cursor-pointer"
                                                >
                                                    <div className="font-medium text-sm">{p.CanalPago}</div>
                                                </div>
                                            ))}
                                        {paymentChannels.filter(p => paymentChannelSearch ? p.CanalPago.toLowerCase().includes(paymentChannelSearch.toLowerCase()) : true).length === 0 && (
                                            <div className="px-3 py-2 text-sm text-gray-400 italic">
                                                No se encontraron canales de pago
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* 4. Monto */}
                            <div className="flex flex-col">
                                <label className="text-xs font-semibold text-gray-600 mb-1">{tModal('amount')}</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="p-2 border rounded text-sm"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    required
                                />
                            </div>

                            <button type="submit" className="bg-red-500 text-white p-2 rounded hover:bg-red-600 font-medium h-10 shadow-sm transition-colors md:col-span-4">
                                Agregar
                            </button>
                        </form>

                        {/* Grid */}
                        <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{tModal('concept')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Referencia</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Canal de Pago</th>
                                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{tModal('amount')}</th>
                                        <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Archivo</th>
                                        <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {dailyExpenses.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400 italic">No records found</td>
                                        </tr>
                                    ) : (
                                        dailyExpenses.map((exp, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{exp.ConceptoGasto}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{exp.Referencia || '-'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{exp.CanalPago || '-'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                                                    ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(exp.Gasto))}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                                    {exp.NombreArchivo ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <a
                                                                href={`/api/expenses/download?projectId=${project.idProyecto}&branchId=${selectedBranch}&day=${exp.Dia}&month=${exp.Mes - 1}&year=${exp.Anio}&conceptId=${exp.IdConceptoGasto}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-blue-600 hover:underline text-[10px] flex items-center gap-1"
                                                                title={exp.NombreArchivo}
                                                            >
                                                                📎 {exp.NombreArchivo.length > 20 ? exp.NombreArchivo.substring(0, 17) + '...' : exp.NombreArchivo}
                                                            </a>
                                                            <button
                                                                onClick={() => handleFileSelect(exp)}
                                                                className="text-gray-400 hover:text-blue-600 text-[10px] border rounded px-1"
                                                                disabled={isUploading}
                                                                title="Cambiar Archivo"
                                                            >
                                                                🔄
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleFileSelect(exp)}
                                                            className="text-green-600 hover:text-green-800 text-[10px] border border-green-200 bg-green-50 rounded px-2 py-1 flex items-center gap-1 mx-auto"
                                                            disabled={isUploading}
                                                        >
                                                            📤 Subir
                                                        </button>
                                                    )}
                                                    {isUploading && uploadingExpenseKey === `${exp.Dia}-${exp.Mes}-${exp.Anio}-${exp.IdConceptoGasto}` && (
                                                        <span className="text-[10px] text-blue-500 animate-pulse block mt-1">Subiendo...</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                                    <button
                                                        onClick={() => handleDeleteExpense(exp)}
                                                        className="text-xl hover:scale-110 transition-transform"
                                                        title="Eliminar gasto"
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                <tfoot className="bg-gray-50 font-bold border-t border-gray-200">
                                    <tr>
                                        <td colSpan={3} className="px-6 py-4 text-right text-gray-700 uppercase text-xs tracking-wider">{tModal('total')}</td>
                                        <td className="px-6 py-4 text-right text-red-600 text-lg">${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalExpenses)}</td>
                                        <td colSpan={2}></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-100">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                            >
                                {tModal('close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
