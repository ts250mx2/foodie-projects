'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        🍳 Captura de Producción - {date.toLocaleDateString()}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                    {/* Input Form */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <form onSubmit={handleAddProduct} className="flex flex-col md:flex-row gap-4 items-end">
                            {/* Product Search */}
                            <div className="flex-1 relative min-w-[300px]">
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Producto</label>
                                <input
                                    type="text"
                                    value={productSearch}
                                    onChange={(e) => {
                                        setProductSearch(e.target.value);
                                        setShowProductDropdown(true);
                                        setSelectedProduct(null);
                                    }}
                                    onFocus={() => setShowProductDropdown(true)}
                                    placeholder="Buscar producto..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                {showProductDropdown && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                        {products.length === 0 ? (
                                            <div className="p-3 text-center text-gray-500 text-sm">Cargando productos...</div>
                                        ) : (
                                            <>
                                                {products
                                                    .filter(p =>
                                                        productSearch === '' ||
                                                        p.Producto.toLowerCase().includes(productSearch.toLowerCase()) ||
                                                        p.Codigo.toLowerCase().includes(productSearch.toLowerCase()) ||
                                                        p.Categoria.toLowerCase().includes(productSearch.toLowerCase())
                                                    )
                                                    .map(p => (
                                                        <div
                                                            key={p.IdProducto}
                                                            onClick={() => {
                                                                setSelectedProduct(p);
                                                                setProductSearch(p.Producto);
                                                                setShowProductDropdown(false);
                                                            }}
                                                            className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                                                        >
                                                            <div className="font-medium text-gray-800">{p.Producto}</div>
                                                            <div className="flex justify-between text-xs text-gray-500 mt-0.5">
                                                                <span>{p.Codigo}</span>
                                                                <span className="bg-gray-100 px-1.5 py-0.5 rounded">{p.Categoria}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                {products.length > 0 && products.filter(p =>
                                                    productSearch === '' ||
                                                    p.Producto.toLowerCase().includes(productSearch.toLowerCase()) ||
                                                    p.Codigo.toLowerCase().includes(productSearch.toLowerCase())
                                                ).length === 0 && (
                                                        <div className="p-3 text-center text-gray-500 italic text-sm">No se encontraron productos</div>
                                                    )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Quantity */}
                            <div className="w-32">
                                <Input
                                    label="Cantidad"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    required={false}
                                />
                            </div>

                            {/* Presentation - Read Only */}
                            <div className="w-40">
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Presentación</label>
                                <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 text-sm h-[42px] flex items-center">
                                    {selectedProduct?.Presentacion || '-'}
                                </div>
                            </div>

                            {/* Price - Read Only */}
                            <div className="w-32">
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Precio</label>
                                <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 text-sm h-[42px] flex items-center justify-end">
                                    ${currentPrice.toFixed(2)}
                                </div>
                            </div>

                            {/* Total - Read Only */}
                            <div className="w-32">
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Total</label>
                                <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 font-bold text-sm h-[42px] flex items-center justify-end">
                                    ${currentTotal.toFixed(2)}
                                </div>
                            </div>

                            {/* Add Button */}
                            <Button
                                onClick={handleAddProduct}
                                disabled={!selectedProduct || !quantity || isSaving}
                                className={`h-[42px] px-6 ${!selectedProduct || !quantity || isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isSaving ? 'Guardando...' : 'Agregar'}
                            </Button>
                        </form>
                    </div>

                    {/* Grid */}
                    <div className="flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <ThemedGridHeader>
                                    <ThemedGridHeaderCell>Producto</ThemedGridHeaderCell>
                                    <ThemedGridHeaderCell className="text-right">Cantidad</ThemedGridHeaderCell>
                                    <ThemedGridHeaderCell>Presentación</ThemedGridHeaderCell>
                                    <ThemedGridHeaderCell className="text-right">Precio Unit.</ThemedGridHeaderCell>
                                    <ThemedGridHeaderCell className="text-right">Total</ThemedGridHeaderCell>
                                    <ThemedGridHeaderCell className="text-right">Acciones</ThemedGridHeaderCell>
                                </ThemedGridHeader>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                                Cargando registros...
                                            </td>
                                        </tr>
                                    ) : gridItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500 text-sm italic">
                                                No hay productos agregados a la producción del día.
                                            </td>
                                        </tr>
                                    ) : (
                                        gridItems.map((item) => (
                                            <tr key={item.IdProduccion} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {item.Producto}
                                                    <div className="text-xs text-gray-500 font-normal">{item.Codigo}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                                                    {item.Cantidad}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {item.Presentacion}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                                                    ${item.Precio.toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                                                    ${item.Total.toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded"
                                                            title="Detalle"
                                                            onClick={() => handleOpenDetail(item)}
                                                        >
                                                            📝
                                                        </button>
                                                        <button
                                                            className="text-orange-600 hover:text-orange-900 p-1 hover:bg-orange-50 rounded"
                                                            title="Explosión de Insumos"
                                                            onClick={() => alert('Para ver la explosión total, usa el botón abajo.')}
                                                        >
                                                            💥
                                                        </button>
                                                        <button
                                                            className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
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
                <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-lg">
                    <div className="mr-auto flex items-center gap-4">
                        <div className="text-sm font-medium text-gray-600">Total Producción:</div>
                        <div className="text-xl font-bold text-blue-600">
                            ${gridItems.reduce((sum, item) => sum + item.Total, 0).toFixed(2)}
                        </div>
                    </div>

                    <Button onClick={() => setIsExplosionOpen(true)} className="bg-orange-600 text-white hover:bg-orange-700">
                        💥 Explosión Total
                    </Button>

                    <Button onClick={onClose} className="bg-gray-500 text-white">
                        Cerrar
                    </Button>
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
                />
            )}
        </div>
    );
}
