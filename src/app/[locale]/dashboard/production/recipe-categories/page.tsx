'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Tag, Search, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell, TableBody, TableRow, TableCell, RowActionButton } from '@/components/ThemedGridHeader';
import BaseModal from '@/components/BaseModal';
import PageShell from '@/components/PageShell';

interface RecipeCategory {
    IdCategoriaRecetario: number;
    CategoriaRecetario: string;
    Status: number;
}

export default function RecipeCategoriesPage() {
    const t = useTranslations('Categories'); // Reuse Categories translations
    const [categories, setCategories] = useState<RecipeCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<RecipeCategory | null>(null);
    const [formData, setFormData] = useState({ category: '' });
    const [project, setProject] = useState<any>(null);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchCategories();
        }
    }, [project]);

    const fetchCategories = async () => {
        try {
            const response = await fetch(`/api/production/recipe-categories?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setCategories(data.data);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async () => {
        try {
            const url = editingCategory
                ? '/api/production/recipe-categories' // PUT uses body id
                : '/api/production/recipe-categories';

            const method = editingCategory ? 'PUT' : 'POST';

            const body = editingCategory
                ? { id: editingCategory.IdCategoriaRecetario, category: formData.category, projectId: project.idProyecto }
                : { projectId: project.idProyecto, category: formData.category };

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                fetchCategories();
                setIsModalOpen(false);
                setFormData({ category: '' });
                setEditingCategory(null);
            }
        } catch (error) {
            console.error('Error saving category:', error);
        }
    };

    const handleDelete = async () => {
        if (!editingCategory) return;
        try {
            const response = await fetch(`/api/production/recipe-categories/${editingCategory.IdCategoriaRecetario}?projectId=${project.idProyecto}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchCategories();
                setIsDeleteModalOpen(false);
                setEditingCategory(null);
            }
        } catch (error) {
            console.error('Error deleting category:', error);
        }
    };

    const openEditModal = (category: RecipeCategory) => {
        setEditingCategory(category);
        setFormData({
            category: category.CategoriaRecetario
        });
        setIsModalOpen(true);
    };

    const openDeleteModal = (category: RecipeCategory) => {
        setEditingCategory(category);
        setIsDeleteModalOpen(true);
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof RecipeCategory, direction: 'asc' | 'desc' } | null>(null);

    const sortedAndFilteredCategories = categories
        .filter(category =>
            category.CategoriaRecetario.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;
            if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
            if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    const handleSort = (key: keyof RecipeCategory) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    return (
        <PageShell title="Módulos de Recetario" icon={Tag} actions={
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
                    variant="solid"
                    leftIcon={Plus}
                    iconBox
                    size="sm"
                    onClick={() => {
                        setEditingCategory(null);
                        setFormData({ category: '' });
                        setIsModalOpen(true);
                    }}
                >
                    {t('addRecipeCategory')}
                </Button>
            </div>
        }>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 290px)' }}>
                    <table className="min-w-full border-collapse">
                        <ThemedGridHeader className="sticky top-0 z-10 shadow-sm">
                            <ThemedGridHeaderCell
                                sortable
                                sortDir={sortConfig?.key === 'CategoriaRecetario' ? sortConfig.direction : null}
                                onClick={() => handleSort('CategoriaRecetario')}
                            >
                                {t('moduleName')}
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell>
                                {t('active')}
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell align="right">
                                {t('actions')}
                            </ThemedGridHeaderCell>
                        </ThemedGridHeader>
                        <TableBody
                            loading={false}
                            empty={sortedAndFilteredCategories.length === 0}
                            emptyMessage={searchTerm ? 'Sin resultados para tu búsqueda' : 'Aún no hay módulos. Agrega el primero.'}
                            colSpan={3}
                        >
                            {sortedAndFilteredCategories.map((category) => (
                                <TableRow key={category.IdCategoriaRecetario}>
                                    <TableCell>
                                        <span className="font-medium text-gray-900">{category.CategoriaRecetario}</span>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`badge ${category.Status === 1 ? 'badge-green' : 'badge-red'}`}>
                                            {category.Status === 1 ? t('active') : 'Inactivo'}
                                        </span>
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex items-center justify-end gap-1">
                                            <RowActionButton
                                                icon={Pencil}
                                                label={t('editCategory')}
                                                variant="edit"
                                                onClick={() => openEditModal(category)}
                                            />
                                            <RowActionButton
                                                icon={Trash2}
                                                label={t('deleteCategory')}
                                                variant="delete"
                                                onClick={() => openDeleteModal(category)}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </table>
                </div>
            </div>

            {/* Edit/Create Modal */}
            <BaseModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingCategory ? t('editModule') : t('addModule')}
                subtitle={editingCategory ? `Editando: ${editingCategory.CategoriaRecetario}` : 'Completa la información del módulo'}
                size="lg"
                onConfirm={handleSubmit}
                confirmLabel={t('save')}
                cancelLabel={t('cancel')}
                headerVariant="primary"
            >
                <div className="space-y-4">
                    <Input
                        label={t('moduleName')}
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        required
                    />
                </div>
            </BaseModal>

            {/* Delete Confirmation Modal */}
            <BaseModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Eliminar módulo"
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
                        <p className="font-semibold text-gray-800">¿Eliminar {editingCategory?.CategoriaRecetario}?</p>
                        <p className="text-sm text-gray-500 mt-1">{t('confirmDelete')}</p>
                    </div>
                </div>
            </BaseModal>
        </PageShell>
    );
}
