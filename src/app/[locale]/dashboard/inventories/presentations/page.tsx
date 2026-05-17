'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Package, Search, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell, TableBody, TableRow, TableCell, RowActionButton } from '@/components/ThemedGridHeader';
import BaseModal from '@/components/BaseModal';
import PageShell from '@/components/PageShell';

interface Presentation {
    IdPresentacion: number;
    Presentacion: string;
    Status: number;
}

export default function PresentationsPage() {
    const t = useTranslations('Presentations');
    const [presentations, setPresentations] = useState<Presentation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingPresentation, setEditingPresentation] = useState<Presentation | null>(null);
    const [formData, setFormData] = useState({ presentation: '' });
    const [project, setProject] = useState<any>(null);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchPresentations();
        }
    }, [project]);

    const fetchPresentations = async () => {
        try {
            const response = await fetch(`/api/presentations?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setPresentations(data.data);
            }
        } catch (error) {
            console.error('Error fetching presentations:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async () => {
        try {
            const url = editingPresentation
                ? `/api/presentations/${editingPresentation.IdPresentacion}`
                : '/api/presentations';

            const method = editingPresentation ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    presentation: formData.presentation
                })
            });

            if (response.ok) {
                fetchPresentations();
                setIsModalOpen(false);
                setFormData({ presentation: '' });
                setEditingPresentation(null);
            }
        } catch (error) {
            console.error('Error saving presentation:', error);
        }
    };

    const handleDelete = async () => {
        if (!editingPresentation) return;
        try {
            const response = await fetch(`/api/presentations/${editingPresentation.IdPresentacion}?projectId=${project.idProyecto}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchPresentations();
                setIsDeleteModalOpen(false);
                setEditingPresentation(null);
            }
        } catch (error) {
            console.error('Error deleting presentation:', error);
        }
    };

    const openEditModal = (presentation: Presentation) => {
        setEditingPresentation(presentation);
        setFormData({
            presentation: presentation.Presentacion
        });
        setIsModalOpen(true);
    };

    const openDeleteModal = (presentation: Presentation) => {
        setEditingPresentation(presentation);
        setIsDeleteModalOpen(true);
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Presentation, direction: 'asc' | 'desc' } | null>(null);

    const sortedAndFilteredPresentations = presentations
        .filter(presentation =>
            presentation.Presentacion.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;
            if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
            if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    const handleSort = (key: keyof Presentation) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    return (
        <PageShell title={t('title')} subtitle={`${presentations.length} presentaciones registradas`} icon={Package} actions={
            <div className="flex gap-2 items-center flex-wrap">
                <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg flex-1 min-w-[200px] max-w-xs">
                    <Search size={18} className="text-gray-400" />
                    <input
                        type="text"
                        placeholder={t('search') || 'Search...'}
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
                        setEditingPresentation(null);
                        setFormData({ presentation: '' });
                        setIsModalOpen(true);
                    }}
                >
                    {t('addPresentation')}
                </Button>
            </div>
        }>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 290px)' }}>
                    <table className="min-w-full border-collapse">
                        <ThemedGridHeader className="sticky top-0 z-10 shadow-sm">
                            <ThemedGridHeaderCell
                                sortable
                                sortDir={sortConfig?.key === 'Presentacion' ? sortConfig.direction : null}
                                onClick={() => handleSort('Presentacion')}
                            >
                                {t('presentationName')}
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
                            empty={sortedAndFilteredPresentations.length === 0}
                            emptyMessage={searchTerm ? 'Sin resultados para tu búsqueda' : 'Aún no hay presentaciones. Agrega la primera.'}
                            colSpan={3}
                        >
                            {sortedAndFilteredPresentations.map((presentation) => (
                                <TableRow key={presentation.IdPresentacion}>
                                    <TableCell>
                                        <span className="font-medium text-gray-900">{presentation.Presentacion}</span>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`badge ${presentation.Status === 0 ? 'badge-green' : 'badge-red'}`}>
                                            {presentation.Status === 0 ? t('active') : 'Inactivo'}
                                        </span>
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex items-center justify-end gap-1">
                                            <RowActionButton
                                                icon={Pencil}
                                                label={t('editPresentation')}
                                                variant="edit"
                                                onClick={() => openEditModal(presentation)}
                                            />
                                            <RowActionButton
                                                icon={Trash2}
                                                label={t('deletePresentation')}
                                                variant="delete"
                                                onClick={() => openDeleteModal(presentation)}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </table>

                    {/* Footer con conteo */}
                    {!isLoading && sortedAndFilteredPresentations.length > 0 && (
                        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                            <span className="text-xs text-gray-600 font-medium">
                                {sortedAndFilteredPresentations.length} de {presentations.length} presentaciones
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit/Create Modal */}
            <BaseModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingPresentation ? t('editPresentation') : t('addPresentation')}
                subtitle={editingPresentation ? `Editando: ${editingPresentation.Presentacion}` : 'Completa la información de la presentación'}
                size="lg"
                onConfirm={handleSubmit}
                confirmLabel={t('save')}
                cancelLabel={t('cancel')}
                headerVariant="primary"
            >
                <div className="space-y-4">
                    <Input
                        label={t('presentationName')}
                        value={formData.presentation}
                        onChange={(e) => setFormData({ ...formData, presentation: e.target.value })}
                        required
                    />
                </div>
            </BaseModal>

            {/* Delete Confirmation Modal */}
            <BaseModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Eliminar presentación"
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
                        <p className="font-semibold text-gray-800">¿Eliminar {editingPresentation?.Presentacion}?</p>
                        <p className="text-sm text-gray-500 mt-1">{t('confirmDelete')}</p>
                    </div>
                </div>
            </BaseModal>
        </PageShell>
    );
}
