'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell, TableBody, TableRow, TableCell, RowActionButton } from '@/components/ThemedGridHeader';
import BaseModal from '@/components/BaseModal';
import PageShell from '@/components/PageShell';
import { CreditCard, Plus, Search, Pencil, Trash2, AlertTriangle } from 'lucide-react';

interface PaymentChannel {
    IdCanalPago: number;
    CanalPago: string;
    Status: number;
}

export default function PaymentChannelsPage() {
    const t = useTranslations('PaymentChannels');
    const [channels, setChannels] = useState<PaymentChannel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingChannel, setEditingChannel] = useState<PaymentChannel | null>(null);
    const [formData, setFormData] = useState({ channelName: '' });
    const [project, setProject] = useState<any>(null);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchChannels();
        }
    }, [project]);

    const fetchChannels = async () => {
        try {
            const response = await fetch(`/api/payment-channels?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setChannels(data.data);
            }
        } catch (error) {
            console.error('Error fetching payment channels:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async () => {
        try {
            const url = editingChannel
                ? `/api/payment-channels/${editingChannel.IdCanalPago}`
                : '/api/payment-channels';

            const method = editingChannel ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    channelName: formData.channelName
                })
            });

            if (response.ok) {
                fetchChannels();
                setIsModalOpen(false);
                setFormData({ channelName: '' });
                setEditingChannel(null);
            }
        } catch (error) {
            console.error('Error saving payment channel:', error);
        }
    };

    const handleDelete = async () => {
        if (!editingChannel) return;
        try {
            const response = await fetch(`/api/payment-channels/${editingChannel.IdCanalPago}?projectId=${project.idProyecto}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchChannels();
                setIsDeleteModalOpen(false);
                setEditingChannel(null);
            }
        } catch (error) {
            console.error('Error deleting payment channel:', error);
        }
    };

    const openEditModal = (channel: PaymentChannel) => {
        setEditingChannel(channel);
        setFormData({
            channelName: channel.CanalPago
        });
        setIsModalOpen(true);
    };

    const openDeleteModal = (channel: PaymentChannel) => {
        setEditingChannel(channel);
        setIsDeleteModalOpen(true);
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof PaymentChannel, direction: 'asc' | 'desc' } | null>(null);

    const sortedAndFilteredChannels = channels
        .filter(channel =>
            channel.CanalPago.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;
            if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
            if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    const handleSort = (key: keyof PaymentChannel) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    return (
        <PageShell
            title={t('title')}
            subtitle={`${channels.length} canales de pago registrados`}
            icon={CreditCard}
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
                            placeholder={t('searchPlaceholder') || 'Buscar canal…'}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border bg-white focus:outline-none transition-all placeholder:text-gray-400 text-gray-700"
                            style={{
                                borderColor: '#e5e7eb',
                            }}
                        />
                    </div>
                    <Button
                        onClick={() => {
                            setEditingChannel(null);
                            setFormData({ channelName: '' });
                            setIsModalOpen(true);
                        }}
                        variant="solid"
                        leftIcon={Plus}
                        iconBox
                        size="sm"
                    >
                        {t('addChannel')}
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
                                sortDir={sortConfig?.key === 'CanalPago' ? sortConfig.direction : null}
                                onClick={() => handleSort('CanalPago')}
                            >
                                {t('channelName')}
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
                            empty={sortedAndFilteredChannels.length === 0}
                            emptyMessage={searchTerm ? 'Sin resultados para tu búsqueda' : 'Aún no hay canales de pago. Agrega el primero.'}
                            colSpan={3}
                        >
                            {sortedAndFilteredChannels.map((channel) => (
                                <TableRow key={channel.IdCanalPago}>
                                    <TableCell>
                                        <span className="font-medium text-gray-900">{channel.CanalPago}</span>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`badge ${channel.Status === 0 ? 'badge-green' : 'badge-red'}`}>
                                            {channel.Status === 0 ? t('active') : 'Inactivo'}
                                        </span>
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex items-center justify-end gap-1">
                                            <RowActionButton
                                                icon={Pencil}
                                                label={t('editChannel')}
                                                variant="edit"
                                                onClick={() => openEditModal(channel)}
                                            />
                                            <RowActionButton
                                                icon={Trash2}
                                                label={t('deleteChannel')}
                                                variant="delete"
                                                onClick={() => openDeleteModal(channel)}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </table>

                    {/* Footer con conteo */}
                    {!isLoading && sortedAndFilteredChannels.length > 0 && (
                        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                            <span className="text-xs text-gray-600 font-medium">
                                {sortedAndFilteredChannels.length} de {channels.length} canales de pago
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit/Create Modal */}
            <BaseModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingChannel ? t('editChannel') : t('addChannel')}
                subtitle={editingChannel ? `Editando: ${editingChannel.CanalPago}` : 'Completa la información del canal de pago'}
                size="lg"
                onConfirm={handleSubmit}
                confirmLabel={t('save')}
                cancelLabel={t('cancel')}
                headerVariant="primary"
            >
                <div className="space-y-4">
                    <Input
                        label={t('channelName')}
                        value={formData.channelName}
                        onChange={(e) => setFormData({ ...formData, channelName: e.target.value })}
                        required
                    />
                </div>
            </BaseModal>

            {/* Delete Confirmation Modal */}
            <BaseModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Eliminar canal de pago"
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
                        <p className="font-semibold text-gray-800">¿Eliminar {editingChannel?.CanalPago}?</p>
                        <p className="text-sm text-gray-500 mt-1">{t('confirmDelete')}</p>
                    </div>
                </div>
            </BaseModal>
        </PageShell>
    );
}
