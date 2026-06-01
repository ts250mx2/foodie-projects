'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Settings, Search, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import Button from '@/components/Button';
import ThemedGridHeader, { ThemedGridHeaderCell, RowActionButton } from '@/components/ThemedGridHeader';
import CostingModal from '@/components/CostingModal';
import MenuSectionsModal from '@/components/MenuSectionsModal';
import PageShell from '@/components/PageShell';

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
    Categoria?: string;
    ImagenCategoria?: string;
    IdModuloRecetario?: number;
}

function dishInitials(name?: string | null) {
    if (!name) return '??';
    return name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0] || '')
        .join('')
        .toUpperCase();
}

const AVATAR_COLORS = [
    'bg-violet-100 text-violet-700',
    'bg-blue-100 text-blue-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-cyan-100 text-cyan-700',
];

function avatarColor(id: number) {
    return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

export default function DishesPage() {
    const t = useTranslations('Products');
    const [dishes, setDishes] = useState<Dish[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isCostingModalOpen, setIsCostingModalOpen] = useState(false);
    const [isMenuSectionsModalOpen, setIsMenuSectionsModalOpen] = useState(false);
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
        <PageShell
            title="Platillos Menu"
            subtitle={`${dishes.length} platillos registrados`}
            actions={
                <div className="flex gap-2 items-center flex-wrap">
                    <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg flex-1 min-w-[200px] max-w-xs">
                        <Search size={18} className="text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 outline-none text-sm text-gray-700 placeholder-gray-400 bg-transparent"
                        />
                    </div>
                    <Button
                        variant="secondary"
                        leftIcon={Settings}
                        iconBox
                        size="sm"
                        onClick={() => setIsMenuSectionsModalOpen(true)}
                    >
                        Secciones de Menú
                    </Button>
                    <Button variant="solid" leftIcon={Plus} iconBox size="sm" onClick={handleOpenAddModal}>Agregar Platillo</Button>
                </div>
            }
        >

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 290px)' }}>
                    <table className="min-w-full divide-y divide-gray-100 table-row-hover border-collapse">
                        <ThemedGridHeader>
                            <ThemedGridHeaderCell
                                className="cursor-pointer hover:opacity-80"
                                onClick={() => handleSort('Producto')}
                            >
                                <div className="flex items-center gap-1">
                                    {t('productName')}
                                    {sortConfig?.key === 'Producto' && (
                                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                    )}
                                </div>
                            </ThemedGridHeaderCell>

                            <ThemedGridHeaderCell
                                className="cursor-pointer hover:opacity-80"
                                onClick={() => handleSort('SeccionMenu')}
                            >
                                <div className="flex items-center gap-1">
                                    Sección Menú
                                    {sortConfig?.key === 'SeccionMenu' && (
                                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                    )}
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
                                        <div className="flex items-center gap-3">
                                            <div className={`flex-shrink-0 w-10 h-10 rounded-full overflow-hidden border border-gray-200 flex items-center justify-center font-bold text-xs ${dish.ArchivoImagen ? 'bg-gray-100' : avatarColor(dish.IdProducto)}`}>
                                                {dish.ArchivoImagen ? (
                                                    <img
                                                        src={dish.ArchivoImagen}
                                                        alt={dish.Producto}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <span>{dishInitials(dish.Producto)}</span>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="flex items-center gap-1">
                                                    {dish.Producto}
                                                    {dish.IdModuloRecetario && dish.IdModuloRecetario > 0 ? (
                                                        <sup className="text-primary-600 font-bold ml-0.5">
                                                            {dish.IdModuloRecetario}
                                                        </sup>
                                                    ) : null}
                                                </span>
                                            </div>
                                        </div>
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
                                        {dish.AlertaCosto === 1 && (
                                            <div title="¡Alerta de Costo!" className="flex justify-center cursor-help">
                                                <AlertTriangle size={20} className="text-amber-500" />
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end gap-1">
                                            <RowActionButton
                                                icon={Pencil}
                                                label={t('editProduct')}
                                                variant="edit"
                                                onClick={() => handleOpenEditModal(dish)}
                                            />
                                            <RowActionButton
                                                icon={Trash2}
                                                label={t('deleteProduct')}
                                                variant="delete"
                                                onClick={() => openDeleteModal(dish)}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Footer con conteo */}
                    {!isLoading && sortedAndFilteredDishes.length > 0 && (
                        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                            <span className="text-xs text-gray-600 font-medium">
                                {sortedAndFilteredDishes.length} de {dishes.length} platos
                            </span>
                        </div>
                    )}
                </div>
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

            {isMenuSectionsModalOpen && project && (
                <MenuSectionsModal
                    isOpen={isMenuSectionsModalOpen}
                    onClose={() => setIsMenuSectionsModalOpen(false)}
                    projectId={project.idProyecto}
                />
            )}
        </PageShell>
    );
}
