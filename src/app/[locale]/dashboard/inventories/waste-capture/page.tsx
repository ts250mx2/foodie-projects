'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';
import PageShell from '@/components/PageShell';
import { Trash2, X, Save, Search, Download } from 'lucide-react';

interface Branch {
    IdSucursal: number;
    Sucursal: string;
}

interface Product {
    IdProducto: number;
    Producto: string;
    UnidadMedidaInventario: string;
    Costo: number;
    CostoInventario?: number;
    ArchivoImagen?: string;
    Categoria?: string;
    ImagenCategoria?: string;
}

interface WasteRecord {
    IdSucursal: number;
    Dia: number;
    Mes: number;
    Anio: number;
    IdProducto: number;
    Cantidad: number;
    Precio: number;
    Producto: string;
    UnidadMedidaInventario: string;
}

export default function WasteCapturePage() {
    const t = useTranslations('WasteCapture');
    const tCommon = useTranslations('Common');
    const { colors } = useTheme();

    // Basic state
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [project, setProject] = useState<any>(null);

    // Data state
    const [products, setProducts] = useState<Product[]>([]);
    const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);
    const [monthlyWasteSummary, setMonthlyWasteSummary] = useState<Record<number, WasteRecord[]>>({});
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProductId, setSelectedProductId] = useState<string>('');
    const [quantity, setQuantity] = useState('');
    
    // UI state
    const [isLoading, setIsLoading] = useState(false);

    // Initial load
    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchBranches();
            fetchProducts();
            
            const savedBranch = localStorage.getItem('dashboardSelectedBranch');
            if (savedBranch) setSelectedBranch(savedBranch);
            
            const savedMonth = localStorage.getItem('lastSelectedMonth');
            if (savedMonth) setSelectedMonth(parseInt(savedMonth));
            
            const savedYear = localStorage.getItem('lastSelectedYear');
            if (savedYear) setSelectedYear(parseInt(savedYear));
        }
    }, [project]);

    // Fetch monthly records when filters change
    useEffect(() => {
        if (project?.idProyecto && selectedBranch) {
            fetchMonthlyWaste();
        }
    }, [project, selectedBranch, selectedMonth, selectedYear]);

    const fetchBranches = async () => {
        try {
            const response = await fetch(`/api/branches?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setBranches(data.data);
                if (!selectedBranch && data.data.length > 0) {
                    setSelectedBranch(data.data[0].IdSucursal.toString());
                }
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        }
    };

    const fetchProducts = async () => {
        try {
            const response = await fetch(`/api/products?projectId=${project.idProyecto}&useView=true`);
            const data = await response.json();
            if (data.success) {
                setProducts(data.data);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };

    const fetchMonthlyWaste = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                month: selectedMonth.toString(),
                year: selectedYear.toString()
            });
            const response = await fetch(`/api/inventories/waste?${params}`);
            const data = await response.json();
            if (data.success) {
                setWasteRecords(data.data);
                
                // Group by day for calendar
                const summary: Record<number, WasteRecord[]> = {};
                data.data.forEach((rec: WasteRecord) => {
                    if (!summary[rec.Dia]) summary[rec.Dia] = [];
                    summary[rec.Dia].push(rec);
                });
                setMonthlyWasteSummary(summary);
            }
        } catch (error) {
            console.error('Error fetching waste records:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDayClick = (date: Date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (date > today) {
            alert(tCommon('errorFutureDate'));
            return;
        }
        setSelectedDate(date);
        setIsModalOpen(true);
        setSelectedProductId('');
        setQuantity('');
        setSearchTerm('');
    };

    const saveWaste = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDate || !selectedProductId || !quantity) return;

        const product = products.find(p => p.IdProducto === parseInt(selectedProductId));
        if (!product) return;

        // Use CostoInventario as requested by the user, fallback to Costo
        const price = product.CostoInventario !== undefined ? product.CostoInventario : product.Costo;

        try {
            const response = await fetch('/api/inventories/waste', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    branchId: selectedBranch,
                    day: selectedDate.getDate(),
                    month: selectedDate.getMonth(),
                    year: selectedDate.getFullYear(),
                    productId: parseInt(selectedProductId),
                    quantity: parseFloat(quantity),
                    price: price
                })
            });

            if (response.ok) {
                fetchMonthlyWaste();
                setSelectedProductId('');
                setQuantity('');
                setSearchTerm('');
            }
        } catch (error) {
            console.error('Error saving waste:', error);
        }
    };

    const deleteWaste = async (productId: number) => {
        if (!selectedDate || !window.confirm(t('confirmDelete'))) return;

        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                day: selectedDate.getDate().toString(),
                month: selectedDate.getMonth().toString(),
                year: selectedYear.toString(),
                productId: productId.toString()
            });
            const response = await fetch(`/api/inventories/waste?${params}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchMonthlyWaste();
            }
        } catch (error) {
            console.error('Error deleting waste:', error);
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

    // Product search filtering
    const filteredProducts = useMemo(() => {
        if (!searchTerm) return [];
        return products.filter(p => 
            p.Producto.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 50); // Limit results for performance
    }, [products, searchTerm]);

    const selectedProduct = products.find(p => p.IdProducto === parseInt(selectedProductId));

    return (
        <PageShell title={t('title')} icon={Trash2} actions={<div className="flex items-center gap-3 flex-wrap">
                    <select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-700 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {branches.map(branch => (
                            <option key={branch.IdSucursal} value={branch.IdSucursal}>{branch.Sucursal}</option>
                        ))}
                    </select>

                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-700 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i} value={i}>{t(`months.${i}`)}</option>
                        ))}
                    </select>

                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-700 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>}>

            {/* Calendar */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col h-[calc(100vh-200px)] overflow-y-auto">
                {/* Header sticky */}
                <div
                    className="sticky top-0 z-10 grid grid-cols-7 gap-0 px-4 py-4 shadow-sm flex-shrink-0"
                    style={{
                        backgroundColor: 'var(--color-brand-orange)',
                        color: colors.colorLetra
                    }}
                >
                    {weekDays.map(day => (
                        <div
                            key={day}
                            className="text-center font-bold text-sm uppercase tracking-wider"
                        >
                            {t(`days.${day}`)}
                        </div>
                    ))}
                </div>

                {/* Calendario expandido */}
                <div className="p-4 bg-white">
                    <div className="grid grid-cols-7 gap-3">
                        {calendarDays.map((date, index) => {
                            if (!date) {
                                return <div key={`empty-${index}`} />;
                            }

                            const dayNum = date.getDate();
                            const dayRecords = monthlyWasteSummary[dayNum] || [];
                            const hasWaste = dayRecords.length > 0;
                            const isToday = new Date().toDateString() === date.toDateString();
                            const dayTotal = dayRecords.reduce((sum, rec) => sum + (rec.Cantidad * rec.Precio), 0);

                            return (
                                <div
                                    key={index}
                                    onClick={() => handleDayClick(date)}
                                    className={`
                                    aspect-square rounded-xl p-3 cursor-pointer transition-all duration-200
                                    flex flex-col justify-between group relative overflow-hidden
                                    ${isToday
                                            ? 'bg-red-50 border-2 border-red-400 shadow-md hover:shadow-lg'
                                            : hasWaste
                                            ? 'bg-orange-50 border-2 border-orange-300 shadow-sm hover:shadow-md'
                                            : 'bg-white border-2 border-gray-200 shadow-sm hover:shadow-md'
                                        }
                                    hover:scale-105 hover:-translate-y-1
                                `}
                                >
                                    <div className="flex justify-between items-start z-10">
                                        <span className={`text-xl font-black
                                            ${isToday ? 'text-red-600' : hasWaste ? 'text-orange-700' : 'text-gray-400'}
                                        `}>
                                            {dayNum}
                                        </span>
                                        {isToday && (
                                            <span className="text-[7px] font-bold bg-red-500 text-white px-1 py-0.5 rounded-full animate-pulse">
                                                HOY
                                            </span>
                                        )}
                                    </div>

                                    {hasWaste && (
                                        <div className="flex flex-col gap-1 text-right">
                                            <div className="text-[10px] text-gray-400 font-bold uppercase">
                                                {dayRecords.length} items
                                            </div>
                                            <div className="text-sm font-black text-orange-600">
                                                ${dayTotal.toFixed(2)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && selectedDate && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
                    <div className="relative w-full bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-w-5xl" style={{ maxHeight: '90vh' }}>
                        {/* Modal Header */}
                        <div
                            className="shrink-0 flex items-start justify-between px-5 py-4 gap-4 border-b border-black/5"
                            style={{ backgroundColor: 'var(--color-brand-orange)' }}
                        >
                            <div className="flex flex-col min-w-0">
                                <h2 className="text-[15px] font-semibold" style={{ color: colors.colorLetra }}>
                                    {t('modalTitle')}
                                </h2>
                                <p className="text-[12px] opacity-80 mt-1" style={{ color: colors.colorLetra }}>
                                    {selectedDate.toLocaleDateString()}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="flex-shrink-0 rounded-lg p-1.5 hover:bg-white/10 transition-colors"
                                style={{ color: colors.colorLetra }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Sub-header with search and actions */}
                        <div className="shrink-0 px-5 py-3 bg-gray-50/50 border-b border-gray-100 flex items-center gap-3 flex-wrap">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search size={14} className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none" style={{ top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    type="text"
                                    placeholder={t('searchProduct')}
                                    className="w-full h-9 pl-9 pr-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500/30 bg-white"
                                    value={selectedProduct ? selectedProduct.Producto : searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        if (selectedProduct) setSelectedProductId('');
                                    }}
                                />
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto flex flex-col p-6 gap-6">
                            {/* Capture Form */}
                            <form onSubmit={saveWaste} className="flex flex-col md:flex-row gap-4 bg-gray-50/50 border border-gray-100 rounded-xl p-5 items-end">
                                <div className="flex-1 relative">
                                    {!selectedProductId && searchTerm && filteredProducts.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl z-[60] max-h-60 overflow-y-auto overflow-x-hidden divide-y divide-gray-50">
                                            {filteredProducts.map(p => (
                                                <div
                                                    key={p.IdProducto}
                                                    onClick={() => {
                                                        setSelectedProductId(p.IdProducto.toString());
                                                        setSearchTerm('');
                                                    }}
                                                    className="p-3 hover:bg-gray-50 cursor-pointer flex items-center gap-3 transition-colors group"
                                                >
                                                    {p.ArchivoImagen ? (
                                                        <img src={p.ArchivoImagen} alt={p.Producto} className="w-10 h-10 rounded-lg object-cover shadow-sm flex-shrink-0" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-base flex-shrink-0">📦</div>
                                                    )}
                                                    <div className="flex-1 overflow-hidden">
                                                        <div className="text-sm font-black text-gray-700 group-hover:text-red-600 transition-colors truncate">{p.Producto}</div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="text-[10px] font-bold text-gray-400 uppercase">{p.UnidadMedidaInventario}</div>
                                                            {p.Categoria && (
                                                                <div className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded-md text-gray-500 font-bold">
                                                                    {p.ImagenCategoria} {p.Categoria}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex items-end gap-2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="Cantidad"
                                        className="w-24 h-9 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500/30 text-center"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        required
                                    />
                                    {selectedProduct && (
                                        <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">
                                            {selectedProduct.UnidadMedidaInventario}
                                        </span>
                                    )}
                                </div>

                                <Button type="submit" disabled={!selectedProductId} size="sm">
                                    {t('save')}
                                </Button>
                            </form>

                            {/* Current Waste Grid */}
                            <div className="flex-1 overflow-auto border border-gray-100 rounded-xl bg-white">
                                <table className="min-w-full">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr className="border-b border-gray-200">
                                            <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('product')}</th>
                                            <th className="px-5 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('quantity')}</th>
                                            <th className="px-5 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('unit')}</th>
                                            <th className="px-5 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('price')}</th>
                                            <th className="px-5 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('total')}</th>
                                            <th className="px-5 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {wasteRecords.filter(r => r.Dia === selectedDate.getDate()).length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-5 py-20 text-center text-gray-400 font-bold italic">
                                                    {t('noRecords')}
                                                </td>
                                            </tr>
                                        ) : (
                                            wasteRecords.filter(r => r.Dia === selectedDate.getDate()).map((record, idx) => (
                                                <tr key={idx} className="border-t border-gray-50 hover:bg-gray-50/60 transition-colors">
                                                    <td className="px-5 py-3 text-sm font-medium text-gray-900">{record.Producto}</td>
                                                    <td className="px-5 py-3 text-center text-sm text-gray-900">{record.Cantidad}</td>
                                                    <td className="px-5 py-3 text-center text-[10px] font-bold text-gray-400 uppercase">{record.UnidadMedidaInventario}</td>
                                                    <td className="px-5 py-3 text-right text-sm text-gray-600">${record.Precio.toFixed(2)}</td>
                                                    <td className="px-5 py-3 text-right text-sm font-medium text-red-600">${(record.Cantidad * record.Precio).toFixed(2)}</td>
                                                    <td className="px-5 py-3 text-center">
                                                        <button
                                                            onClick={() => deleteWaste(record.IdProducto)}
                                                            className="p-1 hover:bg-red-50 text-red-600 rounded transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-2.5">
                            <Button
                                onClick={() => setIsModalOpen(false)}
                                variant="secondary"
                                size="md"
                                leftIcon={X}
                            >
                                {t('close')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </PageShell>
    );
}
