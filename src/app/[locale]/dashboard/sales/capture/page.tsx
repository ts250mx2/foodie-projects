'use client';

import { useState, useEffect, useMemo, useContext } from 'react';
import { useTranslations } from 'next-intl';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';
import { useTheme } from '@/contexts/ThemeContext';

interface Branch {
    IdSucursal: number;
    Sucursal: string;
}

export default function SalesCapturePage() {
    const t = useTranslations('SalesCapture');
    const tCommon = useTranslations('Common');
    const tNotes = useTranslations('NotesModal');
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
    const [platforms, setPlatforms] = useState<any[]>([]);
    const [dailySales, setDailySales] = useState<any[]>([]);
    const [monthlySalesDetails, setMonthlySalesDetails] = useState<Record<number, Array<{ shiftName: string, total: number }>>>({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        shiftId: '',
        terminalId: '',
        platformId: '',
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
            const [resShifts, resTerminals, resPlatforms] = await Promise.all([
                fetch(`/api/shifts?projectId=${project.idProyecto}`).then(r => r.json()),
                fetch(`/api/terminals?projectId=${project.idProyecto}`).then(r => r.json()),
                fetch(`/api/platforms?projectId=${project.idProyecto}`).then(r => r.json())
            ]);

            if (resShifts.success) setShifts(resShifts.data);
            if (resTerminals.success) setTerminals(resTerminals.data);
            if (resPlatforms.success) {
                // Platforms are already sorted by Orden in the API, but we ensure it here
                const sortedPlatforms = resPlatforms.data.sort((a: any, b: any) => a.Orden - b.Orden);
                setPlatforms(sortedPlatforms);

                // Set default platform to the one with Orden = 0
                const defaultPlatform = sortedPlatforms.find((p: any) => p.Orden === 0);
                if (defaultPlatform) {
                    setFormData(prev => ({ ...prev, platformId: defaultPlatform.IdPlataforma.toString() }));
                }
            }
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
            const response = await fetch(`/api/sales/monthly?${params}`);
            const data = await response.json();
            if (data.success) {
                // Group sales by day and shift
                const detailsMap: Record<number, Array<{ shiftName: string, total: number }>> = {};
                data.data.forEach((item: any) => {
                    if (!detailsMap[item.day]) {
                        detailsMap[item.day] = [];
                    }
                    detailsMap[item.day].push({
                        shiftName: item.shiftName,
                        total: item.total
                    });
                });
                setMonthlySalesDetails(detailsMap);
            }
        } catch (error) {
            console.error('Error fetching monthly sales:', error);
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
        await Promise.all([
            fetchDailySales(date),
            fetchNotes(date)
        ]);
        setActiveTab('sales');
        setIsModalOpen(true);
    };

    const fetchDailySales = async (date: Date) => {
        if (!project || !selectedBranch) return;
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                day: date.getDate().toString(),
                month: date.getMonth().toString(), // 0-11
                year: date.getFullYear().toString()
            });
            const response = await fetch(`/api/sales/daily?${params}`);
            const data = await response.json();
            if (data.success) {
                setDailySales(data.data);
            }
        } catch (error) {
            console.error('Error fetching daily sales:', error);
        }
    };

    const [activeTab, setActiveTab] = useState<'sales' | 'notes'>('sales');
    const [notes, setNotes] = useState<any[]>([]);
    const [isLoadingNotes, setIsLoadingNotes] = useState(false);
    const [editingNote, setEditingNote] = useState<any>(null);
    const [noteFormData, setNoteFormData] = useState({
        note: '',
        file: null as string | null
    });

    const fetchNotes = async (date: Date) => {
        if (!project || !selectedBranch) return;
        setIsLoadingNotes(true);
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                day: date.getDate().toString(),
                month: date.getMonth().toString(),
                year: date.getFullYear().toString()
            });
            const response = await fetch(`/api/notes?${params}`);
            const data = await response.json();
            if (data.success) {
                setNotes(data.data);
            }
        } catch (error) {
            console.error('Error fetching notes:', error);
        } finally {
            setIsLoadingNotes(false);
        }
    };

    const handleNoteSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDate || !project || !selectedBranch) return;

        try {
            const url = '/api/notes';
            const method = editingNote ? 'PUT' : 'POST';
            const body: any = editingNote ? {
                projectId: project.idProyecto,
                noteId: editingNote.IdNota,
                note: noteFormData.note,
                ...(noteFormData.file !== editingNote.archivnota ? { file: noteFormData.file } : {})
            } : {
                projectId: project.idProyecto,
                branchId: selectedBranch,
                day: selectedDate.getDate(),
                month: selectedDate.getMonth(),
                year: selectedDate.getFullYear(),
                note: noteFormData.note,
                file: noteFormData.file
            };

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                await fetchNotes(selectedDate);
                setNoteFormData({ note: '', file: null });
                setEditingNote(null);
            }
        } catch (error) {
            console.error('Error saving note:', error);
        }
    };

    const handleDeleteNote = async (noteId: number) => {
        if (!window.confirm(tNotes('confirmDelete'))) return;
        try {
            const response = await fetch('/api/notes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    noteId,
                    status: 2
                })
            });
            if (response.ok && selectedDate) {
                await fetchNotes(selectedDate);
            }
        } catch (error) {
            console.error('Error deleting note:', error);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setNoteFormData(prev => ({ ...prev, file: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDate || !project || !selectedBranch) return;

        try {
            const response = await fetch('/api/sales/daily', {
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
                    platformId: formData.platformId,
                    amount: parseFloat(formData.amount)
                })
            });

            if (response.ok) {
                fetchDailySales(selectedDate);
                fetchMonthlySales(); // Refresh monthly totals
                setFormData({ ...formData, amount: '' });
            }
        } catch (error) {
            console.error('Error saving sale:', error);
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
    const tModal = useTranslations('SalesModal');

    const totalSales = dailySales.reduce((sum, sale) => sum + (sale.Venta || 0), 0);

    // Filter shifts by selected branch
    const filteredShifts = useMemo(() => {
        if (!selectedBranch) return shifts;
        return shifts.filter((shift: any) => shift.IdSucursal === parseInt(selectedBranch));
    }, [shifts, selectedBranch]);

    return (
        <div className="flex flex-col min-h-screen p-6 gap-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-3 rounded-xl shadow-sm">
                <h1 className="text-2xl font-bold text-gray-800">{t('title')}</h1>

                <div className="flex items-center gap-4">
                    {/* Selectors */}
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

            {/* Calendar */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col">
                <div className="grid grid-cols-7 bg-orange-500 border-b border-orange-600">
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
                                    relative border-b border-r border-gray-300 p-2 transition-all hover:bg-orange-50 cursor-pointer group min-h-[120px] flex flex-col
                                    ${isToday ? 'bg-orange-50/30' : ''}
                                `}
                            >
                                <span className={`
                                    text-sm font-medium
                                    ${isToday ? 'bg-orange-500 text-white px-2 py-1 rounded-full' : isWeekend ? 'text-gray-400' : 'text-gray-700'}
                                `}>
                                    {date.getDate()}
                                </span>
                                {monthlySalesDetails[date.getDate()] && (
                                    <>
                                        <div className="mt-6 space-y-1 flex-1">
                                            {monthlySalesDetails[date.getDate()].map((shift, idx) => (
                                                <div key={idx} className="text-xs">
                                                    <div className="font-medium text-gray-700">{shift.shiftName}</div>
                                                    <div className="font-semibold text-green-600">${shift.total.toFixed(2)}</div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                            <div className="text-xs font-bold text-blue-700">
                                                Total: ${monthlySalesDetails[date.getDate()].reduce((sum, shift) => sum + shift.total, 0).toFixed(2)}
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl transition-all">
                        {/* Header */}
                        <div className="px-6 pt-4 pb-0" style={{ backgroundColor: colors.colorFondo1, color: colors.colorLetra }}>
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-0">
                                        <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                            {activeTab === 'sales' ? 'Ventas' : 'Notas'}
                                        </span>
                                        <span className="bg-blue-400 text-blue-900 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                            {selectedDate.toLocaleDateString()}
                                        </span>
                                    </div>
                                    <h1 className="text-3xl font-black mb-0 leading-tight">
                                        {activeTab === 'sales' ? tModal('title') : tNotes('title')}
                                    </h1>
                                </div>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="text-white hover:bg-white/20 rounded-full p-2 flex-shrink-0"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Tabs */}
                            <div className="flex gap-1 mt-6 overflow-x-auto relative px-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                                {[
                                    { id: 'sales', label: tModal('tabs.sales'), icon: '💰' },
                                    { id: 'notes', label: tModal('tabs.notes'), icon: '📝' }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={`px-6 py-2.5 rounded-t-xl transition-all duration-300 whitespace-nowrap relative flex items-center justify-center ${activeTab === tab.id
                                            ? 'bg-white text-gray-900 text-sm font-bold z-30 translate-y-[1px] border-t border-l border-r border-gray-200 shadow-[4px_-4px_10px_rgba(0,0,0,0.05)]'
                                            : 'bg-white/10 text-xs font-normal hover:bg-white/20 hover:-translate-y-0.5'
                                            }`}
                                        style={activeTab === tab.id ? {} : { color: colors.colorLetra }}
                                    >
                                        <span className="mr-2">{tab.icon}</span>
                                        {tab.label}
                                        {activeTab === tab.id && (
                                            <div className="absolute -bottom-[2px] left-0 right-0 h-[4px] bg-white z-40"></div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 bg-white border-t border-gray-200">
                            {activeTab === 'sales' && (
                                <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                                    {/* Form */}
                                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-gray-50 p-6 rounded-xl border border-gray-100 items-end shadow-sm">
                                        <div className="flex flex-col">
                                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 ml-1 tracking-wider">{tModal('shift')}</label>
                                            <select
                                                className="p-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white transition-all font-medium"
                                                value={formData.shiftId}
                                                onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
                                                required
                                            >
                                                <option value="">{tModal('select')}</option>
                                                {filteredShifts.map(s => <option key={s.IdTurno} value={s.IdTurno}>{s.Turno}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 ml-1 tracking-wider">{tModal('terminal')}</label>
                                            <select
                                                className="p-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white transition-all font-medium"
                                                value={formData.terminalId}
                                                onChange={(e) => setFormData({ ...formData, terminalId: e.target.value })}
                                                required
                                            >
                                                <option value="">{tModal('select')}</option>
                                                {terminals.map(t => <option key={t.IdTerminal} value={t.IdTerminal}>{t.Terminal}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 ml-1 tracking-wider">{tModal('platform')}</label>
                                            <select
                                                className="p-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white transition-all font-medium"
                                                value={formData.platformId}
                                                onChange={(e) => setFormData({ ...formData, platformId: e.target.value })}
                                                required
                                            >
                                                <option value="">{tModal('select')}</option>
                                                {platforms.map(p => <option key={p.IdPlataforma} value={p.IdPlataforma}>{p.Plataforma}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 ml-1 tracking-wider">{tModal('amount')}</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="p-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-black text-blue-600 transition-all"
                                                value={formData.amount}
                                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                                required
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <button type="submit" className="bg-blue-600 text-white p-2.5 rounded-lg hover:bg-blue-700 font-bold h-[42px] shadow-md transition-all active:scale-95">
                                            {tModal('add')}
                                        </button>
                                    </form>

                                    {/* Grid */}
                                    <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                                        <table className="min-w-full divide-y divide-gray-100">
                                            <ThemedGridHeader>
                                                <ThemedGridHeaderCell>{tModal('shift')}</ThemedGridHeaderCell>
                                                <ThemedGridHeaderCell>{tModal('terminal')}</ThemedGridHeaderCell>
                                                <ThemedGridHeaderCell>{tModal('platform')}</ThemedGridHeaderCell>
                                                <ThemedGridHeaderCell className="text-right">{tModal('amount')}</ThemedGridHeaderCell>
                                            </ThemedGridHeader>
                                            <tbody className="bg-white divide-y divide-gray-50 text-[13px]">
                                                {dailySales.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">
                                                            No records found
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    dailySales.map((sale, idx) => (
                                                        <tr key={idx} className="hover:bg-blue-50/30 transition-colors group px-6">
                                                            <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-700">{sale.Turno}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">{sale.Terminal}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">{sale.Plataforma}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-right font-black text-blue-600">
                                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(sale.Venta)}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                            <tfoot className="bg-gray-50 border-t border-gray-100">
                                                <tr className="px-6">
                                                    <td colSpan={3} className="px-6 py-4 text-right text-gray-500 uppercase text-[10px] font-black tracking-widest">{tModal('total')}</td>
                                                    <td className="px-6 py-4 text-right text-blue-700 text-xl font-black">
                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalSales)}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'notes' && (
                                <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-300">
                                    <form onSubmit={handleNoteSubmit} className="flex flex-col gap-4 bg-orange-50/50 p-6 rounded-xl border border-orange-100 shadow-sm">
                                        <div className="flex justify-between items-center mb-1">
                                            <h3 className="text-sm font-black text-orange-900/60 uppercase tracking-widest flex items-center gap-2">
                                                {editingNote ? '📝 ' + tNotes('edit') : '✨ ' + tNotes('add')}
                                            </h3>
                                            {editingNote && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingNote(null);
                                                        setNoteFormData({ note: '', file: null });
                                                    }}
                                                    className="text-xs font-bold text-orange-600 hover:underline"
                                                >
                                                    {tCommon('cancel')}
                                                </button>
                                            )}
                                        </div>
                                        
                                        <textarea
                                            className="w-full p-4 border border-orange-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white min-h-[120px] transition-all resize-none font-medium placeholder:text-gray-300"
                                            value={noteFormData.note}
                                            onChange={(e) => setNoteFormData({ ...noteFormData, note: e.target.value })}
                                            placeholder={tNotes('placeholder')}
                                            required
                                        />

                                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                            <div className="flex items-center gap-3 w-full md:w-auto">
                                                <label className="flex items-center gap-2 px-4 py-2 bg-white border border-orange-200 rounded-lg text-xs font-bold text-orange-700 cursor-pointer hover:bg-orange-50 transition-all shadow-sm active:scale-95">
                                                    📎 {tNotes('attachFile')}
                                                    <input type="file" className="hidden" onChange={handleFileChange} />
                                                </label>
                                                {noteFormData.file && (
                                                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded font-black uppercase tracking-wider animate-pulse flex items-center gap-1">
                                                        ✅ Archivo Cargado
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setNoteFormData(prev => ({ ...prev, file: null }))}
                                                            className="ml-1 hover:text-red-600"
                                                        >✕</button>
                                                    </span>
                                                )}
                                            </div>
                                            <button 
                                                type="submit" 
                                                className="w-full md:w-auto bg-orange-600 text-white px-8 py-2.5 rounded-lg hover:bg-orange-700 font-bold shadow-md transition-all active:scale-95"
                                            >
                                                {editingNote ? tCommon('save') : tNotes('save')}
                                            </button>
                                        </div>
                                    </form>

                                    <div className="flex flex-col gap-3">
                                        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest ml-1 mb-2">Historial de Notas</h3>
                                        {isLoadingNotes ? (
                                            <div className="py-12 text-center text-gray-400 animate-pulse font-bold tracking-widest text-xs uppercase">{tCommon('loading')}</div>
                                        ) : notes.length === 0 ? (
                                            <div className="py-12 text-center text-gray-400 italic bg-gray-50 rounded-2xl border border-dashed border-gray-200">{tNotes('noNotes')}</div>
                                        ) : (
                                            notes.map((note) => (
                                                <div key={note.IdNota} className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all group border-l-4 border-l-orange-500">
                                                    <div className="flex justify-between items-start gap-4">
                                                        <div className="flex-1">
                                                            <p className="text-sm text-gray-700 font-medium whitespace-pre-wrap leading-relaxed">{note.Nota}</p>
                                                            <div className="mt-3 flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                                <span>🕒 {new Date(note.FechaAct).toLocaleString()}</span>
                                                                {note.archivnota && (
                                                                    <a 
                                                                        href={note.archivnota} 
                                                                        download={`nota_${note.IdNota}`} 
                                                                        className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                                                    >
                                                                        📁 {tCommon('download')}
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                            <button 
                                                                onClick={() => {
                                                                    setEditingNote(note);
                                                                    setNoteFormData({ note: note.Nota, file: note.archivnota });
                                                                }}
                                                                className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                                                            >✏️</button>
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteNote(note.IdNota);
                                                                }}
                                                                className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                                            >🗑️</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-8 py-2.5 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 font-bold transition-all active:scale-95"
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
