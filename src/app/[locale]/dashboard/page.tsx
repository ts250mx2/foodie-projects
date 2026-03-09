'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

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

    const [isLoadingKpi, setIsLoadingKpi] = useState<boolean>(true);

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
            } else {
                setTotalSales(0);
                setSalesObjective(0);
                setTotalPayroll(0);
                setPayrollObjective(0);
                setTotalOperatingExpense(0);
                setOperatingExpenseObjective(0);
                setTotalRawMaterial(0);
                setRawMaterialObjective(0);
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-2">
                {/* Sales KPI Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group text-left">
                    <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
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
                                <h2 className="text-2xl font-black text-slate-900 mb-2">
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
                            </div>
                        )}
                    </div>
                </div>

                {/* Payroll KPI Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group text-left">
                    <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                        <svg className="w-20 h-20 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <div className="flex flex-col h-full justify-between relative z-10">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Costo de Nómina</span>
                            {isLoadingKpi ? (
                                <div className="h-8 w-32 bg-slate-200 animate-pulse rounded mt-2 mb-2"></div>
                            ) : (
                                <h2 className="text-2xl font-black text-slate-900 mb-2">
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
                            </div>
                        )}
                    </div>
                </div>

                {/* Operating Expense KPI Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group text-left">
                    <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                        <svg className="w-20 h-20 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div className="flex flex-col h-full justify-between relative z-10">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Gasto Operativo</span>
                            {isLoadingKpi ? (
                                <div className="h-8 w-32 bg-slate-200 animate-pulse rounded mt-2 mb-2"></div>
                            ) : (
                                <h2 className="text-2xl font-black text-slate-900 mb-2">
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
                            </div>
                        )}
                    </div>
                </div>

                {/* Raw Material KPI Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group text-left">
                    <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                        <svg className="w-20 h-20 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <div className="flex flex-col h-full justify-between relative z-10">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Materia Prima</span>
                            {isLoadingKpi ? (
                                <div className="h-8 w-32 bg-slate-200 animate-pulse rounded mt-2 mb-2"></div>
                            ) : (
                                <h2 className="text-2xl font-black text-slate-900 mb-2">
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
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
