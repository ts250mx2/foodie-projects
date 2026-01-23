'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';

interface Branch {
    IdSucursal: number;
    Sucursal: string;
}

export default function SalesTerminalsCapturePage() {
    const t = useTranslations('SalesTerminalsCapture');
    const tModal = useTranslations('SalesModal');
    const { colors } = useTheme();

    // Basic state
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [project, setProject] = useState<any>(null);

    // Data for modal
    const [shifts, setShifts] = useState<any[]>([]);
    const [terminals, setTerminals] = useState<any[]>([]);
    const [dailySales, setDailySales] = useState<any[]>([]);
    const [monthlySalesDetails, setMonthlySalesDetails] = useState<Record<number, Array<{ shiftName: string, total: number, commission: number }>>>({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        shiftId: '',
        terminalId: '',
        amount: ''
    });

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
            fetchDropdowns();

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
            fetchMonthlySales();
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

    const fetchDropdowns = async () => {
        try {
            const [resShifts, resTerminals] = await Promise.all([
                fetch(`/api/shifts?projectId=${project.idProyecto}`).then(r => r.json()),
                fetch(`/api/terminals?projectId=${project.idProyecto}`).then(r => r.json())
            ]);

            if (resShifts.success) setShifts(resShifts.data);
            if (resTerminals.success) setTerminals(resTerminals.data);
        } catch (error) {
            console.error('Error fetching dropdowns:', error);
        }
    };

    const fetchMonthlySales = async () => {
        if (!project || !selectedBranch) return;
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                month: selectedMonth.toString(),
                year: selectedYear.toString()
            });
            const response = await fetch(`/api/sales/terminals/monthly?${params}`);
            const data = await response.json();
            if (data.success) {
                const detailsMap: Record<number, Array<{ shiftName: string, total: number, commission: number }>> = {};
                data.data.forEach((item: any) => {
                    if (!detailsMap[item.day]) {
                        detailsMap[item.day] = [];
                    }
                    detailsMap[item.day].push({
                        shiftName: item.shiftName,
                        total: item.total,
                        commission: item.commission || 0
                    });
                });
                setMonthlySalesDetails(detailsMap);
            }
        } catch (error) {
            console.error('Error fetching monthly sales:', error);
        }
    };

    const handleDayClick = async (date: Date) => {
        setSelectedDate(date);
        await fetchDailySales(date);
        setIsModalOpen(true);
    };

    const fetchDailySales = async (date: Date) => {
        if (!project || !selectedBranch) return;
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                day: date.getDate().toString(),
                month: date.getMonth().toString(),
                year: date.getFullYear().toString()
            });
            const response = await fetch(`/api/sales/terminals/daily?${params}`);
            const data = await response.json();
            if (data.success) {
                setDailySales(data.data);
            }
        } catch (error) {
            console.error('Error fetching daily sales:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDate || !project || !selectedBranch) return;

        try {
            const response = await fetch('/api/sales/terminals/daily', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    branchId: selectedBranch,
                    day: selectedDate.getDate(),
                    month: selectedDate.getMonth(),
                    year: selectedDate.getFullYear(),
                    shiftId: formData.shiftId,
                    terminalId: formData.terminalId,
                    amount: parseFloat(formData.amount.replace(/[^0-9.]/g, ''))
                })
            });

            if (response.ok) {
                fetchDailySales(selectedDate);
                fetchMonthlySales();
                setFormData({ ...formData, amount: '' });
            }
        } catch (error) {
            console.error('Error saving sale:', error);
        }
    };

    const handleDelete = async (shiftId: number, terminalId: number) => {
        if (!selectedDate || !project || !selectedBranch) return;
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                day: selectedDate.getDate().toString(),
                month: selectedDate.getMonth().toString(),
                year: selectedDate.getFullYear().toString(),
                shiftId: shiftId.toString(),
                terminalId: terminalId.toString()
            });
            const response = await fetch(`/api/sales/terminals/daily?${params}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchDailySales(selectedDate);
                fetchMonthlySales();
            }
        } catch (error) {
            console.error('Error deleting sale:', error);
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

    const totalSales = dailySales.reduce((sum, sale) => sum + (sale.Venta || 0), 0);

    const filteredShifts = useMemo(() => {
        if (!selectedBranch) return shifts;
        return shifts.filter((shift: any) => shift.IdSucursal === parseInt(selectedBranch));
    }, [shifts, selectedBranch]);

    return (
        <div className="flex flex-col min-h-screen p-6 gap-4">
            <div className="sticky top-16 z-30 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-sm">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    💳 {t('title')}
                </h1>

                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1">{t('selectBranch')}</label>
                        <select
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
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
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
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
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                        >
                            {years.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col">
                <div
                    className="grid grid-cols-7 border-b"
                    style={{
                        background: `linear-gradient(to right, ${colors.colorFondo1}, ${colors.colorFondo2})`,
                        borderColor: colors.colorFondo2
                    }}
                >
                    {weekDays.map(day => (
                        <div key={day} className="py-3 text-center text-sm font-semibold uppercase tracking-wider" style={{ color: colors.colorLetra }}>
                            {t(`days.${day}`)}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 flex-1 auto-rows-[1fr]">
                    {calendarDays.map((date, index) => {
                        if (!date) return <div key={`empty-${index}`} className="bg-gray-50/50 border-b border-r border-gray-300" />;
                        const isToday = new Date().toDateString() === date.toDateString();
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        return (
                            <div
                                key={date.toISOString()}
                                onClick={() => handleDayClick(date)}
                                className={`relative border-b border-r border-gray-300 p-2 transition-all hover:bg-orange-50 cursor-pointer group min-h-[120px] flex flex-col ${isToday ? 'bg-orange-50/30' : ''}`}
                            >
                                <span className={`text-sm font-medium ${isToday ? 'bg-orange-500 text-white px-2 py-1 rounded-full' : isWeekend ? 'text-gray-400' : 'text-gray-700'}`}>
                                    {date.getDate()}
                                </span>
                                {monthlySalesDetails[date.getDate()] && (
                                    <>
                                        <div className="mt-6 space-y-1 flex-1">
                                            {monthlySalesDetails[date.getDate()].map((shift, idx) => (
                                                <div key={idx} className="text-xs">
                                                    <div className="font-medium text-gray-700">{shift.shiftName}</div>
                                                    <div className="font-semibold text-green-600">
                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(shift.total)}
                                                        <span className="text-blue-600"> ({new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(shift.commission)})</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                            <div className="text-xs font-bold text-blue-700">
                                                Total: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(monthlySalesDetails[date.getDate()].reduce((sum, shift) => sum + shift.total, 0))} ({new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(monthlySalesDetails[date.getDate()].reduce((sum, shift) => sum + shift.commission, 0))})
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {isModalOpen && selectedDate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col gap-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">
                                {t('title')} - {selectedDate.toLocaleDateString()}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700 text-xl font-bold">✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg items-end">
                            <div className="flex flex-col">
                                <label className="text-xs font-semibold text-gray-600 mb-1">{tModal('shift')}</label>
                                <select
                                    className="p-2 border rounded text-sm"
                                    value={formData.shiftId}
                                    onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
                                    required
                                >
                                    <option value="">{tModal('select')}</option>
                                    {filteredShifts.map(s => <option key={s.IdTurno} value={s.IdTurno}>{s.Turno}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs font-semibold text-gray-600 mb-1">Terminal</label>
                                <select
                                    className="p-2 border rounded text-sm"
                                    value={formData.terminalId}
                                    onChange={(e) => setFormData({ ...formData, terminalId: e.target.value })}
                                    required
                                >
                                    <option value="">{tModal('select')}</option>
                                    {terminals.map(ter => <option key={ter.IdTerminal} value={ter.IdTerminal}>{ter.Terminal}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs font-semibold text-gray-600 mb-1">{tModal('amount')}</label>
                                <input
                                    type="text"
                                    className="p-2 border rounded text-sm"
                                    value={formData.amount}
                                    onChange={(e) => {
                                        // Allow only numbers and dots
                                        const val = e.target.value.replace(/[^0-9.]/g, '');
                                        // Prevent multiple dots
                                        if ((val.match(/\./g) || []).length > 1) return;
                                        setFormData({ ...formData, amount: val });
                                    }}
                                    onBlur={(e) => {
                                        const val = parseFloat(e.target.value.replace(/[^0-9.]/g, '') || '0');
                                        if (!isNaN(val)) {
                                            setFormData({ ...formData, amount: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) });
                                        }
                                    }}
                                    onFocus={(e) => {
                                        // Remove currency symbols and commas for editing
                                        const val = e.target.value.replace(/[^0-9.]/g, '');
                                        if (val === '0.00' || val === '0') {
                                            setFormData({ ...formData, amount: '' });
                                        } else {
                                            setFormData({ ...formData, amount: val });
                                        }
                                    }}
                                    required
                                    placeholder="0.00"
                                />
                            </div>
                            <button type="submit" className="bg-orange-500 text-white p-2 rounded hover:bg-orange-600 font-medium h-10 shadow-sm transition-colors">
                                {tModal('add')}
                            </button>
                        </form>

                        <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{tModal('shift')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Terminal</th>
                                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{tModal('amount')}</th>
                                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Comisión</th>
                                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {dailySales.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400 italic">No records found</td>
                                        </tr>
                                    ) : (
                                        dailySales.map((sale, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sale.Turno}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sale.Terminal}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(sale.Venta))}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 text-right font-medium">
                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(sale.ComisionMonto || 0))}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                    <button
                                                        onClick={() => handleDelete(sale.IdTurno, sale.IdTerminal)}
                                                        className="text-red-600 hover:text-red-900 font-bold"
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
                                        <td colSpan={2} className="px-6 py-4 text-right text-gray-700 uppercase text-xs tracking-wider">{tModal('total')}</td>
                                        <td className="px-6 py-4 text-right text-orange-600 text-lg">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalSales)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-blue-600 text-lg">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dailySales.reduce((sum, sale) => sum + (parseFloat(sale.ComisionMonto) || 0), 0))}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-100">
                            <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors">
                                {tModal('close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
