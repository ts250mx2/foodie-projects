'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import LoadingSpinner from '@/components/LoadingSpinner';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell, TableBody, TableRow, TableCell } from '@/components/ThemedGridHeader';
import ProductionDetailModal from '@/components/ProductionDetailModal';
import ProductionTotalExplosionModal from '@/components/ProductionTotalExplosionModal';
import { ChefHat, X, Plus, Zap, Trash2, FileText, RotateCw, DollarSign, Package } from 'lucide-react';

interface ProductionProduct {
    IdProducto: number;
    Producto: string;
    Codigo: string;
    IdCategoria: number;
    IdPresentacion: number;
    Precio: number;
    IVA: number;
    RutaFoto?: string;
    Categoria: string;
    Presentacion: string;
}

interface ProductionItem {
    IdProduccion: number;
    IdProducto: number;
    Producto: string;
    Codigo: string;
    Categoria: string;
    Presentacion: string;
    Cantidad: number;
    Precio: number;
    Total: number;
}

interface ProductionCaptureModalProps {
    isOpen: boolean;
    onClose: () => void;
    date: Date;
    projectId: number;
    branchId: number;
}

export default function ProductionCaptureModal({ isOpen, onClose, date, projectId, branchId }: ProductionCaptureModalProps) {
    const t = useTranslations('Production');
    const { colors } = useTheme();
    const [products, setProducts] = useState<ProductionProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [gridItems, setGridItems] = useState<ProductionItem[]>([]);

    // Detail Modal State
    const [detailItem, setDetailItem] = useState<ProductionItem | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    // Total Explosion Modal State
    const [isExplosionOpen, setIsExplosionOpen] = useState(false);

    // Form state
    const [selectedProduct, setSelectedProduct] = useState<ProductionProduct | null>(null);
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const [quantity, setQuantity] = useState<string>('');

    useEffect(() => {
        if (isOpen && projectId) {
            fetchProducts();
            fetchDailyProduction();
        }
    }, [isOpen, projectId, branchId, date]);

    const fetchProducts = async () => {
        try {
            const response = await fetch(`/api/production/products?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                setProducts(data.data);
            }
        } catch (error) {
            console.error('Error fetching production products:', error);
        }
    };

    const fetchDailyProduction = async () => {
        setIsLoading(true);
        try {
            const dateStr = date.toISOString();
            const response = await fetch(`/api/production/daily?projectId=${projectId}&branchId=${branchId}&date=${dateStr}`);
            const data = await response.json();
            if (data.success) {
                setGridItems(data.data);
            }
        } catch (error) {
            console.error('Error fetching daily production:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenDetail = (item: ProductionItem) => {
        setDetailItem(item);
        setIsDetailOpen(true);
    };

    const handleAddProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct || !quantity) return;

        const qty = parseFloat(quantity);
        if (isNaN(qty) || qty <= 0) return;

        setIsSaving(true);
        try {
            const response = await fetch('/api/production/daily', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    branchId,
                    productId: selectedProduct.IdProducto,
                    quantity: qty,
                    price: selectedProduct.Precio,
                    date: date.toISOString()
                })
            });

            if (response.ok) {
                await fetchDailyProduction();
                setSelectedProduct(null);
                setProductSearch('');
                setQuantity('');
            } else {
                alert('Error al guardar el producto');
            }
        } catch (error) {
            console.error('Error saving production:', error);
            alert('Error de conexión al guardar');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteItem = async (idProduccion: number) => {
        if (!confirm('¿Estás seguro de eliminar este registro?')) return;

        try {
            const response = await fetch(`/api/production/daily?projectId=${projectId}&productionId=${idProduccion}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await fetchDailyProduction();
            } else {
                alert('Error al eliminar el registro');
            }
        } catch (error) {
            console.error('Error deleting production:', error);
        }
    };

    // Calculate total for display in form
    const currentPrice = selectedProduct?.Precio || 0;
    const currentTotal = selectedProduct && quantity ? (currentPrice * parseFloat(quantity || '0')) : 0;

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(val);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[500] p-4">
            <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl transition-all">
                {/* Header */}
                <div
                    className="relative overflow-hidden sticky top-0 z-20 flex items-start justify-between px-5 py-4 gap-4 border-b border-black/5 shrink-0"
                    style={{ backgroundColor: 'var(--color-brand-orange)' }}
                >
                    <span aria-hidden="true" className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10" />
                    <div className="relative z-10 flex flex-col gap-0.5 min-w-0">
                        <h2
                            className="brand-heading text-[15px] font-semibold leading-tight flex items-center gap-2"
                            style={{ color: colors.colorLetra }}
                        >
                            <ChefHat size={16} /> {t('title') || 'Captura de Producción'}
                        </h2>
                        <p
                            className="text-[12px] leading-tight"
                            style={{ color: colors.colorLetra, opacity: 0.8 }}
                        >
                            {date.toLocaleDateString()}
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        aria-label="Cerrar"
                        className="relative z-10 shrink-0 mt-0.5 p-1.5 rounded-lg active:scale-95 transition-all duration-100 hover:bg-white/10"
                        style={{ color: colors.colorLetra }}
                    >
                        <X size={16} strokeWidth={2} />
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="shrink-0 px-6 py-5 bg-gray-50/50 border-b border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-2">
                                <DollarSign size={14} className="text-gray-400" />
                                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Costo Producción</label>
                            </div>
                            <div className="text-lg font-bold text-teal-600">
                                {formatCurrency(gridItems.reduce((sum, item) => sum + item.Total, 0))}
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-2">
                                <Package size={14} className="text-gray-400" />
                                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Items Producidos</label>
                            </div>
                            <div className="text-lg font-bold text-gray-800">
                                {gridItems.length}
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-2">
                                <RotateCw size={14} className="text-gray-400" />
                                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Insumos</label>
                            </div>
                            <div className="text-lg font-bold text-gray-800">
                                {gridItems.reduce((sum, item) => sum + item.Cantidad, 0).toFixed(2)}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {/* Form Section */}
                    <div className="shrink-0 px-6 py-5 bg-gray-50/50 border-b border-gray-100 animate-in fade-in slide-in-from-top-4 duration-300">
                        <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            {/* Product Search */}
                            <div className="flex flex-col relative md:col-span-2">
                                <label className="text-xs font-bold text-teal-900/60 uppercase tracking-wider mb-2 ml-1">Producto *</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={productSearch}
                                        onChange={(e) => {
                                            setProductSearch(e.target.value);
                                            setShowProductDropdown(true);
                                            setSelectedProduct(null);
                                        }}
                                        onFocus={() => setShowProductDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                                        placeholder="Buscar producto..."
                                        className="w-full p-2.5 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-gray-700"
                                        required
                                    />
                                    {showProductDropdown && (
                                        <div className="absolute z-[510] w-full top-full mt-1 bg-white border-2 border-blue-300 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                            {products.length === 0 ? (
                                                <div className="p-3"><LoadingSpinner message="Cargando productos..." size="sm" /></div>
                                            ) : (
                                                <>
                                                    {products
                                                        .filter(p =>
                                                            productSearch === '' ||
                                                            p.Producto.toLowerCase().includes(productSearch.toLowerCase()) ||
                                                            p.Codigo.toLowerCase().includes(productSearch.toLowerCase())
                                                        )
                                                        .map(p => (
                                                            <div
                                                                key={p.IdProducto}
                                                                onClick={() => {
                                                                    setSelectedProduct(p);
                                                                    setProductSearch(p.Producto);
                                                                    setShowProductDropdown(false);
                                                                }}
                                                                className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-0 border-gray-50 font-bold text-sm text-gray-800"
                                                            >
                                                                <div>{p.Codigo} — {p.Producto}</div>
                                                                <div className="text-[10px] uppercase font-bold text-gray-400">{p.Categoria}</div>
                                                            </div>
                                                        ))}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Quantity */}
                            <div className="flex flex-col">
                                <label className="text-xs font-bold text-teal-900/60 uppercase tracking-wider mb-2 ml-1">Cantidad *</label>
                                <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    className="w-full p-2.5 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all font-black text-gray-700"
                                    placeholder="0.00"
                                    required
                                />
                            </div>

                            {/* Add Button */}
                            <button
                                type="submit"
                                disabled={!selectedProduct || !quantity || isSaving}
                                className="bg-teal-600 text-white px-6 py-2.5 rounded-lg hover:bg-teal-700 font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 h-10"
                            >
                                {isSaving ? '...' : <><Plus size={16} /> Agregar</>}
                            </button>
                        </form>
                    </div>

                    {/* Table Section */}
                    <div className="flex-1 overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm">
                        <table className="w-full border-collapse">
                            <ThemedGridHeader className="sticky top-0 z-10 shadow-sm">
                                <ThemedGridHeaderCell>
                                    Producto
                                </ThemedGridHeaderCell>
                                <ThemedGridHeaderCell align="center">
                                    Cant. Producida
                                </ThemedGridHeaderCell>
                                <ThemedGridHeaderCell>
                                    Presentación
                                </ThemedGridHeaderCell>
                                <ThemedGridHeaderCell align="right">
                                    Precio Unit.
                                </ThemedGridHeaderCell>
                                <ThemedGridHeaderCell align="right">
                                    Total
                                </ThemedGridHeaderCell>
                                <ThemedGridHeaderCell align="right">
                                    Acciones
                                </ThemedGridHeaderCell>
                            </ThemedGridHeader>
                            <TableBody
                                loading={isLoading}
                                empty={gridItems.length === 0}
                                emptyMessage="No hay productos registrados en esta producción"
                                colSpan={6}
                            >
                                {gridItems.map((item) => (
                                    <TableRow key={item.IdProduccion}>
                                        <TableCell>
                                            <div className="font-medium text-gray-900">{item.Producto}</div>
                                            <div className="text-[10px] text-gray-500 font-mono">#{item.Codigo}</div>
                                        </TableCell>
                                        <TableCell align="center">
                                            <span className="font-medium text-gray-900">{item.Cantidad.toFixed(2)}</span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm text-gray-600">{item.Presentacion}</span>
                                        </TableCell>
                                        <TableCell align="right">
                                            <span className="text-gray-900 font-medium">{formatCurrency(item.Precio)}</span>
                                        </TableCell>
                                        <TableCell align="right">
                                            <span className="font-bold text-teal-600">
                                                {formatCurrency(item.Total)}
                                            </span>
                                        </TableCell>
                                        <TableCell align="right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                                                    title="Detalle"
                                                    onClick={() => handleOpenDetail(item)}
                                                >
                                                    <FileText size={16} />
                                                </button>
                                                <button
                                                    className="p-1.5 hover:bg-primary-50 text-primary-600 rounded-lg transition-colors"
                                                    title="Explosión"
                                                    onClick={() => alert('Para ver la explosión total, usa el botón abajo.')}
                                                >
                                                    <Zap size={16} />
                                                </button>
                                                <button
                                                    className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                                    title="Eliminar"
                                                    onClick={() => handleDeleteItem(item.IdProduccion)}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Insumos Totales</span>
                            <span className="text-lg font-black text-gray-800">
                                {gridItems.reduce((sum, item) => sum + item.Cantidad, 0).toFixed(2)}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Costo Total</span>
                            <span className="text-lg font-black text-teal-600">
                                {formatCurrency(gridItems.reduce((sum, item) => sum + item.Total, 0))}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-2.5">
                        <Button
                            onClick={() => setIsExplosionOpen(true)}
                            variant="solid"
                            size="md"
                            leftIcon={Zap}
                            iconBox
                        >
                            Explosión Total
                        </Button>
                        <Button
                            onClick={onClose}
                            variant="secondary"
                            size="md"
                            leftIcon={X}
                        >
                            {t('close') || 'Cerrar'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Detail Modal */}
            {isDetailOpen && detailItem && (
                <ProductionDetailModal
                    isOpen={isDetailOpen}
                    onClose={() => setIsDetailOpen(false)}
                    productionItem={{
                        IdProducto: detailItem.IdProducto,
                        Producto: detailItem.Producto,
                        Cantidad: detailItem.Cantidad
                    }}
                    projectId={projectId}
                />
            )}

            {/* Total Explosion Modal */}
            {isExplosionOpen && (
                <ProductionTotalExplosionModal
                    isOpen={isExplosionOpen}
                    onClose={() => setIsExplosionOpen(false)}
                    date={date}
                    projectId={projectId}
                    branchId={branchId}
                    sourceSummary={gridItems.map(item => `${item.Producto} (${item.Cantidad})`).join(', ')}
                />
            )}
        </div>
    );
}
