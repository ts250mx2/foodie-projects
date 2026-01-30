'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/Button';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';
import CostingModal from '@/components/CostingModal';

interface SubRecipe {
    IdProducto: number;
    Producto: string;
    Codigo: string;
    Categoria?: string;
    Presentacion?: string;
    Costo: number;
    Status: number;
    ArchivoImagen?: string;
    NombreArchivo?: string;
}

export default function SubRecipesPage() {
    const t = useTranslations('Products');
    const [subRecipes, setSubRecipes] = useState<SubRecipe[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isCostingModalOpen, setIsCostingModalOpen] = useState(false);
    const [editingSubRecipe, setEditingSubRecipe] = useState<SubRecipe | null>(null);
    const [selectedSubRecipe, setSelectedSubRecipe] = useState<SubRecipe | null>(null);
    const [project, setProject] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchSubRecipes();
        }
    }, [project]);

    const fetchSubRecipes = async () => {
        try {
            const response = await fetch(`/api/products?projectId=${project.idProyecto}&tipoProducto=2`);
            const data = await response.json();
            if (data.success) {
                setSubRecipes(data.data);
            }
        } catch (error) {
            console.error('Error fetching sub-recipes:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedSubRecipe || !project) return;

        try {
            const response = await fetch(`/api/products/${selectedSubRecipe.IdProducto}?projectId=${project.idProyecto}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await fetchSubRecipes();
                setIsDeleteModalOpen(false);
                setSelectedSubRecipe(null);
            }
        } catch (error) {
            console.error('Error deleting sub-recipe:', error);
        }
    };

    const handleOpenAddModal = () => {
        setEditingSubRecipe(null);
        setIsCostingModalOpen(true);
    };

    const handleOpenEditModal = (subRecipe: SubRecipe) => {
        setEditingSubRecipe(subRecipe);
        setIsCostingModalOpen(true);
    };

    const openDeleteModal = (subRecipe: SubRecipe) => {
        setSelectedSubRecipe(subRecipe);
        setIsDeleteModalOpen(true);
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const [categorySearch, setCategorySearch] = useState('');

    const sortedAndFilteredSubRecipes = subRecipes
        .filter(subRecipe => {
            const searchTermLower = searchTerm.toLowerCase();
            const productName = subRecipe.Producto ? String(subRecipe.Producto) : '';
            const productCode = subRecipe.Codigo ? String(subRecipe.Codigo) : '';
            const matchesSearch = productName.toLowerCase().includes(searchTermLower) ||
                productCode.toLowerCase().includes(searchTermLower);

            const categoryName = subRecipe.Categoria ? String(subRecipe.Categoria) : '';
            const matchesCategory = categoryName.toLowerCase().includes(categorySearch.toLowerCase());

            return matchesSearch && matchesCategory;
        })
        .sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;

            const aValue = key === 'Categoria' ? (a.Categoria ?? '') :
                key === 'Presentacion' ? (a.Presentacion ?? '') :
                    (a[key as keyof SubRecipe] ?? '');

            const bValue = key === 'Categoria' ? (b.Categoria ?? '') :
                key === 'Presentacion' ? (b.Presentacion ?? '') :
                    (b[key as keyof SubRecipe] ?? '');

            if (aValue < bValue) return direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    if (isLoading) {
        return (
            <div className="p-6 text-center text-gray-600">Cargando...</div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">📝 Subrecetas</h1>
                <Button onClick={handleOpenAddModal}>Agregar Subreceta</Button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
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
                        <ThemedGridHeaderCell
                            className="cursor-pointer hover:opacity-80"
                            onClick={() => handleSort('Codigo')}
                        >
                            <div className="flex items-center gap-1">
                                {t('code')}
                                {sortConfig?.key === 'Codigo' && (
                                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                )}
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
                                    placeholder="🔍 Filter..."
                                    className="mt-1 block px-2 py-1 text-xs border border-gray-300 rounded font-normal text-gray-700"
                                    value={categorySearch}
                                    onChange={(e) => setCategorySearch(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell
                            className="cursor-pointer hover:opacity-80"
                            onClick={() => handleSort('Presentacion')}
                        >
                            <div className="flex items-center gap-1">
                                {t('presentation')}
                                {sortConfig?.key === 'Presentacion' && (
                                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                )}
                            </div>
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell
                            className="text-right cursor-pointer hover:opacity-80"
                            onClick={() => handleSort('Costo')}
                        >
                            <div className="flex items-center justify-end gap-1">
                                Costo
                                {sortConfig?.key === 'Costo' && (
                                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                )}
                            </div>
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell className="text-right">{t('actions')}</ThemedGridHeaderCell>
                    </ThemedGridHeader>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedAndFilteredSubRecipes.map((subRecipe) => (
                            <tr key={subRecipe.IdProducto} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {subRecipe.Producto}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {subRecipe.Codigo}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {subRecipe.Categoria || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {subRecipe.Presentacion || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right font-medium text-blue-600">
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(subRecipe.Costo || 0)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => handleOpenEditModal(subRecipe)}
                                        className="text-xl mr-3 hover:scale-110 transition-transform"
                                        title={t('editProduct')}
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => openDeleteModal(subRecipe)}
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
            {isDeleteModalOpen && selectedSubRecipe && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
                        <h2 className="text-xl font-bold mb-4">{t('confirmDelete')}</h2>
                        <p className="mb-6 text-gray-600">¿Está seguro que desea eliminar "{selectedSubRecipe.Producto}"?</p>
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

            {/* Costing Modal */}
            {isCostingModalOpen && project && (
                <CostingModal
                    isOpen={isCostingModalOpen}
                    onClose={() => {
                        setIsCostingModalOpen(false);
                        setEditingSubRecipe(null);
                    }}
                    product={editingSubRecipe as any}
                    projectId={project.idProyecto}
                    productType={2}
                    onProductUpdate={() => fetchSubRecipes()}
                    initialTab="general"
                />
            )}
        </div>
    );
}
