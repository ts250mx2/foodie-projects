'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell, TableBody, TableRow, TableCell, RowActionButton } from '@/components/ThemedGridHeader';
import BaseModal from '@/components/BaseModal';
import PageShell from '@/components/PageShell';
import { Receipt, Search, Pencil, Trash2, AlertTriangle } from 'lucide-react';

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

    const handleSubmit = async () => {
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
        <PageShell
            title={t('title')}
            subtitle={`${taxes.length} impuestos registrados`}
            icon={Receipt}
            actions={
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative w-full sm:w-64">
                        <Search
                            size={14}
                            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                            style={{ color: '#9ca3af' }}
                        />
                        <input
                            type="text"
                            placeholder="Buscar impuesto…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border bg-white focus:outline-none transition-all placeholder:text-gray-400 text-gray-700"
                            style={{
                                borderColor: '#e5e7eb',
                            }}
                        />
                    </div>
                    <Button onClick={() => {
                        setEditingTax(null);
                        setFormData({ description: '', percentage: '' });
                        setIsModalOpen(true);
                    }} variant="solid" leftIcon={Search} iconBox size="sm">
                        {t('addTax')}
                    </Button>
                </div>
            }
        >

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 290px)' }}>
                    <table className="min-w-full border-collapse">
                        <ThemedGridHeader className="sticky top-0 z-10 shadow-sm">
                            <ThemedGridHeaderCell
                                sortable
                                sortDir={sortConfig?.key === 'Descripcion' ? sortConfig.direction : null}
                                onClick={() => handleSort('Descripcion')}
                            >
                                {t('description')}
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell
                                sortable
                                sortDir={sortConfig?.key === 'Impuesto' ? sortConfig.direction : null}
                                onClick={() => handleSort('Impuesto')}
                            >
                                {t('percentage')}
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
                            empty={sortedAndFilteredTaxes.length === 0}
                            emptyMessage={searchTerm ? 'Sin resultados para tu búsqueda' : 'Aún no hay impuestos. Agrega el primero.'}
                            colSpan={4}
                        >
                            {sortedAndFilteredTaxes.map((tax) => (
                                <TableRow key={tax.IdImpuesto}>
                                    <TableCell>
                                        <span className="font-medium text-gray-900">{tax.Descripcion}</span>
                                    </TableCell>
                                    <TableCell muted>{tax.Impuesto}%</TableCell>
                                    <TableCell>
                                        <span className={`badge ${tax.Status === 0 ? 'badge-green' : 'badge-red'}`}>
                                            {tax.Status === 0 ? t('active') : 'Inactivo'}
                                        </span>
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex items-center justify-end gap-1">
                                            <RowActionButton
                                                icon={Pencil}
                                                label={t('editTax')}
                                                variant="edit"
                                                onClick={() => openEditModal(tax)}
                                            />
                                            <RowActionButton
                                                icon={Trash2}
                                                label={t('deleteTax')}
                                                variant="delete"
                                                onClick={() => openDeleteModal(tax)}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </table>
                </div>

                {/* Footer con conteo */}
                {!isLoading && sortedAndFilteredTaxes.length > 0 && (
                    <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <span className="text-xs text-gray-600 font-medium">
                            {sortedAndFilteredTaxes.length} de {taxes.length} impuestos
                        </span>
                    </div>
                )}
            </div>

            {/* Edit/Create Modal */}
            <BaseModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingTax ? t('editTax') : t('addTax')}
                subtitle={editingTax ? `Editando: ${editingTax.Descripcion}` : 'Completa la información del impuesto'}
                size="lg"
                onConfirm={handleSubmit}
                confirmLabel={t('save')}
                cancelLabel={t('cancel')}
                headerVariant="primary"
            >
                <div className="space-y-4">
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
                </div>
            </BaseModal>

            {/* Delete Confirmation Modal */}
            <BaseModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Eliminar impuesto"
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
                        <p className="font-semibold text-gray-800">¿Eliminar {editingTax?.Descripcion}?</p>
                        <p className="text-sm text-gray-500 mt-1">{t('confirmDelete')}</p>
                    </div>
                </div>
            </BaseModal>
        </PageShell>
    );
}
