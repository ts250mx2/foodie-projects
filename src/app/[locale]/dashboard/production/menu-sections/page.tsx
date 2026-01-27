'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';

interface MenuSection {
    IdSeccionMenu: number;
    SeccionMenu: string;
    Status: number;
}

export default function MenuSectionsPage() {
    const t = useTranslations('MenuSections');
    const [sections, setSections] = useState<MenuSection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingSection, setEditingSection] = useState<MenuSection | null>(null);
    const [formData, setFormData] = useState({ seccionMenu: '' });
    const [project, setProject] = useState<any>(null);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchSections();
        }
    }, [project]);

    const fetchSections = async () => {
        try {
            const response = await fetch(`/api/production/menu-sections?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setSections(data.data);
            }
        } catch (error) {
            console.error('Error fetching menu sections:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const method = editingSection ? 'PUT' : 'POST';
            const body = editingSection
                ? { id: editingSection.IdSeccionMenu, seccionMenu: formData.seccionMenu, projectId: project.idProyecto }
                : { projectId: project.idProyecto, seccionMenu: formData.seccionMenu };

            const response = await fetch('/api/production/menu-sections', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                fetchSections();
                setIsModalOpen(false);
                setFormData({ seccionMenu: '' });
                setEditingSection(null);
            }
        } catch (error) {
            console.error('Error saving menu section:', error);
        }
    };

    const handleDelete = async () => {
        if (!editingSection) return;
        try {
            // Using PUT with Status=2 for soft delete as per user instructions
            const response = await fetch('/api/production/menu-sections', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingSection.IdSeccionMenu,
                    status: 2,
                    projectId: project.idProyecto
                })
            });

            if (response.ok) {
                fetchSections();
                setIsDeleteModalOpen(false);
                setEditingSection(null);
            }
        } catch (error) {
            console.error('Error deleting menu section:', error);
        }
    };

    const openEditModal = (section: MenuSection) => {
        setEditingSection(section);
        setFormData({
            seccionMenu: section.SeccionMenu
        });
        setIsModalOpen(true);
    };

    const openDeleteModal = (section: MenuSection) => {
        setEditingSection(section);
        setIsDeleteModalOpen(true);
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof MenuSection, direction: 'asc' | 'desc' } | null>(null);

    const sortedAndFilteredSections = sections
        .filter(section =>
            section.SeccionMenu.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;
            if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
            if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    const handleSort = (key: keyof MenuSection) => {
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
                    setEditingSection(null);
                    setFormData({ seccionMenu: '' });
                    setIsModalOpen(true);
                }}>
                    {t('addSection')}
                </Button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <ThemedGridHeader>
                        <ThemedGridHeaderCell
                            className="cursor-pointer hover:opacity-80"
                            onClick={() => handleSort('SeccionMenu')}
                        >
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1">
                                    {t('sectionName')}
                                    {sortConfig?.key === 'SeccionMenu' && (
                                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    placeholder={t('searchPlaceholder')}
                                    className="mt-1 px-2 py-1 text-xs border border-gray-300 rounded font-normal text-gray-700 w-full"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell className="text-right">
                            {t('actions')}
                        </ThemedGridHeaderCell>
                    </ThemedGridHeader>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {isLoading ? (
                            <tr>
                                <td colSpan={2} className="px-6 py-4 text-center text-sm text-gray-500">
                                    Loading...
                                </td>
                            </tr>
                        ) : sortedAndFilteredSections.length === 0 ? (
                            <tr>
                                <td colSpan={2} className="px-6 py-4 text-center text-sm text-gray-500">
                                    No data found
                                </td>
                            </tr>
                        ) : sortedAndFilteredSections.map((section) => (
                            <tr key={section.IdSeccionMenu} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {section.SeccionMenu}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => openEditModal(section)}
                                        className="text-xl mr-4 hover:scale-110 transition-transform"
                                        title={t('editSection')}
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => openDeleteModal(section)}
                                        className="text-xl hover:scale-110 transition-transform"
                                        title={t('deleteSection')}
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
                            {editingSection ? t('editSection') : t('addSection')}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                label={t('sectionName')}
                                value={formData.seccionMenu}
                                onChange={(e) => setFormData({ ...formData, seccionMenu: e.target.value })}
                                required
                            />
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                                    title="Cancel"
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
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{t('deleteSection')}</h3>
                        <p className="text-gray-500 mb-6">{t('confirmDelete')}</p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                                title="Cancel"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                                title={t('deleteSection')}
                            >
                                {t('deleteSection')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
