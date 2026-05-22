'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    Cell, PieChart, Pie, Legend
} from 'recharts';
import AiAgent from '@/components/dashboard/AiAgent';
import PageShell from '@/components/PageShell';
import { LayoutDashboard, Maximize2, Minimize2, X, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Branch {
    IdSucursal: number;
    Sucursal: string;
}

export default function DashboardPage() {
    const t = useTranslations('HomePage');
    const tPurchases = useTranslations('PurchasesCapture');

    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    // Branch drilldown state
    const [project, setProject] = useState<Record<string, unknown> | null>(null);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('');

    // KPI state
    const [totalSales, setTotalSales] = useState<number>(0);
    const [salesObjective, setSalesObjective] = useState<number>(0);

    // Payroll KPI State
    const [totalPayroll, setTotalPayroll] = useState<number>(0);
    const [payrollObjective, setPayrollObjective] = useState<number>(0);
    const [payrollStartDate, setPayrollStartDate] = useState<string>(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
    });
    const [payrollEndDate, setPayrollEndDate] = useState<string>(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
    });
    const [isPayrollLoading, setIsPayrollLoading] = useState<boolean>(false);

    // Operating Expense KPI State
    const [totalOperatingExpense, setTotalOperatingExpense] = useState<number>(0);
    const [operatingExpenseObjective, setOperatingExpenseObjective] = useState<number>(0);

    // Raw Material KPI State
    const [totalRawMaterial, setTotalRawMaterial] = useState<number>(0);
    const [rawMaterialObjective, setRawMaterialObjective] = useState<number>(0);

    // Waste KPI State
    const [totalWaste, setTotalWaste] = useState<number>(0);

    // Inventory KPI State
    const [lastInventoryCost, setLastInventoryCost] = useState<number>(0);
    const [lastInventoryDate, setLastInventoryDate] = useState<string | null>(null);
    const [lastInventoryDay, setLastInventoryDay] = useState<number | null>(null);
    const [lastInventoryMonth, setLastInventoryMonth] = useState<number | null>(null);
    const [lastInventoryYear, setLastInventoryYear] = useState<number | null>(null);

    const [isLoadingKpi, setIsLoadingKpi] = useState<boolean>(true);

    // KPI Detail state
    const [selectedKpi, setSelectedKpi] = useState<string | null>('sales');
    const [salesDetailData, setSalesDetailData] = useState<{
        channels: any[];
        shifts: any[];
        payments: any[];
        days: any[];
        totalSales: number;
    } | null>(null);
    const [payrollDetailData, setPayrollDetailData] = useState<{
        positions: any[];
        employees: any[];
        days: any[];
        totalPayroll: number;
    } | null>(null);
    const [expenseDetailData, setExpenseDetailData] = useState<{
        concepts: any[];
        providers: any[];
        days: any[];
        totalExpenses: number;
    } | null>(null);
    const [purchaseDetailData, setPurchaseDetailData] = useState<{
        categories: any[];
        providers: any[];
        products: any[];
        days: any[];
        totalPurchases: number;
    } | null>(null);
    const [wasteDetailData, setWasteDetailData] = useState<{
        categories: any[];
        products: any[];
        days: any[];
        totalWaste: number;
    } | null>(null);
    const [inventoryDetailData, setInventoryDetailData] = useState<{
        categories: any[];
        products: any[];
        details: any[];
        totalCost: number;
    } | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
    const [detailGrouping, setDetailGrouping] = useState<string>('channels');
    const [inventoryView, setInventoryView] = useState<'categories' | 'products'>('categories');
    const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
    const [cardSearchQuery, setCardSearchQuery] = useState<string>('');
    const [isDrilldownLoading, setIsDrilldownLoading] = useState<boolean>(false);
    const [drilldownItem, setDrilldownItem] = useState<{name: string, kpi: string, grouping: string, emoji?: string, color: string, count?: number, value?: number, categoryName?: string} | null>(null);
    const [drilldownData, setDrilldownData] = useState<any[]>([]);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isModalMaximized, setIsModalMaximized] = useState(false);
    const [isTotalCostModalOpen, setIsTotalCostModalOpen] = useState(false);

    // Costing Alerts state
    const [costingAlerts, setCostingAlerts] = useState<any[]>([]);
    const [isLoadingCostingAlerts, setIsLoadingCostingAlerts] = useState<boolean>(false);

    const dashboardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            dashboardRef.current?.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    useEffect(() => {
        setCardSearchQuery('');
    }, [selectedKpi, detailGrouping]);

    // Generate years
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 7 }, (_, i) => currentYear - 5 + i);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }

        const savedMonth = localStorage.getItem('lastSelectedMonth');
        const savedYear = localStorage.getItem('lastSelectedYear');
        if (savedMonth) {
            setSelectedMonth(parseInt(savedMonth));
            // Sync payroll dates too
            const d = new Date(parseInt(savedYear || new Date().getFullYear().toString()), parseInt(savedMonth), 1);
            setPayrollStartDate(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]);
            setPayrollEndDate(new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]);
        }
        if (savedYear) {
            setSelectedYear(parseInt(savedYear));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchBranches();

            // Try to load persisted branch
            const savedBranch = localStorage.getItem('dashboardSelectedBranch');
            if (savedBranch) {
                setSelectedBranch(savedBranch);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project]);

    useEffect(() => {
        if (selectedBranch) {
            localStorage.setItem('dashboardSelectedBranch', selectedBranch);
        }
    }, [selectedBranch]);

    useEffect(() => {
        localStorage.setItem('lastSelectedMonth', selectedMonth.toString());
    }, [selectedMonth]);

    useEffect(() => {
        localStorage.setItem('lastSelectedYear', selectedYear.toString());
    }, [selectedYear]);

    const handleDrilldownClick = async (item: any, colorHex: string) => {
        if (detailGrouping === 'days') return;
        if (selectedKpi === 'sales' && String(item.name || '') === 'Efectivo') return;
        
        const calculatedEmoji = ['purchases', 'waste'].includes(selectedKpi as string) && ['categories', 'products'].includes(detailGrouping) 
            ? (item.emoji || getCategoryEmoji(String(item.categoryName || item.name || ''))) 
            : String(item.name || '').slice(0, 2).toUpperCase();

        setDrilldownItem({ 
            name: item.name, 
            kpi: selectedKpi as string, 
            grouping: detailGrouping, 
            emoji: calculatedEmoji, 
            color: colorHex, 
            count: item.count, 
            value: item.value,
            categoryName: item.categoryName
        });
        setIsDrilldownLoading(true);
        setDrilldownData([]);

        try {
            const m = selectedKpi === 'payroll' ? null : selectedMonth;
            const y = selectedKpi === 'payroll' ? null : selectedYear;
            const payrollDates = selectedKpi === 'payroll' ? `&startDate=${payrollStartDate}&endDate=${payrollEndDate}` : '';
            const response = await fetch(`/api/dashboard/drilldown?projectId=${project?.idProyecto}&branchId=${selectedBranch}&month=${m}&year=${y}&kpi=${selectedKpi}&grouping=${detailGrouping}&itemName=${encodeURIComponent(item.name)}${payrollDates}`);
            const data = await response.json();
            if (data.success) {
                setDrilldownData(data.data);
            }
        } catch (error) {
            console.error('Error fetching drilldown:', error);
        } finally {
            setIsDrilldownLoading(false);
        }
    };

    const getCategoryEmoji = (category: string) => {
        const cat = category.toLowerCase();
        if (cat.includes('carne') || cat.includes('res') || cat.includes('cerdo') || cat.includes('pollo')) return '🥩';
        if (cat.includes('verdura') || cat.includes('fruta') || cat.includes('vegetal')) return '🥦';
        if (cat.includes('lacteo') || cat.includes('leche') || cat.includes('queso')) return '🥛';
        if (cat.includes('abarrote')) return '🥫';
        if (cat.includes('bebida') || cat.includes('refresco')) return '🥤';
        if (cat.includes('desechable') || cat.includes('empaque')) return '🥡';
        if (cat.includes('limpieza')) return '🧼';
        if (cat.includes('marisco') || cat.includes('pescado')) return '🐟';
        if (cat.includes('pan')) return '🍞';
        return '📦';
    };

    const fetchBranches = async () => {
        try {
            const response = await fetch(`/api/branches?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success && data.data.length > 0) {
                setBranches(data.data);

                // Keep selected branch if it exists, save it, or auto-select if only 1 branch
                const savedBranch = localStorage.getItem('dashboardSelectedBranch');
                if (!savedBranch && !selectedBranch) {
                    if (data.data.length === 1) {
                        setSelectedBranch(data.data[0].IdSucursal.toString());
                    } else {
                        // Fallback to first branch if desired, or leave empty
                        setSelectedBranch(data.data[0].IdSucursal.toString());
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        }
    };

    const fetchSalesKpi = async () => {
        // Only fetch if project and branch are ready
        if (!project?.idProyecto || !selectedBranch || selectedMonth === undefined || selectedYear === undefined) return;

        setIsLoadingKpi(true);
        try {
            const response = await fetch(`/api/dashboard/kpi/sales?projectId=${project.idProyecto}&branchId=${selectedBranch}&month=${selectedMonth}&year=${selectedYear}`);
            const data = await response.json();
            if (data.success) {
                setTotalSales(data.data.totalSales);
                setSalesObjective(data.data.salesObjective);
                setTotalPayroll(data.data.totalPayroll);
                setPayrollObjective(data.data.payrollObjective);
                setTotalOperatingExpense(data.data.totalOperatingExpense);
                setOperatingExpenseObjective(data.data.operatingExpenseObjective);
                setTotalRawMaterial(data.data.totalRawMaterial);
                setRawMaterialObjective(data.data.rawMaterialObjective);
                setTotalWaste(data.data.totalWaste || 0);
                setLastInventoryCost(data.data.lastInventoryCost || 0);
                setLastInventoryDate(data.data.lastInventoryDate || null);
                setLastInventoryDay(data.data.lastInventoryDay || null);
                setLastInventoryMonth(data.data.lastInventoryMonth !== null ? data.data.lastInventoryMonth : null);
                setLastInventoryYear(data.data.lastInventoryYear || null);
            } else {
                setTotalSales(0);
                setSalesObjective(0);
                setTotalPayroll(0);
                setPayrollObjective(0);
                setTotalOperatingExpense(0);
                setOperatingExpenseObjective(0);
                setTotalRawMaterial(0);
                setRawMaterialObjective(0);
                setTotalWaste(0);
                setLastInventoryCost(0);
                setLastInventoryDate(null);
                setLastInventoryDay(null);
                setLastInventoryMonth(null);
                setLastInventoryYear(null);
            }
        } catch (error) {
            console.error('Error fetching sales KPI:', error);
            setTotalSales(0);
            setSalesObjective(0);
            setTotalPayroll(0);
            setPayrollObjective(0);
            setTotalOperatingExpense(0);
            setOperatingExpenseObjective(0);
            setTotalRawMaterial(0);
            setRawMaterialObjective(0);
            setTotalWaste(0);
            setLastInventoryCost(0);
            setLastInventoryDate(null);
            setLastInventoryDay(null);
            setLastInventoryMonth(null);
            setLastInventoryYear(null);
        } finally {
            setIsLoadingKpi(false);
        }
    };

    const fetchPayrollKpi = async () => {
        if (!project?.idProyecto || !selectedBranch || !payrollStartDate || !payrollEndDate) return;
        
        setIsPayrollLoading(true);
        try {
            const response = await fetch(`/api/dashboard/kpi/sales?projectId=${project.idProyecto}&branchId=${selectedBranch}&month=${selectedMonth}&year=${selectedYear}&payrollStartDate=${payrollStartDate}&payrollEndDate=${payrollEndDate}`);
            const data = await response.json();
            if (data.success) {
                setTotalPayroll(data.data.totalPayroll);
                setPayrollObjective(data.data.payrollObjective);
            }
        } catch (error) {
            console.error('Error fetching payroll KPI:', error);
        } finally {
            setIsPayrollLoading(false);
        }
    };

    const fetchSalesDetails = async () => {
        if (!project?.idProyecto || !selectedBranch || selectedKpi !== 'sales') return;

        setIsLoadingDetails(true);
        try {
            const response = await fetch(`/api/dashboard/sales-details?projectId=${project.idProyecto}&branchId=${selectedBranch}&month=${selectedMonth}&year=${selectedYear}`);
            const data = await response.json();
            if (data.success) {
                setSalesDetailData(data.data);
                if (!['channels', 'shifts', 'payments', 'days'].includes(detailGrouping)) {
                    setDetailGrouping('channels');
                }
            }
        } catch (error) {
            console.error('Error fetching sales details:', error);
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const fetchPayrollDetails = async () => {
        if (!project?.idProyecto || !selectedBranch || selectedKpi !== 'payroll') return;

        setIsLoadingDetails(true);
        try {
            const response = await fetch(`/api/dashboard/payroll-details?projectId=${project.idProyecto}&branchId=${selectedBranch}&startDate=${payrollStartDate}&endDate=${payrollEndDate}`);
            const data = await response.json();
            if (data.success) {
                setPayrollDetailData(data.data);
                if (!['positions', 'employees', 'days'].includes(detailGrouping)) {
                    setDetailGrouping('positions');
                }
            }
        } catch (error) {
            console.error('Error fetching payroll details:', error);
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const fetchExpenseDetails = async () => {
        if (!project?.idProyecto || !selectedBranch || selectedKpi !== 'expenses') return;

        setIsLoadingDetails(true);
        try {
            const response = await fetch(`/api/dashboard/expense-details?projectId=${project.idProyecto}&branchId=${selectedBranch}&month=${selectedMonth}&year=${selectedYear}`);
            const data = await response.json();
            if (data.success) {
                setExpenseDetailData(data.data);
                if (!['concepts', 'providers', 'days'].includes(detailGrouping)) {
                    setDetailGrouping('concepts');
                }
            }
        } catch (error) {
            console.error('Error fetching expense details:', error);
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const fetchPurchaseDetails = async () => {
        if (!project?.idProyecto || !selectedBranch || selectedKpi !== 'purchases') return;

        setIsLoadingDetails(true);
        try {
            const response = await fetch(`/api/dashboard/purchase-details?projectId=${project.idProyecto}&branchId=${selectedBranch}&month=${selectedMonth}&year=${selectedYear}`);
            const data = await response.json();
            if (data.success) {
                setPurchaseDetailData(data.data);
                if (!['categories', 'providers', 'products', 'days'].includes(detailGrouping)) {
                    setDetailGrouping('categories');
                }
            }
        } catch (error) {
            console.error('Error fetching purchase details:', error);
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const fetchWasteDetails = async () => {
        if (!project?.idProyecto || !selectedBranch || (selectedKpi as string) !== 'waste') return;

        setIsLoadingDetails(true);
        try {
            const response = await fetch(`/api/dashboard/waste-details?projectId=${project.idProyecto}&branchId=${selectedBranch}&month=${selectedMonth}&year=${selectedYear}`);
            const data = await response.json();
            if (data.success) {
                setWasteDetailData(data.data);
                if (!['categories', 'products', 'days'].includes(detailGrouping)) {
                    setDetailGrouping('categories');
                }
            }
        } catch (error) {
            console.error('Error fetching waste details:', error);
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const fetchInventoryDetails = async () => {
        if (!project?.idProyecto || !selectedBranch || (selectedKpi as string) !== 'inventory' || lastInventoryDay === null) return;

        setIsLoadingDetails(true);
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto as string,
                branchId: selectedBranch,
                day: lastInventoryDay!.toString(),
                month: lastInventoryMonth!.toString(),
                year: lastInventoryYear!.toString()
            });
            const response = await fetch(`/api/dashboard/inventory-details?${params}`);
            const data = await response.json();
            if (data.success) {
                setInventoryDetailData(data.data);
            }
        } catch (error) {
            console.error('Error fetching inventory details:', error);
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const fetchCostingAlerts = async () => {
        if (!project?.idProyecto) return;
        setIsLoadingCostingAlerts(true);
        try {
            const response = await fetch(`/api/dashboard/costing-alerts?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setCostingAlerts(data.data);
            } else {
                setCostingAlerts([]);
            }
        } catch (error) {
            console.error('Error fetching costing alerts:', error);
            setCostingAlerts([]);
        } finally {
            setIsLoadingCostingAlerts(false);
        }
    };

    useEffect(() => {
        if (project?.idProyecto) {
            fetchCostingAlerts();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project]);

    useEffect(() => {
        if (selectedKpi === 'sales') {
            fetchSalesDetails();
        } else if (selectedKpi === 'payroll') {
            fetchPayrollDetails();
        } else if (selectedKpi === 'expenses') {
            fetchExpenseDetails();
        } else if (selectedKpi === 'purchases') {
            fetchPurchaseDetails();
        } else if ((selectedKpi as string) === 'waste') {
            fetchWasteDetails();
        } else if ((selectedKpi as string) === 'inventory') {
            fetchInventoryDetails();
        }
    }, [selectedKpi, selectedMonth, selectedYear, payrollStartDate, payrollEndDate, selectedBranch, lastInventoryDay]);

    useEffect(() => {
        fetchPayrollKpi();
    }, [project, selectedBranch, payrollStartDate, payrollEndDate]);

    useEffect(() => {
        fetchSalesKpi();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project, selectedBranch, selectedMonth, selectedYear]);

    // Combined Analysis State
    const totalActualValue = totalPayroll + totalOperatingExpense + totalRawMaterial;
    const actualPayrollPercent = totalSales > 0 ? (totalPayroll / totalSales) * 100 : 0;
    const actualExpensePercent = totalSales > 0 ? (totalOperatingExpense / totalSales) * 100 : 0;
    const actualRawMaterialPercent = totalSales > 0 ? (totalRawMaterial / totalSales) * 100 : 0;
    const totalActualPercent = actualPayrollPercent + actualExpensePercent + actualRawMaterialPercent;
    const totalBudgetPercent = payrollObjective + operatingExpenseObjective + rawMaterialObjective;
    const diffPercent = totalActualPercent - totalBudgetPercent;
    const utilityPercent = 100 - totalActualPercent;
    const utilityAmount = totalSales - totalActualValue;

    const dashboardDataContext = {
        project,
        period: { month: selectedMonth, year: selectedYear },
        kpis: {
            sales: { actual: totalSales, target: salesObjective },
            payroll: { actual: totalPayroll, target: payrollObjective },
            operatingExpense: { actual: totalOperatingExpense, target: operatingExpenseObjective },
            rawMaterial: { actual: totalRawMaterial, target: rawMaterialObjective },
            waste: { actual: totalWaste },
            inventory: { 
                actual: lastInventoryCost, 
                date: lastInventoryDate,
                day: lastInventoryDay,
                month: lastInventoryMonth,
                year: lastInventoryYear
            }
        },
        branch: branches.find(b => b.IdSucursal.toString() === selectedBranch)?.Sucursal || selectedBranch,
        branchId: selectedBranch
    };

    // Helper function for compact currency formatting
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
            notation: 'standard',
            maximumFractionDigits: 0
        }).format(value);
    };

    // Helper to get font size based on string length
    const getKpiFontSize = (val: string) => {
        if (val.length > 15) return 'text-lg';
        if (val.length > 12) return 'text-xl';
        if (val.length > 10) return 'text-2xl';
        return 'text-3xl';
    };


    // KPI Section
    return (
        <div ref={dashboardRef} className={isFullscreen ? 'overflow-y-auto' : ''}>
        <PageShell
            title={t('title')}
            subtitle={`${tPurchases(`months.${selectedMonth}`)} ${selectedYear} · ${t('features.managementDesc')}`}
            icon={LayoutDashboard}
            actions={
                <div className="flex items-center gap-3 flex-wrap">
                    <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium">
                        {branches.length === 0 && <option value="">{tPurchases('noBranches')}</option>}
                        {branches.map(branch => <option key={branch.IdSucursal} value={branch.IdSucursal}>{branch.Sucursal}</option>)}
                    </select>
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium">
                        {Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{tPurchases(`months.${i}`)}</option>)}
                    </select>
                    <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium">
                        {years.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                    <button onClick={toggleFullscreen} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors" title={isFullscreen ? 'Restaurar' : 'Maximizar'}>
                        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                </div>
            }
        >
            <AiAgent dashboardData={dashboardDataContext} />
            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5 mt-4">
                {/* Sales KPI Card */}
                <div
                    onClick={() => setSelectedKpi(selectedKpi === 'sales' ? null : 'sales')}
                    className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer ${selectedKpi === 'sales' ? 'border-emerald-400 shadow-lg shadow-emerald-500/20 bg-gradient-to-br from-emerald-50 to-emerald-50/50' : 'border-gray-200 bg-white shadow-md hover:shadow-lg hover:border-emerald-300'}`}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="absolute -right-8 -top-8 w-24 h-24 bg-emerald-500/10 rounded-full group-hover:scale-150 transition-transform duration-500"></div>

                    <div className="relative p-2 flex flex-col h-full gap-1.5">
                        <div className="flex items-start justify-between">
                            <div>
                                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest leading-none">Ventas</span>
                            </div>
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>

                        {isLoadingKpi ? (
                            <div className="h-4 w-24 bg-gray-200 animate-pulse rounded-lg"></div>
                        ) : (
                            <h2 className="text-base font-bold text-gray-900 leading-tight">
                                {formatCurrency(totalSales)}
                            </h2>
                        )}

                        {!isLoadingKpi && (
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center text-[8px]">
                                    <span className="text-gray-500 font-medium">Progreso</span>
                                    <span className="font-bold text-emerald-600">
                                        {salesObjective > 0 ? `${((totalSales / salesObjective) * 100).toFixed(0)}%` : 'S/P'}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${totalSales >= salesObjective ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-amber-500 to-amber-400'}`}
                                        style={{ width: `${Math.min((totalSales / (salesObjective || totalSales)) * 100, 100)}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between items-center text-[8px] text-gray-600">
                                    <span>Meta:</span>
                                    <span className="font-semibold text-gray-700">{formatCurrency(salesObjective)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Payroll KPI Card */}
                <div
                    onClick={() => setSelectedKpi(selectedKpi === 'payroll' ? null : 'payroll')}
                    className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer ${selectedKpi === 'payroll' ? 'border-indigo-400 shadow-lg shadow-indigo-500/20 bg-gradient-to-br from-indigo-50 to-indigo-50/50' : 'border-gray-200 bg-white shadow-md hover:shadow-lg hover:border-indigo-300'}`}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="absolute -right-8 -top-8 w-24 h-24 bg-indigo-500/10 rounded-full group-hover:scale-150 transition-transform duration-500"></div>

                    <div className="relative p-2 flex flex-col h-full gap-1.5">
                        <div className="flex items-start justify-between">
                            <div>
                                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest leading-none">Nómina</span>
                            </div>
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                        </div>

                        {isLoadingKpi || isPayrollLoading ? (
                            <div className="h-4 w-24 bg-gray-200 animate-pulse rounded-lg"></div>
                        ) : (
                            <h2 className="text-lg font-bold text-gray-900 leading-tight">
                                {formatCurrency(totalPayroll)}
                            </h2>
                        )}

                        {!isLoadingKpi && (
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center text-[8px]">
                                    <span className="text-gray-500 font-medium">% de ventas</span>
                                    <span className="font-bold text-indigo-600">
                                        {totalSales > 0 ? `${((totalPayroll / totalSales) * 100).toFixed(1)}%` : '0%'}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${((totalPayroll / totalSales) * 100) <= payrollObjective || payrollObjective === 0 ? 'bg-gradient-to-r from-indigo-500 to-indigo-400' : 'bg-gradient-to-r from-amber-500 to-amber-400'}`}
                                        style={{ width: `${Math.min(((totalPayroll / totalSales) * 100) / (payrollObjective || 25), 1) * 100}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between items-center text-[8px] text-gray-600">
                                    <span>Meta:</span>
                                    <span className="font-semibold text-gray-700">{payrollObjective > 0 ? `${payrollObjective}%` : 'S/P'}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Operating Expense KPI Card */}
                <div
                    onClick={() => setSelectedKpi(selectedKpi === 'expenses' ? null : 'expenses')}
                    className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer ${selectedKpi === 'expenses' ? 'border-rose-400 shadow-lg shadow-rose-500/20 bg-gradient-to-br from-rose-50 to-rose-50/50' : 'border-gray-200 bg-white shadow-md hover:shadow-lg hover:border-rose-300'}`}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="absolute -right-8 -top-8 w-24 h-24 bg-rose-500/10 rounded-full group-hover:scale-150 transition-transform duration-500"></div>

                    <div className="relative p-2 flex flex-col h-full gap-1.5">
                        <div className="flex items-start justify-between">
                            <div>
                                <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">Gastos</span>
                            </div>
                            <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
                                <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            </div>
                        </div>

                        {isLoadingKpi ? (
                            <div className="h-4 w-28 bg-gray-200 animate-pulse rounded-lg"></div>
                        ) : (
                            <h2 className={`${getKpiFontSize(formatCurrency(totalOperatingExpense))} font-bold text-gray-900 leading-tight`}>
                                {formatCurrency(totalOperatingExpense)}
                            </h2>
                        )}

                        {!isLoadingKpi && (
                            <div className="space-y-1">
                                <div className="space-y-0.5">
                                    <div className="flex justify-between items-center text-[8px]">
                                        <span className="text-gray-600 font-medium">% del total de ventas</span>
                                        <span className="font-bold text-rose-600">
                                            {totalSales > 0 ? `${((totalOperatingExpense / totalSales) * 100).toFixed(1)}%` : '0%'}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${((totalOperatingExpense / totalSales) * 100) <= operatingExpenseObjective || operatingExpenseObjective === 0 ? 'bg-gradient-to-r from-rose-500 to-rose-400' : 'bg-gradient-to-r from-orange-500 to-orange-400'}`}
                                            style={{ width: `${Math.min(((totalOperatingExpense / totalSales) * 100) / (operatingExpenseObjective || 20), 1) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-[9px] bg-gray-50 -mx-2 px-2 py-2 rounded-lg">
                                    <span className="text-gray-600">Meta</span>
                                    <span className="font-semibold text-gray-800">{operatingExpenseObjective > 0 ? `${operatingExpenseObjective}%` : 'S/P'}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Raw Material KPI Card */}
                <div
                    onClick={() => setSelectedKpi(selectedKpi === 'purchases' ? null : 'purchases')}
                    className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer ${selectedKpi === 'purchases' ? 'border-amber-400 shadow-lg shadow-amber-500/20 bg-gradient-to-br from-amber-50 to-amber-50/50' : 'border-gray-200 bg-white shadow-md hover:shadow-lg hover:border-amber-300'}`}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="absolute -right-8 -top-8 w-24 h-24 bg-amber-500/10 rounded-full group-hover:scale-150 transition-transform duration-500"></div>

                    <div className="relative p-2 flex flex-col h-full gap-1.5">
                        <div className="flex items-start justify-between">
                            <div>
                                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Materia Prima</span>
                            </div>
                            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                        </div>

                        {isLoadingKpi ? (
                            <div className="h-4 w-28 bg-gray-200 animate-pulse rounded-lg"></div>
                        ) : (
                            <h2 className={`${getKpiFontSize(formatCurrency(totalRawMaterial))} font-bold text-gray-900 leading-tight`}>
                                {formatCurrency(totalRawMaterial)}
                            </h2>
                        )}

                        {!isLoadingKpi && (
                            <div className="space-y-1">
                                <div className="space-y-0.5">
                                    <div className="flex justify-between items-center text-[8px]">
                                        <span className="text-gray-600 font-medium">% del total de ventas</span>
                                        <span className="font-bold text-amber-600">
                                            {totalSales > 0 ? `${((totalRawMaterial / totalSales) * 100).toFixed(1)}%` : '0%'}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${((totalRawMaterial / totalSales) * 100) <= rawMaterialObjective || rawMaterialObjective === 0 ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 'bg-gradient-to-r from-orange-500 to-orange-400'}`}
                                            style={{ width: `${Math.min(((totalRawMaterial / totalSales) * 100) / (rawMaterialObjective || 30), 1) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-[9px] bg-gray-50 -mx-2 px-2 py-2 rounded-lg">
                                    <span className="text-gray-600">Meta</span>
                                    <span className="font-semibold text-gray-800">{rawMaterialObjective > 0 ? `${rawMaterialObjective}%` : 'S/P'}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Inventory & Waste KPI Card */}
                <div
                    onClick={() => setSelectedKpi((selectedKpi as string) === 'inventory' ? null : 'inventory')}
                    className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer ${(selectedKpi as string) === 'inventory' ? 'border-blue-400 shadow-lg shadow-blue-500/20 bg-gradient-to-br from-blue-50 to-blue-50/50' : 'border-gray-200 bg-white shadow-md hover:shadow-lg hover:border-blue-300'}`}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="absolute -right-8 -top-8 w-24 h-24 bg-blue-500/10 rounded-full group-hover:scale-150 transition-transform duration-500"></div>

                    <div className="relative p-2 flex flex-col h-full gap-1.5">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest block leading-none">Inventario</span>
                                {isLoadingKpi ? (
                                    <div className="h-4 w-20 bg-gray-200 animate-pulse rounded mt-0.5"></div>
                                ) : (
                                    <p className="text-sm font-bold text-gray-900 leading-tight truncate">{formatCurrency(lastInventoryCost)}</p>
                                )}
                            </div>
                            <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                            </div>
                        </div>

                        <div className="border-t border-blue-100"></div>

                        <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <span className="text-[9px] font-bold text-pink-600 uppercase tracking-widest block leading-none">Mermas</span>
                                {isLoadingKpi ? (
                                    <div className="h-4 w-20 bg-gray-200 animate-pulse rounded mt-0.5"></div>
                                ) : (
                                    <div className="flex items-baseline gap-1">
                                        <p className="text-sm font-bold text-gray-900 leading-tight">{formatCurrency(totalWaste)}</p>
                                        <span className={`text-[8px] font-bold ${totalSales > 0 ? 'text-pink-600' : 'text-gray-500'}`}>
                                            {totalSales > 0 ? `${((totalWaste / totalSales) * 100).toFixed(1)}%` : '0%'}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="w-6 h-6 rounded-lg bg-pink-100 flex items-center justify-center flex-shrink-0">
                                <svg className="w-3.5 h-3.5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Total Cost vs Budget Card */}
                <div
                    onClick={() => setIsTotalCostModalOpen(true)}
                    className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer ${totalActualPercent <= totalBudgetPercent ? 'border-purple-400 shadow-lg shadow-purple-500/20 bg-gradient-to-br from-purple-50 to-purple-50/50' : 'border-orange-400 shadow-lg shadow-orange-500/20 bg-gradient-to-br from-orange-50 to-orange-50/50'}`}
                >
                    <div className={`absolute inset-0 bg-gradient-to-br ${totalActualPercent <= totalBudgetPercent ? 'from-purple-500/5' : 'from-orange-500/5'} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                    <div className={`absolute -right-8 -top-8 w-24 h-24 rounded-full group-hover:scale-150 transition-transform duration-500 ${totalActualPercent <= totalBudgetPercent ? 'bg-purple-500/10' : 'bg-orange-500/10'}`}></div>

                    <div className="relative p-2 flex flex-col h-full gap-1.5">
                        <div className="flex items-start justify-between">
                            <div>
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${totalActualPercent <= totalBudgetPercent ? 'text-purple-600' : 'text-orange-600'}`}>Análisis Global</span>
                            </div>
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${totalActualPercent <= totalBudgetPercent ? 'bg-purple-100' : 'bg-orange-100'}`}>
                                <svg className={`w-4 h-4 ${totalActualPercent <= totalBudgetPercent ? 'text-purple-600' : 'text-orange-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                        </div>

                        <h2 className="text-lg font-bold text-gray-900 leading-tight">
                            {totalActualPercent.toFixed(1)}%
                        </h2>

                        <div className="space-y-1">
                            <div className="space-y-0.5">
                                <div className="flex justify-between items-center text-[8px]">
                                    <span className="text-gray-500 font-medium">Progreso</span>
                                    <span className={`font-bold ${totalActualPercent <= totalBudgetPercent ? 'text-purple-600' : 'text-orange-600'}`}>
                                        {totalActualPercent.toFixed(1)}% / {totalBudgetPercent.toFixed(1)}%
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${totalActualPercent <= totalBudgetPercent ? 'bg-gradient-to-r from-purple-500 to-purple-400' : 'bg-gradient-to-r from-orange-500 to-orange-400'}`}
                                        style={{ width: `${Math.min((totalActualPercent / (totalBudgetPercent || 50)), 1) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                            <div className={`flex justify-between items-center text-[7px] font-semibold px-2 py-1 rounded-lg ${totalActualPercent <= totalBudgetPercent ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                                <span>{totalActualPercent <= totalBudgetPercent ? '✓ ÓPTIMO' : '⚠ EXCEDIDO'}</span>
                                <span>{Math.abs(diffPercent).toFixed(1)}% {totalActualPercent > totalBudgetPercent ? 'sobre' : 'bajo'} meta</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detail Section (Generic for Sales, Payroll, Expenses, Purchases, Waste or Inventory) */}
            {(selectedKpi === 'sales' || selectedKpi === 'payroll' || selectedKpi === 'expenses' || selectedKpi === 'purchases' || (selectedKpi as string) === 'waste' || (selectedKpi as string) === 'inventory') && (
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xl animate-in fade-in slide-in-from-top-4 duration-500 mt-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                        <div>
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <span className={`w-2 h-8 rounded-full ${selectedKpi === 'sales' ? 'bg-emerald-500' : selectedKpi === 'payroll' ? 'bg-indigo-500' : selectedKpi === 'expenses' ? 'bg-rose-500' : selectedKpi === 'purchases' ? 'bg-amber-500' : (selectedKpi as string) === 'inventory' ? 'bg-blue-500' : 'bg-pink-500'}`}></span>
                                {selectedKpi === 'sales' ? 'Análisis Detallado de Ventas' : selectedKpi === 'payroll' ? 'Análisis Detallado de Nómina' : selectedKpi === 'expenses' ? 'Análisis Detallado de Gastos' : selectedKpi === 'purchases' ? 'Análisis Detallado de Compras' : (selectedKpi as string) === 'inventory' ? 'Análisis Detallado de Inventario' : 'Análisis Detallado de Mermas'}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                                {selectedKpi === 'payroll' ? (
                                    <div className="flex items-center gap-2 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                                        <label className="text-[10px] font-black text-indigo-400 uppercase">Rango Nómina:</label>
                                        <div className="flex items-center gap-1">
                                            <input 
                                                type="date"
                                                value={payrollStartDate}
                                                onChange={(e) => setPayrollStartDate(e.target.value)}
                                                className="bg-transparent text-[10px] font-black text-indigo-700 outline-none cursor-pointer"
                                            />
                                            <span className="text-indigo-300 text-[10px]">al</span>
                                            <input 
                                                type="date"
                                                value={payrollEndDate}
                                                onChange={(e) => setPayrollEndDate(e.target.value)}
                                                className="bg-transparent text-[10px] font-black text-indigo-700 outline-none cursor-pointer"
                                            />
                                        </div>
                                        <div className="h-8 w-[1px] bg-indigo-200 mx-2 hidden md:block"></div>
                                        <div className="flex flex-col items-end bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 shadow-sm">
                                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Monto total del periodo</span>
                                            <span className="text-3xl font-black text-indigo-700 leading-none">{formatCurrency(totalPayroll)}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-500">
                                        {(selectedKpi as string) === 'inventory' 
                                            ? `Inventario del día ${lastInventoryDay}/${(lastInventoryMonth || 0) + 1}/${lastInventoryYear}`
                                            : 'Desglose porcentual y comparativo por diversas dimensiones'}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-1 bg-white p-1 rounded-lg shadow-sm mr-2">
                                {selectedKpi === 'sales' ? (
                                    <>
                                        <button
                                            onClick={() => setDetailGrouping('channels')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${detailGrouping === 'channels' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Canal
                                        </button>
                                        <button
                                            onClick={() => setDetailGrouping('shifts')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${detailGrouping === 'shifts' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Turno
                                        </button>
                                        <button
                                            onClick={() => setDetailGrouping('payments')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${detailGrouping === 'payments' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Forma Pago
                                        </button>
                                        <button
                                            onClick={() => setDetailGrouping('days')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${detailGrouping === 'days' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Día
                                        </button>
                                    </>
                                ) : selectedKpi === 'payroll' ? (
                                    <>
                                        <button
                                            onClick={() => setDetailGrouping('positions')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${detailGrouping === 'positions' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Puesto
                                        </button>
                                        <button
                                            onClick={() => setDetailGrouping('employees')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${detailGrouping === 'employees' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Empleado
                                        </button>
                                        <button
                                            onClick={() => setDetailGrouping('days')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${detailGrouping === 'days' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Día
                                        </button>
                                    </>
                                ) : selectedKpi === 'expenses' ? (
                                    <>
                                        <button
                                            onClick={() => setDetailGrouping('concepts')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${detailGrouping === 'concepts' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Concepto
                                        </button>
                                        <button
                                            onClick={() => setDetailGrouping('providers')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${detailGrouping === 'providers' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Proveedor
                                        </button>
                                        <button
                                            onClick={() => setDetailGrouping('days')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${detailGrouping === 'days' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Día
                                        </button>
                                    </>
                                ) : (selectedKpi as string) === 'inventory' ? (
                                    <>
                                        <button
                                            onClick={() => setInventoryView('categories')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${inventoryView === 'categories' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Categoría
                                        </button>
                                        <button
                                            onClick={() => setInventoryView('products')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${inventoryView === 'products' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Producto
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => setDetailGrouping('categories')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${detailGrouping === 'categories' ? (selectedKpi === 'expenses' ? 'bg-rose-500' : selectedKpi === 'purchases' ? 'bg-amber-500' : 'bg-pink-500') + ' text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Categoría
                                        </button>
                                        <button
                                            onClick={() => setDetailGrouping('products')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${detailGrouping === 'products' ? (selectedKpi === 'expenses' ? 'bg-rose-500' : selectedKpi === 'purchases' ? 'bg-amber-500' : 'bg-pink-500') + ' text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Productos
                                        </button>
                                        {selectedKpi === 'purchases' && (
                                            <button
                                                onClick={() => setDetailGrouping('providers')}
                                                className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${detailGrouping === 'providers' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                Proveedor
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setDetailGrouping('days')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${detailGrouping === 'days' ? (selectedKpi === 'expenses' ? 'bg-rose-500' : selectedKpi === 'purchases' ? 'bg-amber-500' : 'bg-pink-500') + ' text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Día
                                        </button>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center gap-1 bg-white p-1 rounded-lg shadow-sm">
                                <button
                                    onClick={() => setChartType('bar')}
                                    className={`p-1.5 rounded-md transition-all ${chartType === 'bar' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                                    title="Barras"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                </button>
                                <button
                                    onClick={() => setChartType('pie')}
                                    className={`p-1.5 rounded-md transition-all ${chartType === 'pie' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                                    title="Pastel"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    {(selectedKpi as string) === 'inventory' ? (
                        <div className="animate-in fade-in duration-500">
                             {isLoadingDetails ? (
                                <div className="h-64 flex flex-col items-center justify-center gap-4">
                                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-slate-500 font-bold">Cargando detalles de inventario...</p>
                                </div>
                            ) : inventoryDetailData ? (
                                <div className="space-y-8">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 min-h-[400px]">
                                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                                                <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
                                                Distribución por {inventoryView === 'categories' ? 'Categoría' : 'Top Productos'}
                                            </h4>
                                            <div className="h-72">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={inventoryView === 'categories' ? inventoryDetailData.categories : inventoryDetailData.products.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
                                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                                                        <XAxis type="number" hide />
                                                        <YAxis 
                                                            dataKey="name" 
                                                            type="category" 
                                                            axisLine={false} 
                                                            tickLine={false} 
                                                            width={120}
                                                            tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                                        />
                                                        <Tooltip 
                                                            formatter={(value: any) => formatCurrency(value)}
                                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px' }}
                                                        />
                                                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                                            {(inventoryView === 'categories' ? inventoryDetailData.categories : inventoryDetailData.products.slice(0, 10)).map((entry: any, index: number) => (
                                                                <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'][index % 7]} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 overflow-hidden flex flex-col min-h-[400px]">
                                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                                                <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
                                                Resumen de Valor
                                            </h4>
                                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar max-h-[280px]">
                                                <div className="space-y-2">
                                                    {(inventoryView === 'categories' ? inventoryDetailData.categories : inventoryDetailData.products.slice(0, 15)).map((item: any, idx: number) => (
                                                        <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center shadow-sm">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xs">
                                                                    {inventoryView === 'categories' ? getCategoryEmoji(item.name) : (idx + 1)}
                                                                </div>
                                                                <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{item.name}</span>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-xs font-black text-slate-900">{formatCurrency(item.value)}</p>
                                                                <p className="text-[10px] text-slate-400">
                                                                    {((item.value / inventoryDetailData.totalCost) * 100).toFixed(1)}%
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-slate-200">
                                                <div className="flex justify-between items-center px-2">
                                                    <span className="text-xs font-black text-slate-500 uppercase">Valor Total</span>
                                                    <span className="text-lg font-black text-blue-600">{formatCurrency(inventoryDetailData.totalCost)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Detailed Table */}
                                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Listado Detallado de Productos</h4>
                                            <button 
                                                onClick={() => window.location.href = '/dashboard/inventories/capture'}
                                                className="text-[10px] font-black bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
                                            >
                                                EDITAR INVENTARIO
                                            </button>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 tracking-wider">
                                                        <th className="px-6 py-3">Código</th>
                                                        <th className="px-6 py-3">Producto</th>
                                                        <th className="px-6 py-3">Categoría</th>
                                                        <th className="px-6 py-3 text-right">Stock</th>
                                                        <th className="px-6 py-3 text-right">Precio</th>
                                                        <th className="px-6 py-3 text-right">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {inventoryDetailData.details.map((item: any, idx: number) => (
                                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-6 py-3 text-xs font-medium text-slate-500">{item.Codigo}</td>
                                                            <td className="px-6 py-3 text-xs font-black text-slate-800">{item.Producto}</td>
                                                            <td className="px-6 py-3">
                                                                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">{item.Categoria}</span>
                                                            </td>
                                                            <td className="px-6 py-3 text-xs font-bold text-slate-700 text-right">{item.Cantidad}</td>
                                                            <td className="px-6 py-3 text-xs font-medium text-slate-500 text-right">{formatCurrency(item.Precio)}</td>
                                                            <td className="px-6 py-3 text-xs font-black text-slate-900 text-right">{formatCurrency(item.Total)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                                    <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                    <p className="font-bold">No se encontraron datos para este inventario</p>
                                </div>
                            )}
                        </div>
                    ) : isLoadingDetails ? (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[400px]">
                            <div className="lg:col-span-8 bg-slate-50 animate-pulse rounded-2xl"></div>
                            <div className="lg:col-span-4 flex flex-col gap-4">
                                {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-slate-50 animate-pulse rounded-xl"></div>)}
                            </div>
                        </div>
                    ) : (selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : (selectedKpi as string) === 'waste' ? wasteDetailData : purchaseDetailData) ? (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                            {/* Chart Area */}
                            <div className="lg:col-span-7 h-[400px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    {chartType === 'bar' ? (
                                        <BarChart data={((selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : (selectedKpi as string) === 'waste' ? wasteDetailData : purchaseDetailData) as any)?.[detailGrouping] || []} margin={{ top: 20, right: 30, left: 20, bottom: (((selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : (selectedKpi as string) === 'waste' ? wasteDetailData : purchaseDetailData) as any)?.[detailGrouping] || []).length > 6 ? 60 : 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis 
                                                dataKey="name" 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                                                dy={10}
                                                angle={(((selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : (selectedKpi as string) === 'waste' ? wasteDetailData : purchaseDetailData) as any)?.[detailGrouping] || []).length > 6 ? -45 : 0}
                                                textAnchor={(((selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : (selectedKpi as string) === 'waste' ? wasteDetailData : purchaseDetailData) as any)?.[detailGrouping] || []).length > 6 ? 'end' : 'middle'}
                                                tickFormatter={(value) => {
                                                    const array = (((selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : (selectedKpi as string) === 'waste' ? wasteDetailData : purchaseDetailData) as any)?.[detailGrouping] || []);
                                                    const item = array.find((x: any) => x.name === value);
                                                    return item?.emoji ? `${item.emoji} ${value}` : value;
                                                }}
                                            />
                                            <YAxis 
                                                hide 
                                            />
                                            <Tooltip 
                                                cursor={{ fill: '#f8fafc' }}
                                                content={({ active, payload }) => {
                                                    const currentData = selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : purchaseDetailData;
                                                    const total = selectedKpi === 'sales' ? salesDetailData?.totalSales : selectedKpi === 'payroll' ? payrollDetailData?.totalPayroll : selectedKpi === 'expenses' ? expenseDetailData?.totalExpenses : (selectedKpi as string) === 'waste' ? wasteDetailData?.totalWaste : purchaseDetailData?.totalPurchases;
                                                    if (active && payload && payload.length && currentData && total) {
                                                        return (
                                                            <div className="bg-white/90 backdrop-blur-md p-4 shadow-2xl border border-white/50 rounded-xl">
                                                                <p className="text-xs font-black text-slate-400 uppercase mb-1">{payload[0].payload.emoji ? `${payload[0].payload.emoji} ` : ''}{payload[0].payload.name}</p>
                                                                <p className="text-sm font-black text-slate-900">
                                                                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(payload[0].value as number)}
                                                                </p>
                                                                <p className={`text-[10px] font-bold ${selectedKpi === 'sales' ? 'text-emerald-500' : selectedKpi === 'payroll' ? 'text-indigo-500' : selectedKpi === 'expenses' ? 'text-rose-500' : 'text-amber-500'}`}>
                                                                    {((payload[0].value as number / total) * 100).toFixed(1)}% del total
                                                                </p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Bar 
                                                dataKey="value" 
                                                radius={[6, 6, 0, 0]} 
                                                barSize={48}
                                                cursor="pointer"
                                                onClick={(data, index) => {
                                                    const item = data.payload || data;
                                                    handleDrilldownClick(item, ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'][index % 7]);
                                                }}
                                            >
                                                {(((selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : (selectedKpi as string) === 'waste' ? wasteDetailData : purchaseDetailData) as any)?.[detailGrouping] || []).map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={[
                                                        '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'
                                                    ][index % 7]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    ) : (
                                        <PieChart>
                                            <Pie
                                                data={((selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : (selectedKpi as string) === 'waste' ? wasteDetailData : purchaseDetailData) as any)?.[detailGrouping] || []}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={80}
                                                outerRadius={140}
                                                paddingAngle={5}
                                                dataKey="value"
                                                stroke="none"
                                                cursor="pointer"
                                                onClick={(data, index) => {
                                                    const item = data.payload || data;
                                                    handleDrilldownClick(item, ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'][index % 7]);
                                                }}
                                            >
                                                {(((selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : (selectedKpi as string) === 'waste' ? wasteDetailData : purchaseDetailData) as any)?.[detailGrouping] || []).map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={[
                                                        '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'
                                                    ][index % 7]} />
                                                ))}
                                            </Pie>
                                            <Tooltip 
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        return (
                                                            <div className="bg-white/90 backdrop-blur-md p-4 shadow-2xl border border-white/50 rounded-xl">
                                                                <p className="text-xs font-black text-slate-400 uppercase mb-1">{payload[0].payload.emoji ? `${payload[0].payload.emoji} ` : ''}{payload[0].payload.name}</p>
                                                                <p className="text-sm font-black text-slate-900">
                                                                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(payload[0].value as number)}
                                                                </p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Legend verticalAlign="bottom" height={36}/>
                                        </PieChart>
                                    )}
                                </ResponsiveContainer>
                            </div>

                            {/* Detail Cards Area */}
                            <div className="lg:col-span-5 flex flex-col h-[400px]">
                                <div className="relative mb-3 shrink-0 group">
                                    <div className={`absolute inset-0 bg-gradient-to-r rounded-xl blur-lg opacity-0 transition-opacity duration-500 group-hover:opacity-20 ${selectedKpi === 'sales' ? 'from-emerald-400 to-emerald-200' : selectedKpi === 'payroll' ? 'from-indigo-400 to-indigo-200' : selectedKpi === 'expenses' ? 'from-rose-400 to-rose-200' : 'from-amber-400 to-amber-200'}`}></div>
                                    <div className="relative">
                                        <input 
                                            type="text"
                                            placeholder="Buscar detalle rápido..."
                                            value={cardSearchQuery}
                                            onChange={(e) => setCardSearchQuery(e.target.value)}
                                            className={`w-full px-4 py-3 rounded-xl border bg-white/80 backdrop-blur-md shadow-sm transition-all focus:bg-white pl-11 text-sm font-black text-slate-800 placeholder-slate-400 outline-none ${selectedKpi === 'sales' ? 'border-emerald-100 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10' : selectedKpi === 'payroll' ? 'border-indigo-100 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10' : selectedKpi === 'expenses' ? 'border-rose-100 focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10' : 'border-amber-100 focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10'}`}
                                        />
                                        <svg className={`w-5 h-5 absolute left-4 top-3.5 transition-colors duration-300 ${cardSearchQuery ? (selectedKpi === 'sales' ? 'text-emerald-500' : selectedKpi === 'payroll' ? 'text-indigo-500' : selectedKpi === 'expenses' ? 'text-rose-500' : 'text-amber-500') : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        
                                        {cardSearchQuery && (
                                            <button 
                                                onClick={() => setCardSearchQuery('')}
                                                className="absolute right-3.5 top-3.5 p-0.5 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar flex-1 pb-4">
                                {[...((selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : (selectedKpi as string) === 'waste' ? wasteDetailData : purchaseDetailData) as any)?.[detailGrouping] || []].filter((item: any) => !cardSearchQuery || String(item.name || '').toLowerCase().includes(cardSearchQuery.toLowerCase())).sort((a, b) => b.value - a.value).map((item: any, index: number) => {
                                    const origArr = (((selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : (selectedKpi as string) === 'waste' ? wasteDetailData : purchaseDetailData) as any)?.[detailGrouping] || []);
                                    const origIdx = origArr.findIndex((x: any) => x.name === item.name);
                                    const activeColorIdx = origIdx >= 0 ? origIdx : index;
                                    const total = selectedKpi === 'sales' ? salesDetailData?.totalSales : selectedKpi === 'payroll' ? payrollDetailData?.totalPayroll : selectedKpi === 'expenses' ? expenseDetailData?.totalExpenses : (selectedKpi as string) === 'waste' ? wasteDetailData?.totalWaste : purchaseDetailData?.totalPurchases;
                                    return (
                                        <div 
                                            key={index}
                                            onClick={() => handleDrilldownClick(item, ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'][activeColorIdx % 7])}
                                            className={`bg-white p-4 rounded-xl border border-slate-100 shadow-sm transition-all group flex justify-between items-center hover:shadow-md cursor-pointer ${selectedKpi === 'sales' ? 'hover:border-emerald-200' : selectedKpi === 'payroll' ? 'hover:border-indigo-200' : selectedKpi === 'expenses' ? 'hover:border-rose-200' : 'hover:border-amber-200'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white shadow-md group-hover:scale-110 transition-transform duration-300 text-xl" style={{ backgroundColor: [
                                                    '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'
                                                ][activeColorIdx % 7] }}>
                                                    {['purchases', 'waste'].includes(selectedKpi as string) && ['categories', 'products'].includes(detailGrouping) ? (item.emoji || getCategoryEmoji(String(item.categoryName || item.name || ''))) : String(item.name || '').slice(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-slate-800">
                                                        {item.name}
                                                        {['purchases', 'waste'].includes(selectedKpi as string) && detailGrouping === 'products' && item.categoryName && (
                                                            <span className="font-normal text-slate-500 text-xs ml-2 border border-slate-200 bg-slate-50 px-1.5 py-0.5 rounded-md">
                                                                {item.categoryName}
                                                            </span>
                                                        )}
                                                    </h4>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                                        {item.count > 0 ? `${item.count} ${selectedKpi === 'sales' ? 'Transacciones' : 'Registros'}` : (selectedKpi === 'sales' ? 'Detalle de canal' : selectedKpi === 'payroll' ? 'Detalle de nómina' : selectedKpi === 'expenses' ? 'Detalle de gasto' : 'Detalle')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-slate-900">
                                                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(item.value)}
                                                </p>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black bg-slate-50 ${selectedKpi === 'sales' ? 'text-emerald-600' : selectedKpi === 'payroll' ? 'text-indigo-600' : selectedKpi === 'expenses' ? 'text-rose-600' : 'text-amber-600'}`}>
                                                    {total && total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0'}%
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            <p className="font-bold">No hay datos suficientes para mostrar el análisis</p>
                        </div>
                    )}
                </div>
            )}

            {/* Costing Alerts Section */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xl mt-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-6">
                    <div>
                        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <span className={`w-2 h-8 rounded-full ${costingAlerts.length > 0 ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                            Alertas de Costeo
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Platillos cuyo % de costo real supera el % de costo ideal definido
                        </p>
                    </div>
                    {!isLoadingCostingAlerts && (
                        costingAlerts.length > 0 ? (
                            <span className="text-xs font-black text-red-700 bg-red-50 border border-red-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 uppercase tracking-wider">
                                <AlertTriangle size={14} />
                                {costingAlerts.length} {costingAlerts.length === 1 ? 'platillo excede meta' : 'platillos exceden meta'}
                            </span>
                        ) : (
                            <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 uppercase tracking-wider">
                                <CheckCircle2 size={14} />
                                Todo dentro de meta
                            </span>
                        )
                    )}
                </div>

                {isLoadingCostingAlerts ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-20 bg-slate-50 animate-pulse rounded-xl"></div>
                        ))}
                    </div>
                ) : costingAlerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-emerald-600 bg-emerald-50/40 border border-dashed border-emerald-200 rounded-2xl">
                        <CheckCircle2 size={48} className="mb-3 opacity-70" />
                        <p className="font-black text-lg">¡Excelente!</p>
                        <p className="text-sm text-emerald-700 font-medium mt-1">Todos los platillos están dentro del costo ideal configurado.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {costingAlerts.map((item: any) => {
                            const real = Number(item.PorcentajeCosto) || 0;
                            const ideal = Number(item.PorcentajeCostoIdeal) || 0;
                            const diff = real - ideal;
                            return (
                                <div
                                    key={item.IdProducto}
                                    onClick={() => { window.location.href = '/dashboard/production/dishes'; }}
                                    className="bg-gradient-to-br from-red-50 to-rose-50/50 border border-red-100 rounded-xl p-4 flex justify-between items-center hover:shadow-md hover:border-red-200 transition-all cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="w-12 h-12 rounded-xl bg-white border border-red-100 flex items-center justify-center text-2xl flex-shrink-0 shadow-sm">
                                            {item.ImagenCategoria || '🍽️'}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="text-sm font-black text-slate-800 truncate">{item.Producto}</h4>
                                            <p className="text-[11px] text-slate-500 font-medium truncate">
                                                {item.Codigo}{item.Categoria ? ` · ${item.Categoria}` : ''}{item.SeccionMenu ? ` · ${item.SeccionMenu}` : ''}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className="text-[10px] font-bold text-slate-500">Costo: <span className="text-slate-800">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(item.Costo) || 0)}</span></span>
                                                <span className="text-[10px] font-bold text-slate-500">Precio: <span className="text-slate-800">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(item.Precio) || 0)}</span></span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-3">
                                        <div className="flex items-baseline gap-1 justify-end">
                                            <span className="text-2xl font-black text-red-600 leading-none">{real.toFixed(1)}%</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-bold mt-1">
                                            Ideal: <span className="text-slate-700">{ideal.toFixed(1)}%</span>
                                        </p>
                                        <span className="inline-block mt-1 text-[10px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                                            +{diff.toFixed(1)} pts
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Drilldown Modal */}
            {drilldownItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300">
                    <div className={`bg-white shadow-2xl transition-all duration-300 flex flex-col overflow-hidden ${isModalMaximized ? 'w-full h-full rounded-2xl' : 'w-full max-w-5xl h-[600px] max-h-[90vh] rounded-3xl'}`}>
                        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white shadow-lg text-2xl" style={{ backgroundColor: drilldownItem.color }}>
                                    {drilldownItem.emoji}
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 flex-wrap">
                                        {drilldownItem.name} 
                                        {['purchases', 'waste'].includes(drilldownItem.kpi) && drilldownItem.grouping === 'products' && drilldownItem.categoryName && (
                                            <span className="font-normal text-slate-600 text-sm border border-slate-200 bg-white px-2 py-0.5 rounded-lg ml-1">
                                                {drilldownItem.categoryName}
                                            </span>
                                        )}
                                        <span className="text-[10px] font-bold px-2 py-0.5 bg-white text-slate-500 rounded-full ml-1 border border-slate-200 shadow-sm uppercase tracking-widest">
                                            Desglose Diario &bull; {tPurchases(`months.${selectedMonth}`)} {selectedYear}
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-400 font-bold tracking-wider mt-1">
                                        {drilldownItem.count && drilldownItem.count > 0 ? `${drilldownItem.count} ${drilldownItem.kpi === 'sales' ? 'Transacciones' : 'Registros'}` : 'Detalle'} 
                                        <span className="ml-2 px-2 py-0.5 rounded-md bg-slate-200/50 text-slate-600 font-black">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(drilldownItem.value || 0)}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setIsModalMaximized(!isModalMaximized)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-all bg-white shadow-sm border border-slate-100" title={isModalMaximized ? "Restaurar" : "Maximizar"}>
                                    {isModalMaximized ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" x2="21" y1="10" y2="3"/><line x1="3" x2="10" y1="21" y2="14"/></svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" x2="14" y1="3" y2="10"/><line x1="3" x2="10" y1="21" y2="14"/></svg>
                                    )}
                                </button>
                                <button onClick={() => { setDrilldownItem(null); setIsModalMaximized(false); }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 rounded-full transition-all bg-white shadow-sm border border-slate-100" title="Cerrar">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto bg-slate-50/50">
                            {isDrilldownLoading ? (
                                <div className="h-full w-full bg-slate-100/50 rounded-2xl animate-pulse"></div>
                            ) : drilldownData.length > 0 ? (
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                                    <div className="lg:col-span-8 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm h-full max-h-[400px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={drilldownData} margin={{ top: 20, right: 30, left: 10, bottom: drilldownData.length > 15 ? 50 : 10 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis 
                                                    dataKey="name" 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                                                    dy={12}
                                                    tickFormatter={(value) => `Día ${value}`}
                                                    angle={drilldownData.length > 15 ? -45 : 0}
                                                    textAnchor={drilldownData.length > 15 ? 'end' : 'middle'}
                                                />
                                                <YAxis hide />
                                                <Tooltip 
                                                    cursor={{ fill: '#f8fafc' }}
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            return (
                                                                <div className="bg-white text-slate-800 text-xs font-bold px-4 py-3 rounded-xl shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)] border border-slate-200">
                                                                    <p className="mb-1 text-slate-400">Día {payload[0].payload.name}</p>
                                                                    <p className="text-xl text-slate-900 font-black">
                                                                        {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(payload[0].value as number)}
                                                                    </p>
                                                                    <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">
                                                                        {payload[0].payload.count} operaciones
                                                                    </p>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Bar 
                                                    dataKey="value" 
                                                    fill={drilldownItem.color} 
                                                    radius={[6, 6, 0, 0]} 
                                                    maxBarSize={45}
                                                >
                                                    {drilldownData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={drilldownItem.color} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="lg:col-span-4 flex flex-col gap-3 h-full max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                        {[...drilldownData].map((item, index) => (
                                            <div key={index} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center hover:shadow-md transition-all group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-white shadow-sm text-xs group-hover:scale-110 transition-transform" style={{ backgroundColor: drilldownItem.color }}>
                                                        {item.name}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-black text-slate-800">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(item.value)}</h4>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                            {item.count} movs
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 font-bold bg-white rounded-2xl border border-dashed border-slate-200">
                                    <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                    No hay movimientos registrados para esta métrica.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Total Cost vs Budget Modal */}
            {isTotalCostModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className={`bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-300 border ${totalActualPercent <= totalBudgetPercent ? 'border-purple-200' : 'border-orange-200'}`}>
                        {/* Header */}
                        <div className={`px-5 py-3 flex justify-between items-center border-b ${totalActualPercent <= totalBudgetPercent ? 'bg-gradient-to-r from-purple-50 to-purple-50/50 border-purple-100' : 'bg-gradient-to-r from-orange-50 to-orange-50/50 border-orange-100'}`}>
                            <div>
                                <h2 className="text-base font-bold text-gray-900">Análisis Global</h2>
                                <p className={`text-[11px] font-medium mt-0.5 ${totalActualPercent <= totalBudgetPercent ? 'text-purple-600' : 'text-orange-600'}`}>Costo Total vs Presupuesto • {branches.find(b => b.IdSucursal.toString() === selectedBranch)?.Sucursal || 'Global'}</p>
                            </div>
                            <button onClick={() => setIsTotalCostModalOpen(false)} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${totalActualPercent <= totalBudgetPercent ? 'hover:bg-purple-100 text-purple-400 hover:text-purple-600' : 'hover:bg-orange-100 text-orange-400 hover:text-orange-600'}`}>
                                <X size={16} strokeWidth={2.5} />
                            </button>
                        </div>

                        <div className="p-4 space-y-3">
                            <div className="text-center space-y-1.5">
                                <p className={`text-[10px] font-bold uppercase tracking-widest ${totalActualPercent <= totalBudgetPercent ? 'text-purple-600' : 'text-orange-600'}`}>Costo Total Acumulado</p>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalActualValue)}
                                </h1>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className={`p-3 rounded-lg border text-center ${totalActualPercent <= totalBudgetPercent ? 'bg-purple-50 border-purple-100' : 'bg-orange-50 border-orange-100'}`}>
                                    <p className={`text-[8px] font-bold uppercase tracking-widest mb-0.5 ${totalActualPercent <= totalBudgetPercent ? 'text-purple-600' : 'text-orange-600'}`}>Costo %</p>
                                    <p className={`text-lg font-bold ${totalActualPercent <= totalBudgetPercent ? 'text-purple-700' : 'text-orange-700'}`}>{totalActualPercent.toFixed(1)}%</p>
                                </div>
                                <div className={`p-3 rounded-lg border text-center ${totalActualPercent <= totalBudgetPercent ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                                    <p className={`text-[8px] font-bold uppercase tracking-widest mb-0.5 ${totalActualPercent <= totalBudgetPercent ? 'text-emerald-600' : 'text-amber-600'}`}>Meta %</p>
                                    <p className={`text-lg font-bold ${totalActualPercent <= totalBudgetPercent ? 'text-emerald-700' : 'text-amber-700'}`}>{totalBudgetPercent.toFixed(1)}%</p>
                                </div>
                            </div>

                            <div className={`p-3 rounded-lg border-l-4 flex items-start gap-2 ${totalActualPercent <= totalBudgetPercent ? 'bg-emerald-50 border-emerald-400' : 'bg-orange-50 border-orange-400'}`}>
                                <span className="text-lg flex-shrink-0">{totalActualPercent <= totalBudgetPercent ? '✓' : '⚠'}</span>
                                <div>
                                    <p className={`text-[10px] font-bold uppercase ${totalActualPercent <= totalBudgetPercent ? 'text-emerald-700' : 'text-orange-700'}`}>
                                        {totalActualPercent <= totalBudgetPercent ? 'ÓPTIMO' : 'EXCEDIDO'}
                                    </p>
                                    <p className={`text-[9px] font-medium ${totalActualPercent <= totalBudgetPercent ? 'text-emerald-600' : 'text-orange-600'}`}>
                                        {Math.abs(diffPercent).toFixed(1)}% {totalActualPercent <= totalBudgetPercent ? 'bajo' : 'sobre'} meta
                                    </p>
                                </div>
                            </div>

                            {/* GAUGE CHART */}
                            <div className="flex justify-center mb-6">
                                <div className="w-full max-w-[320px] h-[180px] relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                dataKey="value"
                                                startAngle={180}
                                                endAngle={0}
                                                data={[
                                                    { name: 'A', value: totalBudgetPercent, fill: '#10b981' },
                                                    { name: 'B', value: Math.max(0, 100 - totalBudgetPercent), fill: '#ef4444' }
                                                ]}
                                                cx="50%"
                                                cy="85%"
                                                innerRadius={80}
                                                outerRadius={120}
                                                stroke="none"
                                            />
                                            
                                            {/* Needle Layer */}
                                            {(() => {
                                                const iR = 0;
                                                const oR = 120;
                                                const RADIAN = Math.PI / 180;
                                                const ang = 180.0 * (1 - Math.min(100, Math.max(0, totalActualPercent)) / 100);
                                                const sin = Math.sin(-RADIAN * ang);
                                                const cos = Math.cos(-RADIAN * ang);
                                                const length = (iR + 2 * oR) / 3;

                                                const cx = 160; 
                                                const cy = 153; 

                                                return (
                                                    <g>
                                                        <circle cx={cx} cy={cy} r={5} fill="#ef4444" stroke="none" />
                                                        <path 
                                                            d={`M${cx - 2} ${cy} L${cx + 2} ${cy} L${cx + length * cos} ${cy + length * sin} Z`} 
                                                            fill="#ef4444" 
                                                            stroke="none" 
                                                        />
                                                    </g>
                                                );
                                            })()}
                                        </PieChart>
                                    </ResponsiveContainer>

                                    {/* HTML/CSS Label Overlays (Reliable Rendering) */}
                                    <div className="absolute bottom-[10%] left-0 text-[10px] font-black text-slate-400">0%</div>
                                    <div className="absolute bottom-[10%] right-0 text-[10px] font-black text-slate-400">100%</div>
                                    
                                    {/* Budget Marker Label */}
                                    {(() => {
                                        const budgetAngle = (totalBudgetPercent / 100) * 180; // 0 to 180
                                        const radius = 135; // px
                                        const radian = (Math.PI / 180) * (180 - budgetAngle);
                                        const x = 160 + radius * Math.cos(radian);
                                        const y = 153 - radius * Math.sin(radian);
                                        
                                        return (
                                            <div 
                                                className="absolute text-[9px] font-black text-rose-500 whitespace-nowrap pointer-events-none select-none"
                                                style={{ 
                                                    left: `${x}px`, 
                                                    top: `${y}px`,
                                                    transform: 'translate(-50%, -100%)'
                                                }}
                                            >
                                                SUMA % PRESUPUESTO: {totalBudgetPercent.toFixed(1)}%
                                            </div>
                                        );
                                    })()}

                                    <div className="absolute bottom-[15%] left-1/2 -translate-x-1/2 text-center">
                                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest block">Costo Total</span>
                                        <h3 className="text-xl font-black text-slate-800">{totalActualPercent.toFixed(1)}%</h3>
                                    </div>
                                </div>
                            </div>

                            <div className={`p-3 rounded-lg border-l-4 ${utilityPercent < 0 ? 'bg-rose-50 border-rose-400' : utilityPercent < 10 ? 'bg-amber-50 border-amber-400' : 'bg-emerald-50 border-emerald-400'}`}>
                                <p className={`text-[10px] font-bold uppercase mb-1 ${utilityPercent < 0 ? 'text-rose-700' : utilityPercent < 10 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                    Utilidad Teórica
                                </p>
                                <div className="flex items-baseline gap-2">
                                    <p className={`text-2xl font-bold ${utilityPercent < 0 ? 'text-rose-700' : utilityPercent < 10 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                        {utilityPercent.toFixed(1)}%
                                    </p>
                                    <p className={`text-[11px] font-medium ${utilityPercent < 0 ? 'text-rose-600' : utilityPercent < 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                        ({new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', notation: 'compact' }).format(utilityAmount)})
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </PageShell>
        </div>
    );
}
