'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';
import CostingModal from '@/components/CostingModal';
import MassiveProductUpload from '@/components/MassiveProductUpload';
import ProductImageCaptureModal from '@/components/ProductImageCaptureModal';
import PageShell from '@/components/PageShell';

interface Product {
    IdProducto: number;
    Producto: string;
    Codigo: string;
    IdCategoria: number;
    IdPresentacion: number;
    Precio: number;
    IVA: number;
    Status: number;
    Categoria?: string;
    Presentacion?: string;
    IdCategoriaRecetario?: number;
    IdSeccionMenu?: number;
    PorcentajeCostoIdeal?: number;
    IdTipoProducto: number;
    CantidadCompra: number;
    IdPresentacionInventario: number | null;
    UnidadMedidaCompra?: string;
    UnidadMedidaInventario?: string;
    UnidadMedidaRecetario?: string;
    ImagenCategoria?: string;
    ArchivoImagen?: string;
    IdModuloRecetario?: number;
    FechaAct?: string;
}

interface Category {
    IdCategoria: number;
    Categoria: string;
}

interface Presentation {
    IdPresentacion: number;
    Presentacion: string;
}

interface KitItem {
    IdProductoPadre: number;
    IdProductoHijo: number;
    Cantidad: number;
    Producto: string;
    Codigo: string;
    Categoria: string;
    Presentacion: string;
}

export default function ProductsPage() {
    const t = useTranslations('Products');
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [presentations, setPresentations] = useState<Presentation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isKitsModalOpen, setIsKitsModalOpen] = useState(false);
    const [isDeleteKitModalOpen, setIsDeleteKitModalOpen] = useState(false);
    const [isMassiveModalOpen, setIsMassiveModalOpen] = useState(false);
    const [isProductImageCaptureModalOpen, setIsProductImageCaptureModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [kitItems, setKitItems] = useState<KitItem[]>([]);
    const [deletingKitItem, setDeletingKitItem] = useState<KitItem | null>(null);
    const [kitFormData, setKitFormData] = useState({
        idProductoHijo: '',
        cantidad: ''
    });
    const [productSearch, setProductSearch] = useState('');
    const [codeSearch, setCodeSearch] = useState('');
    const [categorySearch, setCategorySearch] = useState('');
    const [formData, setFormData] = useState({
        producto: '',
        codigo: '',
        idCategoria: '',
        idPresentacion: '',
        precio: '',
        iva: ''
    });
    const [selectedProductForCosting, setSelectedProductForCosting] = useState<Product | null>(null);
    const [project, setProject] = useState<any>(null);

    // New state for creating category/presentation
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isCreatingPresentation, setIsCreatingPresentation] = useState(false);
    const [newPresentationName, setNewPresentationName] = useState('');
    const [showRecentOnly, setShowRecentOnly] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Product, direction: 'asc' | 'desc' } | null>(null);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
    const [isDeletingBulk, setIsDeletingBulk] = useState(false);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchProducts();
            fetchCategories();
            fetchPresentations();
        }
    }, [project]);

    const fetchProducts = async () => {
        try {
            const response = await fetch(`/api/products?projectId=${project.idProyecto}&useView=true`);
            const data = await response.json();
            if (data.success) {
                setProducts(data.data);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const response = await fetch(`/api/categories?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setCategories(data.data);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const fetchPresentations = async () => {
        try {
            const response = await fetch(`/api/presentations?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setPresentations(data.data);
            }
        } catch (error) {
            console.error('Error fetching presentations:', error);
        }
    };

    const fetchKitItems = async (productId: number) => {
        try {
            const response = await fetch(`/api/product-kits?projectId=${project.idProyecto}&productId=${productId}`);
            const data = await response.json();
            if (data.success) {
                setKitItems(data.data);
            }
        } catch (error) {
            console.error('Error fetching kit items:', error);
        }
    };

    const handleKitSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct) return;

        try {
            const response = await fetch('/api/product-kits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    idProductoPadre: selectedProduct.IdProducto,
                    idProductoHijo: parseInt(kitFormData.idProductoHijo),
                    cantidad: parseFloat(kitFormData.cantidad)
                })
            });

            if (response.ok) {
                fetchKitItems(selectedProduct.IdProducto);
                setKitFormData({
                    idProductoHijo: '',
                    cantidad: ''
                });
                setProductSearch('');
            }
        } catch (error) {
            console.error('Error saving kit item:', error);
        }
    };

    const handleDeleteKitItem = async () => {
        if (!deletingKitItem || !selectedProduct) return;
        try {
            const response = await fetch(`/api/product-kits/delete?projectId=${project.idProyecto}&idProductoPadre=${selectedProduct.IdProducto}&idProductoHijo=${deletingKitItem.IdProductoHijo}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchKitItems(selectedProduct.IdProducto);
                setIsDeleteKitModalOpen(false);
                setDeletingKitItem(null);
            }
        } catch (error) {
            console.error('Error deleting kit item:', error);
        }
    };

    const openKitsModal = (product: Product) => {
        setSelectedProductForCosting(product);
        setIsModalOpen(true);
    };

    const openDeleteKitModal = (kitItem: KitItem) => {
        setDeletingKitItem(kitItem);
        setIsDeleteKitModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingProduct
                ? `/api/products/${editingProduct.IdProducto}`
                : '/api/products';

            const method = editingProduct ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    producto: formData.producto,
                    codigo: formData.codigo,
                    idCategoria: parseInt(formData.idCategoria),
                    idPresentacion: parseInt(formData.idPresentacion),
                    precio: parseFloat(formData.precio.replace(/,/g, '')),
                    iva: parseFloat(formData.iva)
                })
            });

            if (response.ok) {
                fetchProducts();
                setIsModalOpen(false);
                setFormData({
                    producto: '',
                    codigo: '',
                    idCategoria: '',
                    idPresentacion: '',
                    precio: '',
                    iva: ''
                });
                setEditingProduct(null);
            }
        } catch (error) {
            console.error('Error saving product:', error);
        }
    };

    const handleDelete = async () => {
        if (!editingProduct) return;
        try {
            const response = await fetch(`/api/products/${editingProduct.IdProducto}?projectId=${project.idProyecto}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchProducts();
                setIsDeleteModalOpen(false);
                setEditingProduct(null);
            }
        } catch (error) {
            console.error('Error deleting product:', error);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        setIsDeletingBulk(true);
        try {
            const response = await fetch('/api/products', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    productIds: selectedIds
                })
            });

            if (response.ok) {
                fetchProducts();
                setSelectedIds([]);
                setIsBulkDeleteModalOpen(false);
            }
        } catch (error) {
            console.error('Error bulk deleting products:', error);
        } finally {
            setIsDeletingBulk(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === sortedAndFilteredProducts.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(sortedAndFilteredProducts.map(p => p.IdProducto));
        }
    };

    const toggleSelectProduct = (id: number) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleProductUpdate = (updatedProduct?: any, shouldClose = true) => {
        fetchProducts();
        if (updatedProduct) {
            setSelectedProductForCosting(updatedProduct);
        }
        if (shouldClose) {
            setIsModalOpen(false);
            setSelectedProductForCosting(null);
            setEditingProduct(null);
        }
    };

    const openEditModal = (product: Product) => {
        setEditingProduct(product);
        setSelectedProductForCosting(product);
        setIsModalOpen(true);
    };

    const openDeleteModal = (product: Product) => {
        setEditingProduct(product);
        setIsDeleteModalOpen(true);
    };

    const filteredProducts = products.filter(p =>
        p.IdProducto !== selectedProduct?.IdProducto &&
        ((p.Producto || '').toLowerCase().includes(productSearch.toLowerCase()) ||
            (p.Codigo || '').toLowerCase().includes(productSearch.toLowerCase()))
    );

    const sortedAndFilteredProducts = products
        .filter(product => {
            const categoryName = product.Categoria ? String(product.Categoria) : '';
            const matchesCategory = categoryName.toLowerCase().includes(categorySearch.toLowerCase());

            const searchTermLower = searchTerm.toLowerCase();
            const codeSearchLower = codeSearch.toLowerCase();
            const productName = product.Producto ? String(product.Producto) : '';
            const productCode = product.Codigo ? String(product.Codigo) : '';

            const matchesSearch = productName.toLowerCase().includes(searchTermLower);
            const matchesCode = productCode.toLowerCase().includes(codeSearchLower);

            let matchesRecent = true;
            if (showRecentOnly && product.FechaAct) {
                const productDate = new Date(product.FechaAct);
                const now = new Date();
                const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
                matchesRecent = productDate >= oneHourAgo;
            }

            return matchesCategory && matchesSearch && matchesCode && matchesRecent;
        })
        .sort((a, b) => {
            const { key, direction } = sortConfig || { key: 'FechaAct', direction: 'desc' };

            const aValue = key === 'Categoria' ? (a.Categoria ?? '') :
                key === 'Presentacion' ? (a.Presentacion ?? '') :
                    (a[key] ?? '');

            const bValue = key === 'Categoria' ? (b.Categoria ?? '') :
                key === 'Presentacion' ? (b.Presentacion ?? '') :
                    (b[key] ?? '');

            if (aValue === bValue) return 0;

            if (aValue < bValue) return direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    const handleSort = (key: keyof Product) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };


    return (
        <PageShell
            title={t('title')}
            actions={
                <div className="flex gap-2 flex-wrap">
                    <Button
                        onClick={() => setShowRecentOnly(!showRecentOnly)}
                        variant={showRecentOnly ? 'primary' : 'secondary'}
                        className={`${showRecentOnly ? 'bg-amber-500 hover:bg-amber-600 border-amber-600' : ''} flex items-center gap-2`}
                        title="Mostrar productos cargados en la última hora"
                    >
                        {showRecentOnly ? '🕒 Mostrando Recientes' : '🕒 Ver Recientes'}
                    </Button>
                    <Button onClick={() => setIsMassiveModalOpen(true)} variant="primary" className="bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2">
                        📊 Carga por Excel
                    </Button>
                    <Button onClick={() => setIsProductImageCaptureModalOpen(true)} variant="primary" className="bg-indigo-600 hover:bg-indigo-700 flex items-center gap-2">
                        📸 Carga por Imagen
                    </Button>
                    <Button
                        onClick={() => {
                            const XLSX = require('xlsx');
                            const dataToExport = sortedAndFilteredProducts.map(p => ({
                                'Producto': p.Producto,
                                'Código': p.Codigo,
                                'Categoría': p.Categoria || '',
                                'Unidad Medida Compra': (p as any).UnidadMedidaCompra || '',
                                'Precio': p.Precio,
                                'IVA (%)': p.IVA,
                                'Estatus': p.Status === 0 ? 'Activo' : 'Inactivo'
                            }));
                            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
                            const workbook = XLSX.utils.book_new();
                            XLSX.utils.book_append_sheet(workbook, worksheet, "Productos");
                            XLSX.writeFile(workbook, "listado_productos.xlsx");
                        }}
                        variant="secondary"
                    >
                        📤 Exportar Excel
                    </Button>
                    <Button onClick={() => { setEditingProduct(null); setSelectedProductForCosting(null); setIsModalOpen(true); }}>
                        {t('addProduct')}
                    </Button>
                    {selectedIds.length > 0 && (
                        <Button onClick={() => setIsBulkDeleteModalOpen(true)} variant="primary" className="bg-red-600 hover:bg-red-700 flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                            🗑️ Eliminar ({selectedIds.length})
                        </Button>
                    )}
                </div>
            }
        >

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 290px)' }}>
                    <table className="min-w-full divide-y divide-gray-100 table-row-hover border-collapse">
                        <ThemedGridHeader>
                            {showRecentOnly && (
                                <ThemedGridHeaderCell className="w-10" style={{ minWidth: '40px' }}>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedIds.length > 0 && selectedIds.length === sortedAndFilteredProducts.length}
                                            onChange={toggleSelectAll}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            title="Seleccionar todo"
                                        />
                                    </div>
                                </ThemedGridHeaderCell>
                            )}
                            <ThemedGridHeaderCell
                                className="cursor-pointer hover:opacity-80"
                                onClick={() => handleSort('Producto')}
                            >
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1">
                                        {t('productName')}
                                        {sortConfig?.key === 'Producto' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="🔍 Filter..."
                                        className="mt-1 px-2 py-1 text-xs border border-gray-300 rounded font-normal text-gray-700"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell
                                className="cursor-pointer hover:opacity-80"
                                onClick={() => handleSort('Codigo')}
                            >
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1">
                                        {t('code')}
                                        {sortConfig?.key === 'Codigo' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="🔍 Filter..."
                                        className="mt-1 px-2 py-1 text-xs border border-gray-300 rounded font-normal text-gray-700"
                                        value={codeSearch}
                                        onChange={(e) => setCodeSearch(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell
                                className="cursor-pointer hover:opacity-80"
                                onClick={() => handleSort('Categoria')}
                            >
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1">
                                        {t('category')}
                                        {sortConfig?.key === 'Categoria' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="🔍 Category..."
                                        className="mt-1 px-2 py-1 text-xs border border-gray-300 rounded font-normal text-gray-700"
                                        value={categorySearch}
                                        onChange={(e) => setCategorySearch(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell
                                className="text-right cursor-pointer hover:opacity-80"
                                onClick={() => handleSort('Precio')}
                            >
                                <div className="flex items-center justify-end gap-1">
                                    {t('price')}
                                    {sortConfig?.key === 'Precio' && (
                                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                    )}
                                </div>
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell
                                className="cursor-pointer hover:opacity-80"
                                onClick={() => handleSort('FechaAct')}
                            >
                                <div className="flex items-center gap-1">
                                    Fecha Act
                                    {sortConfig?.key === 'FechaAct' && (
                                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                    )}
                                </div>
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell className="text-right">
                                {t('actions')}
                            </ThemedGridHeaderCell>
                        </ThemedGridHeader>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sortedAndFilteredProducts.map((product) => (
                                <tr key={product.IdProducto} className={`hover:bg-gray-50 transition-colors ${selectedIds.includes(product.IdProducto) ? 'bg-indigo-50/30' : ''}`}>
                                    {showRecentOnly && (
                                        <td className="px-6 py-4">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedIds.includes(product.IdProducto)}
                                                onChange={() => toggleSelectProduct(product.IdProducto)}
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                        </td>
                                    )}
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 overflow-hidden border border-gray-200 flex items-center justify-center">
                                                {product.ArchivoImagen ? (
                                                    <img
                                                        src={product.ArchivoImagen}
                                                        alt={product.Producto}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-gray-400 text-xl">📦</span>
                                                )}
                                            </div>
                                            <span>{product.Producto}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {product.Codigo}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span className="flex items-center gap-1">
                                            {product.ImagenCategoria && <span>{product.ImagenCategoria}</span>}
                                            {product.Categoria}
                                            {product.IdModuloRecetario && product.IdModuloRecetario > 0 ? (
                                                <sup className="text-primary-600 font-bold ml-0.5">
                                                    {product.IdModuloRecetario}
                                                </sup>
                                            ) : null}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                        ${(product.Precio || 0).toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {product.FechaAct ? new Date(product.FechaAct).toLocaleString(undefined, {
                                            year: 'numeric', month: '2-digit', day: '2-digit',
                                            hour: '2-digit', minute: '2-digit'
                                        }) : '---'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => openEditModal(product)}
                                            className="text-xl mr-4 hover:scale-110 transition-transform"
                                            title={t('editProduct')}
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => openDeleteModal(product)}
                                            className="text-xl hover:scale-110 transition-transform"
                                            title={t('deleteProduct')}
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Costing Modal for Create/Edit and Kits */}
            {isModalOpen && (
                <CostingModal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedProductForCosting(null);
                        setEditingProduct(null);
                    }}
                    onProductUpdate={handleProductUpdate}
                    productType={0}
                    projectId={project?.idProyecto}
                    product={selectedProductForCosting || {
                        IdProducto: 0,
                        Producto: '',
                        Codigo: '',
                        Precio: 0,
                        IVA: 0,
                        IdTipoProducto: 0,
                        Status: 0
                    }}
                />
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-sm:w-[90%] max-w-sm shadow-xl">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{t('deleteProduct')}</h3>
                        <p className="text-gray-500 mb-6">{t('confirmDelete')}</p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors shadow-sm"
                            >
                                {t('deleteProduct')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Massive Upload Modal (Excel only) */}
            {isMassiveModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                📊 Carga Masiva por Excel
                            </h2>
                            <button
                                onClick={() => setIsMassiveModalOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <MassiveProductUpload
                                hideHeader={true}
                                onlyExcel={true}
                                onSuccess={() => {
                                    fetchProducts();
                                    setShowRecentOnly(true);
                                }}
                            />
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
                            <Button
                                onClick={() => setIsMassiveModalOpen(false)}
                                variant="secondary"
                            >
                                {t('cancel')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Image Capture Modal */}
            {isProductImageCaptureModalOpen && (
                <ProductImageCaptureModal
                    isOpen={isProductImageCaptureModalOpen}
                    onClose={() => setIsProductImageCaptureModalOpen(false)}
                    projectId={project?.idProyecto}
                    onSuccess={() => {
                        fetchProducts();
                        setShowRecentOnly(true);
                    }}
                />
            )}

            {/* Bulk Delete Confirmation Modal */}
            {isBulkDeleteModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl animate-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 text-3xl mb-6 mx-auto">🗑️</div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">Eliminar Seleccionados</h3>
                        <p className="text-gray-500 mb-8 text-center">¿Estás seguro de que deseas eliminar <strong>{selectedIds.length}</strong> productos? Esta acción no se puede deshacer.</p>
                        <div className="flex flex-col gap-3">
                            <Button
                                onClick={handleBulkDelete}
                                isLoading={isDeletingBulk}
                                className="bg-red-600 hover:bg-red-700 w-full py-3"
                            >
                                Eliminar {selectedIds.length} Productos
                            </Button>
                            <Button
                                onClick={() => setIsBulkDeleteModalOpen(false)}
                                variant="secondary"
                                className="w-full py-3"
                            >
                                {t('cancel')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </PageShell>
    );
}
