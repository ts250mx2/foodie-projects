'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

import ProductionCaptureModal from '@/components/ProductionCaptureModal';

interface Branch {
    IdSucursal: number;
    Sucursal: string;
}

interface MonthlyProductionSummary {
    day: number;
    totalCost: number;
    itemCount: number;
    items: {
        product: string;
        quantity: number;
        total: number;
    }[];
}

export default function ProductionCapturePage() {
    const t = useTranslations('Production');
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [project, setProject] = useState<any>(null);
    const [monthlyData, setMonthlyData] = useState<Record<number, MonthlyProductionSummary>>({});

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // Generate years
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 7 }, (_, i) => currentYear - 5 + i);
    const weekDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchBranches();

            // Load persisted filters
            const savedBranch = localStorage.getItem('lastSelectedBranchProduction');
            const savedMonth = localStorage.getItem('lastSelectedMonthProduction');
            const savedYear = localStorage.getItem('lastSelectedYearProduction');

            if (savedBranch) setSelectedBranch(savedBranch);
            if (savedMonth) setSelectedMonth(parseInt(savedMonth));
            if (savedYear) setSelectedYear(parseInt(savedYear));
        }
    }, [project]);

    useEffect(() => {
        if (selectedBranch) localStorage.setItem('lastSelectedBranchProduction', selectedBranch);
    }, [selectedBranch]);

    useEffect(() => {
        localStorage.setItem('lastSelectedMonthProduction', selectedMonth.toString());
    }, [selectedMonth]);

    useEffect(() => {
        localStorage.setItem('lastSelectedYearProduction', selectedYear.toString());
    }, [selectedYear]);

    useEffect(() => {
        if (project?.idProyecto && selectedBranch) {
            fetchMonthlyData();
        }
    }, [project, selectedBranch, selectedMonth, selectedYear]);

    const fetchBranches = async () => {
        try {
            const response = await fetch(`/api/branches?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success && data.data.length > 0) {
                setBranches(data.data);

                const savedBranch = localStorage.getItem('lastSelectedBranchProduction');
                if (!savedBranch && !selectedBranch) {
                    setSelectedBranch(data.data[0].IdSucursal.toString());
                }
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        }
    };

    const fetchMonthlyData = async () => {
        if (!project || !selectedBranch) return;
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                month: selectedMonth.toString(),
                year: selectedYear.toString()
            });
            const response = await fetch(`/api/production/monthly?${params}`);
            const data = await response.json();

            if (data.success) {
                // Transform list to map keyed by day
                const map: Record<number, MonthlyProductionSummary> = {};
                data.data.forEach((item: any) => {
                    map[item.day] = item;
                });
                setMonthlyData(map);
            }
        } catch (error) {
            console.error('Error fetching monthly production:', error);
        }
    };

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

    const handleDayClick = (date: Date) => {
        setSelectedDate(date);
        setIsModalOpen(true);
    };

    return (
        <div className="flex flex-col min-h-screen p-6 gap-4">
            <div className="sticky top-16 z-30 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-sm">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    🍳 {t('title') || 'Captura de Producción'}
                </h1>

                <div className="flex items-center gap-4">
                    {/* Branch Selector */}
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1">{t('branch') || 'Sucursal'}</label>
                        <select
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {branches.length === 0 && <option>{t('noBranches') || 'Sin sucursales'}</option>}
                            {branches.map(branch => (
                                <option key={branch.IdSucursal} value={branch.IdSucursal}>
                                    {branch.Sucursal}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1">{t('month') || 'Mes'}</label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i} value={i}>{t(`months.${i}`) || new Date(0, i).toLocaleString('es-ES', { month: 'long' })}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1">{t('year') || 'Año'}</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
                <div className="grid grid-cols-7 bg-blue-500 border-b border-blue-600">
                    {weekDays.map(day => (
                        <div key={day} className="py-3 text-center text-sm font-semibold text-white uppercase tracking-wider">
                            {t(`days.${day}`) || day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 flex-1 auto-rows-[1fr]">
                    {calendarDays.map((date, index) => {
                        if (!date) {
                            return <div key={`empty-${index}`} className="bg-gray-50/50 border-b border-r border-gray-300 min-h-[120px]" />;
                        }

                        const isToday = new Date().toDateString() === date.toDateString();
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        const dayData = monthlyData[date.getDate()];

                        return (
                            <div
                                key={date.toISOString()}
                                onClick={() => handleDayClick(date)}
                                className={`
                                    relative border-b border-r border-gray-300 p-2 transition-all hover:bg-blue-50 cursor-pointer group min-h-[120px] flex flex-col
                                    ${isToday ? 'bg-blue-50/30' : ''}
                                `}
                            >
                                <span className={`
                                    text-sm font-medium
                                    ${isToday ? 'bg-blue-500 text-white px-2 py-1 rounded-full' : isWeekend ? 'text-gray-400' : 'text-gray-700'}
                                `}>
                                    {date.getDate()}
                                </span>

                                <div className="mt-2 space-y-1 flex-1 overflow-visible">
                                    {dayData ? (
                                        <div className="flex flex-col h-full">
                                            {/* Scrollable list of items */}
                                            <div className="flex-1 overflow-y-auto max-h-[100px] text-xs space-y-0.5 pr-1 scrollbar-thin scrollbar-thumb-gray-300">
                                                {dayData.items.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-start group/item">
                                                        <span className="text-gray-700 truncate mr-1" title={item.product}>
                                                            {item.product}
                                                        </span>
                                                        <span className="text-gray-500 whitespace-nowrap">
                                                            x{item.quantity}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Total Footer */}
                                            <div className="mt-2 pt-1 border-t border-gray-200 text-right">
                                                <div className="text-xs font-bold text-blue-800">
                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dayData.totalCost)}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-gray-400 italic">
                                            -
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Production Capture Modal */}
            {isModalOpen && selectedDate && project && (
                <ProductionCaptureModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    date={selectedDate}
                    projectId={project.idProyecto}
                    branchId={parseInt(selectedBranch)}
                />
            )}
        </div>
    );
}
