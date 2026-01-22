'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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
                    requiredReference: formData.requiredReference ? 1 : 0,
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
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">{t('title')}</h1>
                <Button onClick={() => {
                    setEditingConcept(null);
                    setFormData({ concept: '', requiredReference: false, paymentChannelId: '' });
                    setPaymentChannelSearch('');
                    setSelectedPaymentChannel(null);
                    setIsModalOpen(true);
                }}>
                    {t('addConcept')}
                </Button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <ThemedGridHeader>
                        <ThemedGridHeaderCell
                            className="cursor-pointer hover:opacity-80"
                            onClick={() => handleSort('ConceptoGasto')}
                        >
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1">
                                    {t('conceptName')}
                                    {sortConfig?.key === 'ConceptoGasto' && (
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
                        <ThemedGridHeaderCell>
                            Ref. Obligatoria
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell>
                            Canal de Pago Default
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell>
                            {t('active')}
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell className="text-right">
                            {t('actions')}
                        </ThemedGridHeaderCell>
                    </ThemedGridHeader>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedAndFilteredConcepts.map((concept) => (
                            <tr key={concept.IdConceptoGasto} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {concept.ConceptoGasto}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    {concept.ReferenciaObligatoria === 1 ? 'Sí' : 'No'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    {concept.CanalPago || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${concept.Status === 0
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                        }`}>
                                        {concept.Status === 0 ? t('active') : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => openEditModal(concept)}
                                        className="text-xl mr-4 hover:scale-110 transition-transform"
                                        title={t('editConcept')}
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => openDeleteModal(concept)}
                                        className="text-xl hover:scale-110 transition-transform"
                                        title={t('deleteConcept')}
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
                            {editingConcept ? t('editConcept') : t('addConcept')}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                label={t('conceptName')}
                                value={formData.concept}
                                onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                                required
                            />

                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                                <span className="text-sm font-medium text-gray-700">Referencia Obligatoria</span>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, requiredReference: !formData.requiredReference })}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${formData.requiredReference ? 'bg-orange-500' : 'bg-gray-200'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.requiredReference ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                            </div>

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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                                                    className="px-3 py-2 hover:bg-orange-50 cursor-pointer"
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
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{t('deleteConcept')}</h3>
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
                                {t('deleteConcept')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
