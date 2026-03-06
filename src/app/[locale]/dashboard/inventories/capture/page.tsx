'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import * as XLSX from 'xlsx';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import Input from '@/components/Input';

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
    const [editedQuantities, setEditedQuantities] = useState<Record<number, number>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

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

            const savedBranch = localStorage.getItem('lastSelectedBranchInventory');
            const savedMonth = localStorage.getItem('lastSelectedMonthInventory');
            const savedYear = localStorage.getItem('lastSelectedYearInventory');

            if (savedBranch) setSelectedBranch(savedBranch);
            if (savedMonth) setSelectedMonth(parseInt(savedMonth));
            if (savedYear) setSelectedYear(parseInt(savedYear));
        }
    }, [project]);

    useEffect(() => {
        if (selectedBranch) localStorage.setItem('lastSelectedBranchInventory', selectedBranch);
    }, [selectedBranch]);

    useEffect(() => {
        localStorage.setItem('lastSelectedMonthInventory', selectedMonth.toString());
    }, [selectedMonth]);

    useEffect(() => {
        localStorage.setItem('lastSelectedYearInventory', selectedYear.toString());
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

                const savedBranch = localStorage.getItem('lastSelectedBranchInventory');
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
                    inventoryDate: date.toISOString().split('T')[0]
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
                const quantities: Record<number, number> = {};
                data.data.forEach((entry: InventoryEntry) => {
                    quantities[entry.IdProducto] = entry.Cantidad;
                });
                setEditedQuantities(quantities);
            }
        } catch (error) {
            console.error('Error fetching inventory entries:', error);
        }
    };

    const handleQuantityChange = (productId: number, value: string) => {
        const numValue = parseFloat(value) || 0;
        setEditedQuantities(prev => ({
            ...prev,
            [productId]: numValue
        }));
    };

    const handleSaveAll = async () => {
        if (!selectedDate || !project || !selectedBranch) return;

        setIsLoading(true);
        try {
            const updates = Object.entries(editedQuantities).map(([productId, quantity]) => ({
                productId: parseInt(productId),
                quantity
            }));

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

    // Filter entries based on search query
    const filteredEntries = inventoryEntries.filter(entry => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            entry.Producto.toLowerCase().includes(query) ||
            entry.Codigo.toLowerCase().includes(query)
        );
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
            const quantity = editedQuantities[entry.IdProducto] ?? entry.Cantidad;
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
            const quantity = editedQuantities[entry.IdProducto] ?? entry.Cantidad;
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
                const quantity = editedQuantities[entry.IdProducto] ?? entry.Cantidad;
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

    return (
        <div className="flex flex-col min-h-screen p-6 gap-4">
            <div className="sticky top-16 z-30 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-sm">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    📦 {t('title')}
                </h1>

                <div className="flex items-center gap-4">
                    {/* Branch Selector */}
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1">{t('selectBranch')}</label>
                        <select
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                        >
                            {branches.length === 0 && <option>{t('noBranches')}</option>}
                            {branches.map(branch => (
                                <option key={branch.IdSucursal} value={branch.IdSucursal}>
                                    {branch.Sucursal}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Month Selector */}
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1">{t('month')}</label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i} value={i}>{t(`months.${i}`)}</option>
                            ))}
                        </select>
                    </div>

                    {/* Year Selector */}
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1">{t('year')}</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                        >
                            {years.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Calendar */}
            <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="grid grid-cols-7 gap-2">
                    {weekDays.map(day => (
                        <div key={day} className="text-center font-bold text-gray-600 py-2 text-sm uppercase">
                            {t(`days.${day}`)}
                        </div>
                    ))}
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
                                className="aspect-square border-2 border-gray-200 rounded-lg p-2 cursor-pointer hover:border-green-500 hover:shadow-md transition-all flex flex-col justify-between bg-gradient-to-br from-white to-gray-50"
                            >
                                <div className="flex justify-between items-start">
                                    <span className="text-lg font-semibold text-gray-700">{dayNum}</span>
                                    {isMarkedDay && (
                                        <span className="text-xs bg-blue-100 text-blue-600 px-1 rounded">
                                            📦 {t('inventoryDay')}
                                        </span>
                                    )}
                                </div>
                                {hasInventory && (
                                    <div className="text-xs space-y-1">
                                        <div className="text-green-600 font-semibold">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(details.total)}
                                        </div>
                                        <div className="text-gray-500">
                                            {details.productCount} productos
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Excel-like Inventory Modal */}
            {isModalOpen && selectedDate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                        {/* Header */}
                        <div className="px-6 pt-4 pb-0" style={{ backgroundColor: colors.colorFondo1, color: colors.colorLetra }}>
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
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
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
                                        className="px-6 py-3 font-black rounded-t-lg flex justify-between items-center cursor-pointer transition-all duration-300 transform hover:scale-[1.01] hover:shadow-md"
                                        style={{ backgroundColor: colors.colorFondo1, color: colors.colorLetra }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl">{collapsedCategories[categoria] ? '▶' : '▼'}</span>
                                            <span className="text-lg uppercase tracking-tight">
                                                {entries[0]?.ImagenCategoria ? `${entries[0].ImagenCategoria} ` : '📁 '}
                                                {categoria}
                                            </span>
                                        </div>
                                        <div className="bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/30">
                                            <span className="text-sm font-bold opacity-90">Subtotal:</span>
                                            <span className="ml-2 text-base font-black">
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
                                                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 w-[15%]">Código</th>
                                                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 w-[30%]">Producto</th>
                                                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 w-[15%]">Presentación</th>
                                                        <th className="px-4 py-2 text-center text-xs font-bold text-gray-600 w-[15%]">Cantidad</th>
                                                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-600 w-[10%]">Precio</th>
                                                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {entries.map((entry) => {
                                                        const quantity = editedQuantities[entry.IdProducto] ?? entry.Cantidad;
                                                        const total = quantity * entry.Precio;

                                                        return (
                                                            <tr key={entry.IdProducto} className="hover:bg-gray-50">
                                                                <td className="px-4 py-2 text-sm text-gray-900 truncate">{entry.Codigo}</td>
                                                                <td className="px-4 py-2 text-sm text-gray-900 truncate">{entry.Producto}</td>
                                                                <td className="px-4 py-2 text-sm text-gray-600 truncate">{entry.UnidadMedidaInventario || entry.Presentacion || '-'}</td>
                                                                <td className="px-4 py-2 text-center">
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={quantity}
                                                                        onChange={(e) => handleQuantityChange(entry.IdProducto, e.target.value)}
                                                                        className="w-24 px-2 py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                                                        disabled={isLoading}
                                                                    />
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(entry.Precio)}</td>
                                                                <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total)}
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
        </div>
    );
}
