'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';
import CostingModal from '@/components/CostingModal';

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
    const [selectedProductForCosting, setSelectedProductForCosting] = useState<Product | null>(null);
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

    const openEditModal = (product: Product) => {
        setEditingProduct(product);
        setSelectedProductForCosting(product);
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
                    setSelectedProductForCosting(null);
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

            {/* Costing Modal for Create/Edit and Kits */}
            {isModalOpen && (
                <CostingModal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedProductForCosting(null);
                        setEditingProduct(null);
                    }}
                    onProductUpdate={fetchProducts}
                    productType={0}
                    projectId={project?.idProyecto}
                    product={selectedProductForCosting ? {
                        IdProducto: selectedProductForCosting.IdProducto,
                        Producto: selectedProductForCosting.Producto,
                        Codigo: selectedProductForCosting.Codigo,
                        IdCategoria: selectedProductForCosting.IdCategoria,
                        IdPresentacion: selectedProductForCosting.IdPresentacion,
                        Precio: selectedProductForCosting.Precio,
                        IVA: selectedProductForCosting.IVA,
                        IdTipoProducto: 0, // Specifically for Raw Materials
                        IdCategoriaRecetario: selectedProductForCosting.IdCategoriaRecetario
                    } : {
                        IdProducto: 0,
                        Producto: '',
                        Codigo: '',
                        IdCategoria: undefined,
                        IdPresentacion: undefined,
                        Precio: 0,
                        IVA: 0,
                        IdTipoProducto: 0, // Specifically for Raw Materials
                        IdCategoriaRecetario: undefined
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
        </div>
    );
}
