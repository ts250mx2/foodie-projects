'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';

interface Terminal {
    IdTerminal: number;
    Terminal: string;
    Comision: number;
    Status: number;
}

export default function TerminalsPage() {
    const t = useTranslations('Terminals');
    const [terminals, setTerminals] = useState<Terminal[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingTerminal, setEditingTerminal] = useState<Terminal | null>(null);
    const [formData, setFormData] = useState({ terminal: '', commission: '' });
    const [project, setProject] = useState<any>(null);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchTerminals();
        }
    }, [project]);

    const fetchTerminals = async () => {
        try {
            const response = await fetch(`/api/terminals?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setTerminals(data.data);
            }
        } catch (error) {
            console.error('Error fetching terminals:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingTerminal
                ? `/api/terminals/${editingTerminal.IdTerminal}`
                : '/api/terminals';

            const method = editingTerminal ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    terminal: formData.terminal,
                    commission: parseFloat(formData.commission)
                })
            });

            if (response.ok) {
                fetchTerminals();
                setIsModalOpen(false);
                setFormData({ terminal: '', commission: '' });
                setEditingTerminal(null);
            }
        } catch (error) {
            console.error('Error saving terminal:', error);
        }
    };

    const handleDelete = async () => {
        if (!editingTerminal) return;
        try {
            const response = await fetch(`/api/terminals/${editingTerminal.IdTerminal}?projectId=${project.idProyecto}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchTerminals();
                setIsDeleteModalOpen(false);
                setEditingTerminal(null);
            }
        } catch (error) {
            console.error('Error deleting terminal:', error);
        }
    };

    const openEditModal = (terminal: Terminal) => {
        setEditingTerminal(terminal);
        setFormData({
            terminal: terminal.Terminal,
            commission: terminal.Comision.toString()
        });
        setIsModalOpen(true);
    };

    const openDeleteModal = (terminal: Terminal) => {
        setEditingTerminal(terminal);
        setIsDeleteModalOpen(true);
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Terminal, direction: 'asc' | 'desc' } | null>(null);

    const sortedAndFilteredTerminals = terminals
        .filter(term =>
            term.Terminal.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;
            if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
            if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    const handleSort = (key: keyof Terminal) => {
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
                    setEditingTerminal(null);
                    setFormData({ terminal: '', commission: '' });
                    setIsModalOpen(true);
                }}>
                    {t('addTerminal')}
                </Button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <ThemedGridHeader>
                        <ThemedGridHeaderCell
                            className="cursor-pointer hover:opacity-80"
                            onClick={() => handleSort('Terminal')}
                        >
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1">
                                    {t('terminalName')}
                                    {sortConfig?.key === 'Terminal' && (
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
                            onClick={() => handleSort('Comision')}
                        >
                            <div className="flex items-center gap-1">
                                {t('commission')}
                                {sortConfig?.key === 'Comision' && (
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
                        {sortedAndFilteredTerminals.map((term) => (
                            <tr key={term.IdTerminal} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {term.Terminal}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {term.Comision}%
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${term.Status === 0
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                        }`}>
                                        {term.Status === 0 ? t('active') : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => openEditModal(term)}
                                        className="text-xl mr-4 hover:scale-110 transition-transform"
                                        title={t('editTerminal')}
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => openDeleteModal(term)}
                                        className="text-xl hover:scale-110 transition-transform"
                                        title={t('deleteTerminal')}
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
                            {editingTerminal ? t('editTerminal') : t('addTerminal')}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                label={t('terminalName')}
                                value={formData.terminal}
                                onChange={(e) => setFormData({ ...formData, terminal: e.target.value })}
                                required
                            />
                            <Input
                                label={t('commission')}
                                type="number"
                                step="0.01"
                                value={formData.commission}
                                onChange={(e) => setFormData({ ...formData, commission: e.target.value })}
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
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{t('deleteTerminal')}</h3>
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
                                {t('deleteTerminal')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
