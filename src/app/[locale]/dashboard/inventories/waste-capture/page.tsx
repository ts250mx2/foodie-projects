'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';

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
        <div className="flex flex-col min-h-screen p-6 gap-4">
            {/* Header / Selectors */}
            <div className="sticky top-16 z-30 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-sm">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    🗑️ {t('title')}
                </h1>

                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1">{t('selectBranch')}</label>
                        <select
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
                            style={{ '--tw-ring-color': colors.colorFondo1 } as any}
                        >
                            {branches.map(branch => (
                                <option key={branch.IdSucursal} value={branch.IdSucursal}>{branch.Sucursal}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1">{t('month')}</label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
                            style={{ '--tw-ring-color': colors.colorFondo1 } as any}
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
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
                            style={{ '--tw-ring-color': colors.colorFondo1 } as any}
                        >
                            {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Calendar */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col overflow-hidden">
                <div className="grid grid-cols-7 border-b border-gray-200" style={{ backgroundColor: colors.colorFondo1 }}>
                    {weekDays.map(day => (
                        <div key={day} className="py-3 text-center text-xs font-bold text-white uppercase tracking-wider">
                            {t(`days.${day}`)}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 flex-1 auto-rows-[1fr]">
                    {calendarDays.map((date, index) => {
                        if (!date) return <div key={`empty-${index}`} className="bg-gray-50/50 border-b border-r border-gray-200" />;

                        const isToday = new Date().toDateString() === date.toDateString();
                        const dayRecords = monthlyWasteSummary[date.getDate()] || [];
                        const dayTotal = dayRecords.reduce((sum, rec) => sum + (rec.Cantidad * rec.Precio), 0);

                        return (
                            <div
                                key={date.toISOString()}
                                onClick={() => handleDayClick(date)}
                                className={`
                                    relative border-b border-r border-gray-200 p-2 transition-all hover:bg-gray-50 cursor-pointer group min-h-[100px] flex flex-col
                                    ${isToday ? 'bg-primary-50/20' : ''}
                                `}
                            >
                                <span className={`
                                    text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full
                                    ${isToday ? 'bg-primary-500 text-white' : 'text-gray-700'}
                                `}>
                                    {date.getDate()}
                                </span>
                                
                                {dayRecords.length > 0 && (
                                    <div className="mt-2 flex flex-col gap-1">
                                        <div className="text-[10px] text-gray-400 font-bold uppercase truncate">
                                            {dayRecords.length} {t('items')}
                                        </div>
                                        <div className="text-xs font-black text-red-600">
                                            ${dayTotal.toFixed(2)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && selectedDate && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-6 pt-4 pb-0 text-white" style={{ background: `linear-gradient(to right, ${colors.colorFondo1}, ${colors.colorFondo2})`, color: colors.colorLetra }}>
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-0">
                                        <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                            {t('modalTitle')}
                                        </span>
                                    </div>
                                    <h1 className="text-3xl font-black mb-4 leading-tight">
                                        📅 {selectedDate.toLocaleDateString()}
                                    </h1>
                                </div>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="text-white hover:bg-white/20 rounded-full p-2 flex-shrink-0"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 flex flex-col gap-6 overflow-hidden flex-1">
                            {/* Capture Form */}
                            <form onSubmit={saveWaste} className="flex flex-col md:flex-row gap-4 bg-gray-50 p-6 rounded-2xl items-end border border-gray-100">
                                <div className="flex-1 space-y-2 relative">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t('product')}</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder={t('searchProduct')}
                                            className="w-full p-3 border rounded-xl text-sm font-bold focus:ring-2 outline-none transition-all placeholder:font-medium"
                                            value={selectedProduct ? selectedProduct.Producto : searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                if (selectedProduct) setSelectedProductId('');
                                            }}
                                            style={{ '--tw-ring-color': colors.colorFondo1 } as any}
                                        />
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
                                </div>
                                
                                <div className="w-full md:w-32 space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t('quantity')}</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full p-3 border rounded-xl text-sm font-black focus:ring-2 outline-none transition-all"
                                            value={quantity}
                                            onChange={(e) => setQuantity(e.target.value)}
                                            required
                                            style={{ '--tw-ring-color': colors.colorFondo1 } as any}
                                        />
                                        {selectedProduct && (
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-300 uppercase">
                                                {selectedProduct.UnidadMedidaInventario}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <Button type="submit" disabled={!selectedProductId} className="px-8 py-3 h-12 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg hover:brightness-110 active:scale-95 transition-all">
                                    {t('save')}
                                </Button>
                            </form>

                            {/* Current Waste Grid */}
                            <div className="flex-1 overflow-auto border border-gray-100 rounded-2xl shadow-inner bg-white">
                                <table className="min-w-full divide-y divide-gray-100">
                                    <ThemedGridHeader>
                                        <ThemedGridHeaderCell>{t('product')}</ThemedGridHeaderCell>
                                        <ThemedGridHeaderCell className="text-center">{t('quantity')}</ThemedGridHeaderCell>
                                        <ThemedGridHeaderCell className="text-center">{t('unit')}</ThemedGridHeaderCell>
                                        <ThemedGridHeaderCell className="text-right">{t('price')}</ThemedGridHeaderCell>
                                        <ThemedGridHeaderCell className="text-right">{t('total')}</ThemedGridHeaderCell>
                                        <th className="px-6 py-3 text-center w-20"> </th>
                                    </ThemedGridHeader>
                                    <tbody className="divide-y divide-gray-50">
                                        {wasteRecords.filter(r => r.Dia === selectedDate.getDate()).length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-20 text-center text-gray-400 font-bold italic">
                                                    {t('noRecords')}
                                                </td>
                                            </tr>
                                        ) : (
                                            wasteRecords.filter(r => r.Dia === selectedDate.getDate()).map((record, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50/50 transition-colors group">
                                                    <td className="px-6 py-4 text-sm font-bold text-gray-700">{record.Producto}</td>
                                                    <td className="px-6 py-4 text-center text-sm font-black text-gray-900">{record.Cantidad}</td>
                                                    <td className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase">{record.UnidadMedidaInventario}</td>
                                                    <td className="px-6 py-4 text-right text-sm font-bold text-gray-500">${record.Precio.toFixed(2)}</td>
                                                    <td className="px-6 py-4 text-right text-sm font-black text-red-600">${(record.Cantidad * record.Precio).toFixed(2)}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <button
                                                            onClick={() => deleteWaste(record.IdProducto)}
                                                            className="text-gray-200 hover:text-red-500 transition-colors p-2"
                                                        >🗑️</button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end pt-4 gap-3">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-8 py-3 bg-gray-100 text-gray-500 font-black uppercase tracking-widest text-xs rounded-xl hover:bg-gray-200 transition-all active:scale-95"
                                >
                                    {t('close')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
