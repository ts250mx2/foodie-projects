'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';
import CostingModal from '@/components/CostingModal';
import { generateTechnicalSheetPDF } from '@/utils/generateTechnicalSheetPDF';

interface Product {
    IdProducto: number;
    Producto: string;
    Codigo: string;
    IdCategoria: number;
    IdPresentacion: number;
    Precio: number;
    IVA: number;
    Status: number;
    RutaFoto?: string;
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

interface ProductGridProps {
    productType: number; // 1 = Platillos, 2 = Subrecetas
    pageTitle: string;
}

export default function ProductGrid({ productType, pageTitle }: ProductGridProps) {
    const t = useTranslations('Products');
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // Costing Modal State (Now used for everything)
    const [isCostingModalOpen, setIsCostingModalOpen] = useState(false);
    const [costingProduct, setCostingProduct] = useState<Product | null>(null);
    const [project, setProject] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null); // For deletion

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchProducts();
        }
    }, [project, productType]);

    const fetchProducts = async () => {
        try {
            const response = await fetch(`/api/products?projectId=${project.idProyecto}&tipoProducto=${productType}`);
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

    const handleDelete = async () => {
        if (!selectedProduct || !project) return;

        try {
            const response = await fetch(`/api/products/${selectedProduct.IdProducto}?projectId=${project.idProyecto}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await fetchProducts();
                setIsDeleteModalOpen(false);
                setSelectedProduct(null);
            }
        } catch (error) {
            console.error('Error deleting product:', error);
        }
    };

    const handleOpenAddModal = () => {
        setCostingProduct(null); // Triggers "New Product" mode in CostingModal
        setIsCostingModalOpen(true);
    };

    const handleOpenEditModal = (product: Product) => {
        setCostingProduct(product);
        setIsCostingModalOpen(true);
    };

    const openDeleteModal = (product: Product) => {
        setSelectedProduct(product);
        setIsDeleteModalOpen(true);
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedAndFilteredProducts = products
        .filter(product =>
            searchTerm === '' ||
            product.Producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.Codigo.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (!sortConfig) return 0;
            const aValue = a[sortConfig.key as keyof Product] ?? '';
            const bValue = b[sortConfig.key as keyof Product] ?? '';
            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

    if (isLoading) {
        return (
            <div className="p-6">
                <div className="text-center text-gray-600">Cargando...</div>
            </div>
        );
    }

    const isDishes = productType === 1;

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">{pageTitle}</h1>
                <Button onClick={handleOpenAddModal}>
                    {isDishes ? 'Agregar Platillo' : 'Agregar Subreceta'}
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
                        <ThemedGridHeaderCell>{t('code')}</ThemedGridHeaderCell>
                        <ThemedGridHeaderCell>{t('category')}</ThemedGridHeaderCell>
                        <ThemedGridHeaderCell>{t('presentation')}</ThemedGridHeaderCell>
                        <ThemedGridHeaderCell className="text-right">{t('price')}</ThemedGridHeaderCell>
                        <ThemedGridHeaderCell className="text-right">{t('iva')}</ThemedGridHeaderCell>
                        <ThemedGridHeaderCell>{t('active')}</ThemedGridHeaderCell>
                        <ThemedGridHeaderCell className="text-right">{t('actions')}</ThemedGridHeaderCell>
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
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(product.Precio)}
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
                                        onClick={() => handleOpenEditModal(product)}
                                        className="text-xl mr-3 hover:scale-110 transition-transform"
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

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && selectedProduct && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">{t('confirmDelete')}</h2>
                        <p className="mb-6">¿Está seguro que desea eliminar "{selectedProduct.Producto}"?</p>
                        <div className="flex justify-end gap-2">
                            <Button onClick={() => setIsDeleteModalOpen(false)} className="bg-gray-500">
                                {t('cancel')}
                            </Button>
                            <Button onClick={handleDelete} className="bg-red-600">
                                {t('deleteProduct')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Costing Modal (Used for Create & Edit) */}
            {isCostingModalOpen && project && (
                <CostingModal
                    isOpen={isCostingModalOpen}
                    onClose={() => {
                        setIsCostingModalOpen(false);
                        setCostingProduct(null);
                    }}
                    product={costingProduct as any} // Cast to any to bypass strict checks for new products
                    projectId={project.idProyecto}
                    productType={productType}
                    onProductUpdate={() => fetchProducts()}
                    initialTab="general"
                />
            )}
        </div>
    );
}
