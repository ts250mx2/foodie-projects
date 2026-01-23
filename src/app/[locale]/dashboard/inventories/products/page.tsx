'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';

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
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [kitItems, setKitItems] = useState<KitItem[]>([]);
    const [deletingKitItem, setDeletingKitItem] = useState<KitItem | null>(null);
    const [kitFormData, setKitFormData] = useState({
        idProductoHijo: '',
        cantidad: ''
    });
    const [productSearch, setProductSearch] = useState('');
    const [formData, setFormData] = useState({
        producto: '',
        codigo: '',
        idCategoria: '',
        idPresentacion: '',
        precio: '',
        iva: ''
    });
    const [project, setProject] = useState<any>(null);

    // New state for creating category/presentation
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isCreatingPresentation, setIsCreatingPresentation] = useState(false);
    const [newPresentationName, setNewPresentationName] = useState('');

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
            const response = await fetch(`/api/products?projectId=${project.idProyecto}`);
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
        setSelectedProduct(product);
        fetchKitItems(product.IdProducto);
        setIsKitsModalOpen(true);
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

    const openEditModal = (product: Product) => {
        setEditingProduct(product);
        setFormData({
            producto: product.Producto,
            codigo: product.Codigo,
            idCategoria: product.IdCategoria.toString(),
            idPresentacion: product.IdPresentacion.toString(),
            precio: new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(product.Precio),
            iva: product.IVA.toString()
        });
        setIsModalOpen(true);
    };

    const openDeleteModal = (product: Product) => {
        setEditingProduct(product);
        setIsDeleteModalOpen(true);
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Product, direction: 'asc' | 'desc' } | null>(null);

    const filteredProducts = products.filter(p =>
        p.IdProducto !== selectedProduct?.IdProducto &&
        (p.Producto.toLowerCase().includes(productSearch.toLowerCase()) ||
            p.Codigo.toLowerCase().includes(productSearch.toLowerCase()))
    );

    const sortedAndFilteredProducts = products
        .filter(product =>
            product.Producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.Codigo.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;

            const aValue = a[key];
            const bValue = b[key];

            if (aValue === bValue) return 0;
            if (aValue === undefined || aValue === null) return 1;
            if (bValue === undefined || bValue === null) return -1;

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
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">{t('title')}</h1>
                <Button onClick={() => {
                    setEditingProduct(null);
                    setFormData({
                        producto: '',
                        codigo: '',
                        idCategoria: '',
                        idPresentacion: '',
                        precio: '',
                        iva: ''
                    });
                    setIsCreatingCategory(false);
                    setNewCategoryName('');
                    setIsCreatingPresentation(false);
                    setNewPresentationName('');
                    setIsModalOpen(true);
                }}>
                    {t('addProduct')}
                </Button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <ThemedGridHeader>
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
                        <ThemedGridHeaderCell>
                            {t('code')}
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell>
                            {t('category')}
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell>
                            {t('presentation')}
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell className="text-right">
                            {t('price')}
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell className="text-right">
                            {t('iva')}
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell>
                            {t('active')}
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell className="text-right">
                            {t('actions')}
                        </ThemedGridHeaderCell>
                    </ThemedGridHeader>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedAndFilteredProducts.map((product) => (
                            <tr key={product.IdProducto} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {product.Producto}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {product.Codigo}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {product.Categoria}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {product.Presentacion}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                    ${product.Precio.toFixed(2)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                    {product.IVA}%
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${product.Status === 0
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                        }`}>
                                        {product.Status === 0 ? t('active') : 'Inactive'}
                                    </span>
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

            {/* Edit/Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">
                            {editingProduct ? t('editProduct') : t('addProduct')}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                label={t('productName')}
                                value={formData.producto}
                                onChange={(e) => setFormData({ ...formData, producto: e.target.value })}
                                required
                            />
                            <Input
                                label={t('code')}
                                value={formData.codigo}
                                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                                required
                            />
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('category')}
                                </label>
                                <div className="flex gap-2">
                                    {isCreatingCategory ? (
                                        <div className="flex-1 flex gap-2">
                                            <input
                                                type="text"
                                                value={newCategoryName}
                                                onChange={(e) => setNewCategoryName(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                placeholder={t('newCategory')}
                                                autoFocus
                                            />
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    if (!newCategoryName.trim()) return;
                                                    try {
                                                        const response = await fetch('/api/categories', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({
                                                                projectId: project.idProyecto,
                                                                category: newCategoryName
                                                            })
                                                        });
                                                        const data = await response.json();
                                                        if (data.success) {
                                                            await fetchCategories();
                                                            setFormData({ ...formData, idCategoria: data.id.toString() });
                                                            setIsCreatingCategory(false);
                                                            setNewCategoryName('');
                                                        }
                                                    } catch (error) {
                                                        console.error('Error creating category:', error);
                                                    }
                                                }}
                                                className="px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                                            >
                                                ✓
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIsCreatingCategory(false)}
                                                className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <select
                                                value={formData.idCategoria}
                                                onChange={(e) => setFormData({ ...formData, idCategoria: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                required
                                            >
                                                <option value="">{t('selectCategory')}</option>
                                                {categories.map((category) => (
                                                    <option key={category.IdCategoria} value={category.IdCategoria}>
                                                        {category.Categoria}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => setIsCreatingCategory(true)}
                                                className="px-3 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
                                                title={t('addCategory')}
                                            >
                                                +
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('presentation')}
                                </label>
                                <div className="flex gap-2">
                                    {isCreatingPresentation ? (
                                        <div className="flex-1 flex gap-2">
                                            <input
                                                type="text"
                                                value={newPresentationName}
                                                onChange={(e) => setNewPresentationName(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                placeholder={t('newPresentation')}
                                                autoFocus
                                            />
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    if (!newPresentationName.trim()) return;
                                                    try {
                                                        const response = await fetch('/api/presentations', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({
                                                                projectId: project.idProyecto,
                                                                presentation: newPresentationName
                                                            })
                                                        });
                                                        const data = await response.json();
                                                        if (data.success) {
                                                            await fetchPresentations();
                                                            setFormData({ ...formData, idPresentacion: data.id.toString() });
                                                            setIsCreatingPresentation(false);
                                                            setNewPresentationName('');
                                                        }
                                                    } catch (error) {
                                                        console.error('Error creating presentation:', error);
                                                    }
                                                }}
                                                className="px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                                            >
                                                ✓
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIsCreatingPresentation(false)}
                                                className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <select
                                                value={formData.idPresentacion}
                                                onChange={(e) => setFormData({ ...formData, idPresentacion: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                required
                                            >
                                                <option value="">{t('selectPresentation')}</option>
                                                {presentations.map((presentation) => (
                                                    <option key={presentation.IdPresentacion} value={presentation.IdPresentacion}>
                                                        {presentation.Presentacion}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => setIsCreatingPresentation(true)}
                                                className="px-3 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
                                                title={t('addPresentation')}
                                            >
                                                +
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <Input
                                label={t('price')}
                                type="text"
                                value={formData.precio}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9.]/g, '');
                                    if ((val.match(/\./g) || []).length > 1) return;
                                    setFormData({ ...formData, precio: val });
                                }}
                                onBlur={(e) => {
                                    const val = parseFloat(e.target.value || '0');
                                    if (!isNaN(val)) {
                                        setFormData({ ...formData, precio: new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) });
                                    }
                                }}
                                onFocus={(e) => {
                                    const val = e.target.value.replace(/,/g, '');
                                    if (val === '0.00') {
                                        setFormData({ ...formData, precio: '' });
                                    } else {
                                        setFormData({ ...formData, precio: val });
                                    }
                                }}
                                required
                            />
                            <Input
                                label={t('iva')}
                                type="number"
                                step="0.01"
                                value={formData.iva}
                                onChange={(e) => setFormData({ ...formData, iva: e.target.value })}
                                required
                            />
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                                >
                                    {t('cancel')}
                                </button>
                                <Button type="submit">
                                    {t('save')}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-sm">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{t('deleteProduct')}</h3>
                        <p className="text-gray-500 mb-6">{t('confirmDelete')}</p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                            >
                                {t('deleteProduct')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Kits Modal */}
            {isKitsModalOpen && selectedProduct && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4">
                            {t('manageKits')} - {selectedProduct.Producto}
                        </h2>

                        {/* Add Kit Item Form */}
                        <form onSubmit={handleKitSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
                            <h3 className="text-lg font-semibold mb-3">{t('addKitItem')}</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('productName')}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={t('searchProduct')}
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 mb-2"
                                    />
                                    {productSearch && (
                                        <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md">
                                            {filteredProducts.map((product) => (
                                                <div
                                                    key={product.IdProducto}
                                                    onClick={() => {
                                                        setKitFormData({ ...kitFormData, idProductoHijo: product.IdProducto.toString() });
                                                        setProductSearch(product.Producto);
                                                    }}
                                                    className="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-200"
                                                >
                                                    <div className="font-medium">{product.Producto}</div>
                                                    <div className="text-sm text-gray-500">
                                                        {product.Codigo} | {product.Categoria} | {product.Presentacion}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <Input
                                        label={t('quantity')}
                                        type="number"
                                        step="0.01"
                                        value={kitFormData.cantidad}
                                        onChange={(e) => setKitFormData({ ...kitFormData, cantidad: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end mt-4">
                                <Button type="submit">{t('save')}</Button>
                            </div>
                        </form>

                        {/* Kit Items Grid */}
                        <div className="bg-white rounded-lg shadow overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                                <ThemedGridHeader>
                                    <ThemedGridHeaderCell>{t('productName')}</ThemedGridHeaderCell>
                                    <ThemedGridHeaderCell>{t('code')}</ThemedGridHeaderCell>
                                    <ThemedGridHeaderCell>{t('category')}</ThemedGridHeaderCell>
                                    <ThemedGridHeaderCell>{t('presentation')}</ThemedGridHeaderCell>
                                    <ThemedGridHeaderCell className="text-right">{t('quantity')}</ThemedGridHeaderCell>
                                    <ThemedGridHeaderCell className="text-right">{t('actions')}</ThemedGridHeaderCell>
                                </ThemedGridHeader>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {kitItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                                                {t('noKitItems')}
                                            </td>
                                        </tr>
                                    ) : (
                                        kitItems.map((item) => (
                                            <tr key={`${item.IdProductoPadre}-${item.IdProductoHijo}`} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {item.Producto}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {item.Codigo}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {item.Categoria}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {item.Presentacion}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                                    {item.Cantidad}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <button
                                                        onClick={() => openDeleteKitModal(item)}
                                                        className="text-xl hover:scale-110 transition-transform"
                                                        title={t('deleteProduct')}
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end mt-6">
                            <button
                                onClick={() => {
                                    setIsKitsModalOpen(false);
                                    setSelectedProduct(null);
                                    setKitItems([]);
                                    setKitFormData({ idProductoHijo: '', cantidad: '' });
                                    setProductSearch('');
                                }}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                            >
                                {t('cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Kit Item Confirmation Modal */}
            {isDeleteKitModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-sm">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{t('deleteProduct')}</h3>
                        <p className="text-gray-500 mb-6">{t('confirmDeleteKitItem')}</p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsDeleteKitModalOpen(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={handleDeleteKitItem}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                            >
                                {t('deleteProduct')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
