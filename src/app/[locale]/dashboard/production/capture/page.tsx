'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';

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
    const tCommon = useTranslations('Common');
    const { colors } = useTheme();
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
            fetchMonthlyData();
        }
    }, [project, selectedBranch, selectedMonth, selectedYear]);

    const fetchBranches = async () => {
        try {
            const response = await fetch(`/api/branches?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success && data.data.length > 0) {
                setBranches(data.data);

                const savedBranch = localStorage.getItem('dashboardSelectedBranch');
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
        for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
        while (date.getMonth() === month) {
            days.push(new Date(date));
            date.setDate(date.getDate() + 1);
        }
        return days;
    };

    const calendarDays = getDaysInMonth(selectedMonth, selectedYear);

    const handleDayClick = (date: Date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (date > today) {
            alert(tCommon('errorFutureDate'));
            return;
        }

        setSelectedDate(date);
        setIsModalOpen(true);
    };

    return (
        <div className="flex flex-col min-h-screen p-6 gap-4">
            {/* Standardized Header */}
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
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                        >
                            {branches.length === 0 && <option>{t('noBranches') || 'Sin sucursales'}</option>}
                            {branches.map(branch => (
                                <option key={branch.IdSucursal} value={branch.IdSucursal}>
                                    {branch.Sucursal}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Month Selector */}
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1">{t('month') || 'Mes'}</label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i} value={i}>{t(`months.${i}`) || new Date(0, i).toLocaleString('es-ES', { month: 'long' })}</option>
                            ))}
                        </select>
                    </div>

                    {/* Year Selector */}
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1">{t('year') || 'Año'}</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
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
                            {t(`days.${day}`) || day}
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
                            const dayData = monthlyData[dayNum];
                            const isToday = new Date().toDateString() === date.toDateString();

                            return (
                                <div
                                    key={index}
                                    onClick={() => handleDayClick(date)}
                                    className={`
                                    aspect-square rounded-xl p-3 cursor-pointer transition-all duration-300
                                    flex flex-col justify-between group relative overflow-hidden
                                    ${isToday
                                            ? 'bg-white border-2 border-teal-400 shadow-teal-100'
                                            : 'bg-white border border-slate-200/60 hover:border-blue-400 hover:shadow-blue-100'
                                        }
                                    hover:scale-[1.02] hover:shadow-xl shadow-sm
                                `}
                                >
                                    <div className="flex justify-between items-start z-10">
                                        <span className={`text-xl font-black ${isToday ? 'text-teal-600' : dayData ? 'text-slate-800' : 'text-slate-400 group-hover:text-blue-600'}`}>
                                            {dayNum}
                                        </span>
                                        {isToday && (
                                            <span className="text-[9px] font-extrabold bg-teal-500 text-white px-2 py-0.5 rounded-full shadow-sm animate-pulse tracking-tighter">
                                                {t('today') || 'HOY'}
                                            </span>
                                        )}
                                    </div>
                                    {dayData && (
                                        <div className="space-y-0.5 z-10">
                                            <div className="text-sm font-black text-teal-600 leading-tight">
                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dayData.totalCost)}
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                {dayData.itemCount} {dayData.itemCount === 1 ? 'Producto' : 'Productos'}
                                            </div>
                                        </div>
                                    )}
                                    {/* Decorative background element for hover */}
                                    <div className={`
                                    absolute -right-4 -bottom-4 w-12 h-12 rounded-full opacity-0 group-hover:opacity-10 transition-opacity duration-300
                                    ${isToday ? 'bg-teal-600' : 'bg-blue-600'}
                                `} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Production Capture Modal */}
            {isModalOpen && selectedDate && project && (
                <ProductionCaptureModal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        fetchMonthlyData();
                    }}
                    date={selectedDate}
                    projectId={project.idProyecto}
                    branchId={parseInt(selectedBranch)}
                />
            )}
        </div>
    );
}
