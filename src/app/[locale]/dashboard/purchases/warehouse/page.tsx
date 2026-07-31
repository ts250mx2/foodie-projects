'use client';

import { useState, useEffect, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import PageShell from '@/components/PageShell';
import Button from '@/components/Button';
import Input from '@/components/Input';
import BaseModal from '@/components/BaseModal';
import ThemedGridHeader, {
    ThemedGridHeaderCell,
    TableBody,
    TableRow,
    TableCell,
    RowActionButton,
} from '@/components/ThemedGridHeader';
import { useToast } from '@/contexts/ToastContext';
import {
    Warehouse,
    Search,
    History,
    SlidersHorizontal,
    Download,
    Package,
    DollarSign,
    AlertTriangle,
    ArrowDownCircle,
    ArrowUpCircle,
    ChevronDown,
    ChevronRight,
} from 'lucide-react';

type Branch = {
    IdSucursal: number;
    Sucursal: string;
};

type StockRow = {
    IdProducto: number;
    Existencia: number;
    CostoPromedio: number;
    Unidad: string | null;
    FechaAct: string | null;
    Producto: string;
    Codigo: string | null;
    IdCategoria: number | null;
    Categoria: string | null;
    ImagenCategoria: string | null;
    UnidadMedidaCompra: string | null;
    UnidadMedidaInventario: string | null;
    CostoInventario: number | null;
};

type StockGroup = {
    categoria: string;
    emoji: string;
    rows: StockRow[];
    subtotal: number;
};

/** Emoji de respaldo cuando la categoría no tiene ImagenCategoria configurada. */
const getCategoryEmoji = (category?: string | null) => {
    if (!category) return '📦';
    const cat = category.toLowerCase();
    if (cat.includes('carne') || cat.includes('res') || cat.includes('cerdo')) return '🥩';
    if (cat.includes('ave') || cat.includes('pollo')) return '🍗';
    if (cat.includes('pescado') || cat.includes('marisco')) return '🐟';
    if (cat.includes('lacteo') || cat.includes('queso') || cat.includes('leche')) return '🧀';
    if (cat.includes('fruta') || cat.includes('verdura')) return '🥦';
    if (cat.includes('abarrote') || cat.includes('especia') || cat.includes('grano')) return '🧂';
    if (cat.includes('bebida')) return '🥤';
    if (cat.includes('alcohol') || cat.includes('vino') || cat.includes('cerveza')) return '🍺';
    if (cat.includes('desechable') || cat.includes('empaque')) return '🥡';
    if (cat.includes('limpieza')) return '🧼';
    return '📦';
};

type Movement = {
    IdMovimiento: number;
    IdProducto: number;
    TipoMovimiento: 'ENTRADA' | 'SALIDA';
    Origen: string;
    IdOrdenCompra: number | null;
    Cantidad: number;
    CostoUnitario: number;
    ExistenciaAnterior: number;
    ExistenciaNueva: number;
    Unidad: string | null;
    Notas: string | null;
    FechaMovimiento: string;
    Producto: string;
    Codigo: string | null;
};

type Product = {
    IdProducto: number;
    Producto: string;
    Codigo?: string;
    Categoria?: string;
    Costo?: number;
    UnidadMedidaCompra?: string;
    UnidadMedidaInventario?: string;
};

const ORIGIN_LABELS: Record<string, string> = {
    ORDEN_COMPRA: 'Orden de compra',
    SALIDA_INTERNA: 'Salida interna',
    AJUSTE_MANUAL: 'Ajuste manual',
};

export default function WarehousePage() {
    const { success, error: toastError } = useToast();
    const projectId = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('project') || '{}').idProyecto : null;
    const projectName = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('project') || '{}').proyecto : '';

    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [stock, setStock] = useState<StockRow[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [onlyWithStock, setOnlyWithStock] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    // Kardex modal
    const [movementsProduct, setMovementsProduct] = useState<StockRow | null>(null);
    const [movements, setMovements] = useState<Movement[]>([]);
    const [isMovementsLoading, setIsMovementsLoading] = useState(false);

    // Adjustment modal
    const [isAdjustOpen, setIsAdjustOpen] = useState(false);
    const [adjustProduct, setAdjustProduct] = useState<StockRow | Product | null>(null);
    const [adjustProductSearch, setAdjustProductSearch] = useState('');
    const [isAdjustListOpen, setIsAdjustListOpen] = useState(false);
    const [adjustTipo, setAdjustTipo] = useState<'ENTRADA' | 'SALIDA' | 'AJUSTE'>('ENTRADA');
    const [adjustCantidad, setAdjustCantidad] = useState('');
    const [adjustCosto, setAdjustCosto] = useState('');
    const [adjustNotas, setAdjustNotas] = useState('');
    const [isSavingAdjust, setIsSavingAdjust] = useState(false);

    const fetchBranches = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await fetch(`/api/branches?projectId=${projectId}`);
            const data = await res.json();
            if (data.success) {
                setBranches(data.data);
                const saved = localStorage.getItem('dashboardSelectedBranch');
                if (saved && data.data.some((b: Branch) => String(b.IdSucursal) === saved)) {
                    setSelectedBranch(saved);
                } else if (data.data.length === 1) {
                    setSelectedBranch(String(data.data[0].IdSucursal));
                } else if (data.data.length > 0) {
                    setSelectedBranch(String(data.data[0].IdSucursal));
                }
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        }
    }, [projectId]);

    const fetchProducts = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await fetch(`/api/products?projectId=${projectId}&tipoProducto=0`);
            const data = await res.json();
            if (data.success) setProducts(data.data);
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    }, [projectId]);

    const fetchStock = useCallback(async () => {
        if (!projectId || !selectedBranch) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/warehouse/stock?projectId=${projectId}&branchId=${selectedBranch}`);
            const data = await res.json();
            if (data.success) setStock(data.data);
            else toastError(data.message || 'Error al cargar existencias');
        } catch (error) {
            console.error('Error fetching stock:', error);
            toastError('Error al cargar existencias');
        } finally {
            setIsLoading(false);
        }
    }, [projectId, selectedBranch, toastError]);

    useEffect(() => {
        fetchBranches();
        fetchProducts();
    }, [fetchBranches, fetchProducts]);

    useEffect(() => {
        if (selectedBranch) {
            localStorage.setItem('dashboardSelectedBranch', selectedBranch);
            fetchStock();
        }
    }, [selectedBranch, fetchStock]);

    const formatCurrency = (value?: number | string | null) => {
        if (value === undefined || value === null) return '$0.00';
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value));
    };

    const formatQty = (value?: number | string | null) => {
        if (value === undefined || value === null) return '0';
        return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 3 }).format(Number(value));
    };

    const branchName = branches.find(b => String(b.IdSucursal) === selectedBranch)?.Sucursal || '';

    const filteredStock = stock.filter(row => {
        if (onlyWithStock && Number(row.Existencia) === 0) return false;
        const term = searchTerm.toLowerCase();
        return (
            row.Producto.toLowerCase().includes(term) ||
            (row.Codigo || '').toLowerCase().includes(term) ||
            (row.Categoria || '').toLowerCase().includes(term)
        );
    });

    // Agrupación por categoría (orden alfabético, "Sin Categoría" al final).
    const stockGroups: StockGroup[] = (() => {
        const map = new Map<string, StockGroup>();
        for (const row of filteredStock) {
            const categoria = row.Categoria || 'Sin Categoría';
            if (!map.has(categoria)) {
                map.set(categoria, {
                    categoria,
                    emoji: row.ImagenCategoria || getCategoryEmoji(row.Categoria),
                    rows: [],
                    subtotal: 0,
                });
            }
            const group = map.get(categoria)!;
            group.rows.push(row);
            group.subtotal += Number(row.Existencia) * Number(row.CostoPromedio) || 0;
        }
        return [...map.values()].sort((a, b) => {
            if (a.categoria === 'Sin Categoría') return 1;
            if (b.categoria === 'Sin Categoría') return -1;
            return a.categoria.localeCompare(b.categoria, 'es', { sensitivity: 'base' });
        });
    })();

    const toggleGroup = (categoria: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(categoria)) next.delete(categoria);
            else next.add(categoria);
            return next;
        });
    };

    const totalValue = filteredStock.reduce((sum, r) => sum + (Number(r.Existencia) * Number(r.CostoPromedio) || 0), 0);
    const negativeCount = stock.filter(r => Number(r.Existencia) < 0).length;

    const openMovements = async (row: StockRow) => {
        setMovementsProduct(row);
        setIsMovementsLoading(true);
        try {
            const res = await fetch(`/api/warehouse/movements?projectId=${projectId}&branchId=${selectedBranch}&productId=${row.IdProducto}`);
            const data = await res.json();
            if (data.success) setMovements(data.data);
            else toastError(data.message || 'Error al cargar movimientos');
        } catch (error) {
            console.error('Error fetching movements:', error);
            toastError('Error al cargar movimientos');
        } finally {
            setIsMovementsLoading(false);
        }
    };

    const openAdjust = (row?: StockRow) => {
        setAdjustProduct(row || null);
        setAdjustProductSearch(row ? row.Producto : '');
        setIsAdjustListOpen(false);
        setAdjustTipo('ENTRADA');
        setAdjustCantidad('');
        setAdjustCosto('');
        setAdjustNotas('');
        setIsAdjustOpen(true);
    };

    const handleSaveAdjust = async () => {
        const idProducto = (adjustProduct as any)?.IdProducto;
        const qty = Number(adjustCantidad);
        if (!idProducto) {
            toastError('Selecciona un producto');
            return;
        }
        if (adjustTipo === 'AJUSTE') {
            if (adjustCantidad === '' || isNaN(qty) || qty < 0) {
                toastError('Captura la nueva existencia (0 o mayor)');
                return;
            }
        } else if (!qty || qty <= 0) {
            toastError('Captura una cantidad mayor a cero');
            return;
        }
        setIsSavingAdjust(true);
        try {
            const res = await fetch('/api/warehouse/stock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    branchId: Number(selectedBranch),
                    idProducto,
                    tipo: adjustTipo,
                    cantidad: qty,
                    costoUnitario: adjustCosto ? Number(adjustCosto) : null,
                    notas: adjustNotas || null,
                }),
            });
            const data = await res.json();
            if (data.success) {
                success(
                    adjustTipo === 'AJUSTE'
                        ? (data.message || 'Existencia establecida y registrada como ajuste de inventario')
                        : adjustTipo === 'ENTRADA'
                            ? 'Existencia sumada al almacén'
                            : 'Existencia restada del almacén'
                );
                setIsAdjustOpen(false);
                fetchStock();
            } else {
                toastError(data.message || 'Error al guardar el ajuste');
            }
        } catch (error) {
            console.error('Error saving adjustment:', error);
            toastError('Error al guardar el ajuste');
        } finally {
            setIsSavingAdjust(false);
        }
    };

    const exportStockToPDF = () => {
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.setTextColor(0, 0, 0);
        doc.text('REPORTE DE EXISTENCIAS DE ALMACÉN', 105, 18, { align: 'center' });

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        if (projectName) doc.text(`Proyecto: ${projectName}`, 20, 28);
        doc.text(`Sucursal: ${branchName}`, 20, 33);
        doc.text(`Fecha: ${new Date().toLocaleString('es-MX')}`, 190, 28, { align: 'right' });

        // Agrupado por categoría, igual que la tabla en pantalla.
        const tableData: any[] = [];
        for (const group of stockGroups) {
            tableData.push([{
                content: `${group.categoria}  —  ${group.rows.length} producto(s) · ${formatCurrency(group.subtotal)}`,
                colSpan: 5,
                styles: { fillColor: [240, 245, 255], fontStyle: 'bold', textColor: [30, 64, 175] },
            }]);
            for (const row of group.rows) {
                tableData.push([
                    row.Producto,
                    row.Unidad || row.UnidadMedidaInventario || '—',
                    formatQty(row.Existencia),
                    formatCurrency(row.CostoPromedio),
                    formatCurrency(Number(row.Existencia) * Number(row.CostoPromedio)),
                ]);
            }
        }

        autoTable(doc, {
            startY: 40,
            head: [['Producto', 'Unidad', 'Existencia', 'Costo Prom.', 'Valor']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [13, 148, 136] },
            columnStyles: {
                1: { halign: 'center' },
                2: { halign: 'right' },
                3: { halign: 'right' },
                4: { halign: 'right', fontStyle: 'bold' },
            },
            styles: { fontSize: 8, cellPadding: 1.5 },
        });

        const finalY = (doc as any).lastAutoTable.finalY || 150;
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text(`VALOR TOTAL DEL INVENTARIO: ${formatCurrency(totalValue)}`, 190, finalY + 10, { align: 'right' });

        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('Foodie Guru - Control de Almacén', 105, 285, { align: 'center' });

        doc.save(`Existencias_Almacen_${branchName || 'Sucursal'}.pdf`);
    };

    return (
        <PageShell
            title="Almacén"
            subtitle={branchName ? `Existencias y movimientos — ${branchName}` : 'Existencias y movimientos por sucursal'}
            icon={Warehouse}
            className="!mt-3"
            actions={
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 flex-wrap">
                    {/* Branch selector */}
                    <select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-blue-500 shadow-sm min-w-[180px]"
                    >
                        <option value="">Sucursal…</option>
                        {branches.map(b => (
                            <option key={b.IdSucursal} value={b.IdSucursal}>{b.Sucursal}</option>
                        ))}
                    </select>

                    {/* Search */}
                    <div className="relative flex-1 lg:flex-none min-w-[220px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar producto, código, categoría…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 pl-9 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-800 font-medium text-xs transition-all shadow-sm"
                        />
                    </div>

                    <Button
                        leftIcon={Download}
                        onClick={exportStockToPDF}
                        size="sm"
                        variant="secondary"
                    >
                        PDF
                    </Button>

                    <Button
                        leftIcon={SlidersHorizontal}
                        iconBox
                        onClick={() => openAdjust()}
                        size="sm"
                        variant="solid"
                    >
                        Ajustar Existencias
                    </Button>
                </div>
            }
        >
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-2">
                    <Package size={14} className="text-gray-400" />
                    <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Productos en Almacén</p>
                        <p className="text-sm font-bold text-gray-900">{filteredStock.length}</p>
                    </div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-2">
                    <DollarSign size={14} className="text-gray-400" />
                    <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Inventario Costeado</p>
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(totalValue)}</p>
                    </div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-2">
                    <AlertTriangle size={14} className={negativeCount > 0 ? 'text-red-500' : 'text-gray-400'} />
                    <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Existencias Negativas</p>
                        <p className={`text-sm font-bold ${negativeCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>{negativeCount}</p>
                    </div>
                </div>
            </div>

            {/* Filter toggle */}
            <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer select-none bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
                    <input
                        type="checkbox"
                        checked={onlyWithStock}
                        onChange={(e) => setOnlyWithStock(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                    />
                    Solo productos con existencia
                </label>
            </div>

            {/* Stock Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
                    <table className="min-w-full border-collapse">
                        <ThemedGridHeader className="sticky top-0 z-10 shadow-sm">
                            <ThemedGridHeaderCell>Producto</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell>Categoría</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell align="center">Unidad</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell align="right">Existencia</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell align="right">Costo Prom.</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell align="right">Valor</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell>Última Act.</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell align="right">Acciones</ThemedGridHeaderCell>
                        </ThemedGridHeader>

                        <TableBody
                            loading={isLoading}
                            empty={!isLoading && filteredStock.length === 0}
                            emptyMessage={
                                !selectedBranch
                                    ? 'Selecciona una sucursal para ver su almacén'
                                    : searchTerm
                                        ? 'Sin resultados para tu búsqueda'
                                        : 'Sin existencias registradas. Aplica órdenes de compra o captura un ajuste para iniciar.'
                            }
                            colSpan={8}
                        >
                            {stockGroups.map((group) => [
                                <tr
                                    key={`cat-${group.categoria}`}
                                    onClick={() => toggleGroup(group.categoria)}
                                    className="bg-gray-50/90 border-y border-gray-100 cursor-pointer hover:bg-gray-100/80 transition-colors select-none"
                                >
                                    <td colSpan={5} className="px-4 py-2">
                                        <span className="flex items-center gap-2">
                                            {collapsedGroups.has(group.categoria)
                                                ? <ChevronRight size={14} className="text-gray-400" />
                                                : <ChevronDown size={14} className="text-gray-400" />}
                                            <span className="text-base leading-none">{group.emoji}</span>
                                            <span className="text-xs font-black text-gray-700 uppercase tracking-wide">{group.categoria}</span>
                                            <span className="text-[10px] font-bold text-gray-400 bg-white border border-gray-200 rounded-full px-2 py-0.5">
                                                {group.rows.length}
                                            </span>
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        <span className={`text-xs font-black tabular-nums ${group.subtotal < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                                            {formatCurrency(group.subtotal)}
                                        </span>
                                    </td>
                                    <td colSpan={2}></td>
                                </tr>,
                                ...(collapsedGroups.has(group.categoria) ? [] : group.rows.map((row) => {
                                const value = Number(row.Existencia) * Number(row.CostoPromedio);
                                const isNegative = Number(row.Existencia) < 0;
                                return (
                                    <TableRow key={row.IdProducto}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-900">{row.Producto}</span>
                                                {row.Codigo && <span className="text-xs text-gray-400 font-semibold">{row.Codigo}</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell muted>{row.Categoria || '—'}</TableCell>
                                        <TableCell align="center">
                                            <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">
                                                {row.Unidad || row.UnidadMedidaInventario || '—'}
                                            </span>
                                        </TableCell>
                                        <TableCell align="right">
                                            <span className={`font-bold tabular-nums ${isNegative ? 'text-red-600' : 'text-gray-900'}`}>
                                                {formatQty(row.Existencia)}
                                            </span>
                                        </TableCell>
                                        <TableCell align="right">
                                            <span className="text-gray-600 tabular-nums">{formatCurrency(row.CostoPromedio)}</span>
                                        </TableCell>
                                        <TableCell align="right">
                                            <span className={`font-semibold tabular-nums ${value < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                                {formatCurrency(value)}
                                            </span>
                                        </TableCell>
                                        <TableCell muted>
                                            {row.FechaAct ? new Date(row.FechaAct).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                                        </TableCell>
                                        <TableCell align="right">
                                            <div className="flex items-center justify-end gap-1">
                                                <RowActionButton
                                                    icon={History}
                                                    label="Ver movimientos (kardex)"
                                                    variant="view"
                                                    onClick={() => openMovements(row)}
                                                />
                                                <RowActionButton
                                                    icon={SlidersHorizontal}
                                                    label="Ajustar existencia"
                                                    variant="edit"
                                                    onClick={() => openAdjust(row)}
                                                />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                                })),
                            ])}
                        </TableBody>
                    </table>
                </div>

                {!isLoading && filteredStock.length > 0 && (
                    <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                            {filteredStock.length} de {stock.length} productos
                        </span>
                        <span className="text-xs font-semibold text-gray-600">
                            Inventario costeado: {formatCurrency(totalValue)}
                        </span>
                    </div>
                )}
            </div>

            {/* Kardex Modal */}
            <BaseModal
                isOpen={movementsProduct !== null}
                onClose={() => { setMovementsProduct(null); setMovements([]); }}
                title={movementsProduct?.Producto || 'Movimientos'}
                subtitle={`Kardex de almacén — ${branchName}`}
                size="xl"
                headerVariant="primary"
            >
                <div className="space-y-4">
                    {/* Resumen actual */}
                    {movementsProduct && (
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Existencia Actual</p>
                                <p className={`text-lg font-black mt-0.5 ${Number(movementsProduct.Existencia) < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                    {formatQty(movementsProduct.Existencia)} <span className="text-xs font-semibold text-gray-400">{movementsProduct.Unidad || ''}</span>
                                </p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Costo Promedio</p>
                                <p className="text-lg font-black text-gray-900 mt-0.5">{formatCurrency(movementsProduct.CostoPromedio)}</p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Valor</p>
                                <p className="text-lg font-black text-gray-900 mt-0.5">
                                    {formatCurrency(Number(movementsProduct.Existencia) * Number(movementsProduct.CostoPromedio))}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="border border-gray-100 rounded-lg overflow-hidden max-h-[420px] overflow-y-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                                <tr>
                                    <th className="px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wide">Fecha</th>
                                    <th className="px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wide">Movimiento</th>
                                    <th className="px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wide">Referencia</th>
                                    <th className="px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wide text-right">Cantidad</th>
                                    <th className="px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wide text-right">Costo Unit.</th>
                                    <th className="px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wide text-right">Saldo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 bg-white">
                                {isMovementsLoading && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">Cargando movimientos…</td>
                                    </tr>
                                )}
                                {!isMovementsLoading && movements.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">Sin movimientos registrados para este producto.</td>
                                    </tr>
                                )}
                                {!isMovementsLoading && movements.map(mov => {
                                    const isEntry = mov.TipoMovimiento === 'ENTRADA';
                                    return (
                                        <tr key={mov.IdMovimiento} className="hover:bg-gray-50/60 transition-colors">
                                            <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                                                {new Date(mov.FechaMovimiento).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                                                    isEntry
                                                        ? 'bg-green-50 text-green-600 border border-green-100'
                                                        : 'bg-red-50 text-red-600 border border-red-100'
                                                }`}>
                                                    {isEntry ? <ArrowDownCircle size={11} /> : <ArrowUpCircle size={11} />}
                                                    {isEntry ? 'Entrada' : 'Salida'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-semibold text-gray-700">
                                                        {ORIGIN_LABELS[mov.Origen] || mov.Origen}
                                                        {mov.IdOrdenCompra ? ` · OC-${String(mov.IdOrdenCompra).padStart(4, '0')}` : ''}
                                                    </span>
                                                    {mov.Notas && <span className="text-[11px] text-gray-400">{mov.Notas}</span>}
                                                </div>
                                            </td>
                                            <td className={`px-3 py-2.5 text-right text-sm font-bold tabular-nums ${isEntry ? 'text-green-600' : 'text-red-600'}`}>
                                                {isEntry ? '+' : '−'}{formatQty(mov.Cantidad)} <span className="text-[10px] font-semibold text-gray-400">{mov.Unidad || ''}</span>
                                            </td>
                                            <td className="px-3 py-2.5 text-right text-sm text-gray-600 tabular-nums">{formatCurrency(mov.CostoUnitario)}</td>
                                            <td className="px-3 py-2.5 text-right text-sm font-semibold text-gray-900 tabular-nums">{formatQty(mov.ExistenciaNueva)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </BaseModal>

            {/* Adjustment Modal */}
            <BaseModal
                isOpen={isAdjustOpen}
                onClose={() => setIsAdjustOpen(false)}
                title="Ajustar Existencias"
                subtitle={branchName ? `Almacén — ${branchName}` : undefined}
                size="md"
                headerVariant="primary"
                onConfirm={handleSaveAdjust}
                confirmLabel={
                    adjustTipo === 'AJUSTE'
                        ? 'Establecer existencia'
                        : adjustTipo === 'ENTRADA'
                            ? 'Sumar al almacén'
                            : 'Restar del almacén'
                }
                confirmLoading={isSavingAdjust}
                cancelLabel="Cancelar"
            >
                <div className="space-y-4">
                    {/* Producto */}
                    <div className="relative">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Producto</label>
                        <div className="relative mt-1">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                            <input
                                type="text"
                                value={adjustProductSearch}
                                onChange={(e) => {
                                    setAdjustProductSearch(e.target.value);
                                    setAdjustProduct(null);
                                    setIsAdjustListOpen(true);
                                }}
                                onFocus={() => { if (!adjustProduct) setIsAdjustListOpen(true); }}
                                placeholder="Buscar materia prima…"
                                className="w-full text-sm rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2 text-gray-800 focus:outline-none focus:border-blue-500 transition-all"
                            />
                        </div>
                        {isAdjustListOpen && !adjustProduct && products.length > 0 && (
                            <div className="absolute z-[70] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                                {products
                                    .filter(p => p.Producto.toLowerCase().includes(adjustProductSearch.toLowerCase()))
                                    .slice(0, 50)
                                    .map(p => (
                                        <button
                                            key={p.IdProducto}
                                            onClick={() => {
                                                setAdjustProduct(p);
                                                setAdjustProductSearch(p.Producto);
                                                setIsAdjustListOpen(false);
                                            }}
                                            className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-none text-sm font-medium text-gray-800"
                                        >
                                            {p.Producto}
                                            {p.Categoria && <span className="text-xs text-gray-400 ml-1.5">· {p.Categoria}</span>}
                                        </button>
                                    ))}
                            </div>
                        )}
                    </div>

                    {/* Existencia actual del producto seleccionado */}
                    {(() => {
                        const idSel = (adjustProduct as any)?.IdProducto;
                        const current = idSel ? stock.find(r => r.IdProducto === idSel) : undefined;
                        if (!idSel) return null;
                        return (
                            <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Existencia actual</span>
                                <span className={`text-sm font-black ${current && Number(current.Existencia) < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                    {current ? formatQty(current.Existencia) : '0'}
                                    <span className="ml-1 text-xs font-semibold text-gray-400">{current?.Unidad || current?.UnidadMedidaInventario || ''}</span>
                                </span>
                            </div>
                        );
                    })()}

                    {/* Tipo de ajuste */}
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() => setAdjustTipo('ENTRADA')}
                            className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                                adjustTipo === 'ENTRADA' ? 'border-green-300 bg-green-50/70' : 'border-gray-200 bg-white hover:bg-gray-50'
                            }`}
                        >
                            <span className={`block text-sm font-bold ${adjustTipo === 'ENTRADA' ? 'text-green-700' : 'text-gray-800'}`}>+ Sumar</span>
                            <span className="block text-[11px] text-gray-500 mt-0.5">Entrada: aumenta la existencia</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setAdjustTipo('SALIDA')}
                            className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                                adjustTipo === 'SALIDA' ? 'border-red-300 bg-red-50/70' : 'border-gray-200 bg-white hover:bg-gray-50'
                            }`}
                        >
                            <span className={`block text-sm font-bold ${adjustTipo === 'SALIDA' ? 'text-red-700' : 'text-gray-800'}`}>− Restar</span>
                            <span className="block text-[11px] text-gray-500 mt-0.5">Salida: disminuye la existencia</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setAdjustTipo('AJUSTE')}
                            className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                                adjustTipo === 'AJUSTE' ? 'border-blue-300 bg-blue-50/70' : 'border-gray-200 bg-white hover:bg-gray-50'
                            }`}
                        >
                            <span className={`block text-sm font-bold ${adjustTipo === 'AJUSTE' ? 'text-blue-700' : 'text-gray-800'}`}>= Establecer</span>
                            <span className="block text-[11px] text-gray-500 mt-0.5">Fija la existencia exacta; la diferencia se registra como ajuste</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label={adjustTipo === 'AJUSTE' ? 'Nueva existencia' : 'Cantidad'}
                            type="number"
                            min="0"
                            step="0.001"
                            value={adjustCantidad}
                            onChange={(e) => setAdjustCantidad(e.target.value)}
                            placeholder="0"
                        />
                        {adjustTipo === 'SALIDA' ? (
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Costo de salida</label>
                                <div className="text-sm rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-gray-500">
                                    Se usa el costo promedio vigente
                                </div>
                            </div>
                        ) : (
                            <Input
                                label={adjustTipo === 'AJUSTE' ? 'Costo promedio (opcional)' : 'Costo Unitario (opcional)'}
                                type="number"
                                min="0"
                                step="0.01"
                                value={adjustCosto}
                                onChange={(e) => setAdjustCosto(e.target.value)}
                                placeholder="Usa el costo promedio si se omite"
                            />
                        )}
                    </div>

                    <Input
                        label="Motivo / Notas"
                        type="text"
                        value={adjustNotas}
                        onChange={(e) => setAdjustNotas(e.target.value)}
                        placeholder="Ej. Conteo físico, merma, corrección…"
                    />
                </div>
            </BaseModal>
        </PageShell>
    );
}
