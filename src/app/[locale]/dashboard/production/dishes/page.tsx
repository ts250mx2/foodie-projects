'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/Button';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';
import CostingModal from '@/components/CostingModal';

interface Dish {
    IdProducto: number;
    Producto: string;
    Codigo: string;
    Status: number;
    SeccionMenu?: string;
    IdSeccionMenu?: number;
    Precio: number;
    IVA: number;
    Costo?: number;
    PorcentajeCosto?: number;
    PorcentajeCostoIdeal?: number;
    AlertaCosto?: number;
    ArchivoImagen?: string;
    NombreArchivo?: string;
}

export default function DishesPage() {
    const t = useTranslations('Products');
    const [dishes, setDishes] = useState<Dish[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isCostingModalOpen, setIsCostingModalOpen] = useState(false);
    const [editingDish, setEditingDish] = useState<Dish | null>(null);
    const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
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
            fetchDishes();
        }
    }, [project]);

    const fetchDishes = async () => {
        try {
            const response = await fetch(`/api/products?projectId=${project.idProyecto}&tipoProducto=1`);
            const data = await response.json();
            if (data.success) {
                setDishes(data.data);
            }
        } catch (error) {
            console.error('Error fetching dishes:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedDish || !project) return;

        try {
            const response = await fetch(`/api/products/${selectedDish.IdProducto}?projectId=${project.idProyecto}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await fetchDishes();
                setIsDeleteModalOpen(false);
                setSelectedDish(null);
            }
        } catch (error) {
            console.error('Error deleting dish:', error);
        }
    };

    const handleOpenAddModal = () => {
        setEditingDish(null);
        setIsCostingModalOpen(true);
    };

    const handleOpenEditModal = (dish: Dish) => {
        setEditingDish(dish);
        setIsCostingModalOpen(true);
    };

    const openDeleteModal = (dish: Dish) => {
        setSelectedDish(dish);
        setIsDeleteModalOpen(true);
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const [menuSectionSearch, setMenuSectionSearch] = useState('');

    const sortedAndFilteredDishes = dishes
        .filter(dish => {
            const searchTermLower = searchTerm.toLowerCase();
            const productName = dish.Producto ? String(dish.Producto) : '';
            const productCode = dish.Codigo ? String(dish.Codigo) : '';
            const matchesSearch = productName.toLowerCase().includes(searchTermLower) ||
                productCode.toLowerCase().includes(searchTermLower);

            const menuSectionName = dish.SeccionMenu ? String(dish.SeccionMenu) : '';
            const matchesMenuSection = menuSectionName.toLowerCase().includes(menuSectionSearch.toLowerCase());

            return matchesSearch && matchesMenuSection;
        })
        .sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;

            const aValue = a[key as keyof Dish] ?? '';
            const bValue = b[key as keyof Dish] ?? '';

            if (aValue === bValue) return 0;

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
                <h1 className="text-2xl font-bold text-gray-800">🍽️ Platillos Menu</h1>
                <Button onClick={handleOpenAddModal}>Agregar Platillo</Button>
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
                            onClick={() => handleSort('SeccionMenu')}
                        >
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1">
                                    Sección Menú
                                    {sortConfig?.key === 'SeccionMenu' && (
                                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    placeholder="🔍 Filter..."
                                    className="mt-1 block px-2 py-1 text-xs border border-gray-300 rounded font-normal text-gray-700"
                                    value={menuSectionSearch}
                                    onChange={(e) => setMenuSectionSearch(e.target.value)}
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
                            className="text-right cursor-pointer hover:opacity-80"
                            onClick={() => handleSort('IVA')}
                        >
                            <div className="flex items-center justify-end gap-1">
                                {t('iva')}
                                {sortConfig?.key === 'IVA' && (
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
                        <ThemedGridHeaderCell
                            className="text-right cursor-pointer hover:opacity-80"
                            onClick={() => handleSort('PorcentajeCostoIdeal')}
                        >
                            <div className="flex items-center justify-end gap-1">
                                % Costo Ideal
                                {sortConfig?.key === 'PorcentajeCostoIdeal' && (
                                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                )}
                            </div>
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell
                            className="text-right cursor-pointer hover:opacity-80"
                            onClick={() => handleSort('PorcentajeCosto')}
                        >
                            <div className="flex items-center justify-end gap-1">
                                % Costo Real
                                {sortConfig?.key === 'PorcentajeCosto' && (
                                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                )}
                            </div>
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell
                            className="cursor-pointer hover:opacity-80"
                            onClick={() => handleSort('AlertaCosto')}
                        >
                            <div className="flex items-center gap-1">
                                Alerta
                                {sortConfig?.key === 'AlertaCosto' && (
                                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                )}
                            </div>
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell className="text-right">{t('actions')}</ThemedGridHeaderCell>
                    </ThemedGridHeader>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedAndFilteredDishes.map((dish) => (
                            <tr key={dish.IdProducto} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {dish.Producto}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {dish.Codigo}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {dish.SeccionMenu || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dish.Precio)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                    {dish.IVA}%
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right font-medium text-blue-600">
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dish.Costo || 0)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                    {(dish.PorcentajeCostoIdeal || 0).toFixed(2)}%
                                </td>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${dish.AlertaCosto === 1 ? 'text-red-600' : 'text-green-600'}`}>
                                    {(dish.PorcentajeCosto || 0).toFixed(2)}%
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    {dish.AlertaCosto === 1 && <span title="¡Alerta de Costo!" className="text-xl cursor-help">⚠️</span>}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => handleOpenEditModal(dish)}
                                        className="text-xl mr-3 hover:scale-110 transition-transform"
                                        title={t('editProduct')}
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => openDeleteModal(dish)}
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
            {isDeleteModalOpen && selectedDish && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
                        <h2 className="text-xl font-bold mb-4">{t('confirmDelete')}</h2>
                        <p className="mb-6 text-gray-600">¿Está seguro que desea eliminar "{selectedDish.Producto}"?</p>
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
                        setEditingDish(null);
                    }}
                    product={editingDish as any}
                    projectId={project.idProyecto}
                    productType={1}
                    onProductUpdate={() => fetchDishes()}
                    initialTab="general"
                />
            )}
        </div>
    );
}
