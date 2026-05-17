'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Monitor, Search, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell, TableBody, TableRow, TableCell, RowActionButton } from '@/components/ThemedGridHeader';
import BaseModal from '@/components/BaseModal';
import PageShell from '@/components/PageShell';

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

    const handleSubmit = async () => {
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
        <PageShell title={t('title')} subtitle={`${terminals.length} terminales registradas`} icon={Monitor} actions={
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
                        setEditingTerminal(null);
                        setFormData({ terminal: '', commission: '' });
                        setIsModalOpen(true);
                    }}
                >
                    {t('addTerminal')}
                </Button>
            </div>
        }>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 290px)' }}>
                    <table className="min-w-full border-collapse">
                        <ThemedGridHeader className="sticky top-0 z-10 shadow-sm">
                            <ThemedGridHeaderCell
                                sortable
                                sortDir={sortConfig?.key === 'Terminal' ? sortConfig.direction : null}
                                onClick={() => handleSort('Terminal')}
                            >
                                {t('terminalName')}
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell
                                sortable
                                sortDir={sortConfig?.key === 'Comision' ? sortConfig.direction : null}
                                onClick={() => handleSort('Comision')}
                            >
                                {t('commission')}
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
                            empty={sortedAndFilteredTerminals.length === 0}
                            emptyMessage={searchTerm ? 'Sin resultados para tu búsqueda' : 'Aún no hay terminales. Agrega la primera.'}
                            colSpan={4}
                        >
                            {sortedAndFilteredTerminals.map((term) => (
                                <TableRow key={term.IdTerminal}>
                                    <TableCell>
                                        <span className="font-medium text-gray-900">{term.Terminal}</span>
                                    </TableCell>
                                    <TableCell muted>{term.Comision}%</TableCell>
                                    <TableCell>
                                        <span className={`badge ${term.Status === 0 ? 'badge-green' : 'badge-red'}`}>
                                            {term.Status === 0 ? t('active') : 'Inactivo'}
                                        </span>
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex items-center justify-end gap-1">
                                            <RowActionButton
                                                icon={Pencil}
                                                label={t('editTerminal')}
                                                variant="edit"
                                                onClick={() => openEditModal(term)}
                                            />
                                            <RowActionButton
                                                icon={Trash2}
                                                label={t('deleteTerminal')}
                                                variant="delete"
                                                onClick={() => openDeleteModal(term)}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </table>

                    {/* Footer con conteo */}
                    {!isLoading && sortedAndFilteredTerminals.length > 0 && (
                        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                            <span className="text-xs text-gray-600 font-medium">
                                {sortedAndFilteredTerminals.length} de {terminals.length} terminales
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit/Create Modal */}
            <BaseModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingTerminal ? t('editTerminal') : t('addTerminal')}
                subtitle={editingTerminal ? `Editando: ${editingTerminal.Terminal}` : 'Completa la información de la terminal'}
                size="lg"
                onConfirm={handleSubmit}
                confirmLabel={t('save')}
                cancelLabel={t('cancel')}
                headerVariant="primary"
            >
                <div className="space-y-4">
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
                </div>
            </BaseModal>

            {/* Delete Confirmation Modal */}
            <BaseModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Eliminar terminal"
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
                        <p className="font-semibold text-gray-800">¿Eliminar {editingTerminal?.Terminal}?</p>
                        <p className="text-sm text-gray-500 mt-1">{t('confirmDelete')}</p>
                    </div>
                </div>
            </BaseModal>
        </PageShell>
    );
}
