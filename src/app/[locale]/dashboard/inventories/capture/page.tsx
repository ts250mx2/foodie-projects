'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import * as XLSX from 'xlsx';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import Input from '@/components/Input';
import CostingModal from '@/components/CostingModal';
import InventoryMaxMinComparisonModal from '@/components/InventoryMaxMinComparisonModal';
import PageShell from '@/components/PageShell';
import { ClipboardList } from 'lucide-react';

interface Branch {
    IdSucursal: number;
    Sucursal: string;
}

interface InventoryDate {
    Dia: number;
    Mes: number;
    Anio: number;
    total: number;
    productCount: number;
    isMarkedInventoryDay: number;
}

interface InventoryEntry {
    IdProducto: number;
    Cantidad: number;
    Precio: number;
    FechaInventario: string;
    Dia: number;
    Mes: number;
    Anio: number;
    IdSucursal: number;
    Codigo: string;
    Producto: string;
    Presentacion: string;
    IdCategoria: number;
    Categoria: string;
    Total: number;
    UnidadMedidaInventario?: string;
    ImagenCategoria?: string;
    ArchivoImagen?: string;
}

interface GroupedInventory {
    [categoria: string]: InventoryEntry[];
}

export default function InventoryCapturePage() {
    const t = useTranslations('InventoryCapture');
    const tModal = useTranslations('InventoryModal');
    const tCommon = useTranslations('Common');
    const { colors } = useTheme();

    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [project, setProject] = useState<any>(null);
    const [inventoryDaysDetails, setInventoryDaysDetails] = useState<Record<number, { total: number, productCount: number, isMarkedInventoryDay: boolean }>>({});

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [inventoryEntries, setInventoryEntries] = useState<InventoryEntry[]>([]);
    const [editedQuantities, setEditedQuantities] = useState<Record<number, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
    const [isCostingModalOpen, setIsCostingModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any>(null);
    const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);

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

            const savedBranch = localStorage.getItem('dashboardSelectedBranch');
            const savedMonth = localStorage.getItem('lastSelectedMonth');
            const savedYear = localStorage.getItem('lastSelectedYear');

            if (savedBranch) setSelectedBranch(savedBranch);
            if (savedMonth) setSelectedMonth(parseInt(savedMonth));
            if (savedYear) setSelectedYear(parseInt(savedYear));
        }
    }, [project]);

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
            fetchInventoryDates();
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

    const fetchInventoryDates = async () => {
        if (!project || !selectedBranch) return;
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                month: selectedMonth.toString(),
                year: selectedYear.toString()
            });
            const response = await fetch(`/api/inventories/monthly?${params}`);
            const data = await response.json();
            if (data.success) {
                const detailsMap: Record<number, { total: number, productCount: number, isMarkedInventoryDay: boolean }> = {};
                data.data.forEach((item: InventoryDate) => {
                    detailsMap[item.Dia] = {
                        total: item.total,
                        productCount: item.productCount,
                        isMarkedInventoryDay: item.isMarkedInventoryDay === 1
                    };
                });
                setInventoryDaysDetails(detailsMap);
            }
        } catch (error) {
            console.error('Error fetching inventory dates:', error);
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
        setIsLoading(true);

        await Promise.all([
            initializeInventory(date),
            fetchInventoryEntries(date)
        ]);

        setIsLoading(false);
        setIsModalOpen(true);
    };

    const initializeInventory = async (date: Date) => {
        if (!project || !selectedBranch) return;
        try {
            const response = await fetch('/api/inventories/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    branchId: parseInt(selectedBranch),
                    day: date.getDate(),
                    month: date.getMonth(),
                    year: date.getFullYear(),
                    inventoryDate: `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
                })
            });

            const data = await response.json();
            if (!data.success) {
                console.error('Error initializing inventory:', data.message);
            }
        } catch (error) {
            console.error('Error initializing inventory:', error);
        }
    };

    const fetchInventoryEntries = async (date: Date) => {
        if (!project || !selectedBranch) return;
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                day: date.getDate().toString(),
                month: date.getMonth().toString(),
                year: date.getFullYear().toString()
            });
            const response = await fetch(`/api/inventories/daily?${params}`);
            const data = await response.json();
            if (data.success) {
                console.log('Fetched inventory entries:', data.data.length);
                setInventoryEntries(data.data);

                // Initialize edited quantities with current values
                const quantities: Record<number, string> = {};
                const initialCollapsed: Record<string, boolean> = {};
                data.data.forEach((entry: InventoryEntry) => {
                    quantities[entry.IdProducto] = entry.Cantidad === 0 ? '' : entry.Cantidad.toString();
                    const cat = entry.Categoria || 'Sin Categoría';
                    initialCollapsed[cat] = true;
                });
                setEditedQuantities(quantities);
                setCollapsedCategories(initialCollapsed);
            }
        } catch (error) {
            console.error('Error fetching inventory entries:', error);
        }
    };

    const handleQuantityChange = (productId: number, value: string) => {
        setEditedQuantities(prev => ({
            ...prev,
            [productId]: value
        }));
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const inputs = Array.from(document.querySelectorAll('input[data-inventory-input="true"]')) as HTMLInputElement[];
            const currentIndex = inputs.indexOf(e.currentTarget);
            if (currentIndex !== -1 && currentIndex < inputs.length - 1) {
                inputs[currentIndex + 1].focus();
                inputs[currentIndex + 1].select();
            }
        }
    };


    const handleSaveAll = async () => {
        if (!selectedDate || !project || !selectedBranch) return;

        setIsLoading(true);
        try {
            const updates = Object.entries(editedQuantities)
                .map(([productId, quantityStr]) => {
                    const id = parseInt(productId);
                    const quantity = parseFloat(quantityStr) || 0;
                    const originalEntry = inventoryEntries.find(e => e.IdProducto === id);
                    const originalQuantity = originalEntry ? originalEntry.Cantidad : 0;
                    
                    return {
                        productId: id,
                        quantity,
                        originalQuantity
                    };
                })
                .filter(update => {
                    // Only save if:
                    // 1. Quantity is > 0 (it has inventory)
                    // 2. OR Quantity has changed from original
                    return update.quantity > 0 || update.quantity !== update.originalQuantity;
                })
                .map(update => ({
                    productId: update.productId,
                    quantity: update.quantity
                }));

            if (updates.length === 0) {
                alert(tCommon('noChanges') || 'No hay cambios para guardar');
                setIsLoading(false);
                return;
            }

            const response = await fetch('/api/inventories/daily', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    branchId: parseInt(selectedBranch),
                    day: selectedDate.getDate(),
                    month: selectedDate.getMonth(),
                    year: selectedDate.getFullYear(),
                    updates
                })
            });

            if (response.ok) {
                alert(tCommon('successUpdate') || '¡Guardado con éxito!');
                await fetchInventoryEntries(selectedDate);
                await fetchInventoryDates();
                setIsModalOpen(false);
            } else {
                const errorData = await response.json();
                alert(`${tCommon('errorUpdate') || 'Error al guardar'}: ${errorData.message || ''}`);
            }
        } catch (error) {
            console.error('Error saving inventory:', error);
            alert(tCommon('errorUpdate') || 'Error al guardar');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditProduct = async (productId: number) => {
        if (!project) return;
        setIsLoading(true);
        try {
            const response = await fetch(`/api/products/${productId}?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setEditingProduct(data.data);
                setIsCostingModalOpen(true);
            } else {
                alert('Error al cargar detalles del producto');
            }
        } catch (error) {
            console.error('Error fetching product details:', error);
            alert('Error al cargar detalles del producto');
        } finally {
            setIsLoading(false);
        }
    };

    // Filter entries based on search query
    const filteredEntries = inventoryEntries.filter(entry => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        const product = entry.Producto?.toLowerCase() || '';
        const code = entry.Codigo?.toLowerCase() || '';
        return product.includes(query) || code.includes(query);
    });

    // Group inventory by category
    const groupedInventory: GroupedInventory = filteredEntries.reduce((acc, entry) => {
        const categoria = entry.Categoria || 'Sin Categoría';
        if (!acc[categoria]) {
            acc[categoria] = [];
        }
        acc[categoria].push(entry);
        return acc;
    }, {} as GroupedInventory);

    // Calculate totals
    const calculateCategoryTotal = (entries: InventoryEntry[]) => {
        return entries.reduce((sum, entry) => {
            const quantityStr = editedQuantities[entry.IdProducto];
            const quantity = quantityStr !== undefined ? (parseFloat(quantityStr) || 0) : entry.Cantidad;
            return sum + (quantity * entry.Precio);
        }, 0);
    };

    const grandTotal = Object.values(groupedInventory).reduce((sum, entries) => {
        return sum + calculateCategoryTotal(entries);
    }, 0);

    const handleExport = () => {
        if (!inventoryEntries.length) return;

        // Flatten data for export
        const exportData = filteredEntries.map(entry => {
            const quantityStr = editedQuantities[entry.IdProducto];
            const quantity = quantityStr !== undefined ? (parseFloat(quantityStr) || 0) : entry.Cantidad;
            return {
                timestamp: entry.FechaInventario,
                category: entry.Categoria || 'Sin Categoría',
                code: entry.Codigo,
                product: entry.Producto,
                presentation: entry.Presentacion,
                quantity: quantity,
                price: entry.Precio,
                total: quantity * entry.Precio
            };
        });

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);

        // Add headers
        XLSX.utils.sheet_add_aoa(ws, [[
            'Fecha', 'Categoría', 'Código', 'Producto', 'Presentación', 'Cantidad', 'Precio', 'Total'
        ]], { origin: 'A1' });

        XLSX.utils.book_append_sheet(wb, ws, 'Inventario');

        // Save file
        const fileName = `Inventario_${selectedDate?.toISOString().split('T')[0] || 'export'}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    const handlePrint = () => {
        const printContent = document.getElementById('inventory-grid-container');
        if (!printContent) return;

        const newWindow = window.open('', '', 'height=600,width=800');
        if (!newWindow) return;

        newWindow.document.write('<html><head><title>Imprimir Inventario</title>');
        newWindow.document.write(`
            <style>
                body { font-family: sans-serif; padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
                th { background-color: #f3f4f6; font-weight: bold; }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .category-header { background-color: #f97316 !important; color: white !important; font-weight: bold; padding: 10px; margin-top: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .total-row { border: 2px solid #22c55e; padding: 10px; margin-top: 20px; font-weight: bold; font-size: 14px; text-align: right; }
                .hidden-print { display: none; }
                h2 { text-align: center; margin-bottom: 20px; }
            </style>
        `);
        newWindow.document.write('</head><body>');
        newWindow.document.write(`<h2>Inventario - ${selectedDate?.toLocaleDateString()}</h2>`);

        // Clone the content to modify it for print if needed (e.g. remove inputs)
        // For simplicity, we'll iterate the data again to create a clean specific print view
        // simpler than trying to clean up the interactive DOM with inputs

        let htmlContext = '';
        Object.entries(groupedInventory).forEach(([categoria, entries]) => {
            htmlContext += `<div class="category-header">📁 ${categoria} - Subtotal: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(calculateCategoryTotal(entries))}</div>`;
            htmlContext += '<table><thead><tr><th>Código</th><th>Producto</th><th>Presentación</th><th>Cantidad</th><th>Precio</th><th>Total</th></tr></thead><tbody>';
            entries.forEach(entry => {
                const quantityStr = editedQuantities[entry.IdProducto];
                const quantity = quantityStr !== undefined ? (parseFloat(quantityStr) || 0) : entry.Cantidad;
                const total = quantity * entry.Precio;
                htmlContext += `<tr>
                    <td>${entry.Codigo}</td>
                    <td>${entry.Producto}</td>
                    <td>${entry.Presentacion}</td>
                    <td class="text-center">${quantity}</td>
                    <td class="text-right">${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(entry.Precio)}</td>
                    <td class="text-right">${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total)}</td>
                </tr>`;
            });
            htmlContext += '</tbody></table>';
        });

        htmlContext += `<div class="total-row">TOTAL GENERAL: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(grandTotal)}</div>`;

        newWindow.document.write(htmlContext);
        newWindow.document.write('</body></html>');
        newWindow.document.close();
        newWindow.print();
    };

    const toggleCategory = (category: string) => {
        setCollapsedCategories(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    // Calendar logic
    const getDaysInMonth = (month: number, year: number) => {
        const date = new Date(year, month, 1);
        const days = [];
        const firstDayOfWeek = (date.getDay() + 6) % 7;

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

    const handleImportLast = async () => {
        if (!selectedDate || !project || !selectedBranch) return;
        if (!confirm(tCommon('confirmImportLast') || '¿Estás seguro de que deseas importar el último inventario? Esto sobrescribirá las cantidades actuales.')) return;

        setIsLoading(true);
        try {
            const response = await fetch('/api/inventories/import-last', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    branchId: parseInt(selectedBranch),
                    day: selectedDate.getDate(),
                    month: selectedDate.getMonth(),
                    year: selectedDate.getFullYear(),
                    inventoryDate: `${selectedDate.getFullYear()}-${(selectedDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDate.getDate().toString().padStart(2, '0')}`
                })
            });

            const data = await response.json();
            if (data.success) {
                alert(tCommon('successImport') || '¡Inventario importado con éxito!');
                await fetchInventoryEntries(selectedDate);
            } else {
                alert(`${tCommon('errorImport') || 'Error al importar'}: ${data.message}`);
            }
        } catch (error) {
            console.error('Error importing last inventory:', error);
            alert(tCommon('errorImport') || 'Error al importar');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <PageShell title={t('title')} icon={ClipboardList} actions={<div className="flex items-center gap-4 flex-wrap">
                    {/* Branch Selector */}
                    <select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="px-2 py-1.5 text-xs rounded-lg border border-white/30 bg-white/20 text-white focus:outline-none focus:ring-1 focus:ring-white/50"
                    >
                        {branches.length === 0 && <option>{t('noBranches')}</option>}
                        {branches.map(branch => (
                            <option key={branch.IdSucursal} value={branch.IdSucursal}>
                                {branch.Sucursal}
                            </option>
                        ))}
                    </select>

                    {/* Month Selector */}
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className="px-2 py-1.5 text-xs rounded-lg border border-white/30 bg-white/20 text-white focus:outline-none focus:ring-1 focus:ring-white/50"
                    >
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i} value={i}>{t(`months.${i}`)}</option>
                        ))}
                    </select>

                    {/* Year Selector */}
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="px-2 py-1.5 text-xs rounded-lg border border-white/30 bg-white/20 text-white focus:outline-none focus:ring-1 focus:ring-white/50"
                    >
                        {years.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>}>

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
                            {t(`days.${day}`)}
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
                            const details = inventoryDaysDetails[dayNum];
                            const hasInventory = details && details.productCount > 0;
                            const isMarkedDay = details?.isMarkedInventoryDay;

                            return (
                                <div
                                    key={index}
                                    onClick={() => handleDayClick(date)}
                                    className={`
                                    aspect-square rounded-xl p-3 cursor-pointer transition-all duration-300
                                    flex flex-col justify-between group relative overflow-hidden
                                    ${hasInventory
                                            ? 'bg-white border-2 border-green-100 shadow-sm hover:border-green-400 hover:shadow-green-100'
                                            : 'bg-white border border-slate-200/60 hover:border-blue-400 hover:shadow-blue-100'
                                        }
                                    hover:scale-[1.02] hover:shadow-xl
                                `}
                                >
                                    <div className="flex justify-between items-start z-10">
                                        <span className={`text-xl font-black ${hasInventory ? 'text-green-700' : 'text-slate-400 group-hover:text-blue-600'}`}>
                                            {dayNum}
                                        </span>
                                        {isMarkedDay && (
                                            <span className="text-[9px] font-bold bg-blue-500 text-white px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 animate-pulse">
                                                📦 <span className="hidden sm:inline">{t('inventoryDay')}</span>
                                            </span>
                                        )}
                                    </div>
                                    {hasInventory && (
                                        <div className="space-y-0.5 z-10">
                                            <div className="text-sm font-black text-green-600 leading-tight">
                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(details.total)}
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                {details.productCount} {details.productCount === 1 ? 'Producto' : 'Productos'}
                                            </div>
                                        </div>
                                    )}
                                    {/* Decorative background element for hover */}
                                    <div className={`
                                    absolute -right-4 -bottom-4 w-12 h-12 rounded-full opacity-0 group-hover:opacity-10 transition-opacity duration-300
                                    ${hasInventory ? 'bg-green-600' : 'bg-blue-600'}
                                `} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Excel-like Inventory Modal */}
            {isModalOpen && selectedDate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                        {/* Header */}
                        <div className="px-6 pt-4 pb-0 text-white" style={{ background: `linear-gradient(to right, ${colors.colorFondo1}, ${colors.colorFondo2})`, color: colors.colorLetra }}>
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-0">
                                        <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                            {tModal('title')}
                                        </span>
                                    </div>
                                    <h1 className="text-3xl font-black mb-4 leading-tight">
                                        📅 {selectedDate.toLocaleDateString()}
                                    </h1>
                                </div>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="text-white hover:bg-white/20 rounded-full p-2 flex-shrink-0"
                                    disabled={isLoading}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Search and Actions */}
                        <div className="flex flex-col p-6 border-b gap-4 bg-gray-50/50">
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                                    🔍
                                </span>
                                <input
                                    type="text"
                                    placeholder="Buscar producto..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button
                                    onClick={handleImportLast}
                                    variant="secondary"
                                    className="flex items-center gap-2 border-orange-200 hover:bg-orange-50 text-orange-700"
                                    disabled={isLoading}
                                >
                                    📥 Importar último inventario
                                </Button>
                                <Button
                                    onClick={() => setIsComparisonModalOpen(true)}
                                    variant="secondary"
                                    className="flex items-center gap-2"
                                    disabled={isLoading}
                                >
                                    ⚖️ {tModal('reabastecimiento')}
                                </Button>
                                <Button
                                    onClick={handlePrint}
                                    variant="secondary"
                                    className="flex items-center gap-2"
                                    disabled={isLoading}
                                >
                                    🖨️ Imprimir
                                </Button>
                                <Button
                                    onClick={handleExport}
                                    variant="secondary"
                                    className="flex items-center gap-2"
                                    disabled={isLoading}
                                >
                                    📊 Exportar Excel
                                </Button>
                            </div>
                        </div>

                        {/* Excel Grid */}
                        <div id="inventory-grid-container" className="flex-1 overflow-auto p-6">
                            {Object.entries(groupedInventory).map(([categoria, entries]) => (
                                <div key={categoria} className="mb-6">
                                    {/* Category Header */}
                                    <div
                                        onClick={() => toggleCategory(categoria)}
                                        className="px-4 py-2 font-bold rounded-t-lg flex justify-between items-center cursor-pointer transition-all duration-300 transform hover:scale-[1.005] hover:shadow-sm"
                                        style={{ backgroundColor: colors.colorFondo1, color: colors.colorLetra }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm">{collapsedCategories[categoria] ? '▶' : '▼'}</span>
                                            <span className="text-sm uppercase tracking-wide">
                                                {entries[0]?.ImagenCategoria ? `${entries[0].ImagenCategoria} ` : '📁 '}
                                                {categoria}
                                            </span>
                                        </div>
                                        <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
                                            <span className="text-xs font-medium opacity-90">Subtotal:</span>
                                            <span className="ml-2 text-sm font-bold">
                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(calculateCategoryTotal(entries))}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Products Table */}
                                    {!collapsedCategories[categoria] && (
                                        <div className="border border-gray-200 rounded-b-lg overflow-hidden">
                                            <table className="min-w-full table-fixed">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 w-[5%]">Foto</th>
                                                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 w-[10%]">Código</th>
                                                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 w-[25%]">Producto</th>
                                                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 w-[15%]">Presentación</th>
                                                        <th className="px-4 py-2 text-center text-xs font-bold text-gray-600 w-[15%]">Cantidad</th>
                                                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-600 w-[10%]">Precio</th>
                                                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-[10%]">Total</th>
                                                        <th className="px-4 py-2 text-center text-xs font-bold text-gray-600 w-[10%]">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {entries.map((entry) => {
                                                        const quantityStr = editedQuantities[entry.IdProducto];
                                                        const quantity = quantityStr !== undefined ? (parseFloat(quantityStr) || 0) : entry.Cantidad;
                                                        const total = quantity * entry.Precio;

                                                        return (
                                                            <tr key={entry.IdProducto} className="hover:bg-gray-50">
                                                                <td className="px-4 py-2 text-center">
                                                                    {entry.ArchivoImagen ? (
                                                                        <img 
                                                                            src={entry.ArchivoImagen} 
                                                                            alt={entry.Producto} 
                                                                            className="w-8 h-8 object-cover rounded shadow-sm border mx-auto"
                                                                        />
                                                                    ) : (
                                                                        <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-[10px] mx-auto">
                                                                            📷
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-2 text-sm text-gray-900 truncate">{entry.Codigo}</td>
                                                                <td className="px-4 py-2 text-sm font-medium text-gray-900 truncate">{entry.Producto}</td>
                                                                <td className="px-4 py-2 text-sm text-gray-600 truncate">{entry.UnidadMedidaInventario || entry.Presentacion || '-'}</td>
                                                                <td className="px-4 py-2 text-center">
                                                                    <input
                                                                        type="number"
                                                                        step="any"
                                                                        data-inventory-input="true"
                                                                        value={editedQuantities[entry.IdProducto] ?? (entry.Cantidad === 0 ? '' : entry.Cantidad.toString())}
                                                                        onChange={(e) => handleQuantityChange(entry.IdProducto, e.target.value)}
                                                                        onKeyDown={handleKeyDown}
                                                                        className="w-24 px-2 py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                                                        disabled={isLoading}
                                                                    />

                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(entry.Precio)}</td>
                                                                <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total)}
                                                                </td>
                                                                <td className="px-4 py-2 text-center">
                                                                    <button
                                                                        onClick={() => handleEditProduct(entry.IdProducto)}
                                                                        className="text-primary-600 hover:text-primary-800 p-1 rounded hover:bg-primary-50 transition-colors"
                                                                        title="Editar Producto"
                                                                    >
                                                                        ✏️
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Grand Total */}
                            <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4 mt-6">
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-bold text-gray-700">TOTAL GENERAL:</span>
                                    <span className="text-2xl font-bold text-green-600">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(grandTotal)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
                            <Button
                                onClick={() => setIsModalOpen(false)}
                                variant="secondary"
                                disabled={isLoading}
                            >
                                {tModal('close')}
                            </Button>
                            <Button
                                onClick={handleSaveAll}
                                isLoading={isLoading}
                            >
                                💾 {tCommon('save')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {isComparisonModalOpen && selectedDate && (
                <InventoryMaxMinComparisonModal
                    isOpen={isComparisonModalOpen}
                    onClose={() => setIsComparisonModalOpen(false)}
                    inventoryEntries={inventoryEntries}
                    editedQuantities={editedQuantities}
                    branchId={selectedBranch}
                    projectId={project.idProyecto}
                    dateLabel={selectedDate.toLocaleDateString()}
                />
            )}

            {isCostingModalOpen && editingProduct && (
                <CostingModal
                    isOpen={isCostingModalOpen}
                    onClose={() => {
                        setIsCostingModalOpen(false);
                        setEditingProduct(null);
                        // Refresh inventory entries after editing a product (price might have changed)
                        if (selectedDate) fetchInventoryEntries(selectedDate);
                    }}
                    product={editingProduct}
                    projectId={project?.idProyecto}
                    productType={editingProduct.IdTipoProducto || 0}
                    onProductUpdate={() => {
                        // This will trigger the onClose branch
                        setIsCostingModalOpen(false);
                    }}
                    zIndexClass="z-[60]"
                />
            )}
        </PageShell>
    );
}
