'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import Input from '@/components/Input';
import QRCode from 'react-qr-code';
import ExpenseImageCaptureModal from '@/components/ExpenseImageCaptureModal';
import PageShell from '@/components/PageShell';
import { CreditCard } from 'lucide-react';

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

interface Provider {
    IdProveedor: number;
    Proveedor: string;
    EsProveedorGasto: number;
}

interface ExpenseDetail {
    IdDetalleGasto: number;
    IdGasto: number;
    Concepto: string;
    Cantidad: number;
    Costo: number;
}


export default function ExpensesCapturePage() {
    const t = useTranslations('ExpensesCapture');
    const tCommon = useTranslations('Common');
    const tModal = useTranslations('ExpensesModal');
    const tDetailsModal = useTranslations('ExpenseDetailsModal');
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
    const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);

    const [formData, setFormData] = useState({
        idGasto: null as number | null,
        conceptId: '',
        providerId: '',
        amount: '',
        reference: '',
        invoiceNumber: '',
        paymentChannelId: ''
    });
    const [conceptSearch, setConceptSearch] = useState('');
    const [showConceptDropdown, setShowConceptDropdown] = useState(false);
    const [selectedConcept, setSelectedConcept] = useState<ExpenseConcept | null>(null);
    
    const [providers, setProviders] = useState<Provider[]>([]);
    const [providerSearch, setProviderSearch] = useState('');
    const [showProviderDropdown, setShowProviderDropdown] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);

    const [paymentChannels, setPaymentChannels] = useState<PaymentChannel[]>([]);
    const [paymentChannelSearch, setPaymentChannelSearch] = useState('');
    const [showPaymentChannelDropdown, setShowPaymentChannelDropdown] = useState(false);
    const [selectedPaymentChannel, setSelectedPaymentChannel] = useState<PaymentChannel | null>(null);

    // Details Modal
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [activeExpense, setActiveExpense] = useState<any>(null);
    const [expenseDetails, setExpenseDetails] = useState<ExpenseDetail[]>([]);
    const [detailFormData, setDetailFormData] = useState({
        id: null as number | null,
        concept: '',
        quantity: '1',
        cost: ''
    });

    // File upload state (Grid)
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingExpenseKey, setUploadingExpenseKey] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Supplier creation modal
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [supplierFormData, setSupplierFormData] = useState({
        proveedor: '',
        rfc: '',
        telefonos: '',
        correoElectronico: '',
        calle: '',
        contacto: ''
    });

    // Concept creation modal
    const [isConceptModalOpen, setIsConceptModalOpen] = useState(false);
    const [conceptFormData, setConceptFormData] = useState({
        concept: '',
        paymentChannelId: ''
    });

    // Form visibility and Preview
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [previewFile, setPreviewFile] = useState<{ content: string, name: string, type: string } | null>(null);


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
            fetchProviders();

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

    const fetchProviders = async () => {
        try {
            const response = await fetch(`/api/suppliers?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setProviders(data.data);
            }
        } catch (error) {
            console.error('Error fetching providers:', error);
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

    const fetchExpenseDetails = async (expenseId: number) => {
        if (!project) return;
        try {
            const response = await fetch(`/api/expenses/details?projectId=${project.idProyecto}&expenseId=${expenseId}`);
            const data = await response.json();
            if (data.success) {
                setExpenseDetails(data.data);
            }
        } catch (error) {
            console.error('Error fetching expense details:', error);
        }
    };

    const handleNewExpense = () => {
        setFormData({
            idGasto: null,
            conceptId: '',
            providerId: '',
            amount: '',
            reference: '',
            invoiceNumber: '',
            paymentChannelId: ''
        });
        setConceptSearch('');
        setProviderSearch('');
        setPaymentChannelSearch('');
        setIsFormOpen(true);
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
            
            if (formData.idGasto) formDataToSend.append('idGasto', formData.idGasto.toString());
            formDataToSend.append('conceptId', formData.conceptId);
            formDataToSend.append('providerId', formData.providerId);
            formDataToSend.append('amount', formData.amount.replace(/[^0-9.]/g, ''));
            formDataToSend.append('reference', formData.reference);
            formDataToSend.append('invoiceNumber', formData.invoiceNumber);
            formDataToSend.append('paymentChannelId', formData.paymentChannelId);

            const response = await fetch('/api/expenses/daily', {
                method: 'POST',
                body: formDataToSend
            });

            if (response.ok) {
                if (selectedDate) fetchDailyExpenses(selectedDate);
                fetchMonthlyExpenses();
                setIsFormOpen(false); // Close form after save
                setFormData({
                    idGasto: null,
                    conceptId: '',
                    providerId: '',
                    amount: '',
                    reference: '',
                    invoiceNumber: '',
                    paymentChannelId: ''
                });
                setConceptSearch('');
                setProviderSearch('');
                setPaymentChannelSearch('');
                setSelectedConcept(null);
                setSelectedProvider(null);
                setSelectedPaymentChannel(null);
            }
        } catch (error) {
            console.error('Error saving expense:', error);
        }
    };

    const handleDeleteExpense = async (expense: any) => {
        if (!window.confirm(tCommon('confirmDelete'))) return;

        try {
            const response = await fetch(`/api/expenses/daily?projectId=${project.idProyecto}&idGasto=${expense.IdGasto}`, {
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

    const handleOpenDetails = async (expense: any) => {
        setActiveExpense(expense);
        setExpenseDetails([]);
        setDetailFormData({ id: null, concept: '', quantity: '1', cost: '' });
        await fetchExpenseDetails(expense.IdGasto);
        setIsDetailModalOpen(true);
    };

    const handleAddDetail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeExpense || !detailFormData.concept) return;

        try {
            const isEditing = detailFormData.id !== null;
            const method = isEditing ? 'PUT' : 'POST';
            
            const payload = {
                projectId: project.idProyecto,
                expenseId: activeExpense.IdGasto,
                concept: detailFormData.concept,
                quantity: parseFloat(detailFormData.quantity),
                cost: parseFloat(detailFormData.cost.replace(/[^0-9.]/g, ''))
            };
            
            if (isEditing) {
                Object.assign(payload, { detailId: detailFormData.id });
            }

            const response = await fetch('/api/expenses/details', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                fetchExpenseDetails(activeExpense.IdGasto);
                if (selectedDate) fetchDailyExpenses(selectedDate);
                setDetailFormData({ id: null, concept: '', quantity: '1', cost: '' });
            }
        } catch (error) {
            console.error('Error saving detail:', error);
        }
    };

    const handleDeleteDetail = async (detailId: number) => {
        if (!window.confirm(tCommon('confirmDelete'))) return;

        try {
            const response = await fetch(`/api/expenses/details?projectId=${project.idProyecto}&detailId=${detailId}`, {
                method: 'DELETE'
            });

            if (response.ok && activeExpense) {
                fetchExpenseDetails(activeExpense.IdGasto);
                if (selectedDate) fetchDailyExpenses(selectedDate);
            }
        } catch (error) {
            console.error('Error deleting detail:', error);
        }
    };

    const handleSaveSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!project || !supplierFormData.proveedor) return;
        try {
            const response = await fetch('/api/suppliers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    proveedor: supplierFormData.proveedor,
                    rfc: supplierFormData.rfc,
                    telefonos: supplierFormData.telefonos,
                    correoElectronico: supplierFormData.correoElectronico,
                    calle: supplierFormData.calle,
                    contacto: supplierFormData.contacto,
                    esProveedorGasto: 1
                })
            });
            if (response.ok) {
                await fetchProviders();
                setIsSupplierModalOpen(false);
                setSupplierFormData({ proveedor: '', rfc: '', telefonos: '', correoElectronico: '', calle: '', contacto: '' });
            }
        } catch (error) {
            console.error('Error saving supplier:', error);
        }
    };

    const handleSaveConcept = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!project || !conceptFormData.concept) return;
        try {
            const response = await fetch('/api/expense-concepts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    concept: conceptFormData.concept,
                    paymentChannelId: conceptFormData.paymentChannelId || null
                })
            });
            if (response.ok) {
                await fetchExpenseConcepts();
                setIsConceptModalOpen(false);
                setConceptFormData({ concept: '', paymentChannelId: '' });
            }
        } catch (error) {
            console.error('Error saving concept:', error);
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
        <PageShell title="Captura de Gastos" icon={CreditCard}>
            <div className="sticky top-16 z-30 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-sm mb-4">
                <div className="flex items-center gap-4">
                    {/* OCR Capture Button */}
                    <div className="flex flex-col">
                        <label className="text-xs text-transparent mb-1">.</label>
                        <button
                            onClick={() => setIsOcrModalOpen(true)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-bold shadow-md shadow-indigo-100 flex items-center gap-2 text-sm"
                            title={t('captureByImage')}
                        >
                            📸 {t('captureByImage')}
                        </button>
                    </div>
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

            {/* Main Modal: Daily Expenses Header */}
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

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block tracking-wider">💰 Gastos Totales</label>
                                    <div className="text-xl font-black text-red-600">
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalExpenses)}
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block tracking-wider">📄 Registros</label>
                                    <div className="text-xl font-black text-gray-800">
                                        {dailyExpenses.length}
                                    </div>
                                </div>
                            </div>

                            {!isFormOpen && (
                                <button
                                    onClick={handleNewExpense}
                                    className="bg-red-500 text-white px-6 py-2.5 rounded-lg hover:bg-red-600 font-bold transition-all shadow-md active:scale-95 self-start flex items-center gap-2"
                                >
                                    📄 {tModal('new') || "Nuevo"}
                                </button>
                            )}

                            {/* Form */}
                            {isFormOpen && (
                                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-red-50 p-6 rounded-xl border border-red-100 items-end shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                                {/* Provider */}
                                <div className="flex flex-col relative text-gray-800">
                                    <label className="text-xs font-bold text-red-900/60 uppercase tracking-wider mb-2 ml-1">{tModal('provider')}</label>
                                    <div className="flex gap-1">
                                        <input
                                            type="text"
                                            className="w-full p-2.5 bg-white border border-red-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                            value={providerSearch}
                                            onChange={(e) => {
                                                setProviderSearch(e.target.value);
                                                setShowProviderDropdown(true);
                                                setFormData({ ...formData, providerId: '' });
                                                setSelectedProvider(null);
                                            }}
                                            onFocus={() => setShowProviderDropdown(true)}
                                            onBlur={() => setTimeout(() => setShowProviderDropdown(false), 200)}
                                            placeholder="Buscar proveedor... (Opcional)"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setIsSupplierModalOpen(true)}
                                            className="p-2.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all"
                                            title={tModal('new') || "Nuevo"}
                                        >
                                            ➕
                                        </button>
                                    </div>
                                    {showProviderDropdown && (
                                        <div className="absolute z-20 w-full top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                            {providers
                                                .filter(p => p.EsProveedorGasto === 1 && (!providerSearch || p.Proveedor.toLowerCase().includes(providerSearch.toLowerCase())))
                                                .map(p => (
                                                    <div
                                                        key={p.IdProveedor}
                                                        onClick={() => {
                                                            setSelectedProvider(p);
                                                            setFormData({ ...formData, providerId: p.IdProveedor.toString() });
                                                            setProviderSearch(p.Proveedor);
                                                            setShowProviderDropdown(false);
                                                        }}
                                                        className="px-4 py-2 hover:bg-red-50 cursor-pointer border-b last:border-0 border-gray-50"
                                                    >
                                                        <div className="font-bold text-sm">{p.Proveedor}</div>
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>

                                {/* Invoice / Factura */}
                                <div className="flex flex-col text-gray-800">
                                    <label className="text-xs font-bold text-red-900/60 uppercase tracking-wider mb-2 ml-1">{tModal('invoiceNumber')}</label>
                                    <input
                                        type="text"
                                        className="w-full p-2.5 bg-white border border-red-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                        value={formData.invoiceNumber}
                                        onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                                        placeholder="Opcional"
                                    />
                                </div>

                                {/* Concept (Header level) */}
                                <div className="flex flex-col relative text-gray-800">
                                    <label className="text-xs font-bold text-red-900/60 uppercase tracking-wider mb-2 ml-1">{tModal('concept')}</label>
                                    <div className="flex gap-1">
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
                                        <button
                                            type="button"
                                            onClick={() => setIsConceptModalOpen(true)}
                                            className="p-2.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all"
                                            title={tModal('new') || "Nuevo"}
                                        >
                                            ➕
                                        </button>
                                    </div>
                                    {showConceptDropdown && (
                                        <div className="absolute z-20 w-full top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                            {expenseConcepts
                                                .filter(c => !conceptSearch || c.ConceptoGasto.toLowerCase().includes(conceptSearch.toLowerCase()))
                                                .map(c => (
                                                    <div
                                                        key={c.IdConceptoGasto}
                                                        onClick={() => {
                                                            setSelectedConcept(c);
                                                            setFormData({ ...formData, conceptId: c.IdConceptoGasto.toString() });
                                                            setConceptSearch(c.ConceptoGasto);
                                                            setShowConceptDropdown(false);
                                                        }}
                                                        className="px-4 py-2 hover:bg-red-50 cursor-pointer border-b last:border-0 border-gray-50"
                                                    >
                                                        <div className="font-bold text-sm">{c.ConceptoGasto}</div>
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>

                                {/* Row 1 Spacer */}
                                <div className="hidden lg:block"></div>


                                {/* Amount */}
                                <div className="flex flex-col text-gray-800">
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
                                        required
                                        placeholder="0.00"
                                    />
                                </div>

                                {/* Payment Channel */}
                                <div className="flex flex-col relative text-gray-800">
                                    <label className="text-xs font-bold text-red-900/60 uppercase tracking-wider mb-2 ml-1">Canal de Pago</label>
                                    <input
                                        type="text"
                                        className="w-full p-2.5 bg-white border border-red-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                        value={paymentChannelSearch}
                                        onChange={(e) => {
                                            setPaymentChannelSearch(e.target.value);
                                            setShowPaymentChannelDropdown(true);
                                            setFormData({ ...formData, paymentChannelId: '' });
                                        }}
                                        onFocus={() => setShowPaymentChannelDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowPaymentChannelDropdown(false), 200)}
                                        placeholder="Buscar canal..."
                                    />
                                    {showPaymentChannelDropdown && (
                                        <div className="absolute z-20 w-full top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                            {paymentChannels
                                                .filter(p => !paymentChannelSearch || p.CanalPago.toLowerCase().includes(paymentChannelSearch.toLowerCase()))
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
                                                        <div className="font-bold text-sm">{p.CanalPago}</div>
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 lg:col-span-2">
                                    <Button type="submit" className="flex-1 md:h-[42px]">
                                        {formData.idGasto ? tModal('editExpense') || "Guardar Cambios" : tModal('addExpense')}
                                    </Button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsFormOpen(false);
                                            setFormData({ idGasto: null, conceptId: '', providerId: '', amount: '', reference: '', invoiceNumber: '', paymentChannelId: '' });
                                        }}
                                        className="px-4 bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 font-bold transition-all h-[42px]"
                                    >
                                        {tCommon('cancel')}
                                    </button>
                                </div>
                            </form>
                            )}

                            {/* Table */}
                            <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col">
                                <div className="overflow-y-auto max-h-[400px]">
                                    <table className="min-w-full divide-y divide-gray-100">
                                        <thead className="bg-gray-50 sticky top-0 z-10 backdrop-blur-sm">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{tModal('provider')}</th>
                                                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{tModal('invoiceNumber')}</th>
                                                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{tModal('concept')}</th>
                                                <th className="px-6 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">{tModal('total')}</th>
                                                <th className="px-6 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">{tModal('file') || "Archivo"}</th>
                                                <th className="px-6 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">{tCommon('Action') || "Acción"}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-50">
                                            {dailyExpenses.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400 italic">{tModal('noRecords') || "No se encontraron registros"}</td>
                                                </tr>
                                            ) : (
                                                dailyExpenses.map((exp, idx) => (
                                                    <tr key={idx} className="hover:bg-red-50/30 transition-colors group">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-bold">{exp.Proveedor || '-'}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{exp.NumeroFactura || exp.Referencia || '-'}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{exp.ConceptoGasto}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-right font-black">
                                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(exp.Total || exp.Gasto))}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                                            {exp.ArchivoDocumento ? (
                                                                <div className="flex items-center justify-center gap-2">
                                                                     <button
                                                                         onClick={() => {
                                                                             setPreviewFile({
                                                                                 content: exp.ArchivoDocumento,
                                                                                 name: exp.NombreArchivo || 'documento',
                                                                                 type: exp.NombreArchivo?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/*'
                                                                             });
                                                                         }}
                                                                         className="relative group w-10 h-10 rounded-lg overflow-hidden border-2 border-gray-100 hover:border-blue-500 transition-all shadow-sm flex items-center justify-center bg-gray-50"
                                                                         title="Ver Documento"
                                                                     >
                                                                         {exp.NombreArchivo?.toLowerCase().endsWith('.pdf') ? (
                                                                             <div className="flex flex-col items-center">
                                                                                <span className="text-[10px] font-black text-red-600">PDF</span>
                                                                                <span className="text-[8px] text-gray-400 uppercase">Ver</span>
                                                                             </div>
                                                                         ) : (
                                                                             <img
                                                                                 src={`data:image/*;base64,${exp.ArchivoDocumento}`}
                                                                                 className="w-full h-full object-cover group-hover:scale-125 transition-transform duration-300"
                                                                                 alt="Miniatura"
                                                                             />
                                                                         )}
                                                                         <div className="absolute inset-0 bg-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                             <span className="text-white text-xs">👁️</span>
                                                                         </div>
                                                                     </button>
                                                                    <button onClick={() => {
                                                                        setUploadingExpenseKey(exp.IdGasto.toString());
                                                                        fileInputRef.current?.click();
                                                                    }} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all" title="Cambiar Archivo">🔄</button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => {
                                                                        setUploadingExpenseKey(exp.IdGasto.toString());
                                                                        fileInputRef.current?.click();
                                                                    }}
                                                                    className="text-green-600 hover:text-green-800 text-[10px] border border-green-200 bg-green-50 rounded px-2 py-1 flex items-center gap-1 mx-auto font-bold uppercase"
                                                                >
                                                                    📤 {tModal('upload') || "Subir"}
                                                                </button>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-center flex items-center justify-center gap-2">
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    setFormData({
                                                                        idGasto: exp.IdGasto,
                                                                        conceptId: exp.IdConceptoGasto?.toString() || '',
                                                                        providerId: exp.IdProveedor?.toString() || '',
                                                                        amount: (exp.Total || exp.Gasto)?.toString() || '',
                                                                        reference: exp.Referencia || '',
                                                                        invoiceNumber: exp.NumeroFactura || '',
                                                                        paymentChannelId: exp.IdCanalPago?.toString() || ''
                                                                    });
                                                                    setConceptSearch(exp.ConceptoGasto || '');
                                                                    setProviderSearch(exp.Proveedor || '');
                                                                    setPaymentChannelSearch(exp.CanalPago || '');
                                                                    setIsFormOpen(true);
                                                                }}
                                                                className="text-gray-300 hover:text-blue-500 transition-colors p-1"
                                                                title="Editar Gasto"
                                                            >
                                                                ✏️
                                                            </button>
                                                            <button
                                                                onClick={() => handleOpenDetails(exp)}
                                                                className="text-gray-300 hover:text-green-500 transition-colors p-1"
                                                                title="Ver/Agregar Detalles"
                                                            >
                                                                📄
                                                            </button>
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


            {/* Secondary Modal: Expense Details */}
            {isDetailModalOpen && activeExpense && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm shadow-2xl">
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-gray-100">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center text-white" style={{ background: `linear-gradient(to right, ${colors.colorFondo1}, ${colors.colorFondo2})`, color: colors.colorLetra }}>
                            <div>
                                <h3 className="text-xl font-black">📝 {tDetailsModal('title')}</h3>
                                <p className="text-xs font-bold opacity-80 uppercase tracking-widest mt-1">
                                    {activeExpense.Proveedor} • {activeExpense.NumeroFactura || activeExpense.Referencia}
                                </p>
                            </div>
                            <button onClick={() => setIsDetailModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-all font-bold">✕</button>
                        </div>

                        <div className="p-6 flex flex-col gap-6 overflow-y-auto">
                            <form onSubmit={handleAddDetail} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                <div className="md:col-span-2 flex flex-col text-gray-800">
                                    <label className="text-xs font-bold text-blue-900/60 uppercase mb-2">{tDetailsModal('concept')}</label>
                                    <input
                                        type="text"
                                        className="w-full p-2.5 bg-white border border-blue-200 rounded-lg text-sm"
                                        value={detailFormData.concept}
                                        onChange={(e) => setDetailFormData({ ...detailFormData, concept: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="flex flex-col text-gray-800">
                                    <label className="text-xs font-bold text-blue-900/60 uppercase mb-2">{tDetailsModal('quantity')}</label>
                                    <input
                                        type="number"
                                        step="any"
                                        className="w-full p-2.5 bg-white border border-blue-200 rounded-lg text-sm"
                                        value={detailFormData.quantity}
                                        onChange={(e) => setDetailFormData({ ...detailFormData, quantity: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="flex flex-col text-gray-800">
                                    <label className="text-xs font-bold text-blue-900/60 uppercase mb-2">{tDetailsModal('cost')}</label>
                                    <input
                                        type="text"
                                        className="w-full p-2.5 bg-white border border-blue-200 rounded-lg text-sm"
                                        value={detailFormData.cost}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9.]/g, '');
                                            if ((val.match(/\./g) || []).length > 1) return;
                                            setDetailFormData({ ...detailFormData, cost: val });
                                        }}
                                        required
                                    />
                                </div>
                                <Button type="submit" className="md:col-span-4">
                                    {detailFormData.id ? tModal('editExpense') : tDetailsModal('add')}
                                </Button>
                            </form>

                            <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                                <table className="min-w-full divide-y divide-gray-100">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{tDetailsModal('concept')}</th>
                                            <th className="px-6 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">{tDetailsModal('quantity')}</th>
                                            <th className="px-6 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">{tDetailsModal('cost')}</th>
                                            <th className="px-6 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">{tModal('total')}</th>
                                            <th className="px-6 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">{tCommon('actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-50 text-gray-800 font-medium">
                                        {expenseDetails.length === 0 ? (
                                            <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400 italic">{tDetailsModal('noDetails')}</td></tr>
                                        ) : (
                                            expenseDetails.map((detail, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-6 py-4 text-sm">{detail.Concepto}</td>
                                                    <td className="px-6 py-4 text-sm text-center">{detail.Cantidad}</td>
                                                    <td className="px-6 py-4 text-sm text-right">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(detail.Costo)}</td>
                                                    <td className="px-6 py-4 text-sm text-right font-bold text-red-600">
                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(detail.Cantidad * detail.Costo)}
                                                    </td>
                                                    <td className="px-6 py-4 text-center flex items-center justify-center gap-2">
                                                        <button 
                                                            onClick={e => {
                                                                e.preventDefault();
                                                                setDetailFormData({
                                                                    id: detail.IdDetalleGasto,
                                                                    concept: detail.Concepto,
                                                                    quantity: detail.Cantidad.toString(),
                                                                    cost: detail.Costo.toString()
                                                                });
                                                            }}
                                                            className="text-gray-300 hover:text-blue-500 transition-colors p-1"
                                                            title={tCommon('edit') || "Editar"}
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteDetail(detail.IdDetalleGasto)} 
                                                            className="text-gray-300 hover:text-red-500 transition-colors p-1"
                                                            title={tCommon('delete') || "Eliminar"}
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

                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                            <div className="text-sm font-black text-gray-500 uppercase">Total: <span className="text-xl text-red-600 ml-2">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(expenseDetails.reduce((s, d) => s + (d.Cantidad * d.Costo), 0))}</span></div>
                            <button onClick={() => setIsDetailModalOpen(false)} className="px-8 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-bold transition-all text-sm uppercase">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={async (e) => {
                    if (e.target.files && e.target.files[0] && uploadingExpenseKey) {
                        const file = e.target.files[0];
                        const formDataToSend = new FormData();
                        formDataToSend.append('projectId', project.idProyecto.toString());
                        formDataToSend.append('idGasto', uploadingExpenseKey);
                        formDataToSend.append('file', file);
                        const res = await fetch('/api/expenses/daily', { method: 'PUT', body: formDataToSend });
                        if (res.ok && selectedDate) fetchDailyExpenses(selectedDate);
                        setUploadingExpenseKey(null);
                    }
                }}
            />

            {/* Supplier Modal */}
            {isSupplierModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center text-white" style={{ background: `linear-gradient(to right, ${colors.colorFondo1}, ${colors.colorFondo2})`, color: colors.colorLetra }}>
                            <h3 className="text-xl font-black uppercase tracking-tight">🏢 Nuevo Proveedor</h3>
                            <button onClick={() => setIsSupplierModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-all font-bold">✕</button>
                        </div>
                        <form onSubmit={handleSaveSupplier} className="p-6 flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Nombre / Razón Social</label>
                                <Input label="" value={supplierFormData.proveedor} onChange={e => setSupplierFormData({ ...supplierFormData, proveedor: e.target.value })} required />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500 uppercase ml-1">RFC</label>
                                <Input label="" value={supplierFormData.rfc} onChange={e => setSupplierFormData({ ...supplierFormData, rfc: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Teléfonos</label>
                                    <Input label="" value={supplierFormData.telefonos} onChange={e => setSupplierFormData({ ...supplierFormData, telefonos: e.target.value })} />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Correo</label>
                                    <Input label="" type="email" value={supplierFormData.correoElectronico} onChange={e => setSupplierFormData({ ...supplierFormData, correoElectronico: e.target.value })} />
                                </div>
                            </div>
                            <Button type="submit" className="mt-2">Guardar Proveedor</Button>
                        </form>
                    </div>
                </div>
            )}

            {/* Concept Modal */}
            {isConceptModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center text-white" style={{ background: `linear-gradient(to right, ${colors.colorFondo1}, ${colors.colorFondo2})`, color: colors.colorLetra }}>
                            <h3 className="text-xl font-black uppercase tracking-tight">🏷️ Nuevo Concepto</h3>
                            <button onClick={() => setIsConceptModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-all font-bold">✕</button>
                        </div>
                        <form onSubmit={handleSaveConcept} className="p-6 flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Nombre del Concepto</label>
                                <Input label="" value={conceptFormData.concept} onChange={e => setConceptFormData({ ...conceptFormData, concept: e.target.value })} required />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Canal de Pago Sugerido</label>
                                <select 
                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                                    value={conceptFormData.paymentChannelId}
                                    onChange={(e) => setConceptFormData({ ...conceptFormData, paymentChannelId: e.target.value })}
                                >
                                    <option value="">Ninguno</option>
                                    {paymentChannels.map(pc => (
                                        <option key={pc.IdCanalPago} value={pc.IdCanalPago}>{pc.CanalPago}</option>
                                    ))}
                                </select>
                            </div>
                            <Button type="submit" className="mt-2">Guardar Concepto</Button>
                        </form>
                    </div>
                </div>
            )}

            {/* OCR Modal */}
            {isOcrModalOpen && (
                <ExpenseImageCaptureModal
                    isOpen={isOcrModalOpen}
                    onClose={() => setIsOcrModalOpen(false)}
                    projectId={project?.idProyecto}
                    selectedBranchId={selectedBranch}
                    selectedMonth={selectedDate ? selectedDate.getMonth() : new Date().getMonth()}
                    selectedYear={selectedDate ? selectedDate.getFullYear() : new Date().getFullYear()}
                    onSuccess={() => {
                        if (selectedDate) fetchDailyExpenses(selectedDate);
                        fetchMonthlyExpenses();
                        setIsOcrModalOpen(false);
                    }}
                />
            )}

            {/* Preview Modal */}
            {previewFile && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-md">
                    <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <div className="flex flex-col">
                                <h3 className="font-bold text-gray-800">{previewFile.name}</h3>
                                <button 
                                    onClick={() => {
                                        const byteCharacters = atob(previewFile.content);
                                        const byteNumbers = new Array(byteCharacters.length);
                                        for (let i = 0; i < byteCharacters.length; i++) { byteNumbers[i] = byteCharacters.charCodeAt(i); }
                                        const byteArray = new Uint8Array(byteNumbers);
                                        const blob = new Blob([byteArray], { type: previewFile.type });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = previewFile.name;
                                        a.click();
                                    }}
                                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                >
                                    📥 Descargar original
                                </button>
                            </div>
                            <button onClick={() => setPreviewFile(null)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 transition-all text-gray-500 font-bold">✕</button>
                        </div>
                        <div className="flex-1 bg-gray-200 overflow-hidden flex items-center justify-center p-4">
                            {previewFile.type === 'application/pdf' ? (
                                <iframe
                                    src={`data:application/pdf;base64,${previewFile.content}#toolbar=0`}
                                    className="w-full h-full rounded-lg"
                                />
                            ) : (
                                <img
                                    src={`data:image/*;base64,${previewFile.content}`}
                                    className="max-w-full max-h-full object-contain shadow-lg rounded-lg"
                                    alt="Vista previa"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </PageShell>
    );
}

