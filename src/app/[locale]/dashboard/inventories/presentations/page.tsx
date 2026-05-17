'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Package, Search, Pencil, Trash2 } from 'lucide-react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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
        <PageShell title={t('title')} icon={Package} actions={
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
                    <table className="min-w-full divide-y divide-gray-100 table-row-hover border-collapse">
                        <ThemedGridHeader>
                            <ThemedGridHeaderCell
                                className="cursor-pointer hover:opacity-80"
                                onClick={() => handleSort('Presentacion')}
                            >
                                <div className="flex items-center gap-1">
                                    {t('presentationName')}
                                    {sortConfig?.key === 'Presentacion' && (
                                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                    )}
                                </div>
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell>
                                {t('active')}
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell className="text-right">
                                {t('actions')}
                            </ThemedGridHeaderCell>
                        </ThemedGridHeader>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sortedAndFilteredPresentations.map((presentation) => (
                                <tr key={presentation.IdPresentacion} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {presentation.Presentacion}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${presentation.Status === 0
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                            }`}>
                                            {presentation.Status === 0 ? t('active') : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => openEditModal(presentation)}
                                                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                                                title={t('editPresentation')}
                                            >
                                                <Pencil size={18} className="text-gray-600 hover:text-gray-900" />
                                            </button>
                                            <button
                                                onClick={() => openDeleteModal(presentation)}
                                                className="p-1.5 hover:bg-red-50 rounded transition-colors"
                                                title={t('deletePresentation')}
                                            >
                                                <Trash2 size={18} className="text-red-600 hover:text-red-900" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit/Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">
                            {editingPresentation ? t('editPresentation') : t('addPresentation')}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                label={t('presentationName')}
                                value={formData.presentation}
                                onChange={(e) => setFormData({ ...formData, presentation: e.target.value })}
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
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{t('deletePresentation')}</h3>
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
                                {t('deletePresentation')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PageShell>
    );
}
