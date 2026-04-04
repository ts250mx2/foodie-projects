'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    Cell, PieChart, Pie, Legend
} from 'recharts';

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

    // Operating Expense KPI State
    const [totalOperatingExpense, setTotalOperatingExpense] = useState<number>(0);
    const [operatingExpenseObjective, setOperatingExpenseObjective] = useState<number>(0);

    // Raw Material KPI State
    const [totalRawMaterial, setTotalRawMaterial] = useState<number>(0);
    const [rawMaterialObjective, setRawMaterialObjective] = useState<number>(0);

    // Waste KPI State
    const [totalWaste, setTotalWaste] = useState<number>(0);

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
        days: any[];
        totalPurchases: number;
    } | null>(null);
    const [wasteDetailData, setWasteDetailData] = useState<{
        categories: any[];
        days: any[];
        totalWaste: number;
    } | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
    const [detailGrouping, setDetailGrouping] = useState<string>('channels');
    const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
    const [cardSearchQuery, setCardSearchQuery] = useState<string>('');
    const [isDrilldownLoading, setIsDrilldownLoading] = useState<boolean>(false);
    const [drilldownItem, setDrilldownItem] = useState<{name: string, kpi: string, grouping: string, emoji?: string, color: string, count?: number, value?: number} | null>(null);
    const [drilldownData, setDrilldownData] = useState<any[]>([]);

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

        const savedMonth = localStorage.getItem('dashboardSelectedMonth');
        const savedYear = localStorage.getItem('dashboardSelectedYear');
        if (savedMonth) setSelectedMonth(parseInt(savedMonth));
        if (savedYear) setSelectedYear(parseInt(savedYear));
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
        localStorage.setItem('dashboardSelectedMonth', selectedMonth.toString());
    }, [selectedMonth]);

    useEffect(() => {
        localStorage.setItem('dashboardSelectedYear', selectedYear.toString());
    }, [selectedYear]);

    const handleDrilldownClick = async (item: any, colorHex: string) => {
        if (detailGrouping === 'days') return;
        if (selectedKpi === 'sales' && String(item.name || '') === 'Efectivo') return;
        
        setDrilldownItem({ name: item.name, kpi: selectedKpi as string, grouping: detailGrouping, emoji: item.emoji || getCategoryEmoji(String(item.name || '')), color: colorHex, count: item.count, value: item.value });
        setIsDrilldownLoading(true);
        setDrilldownData([]);

        try {
            const response = await fetch(`/api/dashboard/drilldown?projectId=${project?.idProyecto}&branchId=${selectedBranch}&month=${selectedMonth}&year=${selectedYear}&kpi=${selectedKpi}&grouping=${detailGrouping}&itemName=${encodeURIComponent(item.name)}`);
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
        } finally {
            setIsLoadingKpi(false);
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
            const response = await fetch(`/api/dashboard/payroll-details?projectId=${project.idProyecto}&branchId=${selectedBranch}&month=${selectedMonth}&year=${selectedYear}`);
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
                if (!['categories', 'days'].includes(detailGrouping)) {
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
        if (!project?.idProyecto || !selectedBranch || selectedKpi !== 'waste') return;

        setIsLoadingDetails(true);
        try {
            const response = await fetch(`/api/dashboard/waste-details?projectId=${project.idProyecto}&branchId=${selectedBranch}&month=${selectedMonth}&year=${selectedYear}`);
            const data = await response.json();
            if (data.success) {
                setWasteDetailData(data.data);
                if (!['categories', 'days'].includes(detailGrouping)) {
                    setDetailGrouping('categories');
                }
            }
        } catch (error) {
            console.error('Error fetching waste details:', error);
        } finally {
            setIsLoadingDetails(false);
        }
    };

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
        }
    }, [selectedKpi, selectedMonth, selectedYear, selectedBranch]);

    useEffect(() => {
        fetchSalesKpi();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project, selectedBranch, selectedMonth, selectedYear]);

    return (
        <div className="flex flex-col gap-6 p-6 min-h-screen">
            <div className="sticky top-16 z-30 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-sm border border-gray-100">
                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold text-gray-800 mb-1">{t('title')}</h1>
                    <p className="text-sm text-gray-500">{t('features.managementDesc')}</p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Branch Selector */}
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1">{tPurchases('selectBranch')}</label>
                        <select
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm bg-white"
                        >
                            {branches.length === 0 && <option value="">{tPurchases('noBranches')}</option>}
                            {branches.map(branch => (
                                <option key={branch.IdSucursal} value={branch.IdSucursal}>
                                    {branch.Sucursal}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1">{tPurchases('month')}</label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm bg-white"
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i} value={i}>{tPurchases(`months.${i}`)}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1">{tPurchases('year')}</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm bg-white"
                        >
                            {years.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mt-2">
                {/* Sales KPI Card */}
                <div 
                    onClick={() => setSelectedKpi(selectedKpi === 'sales' ? null : 'sales')}
                    className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group text-left cursor-pointer hover:-translate-y-1 ${selectedKpi === 'sales' ? 'bg-gradient-to-b from-emerald-50/80 to-white border-emerald-300 ring-4 ring-emerald-500/10 shadow-xl shadow-emerald-500/10 z-10' : 'bg-white border-slate-100/80 shadow-sm hover:shadow-md hover:border-slate-200'}`}
                >
                    <div className="absolute -right-6 -top-6 p-4 opacity-[0.03] group-hover:opacity-10 group-hover:rotate-12 group-hover:scale-125 transition-all duration-500 ease-out">
                        <svg className="w-20 h-20 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div className="flex flex-col h-full justify-between relative z-10">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Ventas Totales</span>
                            {isLoadingKpi ? (
                                <div className="h-8 w-32 bg-slate-200 animate-pulse rounded mt-2 mb-2"></div>
                            ) : (
                                <h2 className="text-3xl font-black tracking-tight text-slate-800 mb-2">
                                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalSales)}
                                </h2>
                            )}
                        </div>

                        {!isLoadingKpi && (
                            <div className="flex flex-col gap-2 border-t border-slate-50 pt-4 mt-2">
                                <div className="flex justify-between items-center text-xs font-bold">
                                    <span className="text-slate-500">Venta Presupuesto</span>
                                    <span className="text-slate-700">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(salesObjective)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-bold">
                                    <span className="text-slate-500">% Alcance</span>
                                    {salesObjective > 0 ? (
                                        <div className={`flex items-center gap-1 font-bold ${totalSales >= salesObjective ? 'text-emerald-600' : 'text-rose-500'}`}>
                                            <span className={`px-2 py-0.5 rounded-sm ${totalSales >= salesObjective ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                                                {((totalSales / salesObjective) * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-slate-400 px-2 py-0.5 bg-slate-50 rounded-sm">Sin presu.</span>
                                    )}
                                </div>
                                
                                {salesObjective > 0 && (
                                    <div className="flex justify-between items-center text-xs font-bold -mt-1">
                                        <span className="text-slate-400 text-[10px]">Diferencia vs Meta</span>
                                        <span className={`text-[10px] flex items-center gap-1 ${totalSales >= salesObjective ? 'text-emerald-600' : 'text-rose-500'}`}>
                                            {totalSales >= salesObjective ? '+' : ''}{(((totalSales / salesObjective) * 100) - 100).toFixed(1)}% {totalSales >= salesObjective ? '🚀' : '⚠️'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Payroll KPI Card */}
                <div 
                    onClick={() => setSelectedKpi(selectedKpi === 'payroll' ? null : 'payroll')}
                    className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group text-left cursor-pointer hover:-translate-y-1 ${selectedKpi === 'payroll' ? 'bg-gradient-to-b from-indigo-50/80 to-white border-indigo-300 ring-4 ring-indigo-500/10 shadow-xl shadow-indigo-500/10 z-10' : 'bg-white border-slate-100/80 shadow-sm hover:shadow-md hover:border-slate-200'}`}
                >
                    <div className="absolute -right-6 -top-6 p-4 opacity-[0.03] group-hover:opacity-10 group-hover:rotate-12 group-hover:scale-125 transition-all duration-500 ease-out">
                        <svg className="w-20 h-20 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <div className="flex flex-col h-full justify-between relative z-10">
                        <div>
                            <span className={`text-[10px] font-black uppercase tracking-widest mb-1 block ${selectedKpi === 'payroll' ? 'text-indigo-500' : 'text-slate-400'}`}>Costo Nómina</span>
                            {isLoadingKpi ? (
                                <div className="h-8 w-32 bg-slate-200 animate-pulse rounded mt-2 mb-2"></div>
                            ) : (
                                <h2 className="text-3xl font-black tracking-tight text-slate-800 mb-2">
                                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalPayroll)}
                                </h2>
                            )}
                        </div>


                        {!isLoadingKpi && (
                            <div className="flex flex-col gap-2 border-t border-slate-50 pt-4 mt-2">
                                <div className="flex justify-between items-center text-xs font-bold">
                                    <span className="text-slate-500">% Costo Nómina</span>
                                    <span className={`px-2 py-0.5 rounded-sm ${totalSales > 0 ? (((totalPayroll / totalSales) * 100) <= payrollObjective || payrollObjective === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500') : 'bg-slate-50 text-slate-700'}`}>
                                        {totalSales > 0 ? `${((totalPayroll / totalSales) * 100).toFixed(2)}%` : '0.00%'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-bold">
                                    <span className="text-slate-500">% Presupuesto</span>
                                    <span className="text-slate-700">
                                        {payrollObjective > 0 ? `${payrollObjective}%` : 'Sin presu.'}
                                    </span>
                                </div>
                                {payrollObjective > 0 && totalSales > 0 && (
                                    <div className="flex justify-between items-center text-xs font-bold -mt-1">
                                        <span className="text-slate-400 text-[10px]">Diferencia vs Meta</span>
                                        <span className={`text-[10px] flex items-center gap-1 ${((totalPayroll / totalSales) * 100) <= payrollObjective ? 'text-emerald-600' : 'text-rose-500'}`}>
                                            {(((totalPayroll / totalSales) * 100) - payrollObjective) > 0 ? '+' : ''}{(((totalPayroll / totalSales) * 100) - payrollObjective).toFixed(2)}% {((totalPayroll / totalSales) * 100) <= payrollObjective ? '✅' : '⚠️'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Operating Expense KPI Card */}
                <div 
                    onClick={() => setSelectedKpi(selectedKpi === 'expenses' ? null : 'expenses')}
                    className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group text-left cursor-pointer hover:-translate-y-1 ${selectedKpi === 'expenses' ? 'bg-gradient-to-b from-rose-50/80 to-white border-rose-300 ring-4 ring-rose-500/10 shadow-xl shadow-rose-500/10 z-10' : 'bg-white border-slate-100/80 shadow-sm hover:shadow-md hover:border-slate-200'}`}
                >
                    <div className="absolute -right-6 -top-6 p-4 opacity-[0.03] group-hover:opacity-10 group-hover:rotate-12 group-hover:scale-125 transition-all duration-500 ease-out">
                        <svg className="w-20 h-20 text-rose-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <div className="flex flex-col h-full justify-between relative z-10">
                        <div>
                            <span className={`text-[10px] font-black uppercase tracking-widest mb-1 block ${selectedKpi === 'expenses' ? 'text-rose-500' : 'text-slate-400'}`}>Gasto Operativo</span>
                            {isLoadingKpi ? (
                                <div className="h-8 w-32 bg-slate-200 animate-pulse rounded mt-2 mb-2"></div>
                            ) : (
                                <h2 className="text-3xl font-black tracking-tight text-slate-800 mb-2">
                                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalOperatingExpense)}
                                </h2>
                            )}
                        </div>


                        {!isLoadingKpi && (
                            <div className="flex flex-col gap-2 border-t border-slate-50 pt-4 mt-2">
                                <div className="flex justify-between items-center text-xs font-bold">
                                    <span className="text-slate-500">% Gasto Operativo</span>
                                    <span className={`px-2 py-0.5 rounded-sm ${totalSales > 0 ? (((totalOperatingExpense / totalSales) * 100) <= operatingExpenseObjective || operatingExpenseObjective === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500') : 'bg-slate-50 text-slate-700'}`}>
                                        {totalSales > 0 ? `${((totalOperatingExpense / totalSales) * 100).toFixed(2)}%` : '0.00%'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-bold">
                                    <span className="text-slate-500">% Presupuesto</span>
                                    <span className="text-slate-700">
                                        {operatingExpenseObjective > 0 ? `${operatingExpenseObjective}%` : 'Sin presu.'}
                                    </span>
                                </div>
                                {operatingExpenseObjective > 0 && totalSales > 0 && (
                                    <div className="flex justify-between items-center text-xs font-bold -mt-1">
                                        <span className="text-slate-400 text-[10px]">Diferencia vs Meta</span>
                                        <span className={`text-[10px] flex items-center gap-1 ${((totalOperatingExpense / totalSales) * 100) <= operatingExpenseObjective ? 'text-emerald-600' : 'text-rose-500'}`}>
                                            {(((totalOperatingExpense / totalSales) * 100) - operatingExpenseObjective) > 0 ? '+' : ''}{(((totalOperatingExpense / totalSales) * 100) - operatingExpenseObjective).toFixed(2)}% {((totalOperatingExpense / totalSales) * 100) <= operatingExpenseObjective ? '✅' : '⚠️'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Raw Material KPI Card */}
                <div 
                    onClick={() => setSelectedKpi(selectedKpi === 'purchases' ? null : 'purchases')}
                    className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group text-left cursor-pointer hover:-translate-y-1 ${selectedKpi === 'purchases' ? 'bg-gradient-to-b from-amber-50/80 to-white border-amber-300 ring-4 ring-amber-500/10 shadow-xl shadow-amber-500/10 z-10' : 'bg-white border-slate-100/80 shadow-sm hover:shadow-md hover:border-slate-200'}`}
                >
                    <div className="absolute -right-6 -top-6 p-4 opacity-[0.03] group-hover:opacity-10 group-hover:rotate-12 group-hover:scale-125 transition-all duration-500 ease-out">
                        <svg className="w-20 h-20 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <div className="flex flex-col h-full justify-between relative z-10">
                        <div>
                            <span className={`text-[10px] font-black uppercase tracking-widest mb-1 block ${selectedKpi === 'purchases' ? 'text-amber-500' : 'text-slate-400'}`}>Compras Materia Prima</span>
                            {isLoadingKpi ? (
                                <div className="h-8 w-32 bg-slate-200 animate-pulse rounded mt-2 mb-2"></div>
                            ) : (
                                <h2 className="text-3xl font-black tracking-tight text-slate-800 mb-2">
                                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalRawMaterial)}
                                </h2>
                            )}
                        </div>

                        {!isLoadingKpi && (
                            <div className="flex flex-col gap-2 border-t border-slate-50 pt-4 mt-2">
                                <div className="flex justify-between items-center text-xs font-bold">
                                    <span className="text-slate-500">% Materia Prima</span>
                                    <span className={`px-2 py-0.5 rounded-sm ${totalSales > 0 ? (((totalRawMaterial / totalSales) * 100) <= rawMaterialObjective || rawMaterialObjective === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500') : 'bg-slate-50 text-slate-700'}`}>
                                        {totalSales > 0 ? `${((totalRawMaterial / totalSales) * 100).toFixed(2)}%` : '0.00%'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-bold">
                                    <span className="text-slate-500">% Presupuesto</span>
                                    <span className="text-slate-700">
                                        {rawMaterialObjective > 0 ? `${rawMaterialObjective}%` : 'Sin presu.'}
                                    </span>
                                </div>
                                {rawMaterialObjective > 0 && totalSales > 0 && (
                                    <div className="flex justify-between items-center text-xs font-bold -mt-1">
                                        <span className="text-slate-400 text-[10px]">Diferencia vs Meta</span>
                                        <span className={`text-[10px] flex items-center gap-1 ${((totalRawMaterial / totalSales) * 100) <= rawMaterialObjective ? 'text-emerald-600' : 'text-rose-500'}`}>
                                            {(((totalRawMaterial / totalSales) * 100) - rawMaterialObjective) > 0 ? '+' : ''}{(((totalRawMaterial / totalSales) * 100) - rawMaterialObjective).toFixed(2)}% {((totalRawMaterial / totalSales) * 100) <= rawMaterialObjective ? '✅' : '⚠️'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Waste KPI Card */}
                <div 
                    onClick={() => setSelectedKpi((selectedKpi as string) === 'waste' ? null : 'waste')}
                    className={`p-4 rounded-xl border transition-all relative overflow-hidden group text-left cursor-pointer ${(selectedKpi as string) === 'waste' ? 'bg-pink-50 border-pink-200 shadow-md ring-2 ring-pink-500 ring-opacity-20' : 'bg-white border-slate-100 shadow-sm hover:shadow-md'}`}
                >
                    <div className="absolute -right-6 -top-6 p-4 opacity-[0.03] group-hover:opacity-10 group-hover:rotate-12 group-hover:scale-125 transition-all duration-500 ease-out">
                        <svg className="w-20 h-20 text-rose-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </div>
                    <div className="flex flex-col h-full justify-between relative z-10">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Mermas</span>
                            {isLoadingKpi ? (
                                <div className="h-8 w-32 bg-slate-200 animate-pulse rounded mt-2 mb-2"></div>
                            ) : (
                                <h2 className="text-3xl font-black tracking-tight text-slate-800 mb-2">
                                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalWaste)}
                                </h2>
                            )}
                        </div>

                        {!isLoadingKpi && (
                            <div className="flex flex-col gap-2 border-t border-slate-50 pt-4 mt-2">
                                <div className="flex justify-between items-center text-xs font-bold">
                                    <span className="text-slate-500">% Mermas</span>
                                    <span className={`px-2 py-0.5 rounded-sm ${totalSales > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-700'}`}>
                                        {totalSales > 0 ? `${((totalWaste / totalSales) * 100).toFixed(2)}%` : '0.00%'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-bold">
                                    <span className="text-slate-500">Sobre Ventas</span>
                                    <span className="text-slate-400 italic text-right text-[10px]">
                                        {totalSales > 0 ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalSales) : 'Sin ventas'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Detail Section (Generic for Sales, Payroll, Expenses or Purchases) */}
            {(selectedKpi === 'sales' || selectedKpi === 'payroll' || selectedKpi === 'expenses' || selectedKpi === 'purchases') && (
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xl animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                        <div>
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <span className={`w-2 h-8 rounded-full ${selectedKpi === 'sales' ? 'bg-emerald-500' : selectedKpi === 'payroll' ? 'bg-indigo-500' : selectedKpi === 'expenses' ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
                                {selectedKpi === 'sales' ? 'Análisis Detallado de Ventas' : selectedKpi === 'payroll' ? 'Análisis Detallado de Nómina' : selectedKpi === 'expenses' ? 'Análisis Detallado de Gastos' : 'Análisis Detallado de Compras'}
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">Desglose porcentual y comparativo por diversas dimensiones</p>
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
                                ) : (
                                    <>
                                        <button
                                            onClick={() => setDetailGrouping('categories')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${detailGrouping === 'categories' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Categoría
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
                                            className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${detailGrouping === 'days' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
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

                    {isLoadingDetails ? (
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
                                            <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={48}>
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
                                                    {['purchases', 'waste'].includes(selectedKpi as string) && detailGrouping === 'categories' ? (item.emoji || getCategoryEmoji(String(item.name || ''))) : String(item.name || '').slice(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-slate-800">{item.name}</h4>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                        {item.count > 0 ? `${item.count} ${selectedKpi === 'sales' ? 'Transacciones' : 'Registros'}` : (selectedKpi === 'sales' ? 'Detalle de canal' : selectedKpi === 'payroll' ? 'Detalle de nómina' : selectedKpi === 'expenses' ? 'Detalle de gasto' : 'Detalle de compra')}
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

            {/* Drilldown Modal */}
            {drilldownItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col h-[600px] max-h-[90vh]">
                        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white shadow-lg text-2xl" style={{ backgroundColor: drilldownItem.color }}>
                                    {drilldownItem.emoji || drilldownItem.name.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                        {drilldownItem.name} 
                                        <span className="text-[10px] font-bold px-2 py-0.5 bg-white text-slate-500 rounded-full ml-1 border border-slate-200 shadow-sm uppercase tracking-widest">
                                            Desglose Diario
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-400 font-bold tracking-wider mt-1">
                                        {drilldownItem.count && drilldownItem.count > 0 ? `${drilldownItem.count} ${drilldownItem.kpi === 'sales' ? 'Transacciones' : 'Registros'}` : 'Detalle'} 
                                        <span className="ml-2 px-2 py-0.5 rounded-md bg-slate-200/50 text-slate-600 font-black">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(drilldownItem.value || 0)}</span>
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setDrilldownItem(null)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-all bg-white shadow-sm border border-slate-100">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
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
        </div>
    );
}
