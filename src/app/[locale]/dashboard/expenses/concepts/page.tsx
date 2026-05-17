'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Settings, Pencil, Trash2, Search, AlertTriangle } from 'lucide-react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell, TableBody, TableRow, TableCell, RowActionButton } from '@/components/ThemedGridHeader';
import BaseModal from '@/components/BaseModal';
import PaymentChannelsModal from '@/components/PaymentChannelsModal';
import PageShell from '@/components/PageShell';

interface ExpenseConcept {
    IdConceptoGasto: number;
    ConceptoGasto: string;
    ReferenciaObligatoria: number;
    IdCanalPago: number | null;
    CanalPago: string | null;
    Status: number;
}

interface PaymentChannel {
    IdCanalPago: number;
    CanalPago: string;
}

export default function ExpenseConceptsPage() {
    const t = useTranslations('ExpenseConcepts');
    const [concepts, setConcepts] = useState<ExpenseConcept[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingConcept, setEditingConcept] = useState<ExpenseConcept | null>(null);
    const [formData, setFormData] = useState({ concept: '', requiredReference: false, paymentChannelId: '' });
    const [isPaymentChannelsModalOpen, setIsPaymentChannelsModalOpen] = useState(false);
    const [paymentChannels, setPaymentChannels] = useState<PaymentChannel[]>([]);
    const [paymentChannelSearch, setPaymentChannelSearch] = useState('');
    const [showPaymentChannelDropdown, setShowPaymentChannelDropdown] = useState(false);
    const [selectedPaymentChannel, setSelectedPaymentChannel] = useState<PaymentChannel | null>(null);
    const [project, setProject] = useState<any>(null);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchConcepts();
            fetchPaymentChannels();
        }
    }, [project]);

    const fetchConcepts = async () => {
        try {
            const response = await fetch(`/api/expense-concepts?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setConcepts(data.data);
            }
        } catch (error) {
            console.error('Error fetching expense concepts:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPaymentChannels = async () => {
        try {
            const response = await fetch(`/api/payment-channels?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setPaymentChannels(data.data);
            }
        } catch (error) {
            console.error('Error fetching payment channels:', error);
        }
    };

    const handleSubmit = async () => {
        try {
            const url = editingConcept
                ? `/api/expense-concepts/${editingConcept.IdConceptoGasto}`
                : '/api/expense-concepts';

            const method = editingConcept ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    concept: formData.concept,
                    requiredReference: 0,
                    paymentChannelId: formData.paymentChannelId || null
                })
            });

            if (response.ok) {
                fetchConcepts();
                setIsModalOpen(false);
                setFormData({ concept: '', requiredReference: false, paymentChannelId: '' });
                setPaymentChannelSearch('');
                setSelectedPaymentChannel(null);
                setEditingConcept(null);
            }
        } catch (error) {
            console.error('Error saving expense concept:', error);
        }
    };

    const handleDelete = async () => {
        if (!editingConcept) return;
        try {
            const response = await fetch(`/api/expense-concepts/${editingConcept.IdConceptoGasto}?projectId=${project.idProyecto}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchConcepts();
                setIsDeleteModalOpen(false);
                setEditingConcept(null);
            }
        } catch (error) {
            console.error('Error deleting expense concept:', error);
        }
    };

    const openEditModal = (concept: ExpenseConcept) => {
        setEditingConcept(concept);
        setFormData({
            concept: concept.ConceptoGasto,
            requiredReference: concept.ReferenciaObligatoria === 1,
            paymentChannelId: concept.IdCanalPago?.toString() || ''
        });
        if (concept.IdCanalPago && concept.CanalPago) {
            setSelectedPaymentChannel({
                IdCanalPago: concept.IdCanalPago,
                CanalPago: concept.CanalPago
            });
            setPaymentChannelSearch(concept.CanalPago);
        } else {
            setSelectedPaymentChannel(null);
            setPaymentChannelSearch('');
        }
        setIsModalOpen(true);
    };

    const openDeleteModal = (concept: ExpenseConcept) => {
        setEditingConcept(concept);
        setIsDeleteModalOpen(true);
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof ExpenseConcept, direction: 'asc' | 'desc' } | null>(null);

    const sortedAndFilteredConcepts = concepts
        .filter(concept =>
            concept.ConceptoGasto.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;
            const aVal = a[key];
            const bVal = b[key];
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return direction === 'asc' ? 1 : -1;
            if (bVal == null) return direction === 'asc' ? -1 : 1;
            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    const handleSort = (key: keyof ExpenseConcept) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    return (
        <PageShell
            title={t('title')}
            subtitle={`${concepts.length} conceptos registrados`}
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
                            placeholder="Buscar concepto…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border bg-white focus:outline-none transition-all placeholder:text-gray-400 text-gray-700"
                            style={{
                                borderColor: '#e5e7eb',
                            }}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button variant="secondary" leftIcon={Settings} iconBox onClick={() => setIsPaymentChannelsModalOpen(true)} size="sm">
                            Canales de Pago
                        </Button>
                        <Button variant="solid" leftIcon={Plus} iconBox onClick={() => {
                            setEditingConcept(null);
                            setFormData({ concept: '', requiredReference: false, paymentChannelId: '' });
                            setPaymentChannelSearch('');
                            setSelectedPaymentChannel(null);
                            setIsModalOpen(true);
                        }} size="sm">
                            {t('addConcept')}
                        </Button>
                    </div>
                </div>
            }
        >

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 290px)' }}>
                    <table className="min-w-full border-collapse">
                        <ThemedGridHeader className="sticky top-0 z-10 shadow-sm">
                            <ThemedGridHeaderCell
                                sortable
                                sortDir={sortConfig?.key === 'ConceptoGasto' ? sortConfig.direction : null}
                                onClick={() => handleSort('ConceptoGasto')}
                            >
                                {t('conceptName')}
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell>
                                Canal de Pago Default
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
                            empty={sortedAndFilteredConcepts.length === 0}
                            emptyMessage={searchTerm ? 'Sin resultados para tu búsqueda' : 'Aún no hay conceptos. Agrega el primero.'}
                            colSpan={4}
                        >
                            {sortedAndFilteredConcepts.map((concept) => (
                                <TableRow key={concept.IdConceptoGasto}>
                                    <TableCell>
                                        <span className="font-medium text-gray-900">{concept.ConceptoGasto}</span>
                                    </TableCell>
                                    <TableCell muted>{concept.CanalPago || '—'}</TableCell>
                                    <TableCell>
                                        <span className={`badge ${concept.Status === 0 ? 'badge-green' : 'badge-red'}`}>
                                            {concept.Status === 0 ? t('active') : 'Inactivo'}
                                        </span>
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex items-center justify-end gap-1">
                                            <RowActionButton
                                                icon={Pencil}
                                                label={t('editConcept')}
                                                variant="edit"
                                                onClick={() => openEditModal(concept)}
                                            />
                                            <RowActionButton
                                                icon={Trash2}
                                                label={t('deleteConcept')}
                                                variant="delete"
                                                onClick={() => openDeleteModal(concept)}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </table>
                </div>

                {/* Footer con conteo */}
                {!isLoading && sortedAndFilteredConcepts.length > 0 && (
                    <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <span className="text-xs text-gray-600 font-medium">
                            {sortedAndFilteredConcepts.length} de {concepts.length} conceptos
                        </span>
                    </div>
                )}
            </div>

            {/* Edit/Create Modal */}
            <BaseModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingConcept ? t('editConcept') : t('addConcept')}
                subtitle={editingConcept ? `Editando: ${editingConcept.ConceptoGasto}` : 'Completa la información del concepto'}
                size="lg"
                onConfirm={handleSubmit}
                confirmLabel={t('save')}
                cancelLabel={t('cancel')}
                headerVariant="primary"
            >
                <div className="space-y-4">
                    <Input
                        label={t('conceptName')}
                        value={formData.concept}
                        onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                        required
                    />

                    <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Canal de Pago Default</label>
                        <input
                            type="text"
                            value={paymentChannelSearch}
                            onChange={(e) => {
                                setPaymentChannelSearch(e.target.value);
                                setShowPaymentChannelDropdown(true);
                                setFormData({ ...formData, paymentChannelId: '' });
                                setSelectedPaymentChannel(null);
                            }}
                            onFocus={() => setShowPaymentChannelDropdown(true)}
                            placeholder="Buscar canal de pago (opcional)"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        {showPaymentChannelDropdown && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                {paymentChannels
                                    .filter(c => paymentChannelSearch ? c.CanalPago.toLowerCase().includes(paymentChannelSearch.toLowerCase()) : true)
                                    .map(c => (
                                        <div
                                            key={c.IdCanalPago}
                                            onClick={() => {
                                                setSelectedPaymentChannel(c);
                                                setFormData({ ...formData, paymentChannelId: c.IdCanalPago.toString() });
                                                setPaymentChannelSearch(c.CanalPago);
                                                setShowPaymentChannelDropdown(false);
                                            }}
                                            className="px-3 py-2 hover:bg-primary-50 cursor-pointer"
                                        >
                                            <div className="font-medium text-sm">{c.CanalPago}</div>
                                        </div>
                                    ))}
                                {paymentChannels.filter(c => paymentChannelSearch ? c.CanalPago.toLowerCase().includes(paymentChannelSearch.toLowerCase()) : true).length === 0 && (
                                    <div className="px-3 py-2 text-sm text-gray-400 italic">
                                        No se encontraron canales de pago
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </BaseModal>

            {/* Delete Confirmation Modal */}
            <BaseModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Eliminar concepto"
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
                        <p className="font-semibold text-gray-800">¿Eliminar {editingConcept?.ConceptoGasto}?</p>
                        <p className="text-sm text-gray-500 mt-1">{t('confirmDelete')}</p>
                    </div>
                </div>
            </BaseModal>

            {/* Payment Channels Modal */}
            <PaymentChannelsModal
                isOpen={isPaymentChannelsModalOpen}
                onClose={() => {
                    setIsPaymentChannelsModalOpen(false);
                    if (project?.idProyecto) {
                        fetchPaymentChannels();
                    }
                }}
                projectId={project?.idProyecto}
            />
        </PageShell>
    );
}
