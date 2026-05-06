'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { 
    getDashboardSelectedBranch, 
    setDashboardSelectedBranch, 
    getDashboardSelectedMonth, 
    getDashboardSelectedYear, 
    setDashboardSelectedMonth, 
    setDashboardSelectedYear 
} from '@/lib/storage';
import BranchSelector from '@/components/BranchSelector';
import MonthSelector from '@/components/MonthSelector';
import YearSelector from '@/components/YearSelector';
import Button from '@/components/Button';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import BreakEvenProductImageCaptureModal from '@/components/BreakEvenProductImageCaptureModal';
import MassiveProductUpload from '@/components/MassiveProductUpload';

interface RepresentativeProduct {
    IdProducto?: number;
    NombreProducto: string;
    CostoMateriaPrima: number;
    Empaque: number;
}

interface FixedExpense {
    IdGasto?: number;
    ConceptoGasto: string;
    Monto: number;
}

export default function BreakEvenPage() {
    const t = useTranslations('BreakEven');
    const [project, setProject] = useState<any>(null);
    const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<string | null>(null);

    // Form states
    const [priceTicket, setPriceTicket] = useState<number>(0);
    const [volumeTickets, setVolumeTickets] = useState<number>(0);
    const [representativeProducts, setRepresentativeProducts] = useState<RepresentativeProduct[]>([]);
    const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);

    // Modal states
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [newProduct, setNewProduct] = useState<RepresentativeProduct>({ NombreProducto: '', CostoMateriaPrima: 0, Empaque: 0 });
    const [newExpense, setNewExpense] = useState<FixedExpense>({ ConceptoGasto: '', Monto: 0 });
    const [editingProductIndex, setEditingProductIndex] = useState<number | null>(null);
    const [editingExpenseIndex, setEditingExpenseIndex] = useState<number | null>(null);
    const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
    const [isMassiveExcelModalOpen, setIsMassiveExcelModalOpen] = useState(false);

    // Full screen modals for editing all items
    const [isFullProductsModalOpen, setIsFullProductsModalOpen] = useState(false);
    const [isFullExpensesModalOpen, setIsFullExpensesModalOpen] = useState(false);

    // Refs for autosave
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }

        // Initialize selectors from storage
        const branchId = getDashboardSelectedBranch();
        const month = getDashboardSelectedMonth();
        const year = getDashboardSelectedYear();

        if (branchId) setSelectedBranch(branchId);
        setSelectedMonth(month);
        setSelectedYear(year);

        // Sync with storage events
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'dashboardSelectedBranch') {
                const val = getDashboardSelectedBranch();
                if (val) setSelectedBranch(val);
            } else if (e.key === 'lastSelectedMonth') {
                const val = getDashboardSelectedMonth();
                setSelectedMonth(val);
            } else if (e.key === 'lastSelectedYear') {
                const val = getDashboardSelectedYear();
                setSelectedYear(val);
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    useEffect(() => {
        if (selectedBranch !== null && selectedMonth !== undefined && selectedYear !== undefined) {
            fetchBreakEvenData();
        }
    }, [selectedBranch, selectedMonth, selectedYear]);

    const fetchBreakEvenData = async () => {
        if (!selectedBranch || !project?.idProyecto) return;
        setIsLoading(true);
        try {
            // API expects 1-indexed month
            const response = await fetch(`/api/config/break-even?projectId=${project.idProyecto}&branchId=${selectedBranch}&month=${selectedMonth + 1}&year=${selectedYear}`);
            const data = await response.json();
            if (data.success && data.data) {
                setPriceTicket(data.data.PrecioTicket || 0);
                setVolumeTickets(data.data.VolumenTickets || 0);
                setRepresentativeProducts(data.data.representativeProducts || []);
                setFixedExpenses(data.data.fixedExpenses || []);
                if (data.data.FechaAct) {
                    setLastSaved(new Date(data.data.FechaAct).toLocaleString());
                } else {
                    setLastSaved(null);
                }
            } else {
                setPriceTicket(0);
                setVolumeTickets(0);
                setRepresentativeProducts([]);
                setFixedExpenses([]);
                setLastSaved(null);
            }
        } catch (error) {
            console.error('Error fetching break-even data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBranchChange = (branchId: number) => {
        setSelectedBranch(branchId);
        setDashboardSelectedBranch(branchId);
    };

    const handleMonthChange = (month: number) => {
        setSelectedMonth(month);
        setDashboardSelectedMonth(month);
    };

    const handleYearChange = (year: number) => {
        setSelectedYear(year);
        setDashboardSelectedYear(year);
    };

    const flushSave = async () => {
        if (!selectedBranch || !project?.idProyecto) return;
        setIsSaving(true);
        try {
            const response = await fetch('/api/config/break-even', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    branchId: selectedBranch,
                    month: selectedMonth + 1, // 1-indexed
                    year: selectedYear,
                    price: priceTicket,
                    volume: volumeTickets,
                    representativeProducts,
                    fixedExpenses
                })
            });
            const data = await response.json();
            if (data.success) {
                setLastSaved(new Date().toLocaleString());
            }
        } catch (error) {
            console.error('Error saving break-even data:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const triggerAutoSave = () => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(flushSave, 2000);
    };

    const handleImportPreviousMonth = async () => {
        if (!selectedBranch || !project?.idProyecto) return;
        
        let prevMonth = selectedMonth; // Since selectedMonth is 0-indexed, if current is 0 (Jan), prev is -1.
        let prevYear = selectedYear;
        if (prevMonth === 0) {
            prevMonth = 11; // Dec
            prevYear -= 1;
        } else {
            prevMonth -= 1;
        }

        if (!confirm(`¿Deseas importar los datos del mes anterior? Esto reemplazará los datos actuales.`)) return;

        setIsLoading(true);
        try {
            const response = await fetch(`/api/config/break-even?projectId=${project.idProyecto}&branchId=${selectedBranch}&month=${prevMonth + 1}&year=${prevYear}`);
            const data = await response.json();
            if (data.success && data.data) {
                setPriceTicket(data.data.PrecioTicket || 0);
                setVolumeTickets(data.data.VolumenTickets || 0);
                setRepresentativeProducts(data.data.representativeProducts || []);
                setFixedExpenses(data.data.fixedExpenses || []);
                triggerAutoSave();
            } else {
                alert('No se encontraron datos en el mes anterior.');
            }
        } catch (error) {
            console.error('Error importing previous month data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddProduct = () => {
        if (editingProductIndex !== null) {
            const updated = [...representativeProducts];
            updated[editingProductIndex] = newProduct;
            setRepresentativeProducts(updated);
        } else {
            setRepresentativeProducts([...representativeProducts, newProduct]);
        }
        setIsProductModalOpen(false);
        setNewProduct({ NombreProducto: '', CostoMateriaPrima: 0, Empaque: 0 });
        setEditingProductIndex(null);
        triggerAutoSave();
    };

    const handleAddExpense = () => {
        if (editingExpenseIndex !== null) {
            const updated = [...fixedExpenses];
            updated[editingExpenseIndex] = newExpense;
            setFixedExpenses(updated);
        } else {
            setFixedExpenses([...fixedExpenses, newExpense]);
        }
        setIsExpenseModalOpen(false);
        setNewExpense({ ConceptoGasto: '', Monto: 0 });
        setEditingExpenseIndex(null);
        triggerAutoSave();
    };

    const removeProduct = (index: number) => {
        const updated = representativeProducts.filter((_, i) => i !== index);
        setRepresentativeProducts(updated);
        triggerAutoSave();
    };

    const removeExpense = (index: number) => {
        const updated = fixedExpenses.filter((_, i) => i !== index);
        setFixedExpenses(updated);
        triggerAutoSave();
    };

    const handleAddOcrProducts = (products: any[]) => {
        // Map from modal format to API format
        const mapped = products.map(p => ({
            NombreProducto: p.name,
            CostoMateriaPrima: p.rawMaterial,
            Empaque: p.packaging
        }));
        setRepresentativeProducts(prev => [...prev, ...mapped]);
        triggerAutoSave();
    };

    // Calculations
    const avgVariableCostPercentage = representativeProducts.length > 0 
        ? representativeProducts.reduce((acc, p) => acc + (p.CostoMateriaPrima + p.Empaque), 0) / representativeProducts.length
        : 0;

    const totalFixedExpenses = fixedExpenses.reduce((acc, e) => acc + e.Monto, 0);
    const contributionMargin = 100 - avgVariableCostPercentage;
    const breakEvenSales = contributionMargin > 0 ? (totalFixedExpenses / (contributionMargin / 100)) : 0;
    const dailyBreakEven = breakEvenSales / 30;

    const monthlySalesGoal = priceTicket * volumeTickets;

    const handleExportPDF = () => {
        const doc = new jsPDF();
        
        doc.setFontSize(20);
        doc.text('Análisis de Punto de Equilibrio', 14, 22);
        doc.setFontSize(10);
        doc.text(`Período: ${selectedMonth + 1}/${selectedYear}`, 14, 30);

        autoTable(doc, {
            startY: 40,
            head: [['Indicador', 'Valor']],
            body: [
                ['Venta Mensual de Equilibrio', `$${breakEvenSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
                ['Venta Diaria de Equilibrio', `$${dailyBreakEven.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
                ['Margen de Contribución Promedio', `${contributionMargin.toFixed(2)}%`],
                ['Venta Planeada (Precio x Volumen)', `$${monthlySalesGoal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`]
            ],
        });

        doc.text('Productos Representativos', 14, (doc as any).lastAutoTable.finalY + 15);
        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 20,
            head: [['Producto', '% Materia Prima', '% Empaque', 'Total Variable']],
            body: representativeProducts.map(p => [
                p.NombreProducto, 
                `${p.CostoMateriaPrima}%`, 
                `${p.Empaque}%`, 
                `${(p.CostoMateriaPrima + p.Empaque).toFixed(2)}%`
            ]),
        });

        doc.text('Gastos Fijos Mensuales', 14, (doc as any).lastAutoTable.finalY + 15);
        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 20,
            head: [['Concepto', 'Monto']],
            body: fixedExpenses.map(e => [e.ConceptoGasto, `$${e.Monto.toLocaleString()}`]),
        });

        doc.save(`Punto_Equilibrio_${selectedMonth + 1}_${selectedYear}.pdf`);
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-20">
            {/* STICKY HEADER */}
            <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 shadow-sm">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                            <span className="bg-orange-600 text-white p-1 rounded-lg">📊</span>
                            {t('title')}
                        </h1>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">Define tus metas financieras y analiza tu rentabilidad</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                        <BranchSelector selectedBranch={selectedBranch} onBranchChange={handleBranchChange} />
                        <div className="h-6 w-px bg-slate-300 mx-1"></div>
                        <MonthSelector selectedMonth={selectedMonth} onMonthChange={handleMonthChange} />
                        <YearSelector selectedYear={selectedYear} onYearChange={handleYearChange} />
                        <div className="h-6 w-px bg-slate-300 mx-1"></div>
                        <Button 
                            onClick={handleExportPDF}
                            className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 text-xs px-4 py-2 rounded-xl shadow-sm font-bold h-10"
                        >
                            PDF 📤
                        </Button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* AUTO-SAVE INDICATOR & QUICK ACTIONS */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {isSaving ? (
                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-100 animate-pulse">
                                <span className="w-1.5 h-1.5 bg-orange-600 rounded-full"></span>
                                Guardando...
                            </span>
                        ) : lastSaved ? (
                            <span className="text-[10px] font-bold text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                                ✅ Guardado: {lastSaved}
                            </span>
                        ) : null}
                    </div>
                    <button 
                        onClick={handleImportPreviousMonth}
                        className="text-[10px] font-black uppercase tracking-widest text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-4 py-2 rounded-xl border border-orange-100 transition-all flex items-center gap-2"
                    >
                        <span>🔄</span> Importar datos del mes anterior
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* LEFT COLUMN: INPUTS */}
                    <div className="lg:col-span-8 space-y-6">
                        
                        {/* BLOCK 1: SALES GOAL */}
                        <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-xl shadow-sm">🎯</div>
                                    <div>
                                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">{t('salesGoal')}</h2>
                                        <p className="text-[10px] text-slate-400 font-bold italic">Expectativa de ventas para este mes</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-2 ml-1">Precio Promedio de Ticket</label>
                                        <div className="relative group">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xl group-focus-within:text-indigo-500 transition-colors">$</span>
                                            <input 
                                                type="number"
                                                value={priceTicket || ''}
                                                onChange={(e) => {
                                                    setPriceTicket(parseFloat(e.target.value) || 0);
                                                    triggerAutoSave();
                                                }}
                                                placeholder="0.00"
                                                className="w-full pl-10 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xl font-black text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-2 ml-1">Volumen de Tickets</label>
                                        <div className="relative group">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xl group-focus-within:text-indigo-500 transition-colors">#</span>
                                            <input 
                                                type="number"
                                                value={volumeTickets || ''}
                                                onChange={(e) => {
                                                    setVolumeTickets(parseFloat(e.target.value) || 0);
                                                    triggerAutoSave();
                                                }}
                                                placeholder="0"
                                                className="w-full pl-10 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xl font-black text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6 pt-6 border-t border-slate-50 flex justify-between items-center">
                                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Meta de Venta Calculada:</span>
                                    <span className="text-2xl font-black text-indigo-600">${monthlySalesGoal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>

                        {/* BLOCK 2: VARIABLE COSTS */}
                        <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center text-xl shadow-sm">🧪</div>
                                    <div>
                                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">{t('variableCosts')}</h2>
                                        <div className="flex items-center gap-2 ml-1">
                                            <p className="text-[10px] text-orange-600/70 font-bold italic leading-none">{t('variableCostSuggestion')}</p>
                                            {representativeProducts.length > 0 && (
                                                <span className="text-[9px] font-black bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full border border-orange-200">
                                                    {representativeProducts.length} {representativeProducts.length === 1 ? 'PRODUCTO' : 'PRODUCTOS'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setIsFullProductsModalOpen(true)}
                                        className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-500 transition-all active:scale-95 border border-slate-200"
                                        title="Expandir"
                                    >
                                        ↖️
                                    </button>
                                    <button 
                                        onClick={() => setIsMassiveExcelModalOpen(true)}
                                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-xl text-[10px] font-black uppercase text-emerald-600 border border-emerald-200 active:scale-95 transition-all flex items-center gap-2"
                                        title="Carga Masiva Excel"
                                    >
                                        📊 Excel
                                    </button>
                                    <button 
                                        onClick={() => setIsOcrModalOpen(true)}
                                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-[10px] font-black uppercase text-indigo-600 border border-indigo-200 active:scale-95 transition-all flex items-center gap-2"
                                        title="Carga Masiva Imagen"
                                    >
                                        📸 Imagen
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setNewProduct({ NombreProducto: '', CostoMateriaPrima: 0, Empaque: 0 });
                                            setEditingProductIndex(null);
                                            setIsProductModalOpen(true);
                                        }}
                                        className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 rounded-xl text-[10px] font-black uppercase text-white shadow-sm active:scale-95 transition-all flex items-center gap-2"
                                    >
                                        <span className="text-sm">+</span> {t('addProduct')}
                                    </button>
                                </div>
                            </div>
                            <div className="p-8">
                                <div className="space-y-2">
                                    {representativeProducts.length > 0 && (
                                        <div className="mb-4 space-y-2 max-h-[250px] overflow-y-auto pr-1">
                                            {representativeProducts.map((p, idx) => (
                                                <div key={idx} className="flex items-center justify-between gap-2 p-2 bg-orange-50/30 rounded-xl border border-orange-100/50 shadow-sm">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-black text-slate-800 truncate">{p.NombreProducto}</p>
                                                        <div className="flex gap-2 mt-0.5">
                                                            <span className="text-[9px] text-slate-400 font-bold">MP: {p.CostoMateriaPrima}%</span>
                                                            <span className="text-[9px] text-slate-400 font-bold">EMP: {p.Empaque}%</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[11px] font-black text-orange-600">{(p.CostoMateriaPrima + p.Empaque).toFixed(1)}%</span>
                                                        <div className="flex gap-1">
                                                            <button 
                                                                onClick={() => {
                                                                    setNewProduct(p);
                                                                    setEditingProductIndex(idx);
                                                                    setIsProductModalOpen(true);
                                                                }}
                                                                className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                                                            >
                                                                ✏️
                                                            </button>
                                                            <button 
                                                                onClick={() => removeProduct(idx)}
                                                                className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 -mx-8 px-8 py-4 mt-4">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('avgVariableCostPercentage')}</span>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-black text-orange-600">{avgVariableCostPercentage.toFixed(2)}</span>
                                            <span className="text-sm font-black text-orange-600/50">%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* BLOCK 3: FIXED EXPENSES */}
                        <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-xl shadow-sm">🏠</div>
                                    <div>
                                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">{t('fixedExpenses')}</h2>
                                        <div className="flex items-center gap-2 ml-1">
                                            <p className="text-[10px] text-blue-600/70 font-bold italic leading-none">{t('fixedExpensesDesc')}</p>
                                            {fixedExpenses.length > 0 && (
                                                <span className="text-[9px] font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full border border-blue-200">
                                                    {fixedExpenses.length} {fixedExpenses.length === 1 ? 'GASTO' : 'GASTOS'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setIsFullExpensesModalOpen(true)}
                                        className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-500 transition-all active:scale-95 border border-slate-200"
                                        title="Expandir"
                                    >
                                        ↖️
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setNewExpense({ ConceptoGasto: '', Monto: 0 });
                                            setEditingExpenseIndex(null);
                                            setIsExpenseModalOpen(true);
                                        }}
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-[10px] font-black uppercase text-white shadow-sm active:scale-95 transition-all flex items-center gap-2"
                                    >
                                        <span className="text-sm">+</span> {t('addExpense')}
                                    </button>
                                </div>
                            </div>
                            <div className="p-8">
                                <div className="space-y-2">
                                    {fixedExpenses.length > 0 && (
                                        <div className="mb-4 space-y-2 max-h-[250px] overflow-y-auto pr-1">
                                            {fixedExpenses.map((e, idx) => (
                                                <div key={idx} className="flex items-center justify-between gap-2 p-2 bg-blue-50/30 rounded-xl border border-blue-100/50 shadow-sm">
                                                    <span className="text-[11px] font-black text-slate-800 truncate">{e.ConceptoGasto}</span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[11px] font-black text-blue-600">${e.Monto.toLocaleString()}</span>
                                                        <div className="flex gap-1">
                                                            <button 
                                                                onClick={() => {
                                                                    setNewExpense(e);
                                                                    setEditingExpenseIndex(idx);
                                                                    setIsExpenseModalOpen(true);
                                                                }}
                                                                className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                                                            >
                                                                ✏️
                                                            </button>
                                                            <button 
                                                                onClick={() => removeExpense(idx)}
                                                                className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 -mx-8 px-8 py-4 mt-4">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('totalFixedExpenses')}</span>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-sm font-black text-blue-600/50">$</span>
                                            <span className="text-2xl font-black text-blue-600">{totalFixedExpenses.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* RIGHT COLUMN: RESULTS */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="sticky top-28 space-y-6">
                            
                            {/* BLOCK: BREAK-EVEN SUMMARY */}
                            <div className="bg-slate-900 rounded-[40px] shadow-2xl shadow-slate-300 p-8 text-white relative overflow-hidden group">
                                <div className="absolute -top-24 -right-24 w-64 h-64 bg-orange-600/20 rounded-full blur-3xl group-hover:bg-orange-600/30 transition-all duration-700"></div>
                                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl group-hover:bg-indigo-600/20 transition-all duration-700"></div>
                                
                                <div className="relative z-10 space-y-8">
                                    <div>
                                        <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] mb-4">Análisis de Punto de Equilibrio</h3>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-4xl font-black tracking-tighter">
                                                ${breakEvenSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Venta Mensual Requerida</span>
                                        </div>
                                    </div>

                                    <div className="h-px bg-white/10"></div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Venta Diaria</p>
                                            <p className="text-lg font-black">${dailyBreakEven.toLocaleString(undefined, { minimumFractionDigits: 0 })}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Margen Prom.</p>
                                            <p className="text-lg font-black text-orange-500">{contributionMargin.toFixed(1)}%</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* BLOCK: PROFIT GOAL SUMMARY */}
                            <div className="bg-white rounded-[40px] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 relative overflow-hidden">
                                <div className="relative z-10 space-y-8">
                                    <div>
                                        <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-4">Venta Proyectada (Plan)</h3>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-3xl font-black text-slate-800 tracking-tighter">
                                                ${monthlySalesGoal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Basado en Precio x Volumen</span>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="p-4 rounded-2xl border border-slate-100 space-y-3">
                                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                                                <span>COBERTURA DE PUNTO EQUILIBRIO</span>
                                                <span>{breakEvenSales > 0 ? ((monthlySalesGoal / breakEvenSales) * 100).toFixed(1) : 0}%</span>
                                            </div>
                                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full transition-all duration-1000 ${monthlySalesGoal >= breakEvenSales ? 'bg-emerald-500' : 'bg-orange-500'}`}
                                                    style={{ width: `${Math.min(100, (monthlySalesGoal / (breakEvenSales || 1)) * 100)}%` }}
                                                ></div>
                                            </div>
                                            <p className="text-[9px] font-medium text-slate-400 italic">
                                                {monthlySalesGoal >= breakEvenSales 
                                                    ? '✨ Estás por encima del punto de equilibrio.' 
                                                    : '⚠️ No alcanzas el punto de equilibrio con esta meta.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>

            {/* MODALS */}
            
            {/* ADD/EDIT PRODUCT MODAL */}
            {isProductModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-slate-50">
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest">
                                {editingProductIndex !== null ? 'Editar Producto' : 'Nuevo Producto'}
                            </h3>
                        </div>
                        <div className="p-8 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-2 ml-1">Nombre del Producto</label>
                                <input 
                                    type="text"
                                    value={newProduct.NombreProducto}
                                    onChange={(e) => setNewProduct({ ...newProduct, NombreProducto: e.target.value })}
                                    className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                    placeholder="Ej. Hamburguesa Doble"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-2 ml-1">% Materia Prima</label>
                                    <div className="relative">
                                        <input 
                                            type="number"
                                            value={newProduct.CostoMateriaPrima || ''}
                                            onChange={(e) => setNewProduct({ ...newProduct, CostoMateriaPrima: parseFloat(e.target.value) || 0 })}
                                            className="w-full pl-5 pr-10 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                            placeholder="0"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 font-black text-sm">%</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-2 ml-1">% Empaque</label>
                                    <div className="relative">
                                        <input 
                                            type="number"
                                            value={newProduct.Empaque || ''}
                                            onChange={(e) => setNewProduct({ ...newProduct, Empaque: parseFloat(e.target.value) || 0 })}
                                            className="w-full pl-5 pr-10 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                            placeholder="0"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 font-black text-sm">%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-8 bg-slate-50/50 flex gap-3">
                            <Button 
                                onClick={() => setIsProductModalOpen(false)}
                                variant="secondary"
                                className="flex-1 font-bold text-xs uppercase tracking-widest h-12"
                            >
                                Cancelar
                            </Button>
                            <Button 
                                onClick={handleAddProduct}
                                className="flex-1 font-bold text-xs uppercase tracking-widest h-12 bg-indigo-600 text-white"
                                disabled={!newProduct.NombreProducto}
                            >
                                {editingProductIndex !== null ? 'Actualizar' : 'Agregar'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ADD/EDIT EXPENSE MODAL */}
            {isExpenseModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-slate-50">
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest">
                                {editingExpenseIndex !== null ? 'Editar Gasto' : 'Nuevo Gasto Fijo'}
                            </h3>
                        </div>
                        <div className="p-8 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-2 ml-1">Concepto del Gasto</label>
                                <input 
                                    type="text"
                                    value={newExpense.ConceptoGasto}
                                    onChange={(e) => setNewExpense({ ...newExpense, ConceptoGasto: e.target.value })}
                                    className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                    placeholder="Ej. Renta Local"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-2 ml-1">Monto Mensual</label>
                                <div className="relative">
                                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 font-black text-sm">$</span>
                                    <input 
                                        type="number"
                                        value={newExpense.Monto || ''}
                                        onChange={(e) => setNewExpense({ ...newExpense, Monto: parseFloat(e.target.value) || 0 })}
                                        className="w-full pl-10 pr-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-8 bg-slate-50/50 flex gap-3">
                            <Button 
                                onClick={() => setIsExpenseModalOpen(false)}
                                variant="secondary"
                                className="flex-1 font-bold text-xs uppercase tracking-widest h-12"
                            >
                                Cancelar
                            </Button>
                            <Button 
                                onClick={handleAddExpense}
                                className="flex-1 font-bold text-xs uppercase tracking-widest h-12 bg-blue-600 text-white"
                                disabled={!newExpense.ConceptoGasto}
                            >
                                {editingExpenseIndex !== null ? 'Actualizar' : 'Agregar'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* FULL PRODUCTS MODAL */}
            {isFullProductsModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-[40px] w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 duration-500">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center text-2xl">🧪</div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest">Listado de Productos</h2>
                                    <p className="text-xs text-slate-400 font-bold italic">Gestiona todos tus productos representativos</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button 
                                    onClick={() => {
                                        setNewProduct({ NombreProducto: '', CostoMateriaPrima: 0, Empaque: 0 });
                                        setEditingProductIndex(null);
                                        setIsProductModalOpen(true);
                                    }}
                                    className="bg-orange-600 text-white text-xs px-6 py-2.5 rounded-xl font-black uppercase tracking-widest"
                                >
                                    + Agregar Producto
                                </Button>
                                <button 
                                    onClick={() => setIsFullProductsModalOpen(false)}
                                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {representativeProducts.map((p, idx) => (
                                    <div key={idx} className="group p-5 bg-white border-2 border-slate-100 rounded-3xl hover:border-orange-500/30 hover:shadow-xl hover:shadow-orange-100/50 transition-all duration-300 relative">
                                        <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => {
                                                    setNewProduct(p);
                                                    setEditingProductIndex(idx);
                                                    setIsProductModalOpen(true);
                                                }}
                                                className="w-8 h-8 flex items-center justify-center bg-white border border-slate-100 rounded-full text-xs shadow-sm hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                                            >
                                                ✏️
                                            </button>
                                            <button 
                                                onClick={() => removeProduct(idx)}
                                                className="w-8 h-8 flex items-center justify-center bg-white border border-slate-100 rounded-full text-xs shadow-sm hover:bg-red-50 hover:text-red-500 transition-all"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                        <p className="text-sm font-black text-slate-800 mb-3 pr-10">{p.NombreProducto}</p>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-[10px] font-bold">
                                                <span className="text-slate-400 uppercase tracking-tighter">Materia Prima</span>
                                                <span className="text-slate-800">{p.CostoMateriaPrima}%</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] font-bold">
                                                <span className="text-slate-400 uppercase tracking-tighter">Empaque</span>
                                                <span className="text-slate-800">{p.Empaque}%</span>
                                            </div>
                                            <div className="pt-2 border-t border-slate-50 flex justify-between items-center">
                                                <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Total Variable</span>
                                                <span className="text-lg font-black text-orange-600">{(p.CostoMateriaPrima + p.Empaque).toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {representativeProducts.length === 0 && (
                                <div className="h-64 flex flex-col items-center justify-center text-slate-300">
                                    <span className="text-6xl mb-4">🔬</span>
                                    <p className="text-sm font-black uppercase tracking-widest">No hay productos capturados</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* FULL EXPENSES MODAL */}
            {isFullExpensesModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-[40px] w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 duration-500">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-2xl">🏠</div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest">Gastos Fijos Detallados</h2>
                                    <p className="text-xs text-slate-400 font-bold italic">Control mensual de costos operativos</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button 
                                    onClick={() => {
                                        setNewExpense({ ConceptoGasto: '', Monto: 0 });
                                        setEditingExpenseIndex(null);
                                        setIsExpenseModalOpen(true);
                                    }}
                                    className="bg-blue-600 text-white text-xs px-6 py-2.5 rounded-xl font-black uppercase tracking-widest"
                                >
                                    + Agregar Gasto
                                </Button>
                                <button 
                                    onClick={() => setIsFullExpensesModalOpen(false)}
                                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {fixedExpenses.map((e, idx) => (
                                    <div key={idx} className="group p-5 bg-white border-2 border-slate-100 rounded-3xl hover:border-blue-500/30 hover:shadow-xl hover:shadow-blue-100/50 transition-all duration-300 relative">
                                        <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => {
                                                    setNewExpense(e);
                                                    setEditingExpenseIndex(idx);
                                                    setIsExpenseModalOpen(true);
                                                }}
                                                className="w-8 h-8 flex items-center justify-center bg-white border border-slate-100 rounded-full text-xs shadow-sm hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                                            >
                                                ✏️
                                            </button>
                                            <button 
                                                onClick={() => removeExpense(idx)}
                                                className="w-8 h-8 flex items-center justify-center bg-white border border-slate-100 rounded-full text-xs shadow-sm hover:bg-red-50 hover:text-red-500 transition-all"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                        <p className="text-sm font-black text-slate-800 mb-6 pr-10">{e.ConceptoGasto}</p>
                                        <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Monto Mensual</span>
                                            <span className="text-xl font-black text-blue-600">${e.Monto.toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {fixedExpenses.length === 0 && (
                                <div className="h-64 flex flex-col items-center justify-center text-slate-300">
                                    <span className="text-6xl mb-4">📋</span>
                                    <p className="text-sm font-black uppercase tracking-widest">No hay gastos capturados</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MASSIVE EXCEL UPLOAD MODAL */}
            {isMassiveExcelModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
                    <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                📊 Carga Masiva de Productos (Excel)
                            </h2>
                            <button
                                onClick={() => setIsMassiveExcelModalOpen(false)}
                                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <MassiveProductUpload
                                hideHeader={true}
                                onSuccess={() => {
                                    // Logic to add to break-even list could go here
                                }}
                            />
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                            <Button
                                onClick={() => setIsMassiveExcelModalOpen(false)}
                                variant="secondary"
                                className="font-bold text-xs uppercase tracking-widest px-8"
                            >
                                Cerrar
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <BreakEvenProductImageCaptureModal 
                isOpen={isOcrModalOpen}
                onClose={() => setIsOcrModalOpen(false)}
                projectId={project?.idProyecto}
                onAddProducts={handleAddOcrProducts}
            />
        </div>
    );
}
