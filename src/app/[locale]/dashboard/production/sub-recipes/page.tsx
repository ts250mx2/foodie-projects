'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, BookOpen, Search, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import Button from '@/components/Button';
import ThemedGridHeader, { ThemedGridHeaderCell, TableBody, TableRow, TableCell, RowActionButton } from '@/components/ThemedGridHeader';
import BaseModal from '@/components/BaseModal';
import CostingModal from '@/components/CostingModal';
import PageShell from '@/components/PageShell';

interface SubRecipe {
    IdProducto: number;
    Producto: string;
    Codigo: string;
    Categoria?: string;
    ImagenCategoria?: string;
    IdModuloRecetario?: number;
    Presentacion?: string;
    Costo: number;
    Status: number;
    ArchivoImagen?: string;
    NombreArchivo?: string;
}

function subRecipeInitials(name?: string | null) {
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
            return productName.toLowerCase().includes(searchTermLower) ||
                productCode.toLowerCase().includes(searchTermLower);
        })
        .sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;

            const aValue = key === 'Presentacion' ? (a.Presentacion ?? '') :
                    (a[key as keyof SubRecipe] ?? '');

            const bValue = key === 'Presentacion' ? (b.Presentacion ?? '') :
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
        <PageShell title="Subrecetas" subtitle={`${subRecipes.length} subrecetas registradas`} icon={BookOpen} actions={
            <div className="flex gap-2 items-center flex-wrap">
                <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg flex-1 min-w-[200px] max-w-xs">
                    <Search size={18} className="text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 outline-none text-sm text-gray-700 placeholder-gray-400 bg-transparent"
                    />
                </div>
                <Button
                    variant="solid"
                    leftIcon={Plus}
                    iconBox
                    size="sm"
                    onClick={handleOpenAddModal}
                >
                    Agregar Subreceta
                </Button>
            </div>
        }>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 290px)' }}>
                    <table className="min-w-full border-collapse">
                        <ThemedGridHeader className="sticky top-0 z-10 shadow-sm">
                            <ThemedGridHeaderCell
                                sortable
                                sortDir={sortConfig?.key === 'Producto' ? sortConfig.direction : null}
                                onClick={() => handleSort('Producto')}
                            >
                                {t('productName')}
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell
                                sortable
                                sortDir={sortConfig?.key === 'Codigo' ? sortConfig.direction : null}
                                onClick={() => handleSort('Codigo')}
                            >
                                {t('code')}
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell
                                sortable
                                sortDir={sortConfig?.key === 'Presentacion' ? sortConfig.direction : null}
                                onClick={() => handleSort('Presentacion')}
                            >
                                {t('presentation')}
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell
                                sortable
                                sortDir={sortConfig?.key === 'Costo' ? sortConfig.direction : null}
                                onClick={() => handleSort('Costo')}
                                align="right"
                            >
                                Costo
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell align="right">
                                {t('actions')}
                            </ThemedGridHeaderCell>
                        </ThemedGridHeader>
                        <TableBody
                            loading={false}
                            empty={sortedAndFilteredSubRecipes.length === 0}
                            emptyMessage={searchTerm ? 'Sin resultados para tu búsqueda' : 'Aún no hay subrecetas. Agrega la primera.'}
                            colSpan={5}
                        >
                            {sortedAndFilteredSubRecipes.map((subRecipe) => (
                                <TableRow key={subRecipe.IdProducto}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className={`flex-shrink-0 w-10 h-10 rounded-full overflow-hidden border border-gray-200 flex items-center justify-center text-xs font-bold ${subRecipe.ArchivoImagen ? 'bg-gray-100' : avatarColor(subRecipe.IdProducto)}`}>
                                                {subRecipe.ArchivoImagen ? (
                                                    <img
                                                        src={subRecipe.ArchivoImagen}
                                                        alt={subRecipe.Producto}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    subRecipeInitials(subRecipe.Producto)
                                                )}
                                            </div>
                                            <span className="font-medium text-gray-900">{subRecipe.Producto}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell muted>{subRecipe.Codigo}</TableCell>
                                    <TableCell muted>{subRecipe.Presentacion || '-'}</TableCell>
                                    <TableCell align="right" muted>
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(subRecipe.Costo || 0)}
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex items-center justify-end gap-1">
                                            <RowActionButton
                                                icon={Pencil}
                                                label={t('editProduct')}
                                                variant="edit"
                                                onClick={() => handleOpenEditModal(subRecipe)}
                                            />
                                            <RowActionButton
                                                icon={Trash2}
                                                label={t('deleteProduct')}
                                                variant="delete"
                                                onClick={() => openDeleteModal(subRecipe)}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </table>
                </div>

                {/* Footer con conteo */}
                {!isLoading && sortedAndFilteredSubRecipes.length > 0 && (
                    <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <span className="text-xs text-gray-600 font-medium">
                            {sortedAndFilteredSubRecipes.length} de {subRecipes.length} subrecetas
                        </span>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            <BaseModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Eliminar subreceta"
                size="sm"
                onConfirm={handleDelete}
                confirmLabel="Sí, eliminar"
                cancelLabel={t('cancel')}
            >
                <div className="flex flex-col items-center gap-4 py-2 text-center">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                        <AlertTriangle size={24} className="text-red-500" />
                    </div>
                    <div>
                        <p className="font-semibold text-gray-800">¿Eliminar {selectedSubRecipe?.Producto}?</p>
                        <p className="text-sm text-gray-500 mt-1">{t('confirmDelete')}</p>
                    </div>
                </div>
            </BaseModal>

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
        </PageShell>
    );
}
