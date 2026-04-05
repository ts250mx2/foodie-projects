'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from './Button';
import Input from './Input';
import ThemedGridHeader, { ThemedGridHeaderCell } from './ThemedGridHeader';

interface MenuSection {
    IdSeccionMenu: number;
    SeccionMenu: string;
    Status: number;
}

interface MenuSectionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: number;
}

export default function MenuSectionsModal({ isOpen, onClose, projectId }: MenuSectionsModalProps) {
    const t = useTranslations('MenuSections');
    const [sections, setSections] = useState<MenuSection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingSection, setEditingSection] = useState<MenuSection | null>(null);
    const [formData, setFormData] = useState({ seccionMenu: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof MenuSection, direction: 'asc' | 'desc' } | null>(null);

    useEffect(() => {
        if (isOpen && projectId) {
            fetchSections();
        }
    }, [isOpen, projectId]);

    const fetchSections = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/production/menu-sections?projectId=${projectId}`);
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
                ? { id: editingSection.IdSeccionMenu, seccionMenu: formData.seccionMenu, projectId }
                : { projectId, seccionMenu: formData.seccionMenu };

            const response = await fetch('/api/production/menu-sections', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                fetchSections();
                setIsAddEditModalOpen(false);
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
            const response = await fetch('/api/production/menu-sections', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingSection.IdSeccionMenu,
                    status: 2,
                    projectId
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
        setFormData({ seccionMenu: section.SeccionMenu });
        setIsAddEditModalOpen(true);
    };

    const openDeleteModal = (section: MenuSection) => {
        setEditingSection(section);
        setIsDeleteModalOpen(true);
    };

    const handleSort = (key: keyof MenuSection) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const filteredSections = sections.filter(section =>
        section.SeccionMenu.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sortedSections = [...filteredSections].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
        if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-primary-600 text-white flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold">{t('title')}</h2>
                    <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors text-white">
                        ✕
                    </button>
                </div>

                {/* Sub-header with Add Button and Search */}
                <div className="p-6 border-b flex justify-between items-center shrink-0 bg-gray-50">
                    <div className="flex-1 max-w-sm">
                        <input
                            type="text"
                            placeholder={t('searchPlaceholder')}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button onClick={() => {
                        setEditingSection(null);
                        setFormData({ seccionMenu: '' });
                        setIsAddEditModalOpen(true);
                    }}>
                        {t('addSection')}
                    </Button>
                </div>

                {/* Table Container */}
                <div className="flex-1 overflow-auto p-0">
                    <table className="min-w-full divide-y divide-gray-200">
                        <ThemedGridHeader>
                            <ThemedGridHeaderCell
                                className="cursor-pointer hover:opacity-80"
                                onClick={() => handleSort('SeccionMenu')}
                            >
                                <div className="flex items-center gap-2">
                                    {t('sectionName')}
                                    {sortConfig?.key === 'SeccionMenu' && (
                                        <span className="text-xs">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                    )}
                                </div>
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell className="text-right w-32">
                                {t('actions')}
                            </ThemedGridHeaderCell>
                        </ThemedGridHeader>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={2} className="px-6 py-12 text-center text-gray-500 italic">
                                        Cargando secciones...
                                    </td>
                                </tr>
                            ) : sortedSections.length === 0 ? (
                                <tr>
                                    <td colSpan={2} className="px-6 py-12 text-center text-gray-500">
                                        No se encontraron secciones.
                                    </td>
                                </tr>
                            ) : sortedSections.map((section) => (
                                <tr key={section.IdSeccionMenu} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-l-4 border-l-transparent hover:border-l-primary-500">
                                        {section.SeccionMenu}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                                        <button
                                            onClick={() => openEditModal(section)}
                                            className="text-lg hover:scale-125 transition-transform"
                                            title={t('editSection')}
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => openDeleteModal(section)}
                                            className="text-lg hover:scale-125 transition-transform"
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

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg font-bold hover:bg-gray-300 transition-colors uppercase text-sm tracking-wider"
                    >
                        {t('cancel')}
                    </button>
                </div>

                {/* Inner Add/Edit Modal */}
                {isAddEditModalOpen && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="bg-primary-500 px-6 py-4 text-white font-bold text-lg">
                                {editingSection ? t('editSection') : t('addSection')}
                            </div>
                            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                                <Input
                                    label={t('sectionName')}
                                    value={formData.seccionMenu}
                                    onChange={(e) => setFormData({ ...formData, seccionMenu: e.target.value })}
                                    required
                                    autoFocus
                                />
                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddEditModalOpen(false)}
                                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium border border-gray-200"
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

                {/* Inner Delete Confirmation Modal */}
                {isDeleteModalOpen && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="bg-red-600 px-6 py-4 text-white font-bold text-lg">
                                {t('deleteSection')}
                            </div>
                            <div className="p-6">
                                <p className="text-gray-600 mb-8">{t('confirmDelete')}</p>
                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={() => setIsDeleteModalOpen(false)}
                                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                                    >
                                        {t('cancel')}
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors uppercase text-sm"
                                    >
                                        {t('deleteSection')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
