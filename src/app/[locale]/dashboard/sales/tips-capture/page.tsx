'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';

import TipsCaptureModal from '@/components/TipsCaptureModal';

interface Branch {
    IdSucursal: number;
    Sucursal: string;
}

export default function TipsCapturePage() {
    const t = useTranslations('TipsCapture');
    const tCommon = useTranslations('Common');

    // Basic state
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [project, setProject] = useState<any>(null);

    // Data for calendar
    const [monthlySalesDetails, setMonthlySalesDetails] = useState<Record<number, Array<{ shiftName: string, total: number }>>>({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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
        }
    }, [project]);

    useEffect(() => {
        // Load persisted filters
        const lastBranch = localStorage.getItem('lastSelectedBranch');
        const lastMonth = localStorage.getItem('lastSelectedMonth');
        const lastYear = localStorage.getItem('lastSelectedYear');

        if (lastMonth) setSelectedMonth(parseInt(lastMonth));
        if (lastYear) setSelectedYear(parseInt(lastYear));
        if (lastBranch && !selectedBranch) {
            setSelectedBranch(lastBranch);
        }
    }, []);

    useEffect(() => {
        if (selectedBranch && selectedMonth !== null && selectedYear && project?.idProyecto) {
            fetchMonthlySummary();
            // Persist filters
            localStorage.setItem('lastSelectedBranch', selectedBranch);
            localStorage.setItem('lastSelectedMonth', selectedMonth.toString());
            localStorage.setItem('lastSelectedYear', selectedYear.toString());
        }
    }, [selectedBranch, selectedMonth, selectedYear, project]);

    const fetchBranches = async () => {
        try {
            const response = await fetch(`/api/branches?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setBranches(data.data);
                const lastSelectedBranch = localStorage.getItem('lastSelectedBranch');
                if (lastSelectedBranch && !selectedBranch) {
                    setSelectedBranch(lastSelectedBranch);
                } else if (data.data.length > 0 && !selectedBranch && !lastSelectedBranch) {
                    setSelectedBranch(data.data[0].IdSucursal.toString());
                }
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        }
    };

    const fetchMonthlySummary = async () => {
        try {
            const response = await fetch(
                `/api/tips/monthly?projectId=${project.idProyecto}&branchId=${selectedBranch}&month=${selectedMonth + 1}&year=${selectedYear}`
            );
            const data = await response.json();
            if (data.success) {
                setMonthlySalesDetails(data.data);
            }
        } catch (error) {
            console.error('Error fetching monthly summary:', error);
        }
    };

    const handleDayClick = (day: number) => {
        const date = new Date(selectedYear, selectedMonth, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (date > today) {
            alert(tCommon('errorFutureDate'));
            return;
        }

        setSelectedDate(date);
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setSelectedDate(null);
        fetchMonthlySummary();
    };

    // Calendar calculations
    const daysInMonth = useMemo(() => {
        return new Date(selectedYear, selectedMonth + 1, 0).getDate();
    }, [selectedYear, selectedMonth]);

    const firstDayOfMonth = useMemo(() => {
        return new Date(selectedYear, selectedMonth, 1).getDay();
    }, [selectedYear, selectedMonth]);

    const calendarDays = useMemo(() => {
        const days = [];
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push(null);
        }
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i);
        }
        return days;
    }, [firstDayOfMonth, daysInMonth]);

    return (
        <div className="flex flex-col min-h-screen p-6 gap-4">
            <div className="sticky top-16 z-30 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-sm">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    💵 {t('title')}
                </h1>
                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                    <select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                    >
                        <option value="">{t('selectBranch')}</option>
                        {branches.map((branch) => (
                            <option key={branch.IdSucursal} value={branch.IdSucursal}>
                                {branch.Sucursal}
                            </option>
                        ))}
                    </select>
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                    >
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i} value={i}>
                                {t(`months.${i}`)}
                            </option>
                        ))}
                    </select>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                    >
                        {years.map((year) => (
                            <option key={year} value={year}>
                                {year}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Calendar */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                {/* Day headers */}
                <div className="grid grid-cols-7 bg-gradient-to-r from-orange-500 to-pink-500">
                    {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((day) => (
                        <div key={day} className="p-4 text-center text-white font-semibold uppercase text-sm">
                            {t(`days.${day}`)}
                        </div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-px bg-gray-200">
                    {calendarDays.map((day, index) => (
                        <div
                            key={index}
                            className={`min-h-[120px] bg-white p-2 ${day ? 'cursor-pointer hover:bg-orange-50 transition-colors' : ''
                                }`}
                            onClick={() => day && handleDayClick(day)}
                        >
                            {day && (
                                <>
                                    <div className="font-bold text-gray-700 mb-2">{day}</div>
                                    {monthlySalesDetails[day] && (
                                        <div className="space-y-1">
                                            {monthlySalesDetails[day].map((shift, idx) => (
                                                <div key={idx} className="text-xs">
                                                    <span className="font-semibold text-orange-600">{shift.shiftName}:</span>
                                                    <span className="ml-1 text-gray-700">
                                                        ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(shift.total)}
                                                    </span>
                                                </div>
                                            ))}
                                            <div className="text-xs font-bold text-pink-600 pt-1 border-t border-gray-200">
                                                Total: ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(monthlySalesDetails[day].reduce((sum, s) => sum + s.total, 0))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && selectedDate && (
                <TipsCaptureModal
                    isOpen={isModalOpen}
                    onClose={handleModalClose}
                    date={selectedDate}
                    branchId={selectedBranch}
                    projectId={project?.idProyecto}
                />
            )}
        </div>
    );
}
