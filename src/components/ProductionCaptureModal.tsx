'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';
import ProductionDetailModal from '@/components/ProductionDetailModal';
import ProductionTotalExplosionModal from '@/components/ProductionTotalExplosionModal';

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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl transition-all">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100 text-white rounded-t-2xl" style={{ background: `linear-gradient(to right, ${colors.colorFondo1}, ${colors.colorFondo2})`, color: colors.colorLetra }}>
                    <div>
                        <h2 className="text-2xl font-black flex items-center gap-2">
                            🍳 {t('title') || 'Captura de Producción'}
                        </h2>
                        <p className="text-sm font-medium opacity-90">{date.toLocaleDateString()}</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-all font-bold text-xl">
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block tracking-wider">💰 Costo Producción</label>
                            <div className="text-xl font-black text-teal-600">
                                {formatCurrency(gridItems.reduce((sum, item) => sum + item.Total, 0))}
                            </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block tracking-wider">📦 Items Producidos</label>
                            <div className="text-xl font-black text-gray-800">
                                {gridItems.length}
                            </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block tracking-wider">🔄 Total Insumos</label>
                            <div className="text-xl font-black text-gray-800">
                                {gridItems.reduce((sum, item) => sum + item.Cantidad, 0).toFixed(2)}
                            </div>
                        </div>
                    </div>

                    {/* Form Section */}
                    <div className="bg-teal-50 p-6 rounded-xl border border-teal-100 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                        <form onSubmit={handleAddProduct} className="flex flex-col md:flex-row gap-4 items-end">
                            {/* Product Search */}
                            <div className="flex-1 relative min-w-[250px]">
                                <label className="block text-xs font-bold text-teal-900/60 uppercase tracking-wider mb-2 ml-1">Producto</label>
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
                                        className="w-full px-4 py-2.5 bg-white border border-teal-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all font-bold text-gray-700"
                                    />
                                    {showProductDropdown && (
                                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                            {products.length === 0 ? (
                                                <div className="p-3 text-center text-gray-400 italic text-sm">Cargando productos...</div>
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
                                                                className="px-4 py-2.5 hover:bg-teal-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors"
                                                            >
                                                                <div className="font-bold text-gray-800">{p.Producto}</div>
                                                                <div className="flex justify-between text-[10px] text-gray-400 mt-1 uppercase font-black tracking-widest">
                                                                    <span>{p.Codigo}</span>
                                                                    <span className="bg-gray-100 px-1.5 py-0.5 rounded-full">{p.Categoria}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Quantity */}
                            <div className="w-32">
                                <label className="block text-xs font-bold text-teal-900/60 uppercase tracking-wider mb-2 ml-1">Cant.</label>
                                <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-white border border-teal-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all font-black text-gray-700"
                                    placeholder="0.00"
                                />
                            </div>

                            {/* Presentation - Read Only */}
                            <div className="w-32">
                                <label className="block text-xs font-bold text-teal-900/60 uppercase tracking-wider mb-2 ml-1">Pres.</label>
                                <div className="px-4 py-2.5 bg-gray-100 border border-teal-100 rounded-lg text-gray-500 text-xs font-bold flex items-center h-[42px] truncate">
                                    {selectedProduct?.Presentacion || '-'}
                                </div>
                            </div>

                            {/* Price - Read Only */}
                            <div className="w-32">
                                <label className="block text-xs font-bold text-teal-900/60 uppercase tracking-wider mb-2 ml-1">Precio</label>
                                <div className="px-4 py-2.5 bg-gray-100 border border-teal-100 rounded-lg text-gray-500 text-sm font-bold flex items-center justify-end h-[42px]">
                                    {formatCurrency(currentPrice)}
                                </div>
                            </div>

                            {/* Total - Read Only */}
                            <div className="w-32">
                                <label className="block text-xs font-bold text-teal-900/60 uppercase tracking-wider mb-2 ml-1">Total</label>
                                <div className="px-4 py-2.5 bg-white border border-teal-200 rounded-lg text-teal-600 text-sm font-black flex items-center justify-end h-[42px]">
                                    {formatCurrency(currentTotal)}
                                </div>
                            </div>

                            {/* Add Button */}
                            <button
                                onClick={handleAddProduct}
                                disabled={!selectedProduct || !quantity || isSaving}
                                className="bg-teal-600 text-white px-8 py-2.5 rounded-lg hover:bg-teal-700 font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed h-[42px]"
                            >
                                {isSaving ? '...' : '＋'}
                            </button>
                        </form>
                    </div>

                    {/* Table Section */}
                    <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col bg-white">
                        <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
                            <table className="min-w-full divide-y divide-gray-100">
                                <thead className="bg-gray-50 sticky top-0 z-10 backdrop-blur-sm">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Producto</th>
                                        <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Cant. Producida</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Pres.</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Precio Unit.</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</th>
                                        <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-400 animate-pulse italic">
                                                Cargando producción del día...
                                            </td>
                                        </tr>
                                    ) : gridItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-20 text-center text-gray-400 italic text-sm">
                                                No hay productos registrados en esta producción.
                                            </td>
                                        </tr>
                                    ) : (
                                        gridItems.map((item) => (
                                            <tr key={item.IdProduccion} className="hover:bg-teal-50/30 transition-colors group">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-bold text-gray-800">{item.Producto}</div>
                                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{item.Codigo}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-black text-gray-700">
                                                    {item.Cantidad.toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-500 uppercase">
                                                    {item.Presentacion}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600 font-medium">
                                                    {formatCurrency(item.Precio)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-black text-teal-600">
                                                    {formatCurrency(item.Total)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <div className="flex justify-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                                                            title="Detalle"
                                                            onClick={() => handleOpenDetail(item)}
                                                        >
                                                            📝
                                                        </button>
                                                        <button
                                                            className="p-1.5 hover:bg-primary-50 text-primary-600 rounded-lg transition-colors"
                                                            title="Explosión"
                                                            onClick={() => alert('Para ver la explosión total, usa el botón abajo.')}
                                                        >
                                                            💥
                                                        </button>
                                                        <button
                                                            className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                                            title="Eliminar"
                                                            onClick={() => handleDeleteItem(item.IdProduccion)}
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Insumos Totales</span>
                            <span className="text-xl font-black text-gray-800">
                                {gridItems.reduce((sum, item) => sum + item.Cantidad, 0).toFixed(2)}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Costo Total</span>
                            <span className="text-2xl font-black text-teal-600">
                                {formatCurrency(gridItems.reduce((sum, item) => sum + item.Total, 0))}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto">
                        <button
                            onClick={() => setIsExplosionOpen(true)}
                            className="flex-1 md:flex-none px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-bold transition-all shadow-md shadow-primary-200"
                        >
                            💥 Explosión Total
                        </button>
                        <button
                            onClick={onClose}
                            className="flex-1 md:flex-none px-10 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-bold transition-all"
                        >
                            {t('close') || 'Cerrar'}
                        </button>
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
