'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';

interface Tax {
    IdImpuesto: number;
    Descripcion: string;
    Impuesto: number;
    Status: number;
}

export default function TaxesPage() {
    const t = useTranslations('Taxes');
    const [taxes, setTaxes] = useState<Tax[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingTax, setEditingTax] = useState<Tax | null>(null);
    const [formData, setFormData] = useState({ description: '', percentage: '' });
    const [project, setProject] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Tax, direction: 'asc' | 'desc' } | null>(null);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchTaxes();
        }
    }, [project]);

    const fetchTaxes = async () => {
        try {
            const response = await fetch(`/api/taxes?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setTaxes(data.data);
            }
        } catch (error) {
            console.error('Error fetching taxes:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = '/api/taxes';
            const method = editingTax ? 'PUT' : 'POST';

            const payload: any = {
                projectId: project.idProyecto,
                description: formData.description,
                percentage: parseFloat(formData.percentage)
            };

            if (editingTax) {
                payload.id = editingTax.IdImpuesto;
            }

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                fetchTaxes();
                setIsModalOpen(false);
                setFormData({ description: '', percentage: '' });
                setEditingTax(null);
            }
        } catch (error) {
            console.error('Error saving tax:', error);
        }
    };

    const handleDelete = async () => {
        if (!editingTax) return;
        try {
            const response = await fetch(`/api/taxes?projectId=${project.idProyecto}&id=${editingTax.IdImpuesto}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchTaxes();
                setIsDeleteModalOpen(false);
                setEditingTax(null);
            }
        } catch (error) {
            console.error('Error deleting tax:', error);
        }
    };

    const openEditModal = (tax: Tax) => {
        setEditingTax(tax);
        setFormData({
            description: tax.Descripcion,
            percentage: tax.Impuesto.toString()
        });
        setIsModalOpen(true);
    };

    const openDeleteModal = (tax: Tax) => {
        setEditingTax(tax);
        setIsDeleteModalOpen(true);
    };

    const handleSort = (key: keyof Tax) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedAndFilteredTaxes = taxes
        .filter(tax =>
            tax.Descripcion.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;
            if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
            if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">{t('title')}</h1>
                <Button onClick={() => {
                    setEditingTax(null);
                    setFormData({ description: '', percentage: '' });
                    setIsModalOpen(true);
                }}>
                    {t('addTax')}
                </Button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <ThemedGridHeader>
                        <ThemedGridHeaderCell
                            className="cursor-pointer hover:opacity-80"
                            onClick={() => handleSort('Descripcion')}
                        >
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1">
                                    {t('description')}
                                    {sortConfig?.key === 'Descripcion' && (
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
                            onClick={() => handleSort('Impuesto')}
                        >
                            <div className="flex items-center gap-1">
                                {t('percentage')}
                                {sortConfig?.key === 'Impuesto' && (
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
                        {sortedAndFilteredTaxes.map((tax) => (
                            <tr key={tax.IdImpuesto} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {tax.Descripcion}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {tax.Impuesto}%
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tax.Status === 0
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                        }`}>
                                        {tax.Status === 0 ? t('active') : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => openEditModal(tax)}
                                        className="text-xl mr-4 hover:scale-110 transition-transform"
                                        title={t('editTax')}
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => openDeleteModal(tax)}
                                        className="text-xl hover:scale-110 transition-transform"
                                        title={t('deleteTax')}
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
                            {editingTax ? t('editTax') : t('addTax')}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                label={t('description')}
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                required
                            />
                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-gray-700">
                                    {t('percentage')}
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    value={formData.percentage}
                                    onChange={(e) => setFormData({ ...formData, percentage: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    required
                                />
                            </div>
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
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{t('deleteTax')}</h3>
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
                                {t('deleteTax')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
