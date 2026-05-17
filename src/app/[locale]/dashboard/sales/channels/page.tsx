'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Store, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell, RowActionButton } from '@/components/ThemedGridHeader';
import BaseModal from '@/components/BaseModal';
import PageShell from '@/components/PageShell';

interface Channel {
    IdCanalVenta: number;
    CanalVenta: string;
    Comision: number;
    Orden: number;
    Status: number;
}

export default function SalesChannelsPage() {
    const t = useTranslations('SalesChannels');
    const [channels, setChannels] = useState<Channel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
    const [formData, setFormData] = useState({ channel: '', commission: '', order: '' });
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
            const response = await fetch(`/api/sales-channels?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setChannels(data.data);
            }
        } catch (error) {
            console.error('Error fetching sales channels:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!editingChannel) return;
        try {
            const response = await fetch(`/api/sales-channels/${editingChannel.IdCanalVenta}?projectId=${project.idProyecto}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchChannels();
                setIsDeleteModalOpen(false);
                setEditingChannel(null);
            }
        } catch (error) {
            console.error('Error deleting sales channel:', error);
        }
    };

    const openDeleteModal = (channel: Channel) => {
        setEditingChannel(channel);
        setIsDeleteModalOpen(true);
    };

    const [draggedItem, setDraggedItem] = useState<number | null>(null);

    // ... (rest of drag handlers)

    const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
        setDraggedItem(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (draggedItem === null) return;
        if (draggedItem === index) return;

        const newChannels = [...channels];
        const draggedChannel = newChannels[draggedItem];
        newChannels.splice(draggedItem, 1);
        newChannels.splice(index, 0, draggedChannel);

        setDraggedItem(index);
        setChannels(newChannels);
    };

    const handleDragEnd = async () => {
        setDraggedItem(null);

        const updatedChannels = channels.map((channel, index) => ({
            IdCanalVenta: channel.IdCanalVenta,
            Orden: index + 1
        }));

        try {
            await fetch('/api/sales-channels', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    channels: updatedChannels
                })
            });
        } catch (error) {
            console.error('Error updating channel order:', error);
            fetchChannels();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingChannel
                ? `/api/sales-channels/${editingChannel.IdCanalVenta}`
                : '/api/sales-channels';

            const method = editingChannel ? 'PUT' : 'POST';

            const nextOrder = channels.length > 0
                ? Math.max(...channels.map(c => c.Orden)) + 1
                : 1;

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    channel: formData.channel,
                    commission: parseFloat(formData.commission) || 0,
                    order: editingChannel ? editingChannel.Orden : nextOrder
                })
            });

            if (response.ok) {
                fetchChannels();
                setIsModalOpen(false);
                setFormData({ channel: '', commission: '', order: '' });
                setEditingChannel(null);
            }
        } catch (error) {
            console.error('Error saving sales channel:', error);
        }
    };

    const openEditModal = (channel: Channel) => {
        setEditingChannel(channel);
        setFormData({
            channel: channel.CanalVenta,
            commission: channel.Comision.toString(),
            order: ''
        });
        setIsModalOpen(true);
    };

    return (
        <PageShell title={t('title')} icon={Store} actions={<Button
                    variant="solid"
                    leftIcon={Plus}
                    iconBox
                    size="sm"
                    onClick={() => {
                        setEditingChannel(null);
                        setFormData({ channel: '', commission: '', order: '' });
                        setIsModalOpen(true);
                    }}
                >
                    {t('addChannel')}
                </Button>}>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100 table-row-hover">
                    <ThemedGridHeader>
                        <ThemedGridHeaderCell>
                            {t('channelName')}
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell>
                            {t('commission')}
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell>
                            {t('active')}
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell className="text-right">
                            {t('actions')}
                        </ThemedGridHeaderCell>
                    </ThemedGridHeader>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {isLoading ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">Loading...</td>
                            </tr>
                        ) : channels.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No sales channels found</td>
                            </tr>
                        ) : (
                            channels.map((chan, index) => (
                                <tr
                                    key={chan.IdCanalVenta}
                                    className={`hover:bg-gray-50 cursor-move ${draggedItem === index ? 'opacity-50' : ''}`}
                                    draggable
                                    onDragStart={(e: React.DragEvent<HTMLTableRowElement>) => handleDragStart(e, index)}
                                    onDragOver={(e: React.DragEvent<HTMLTableRowElement>) => handleDragOver(e, index)}
                                    onDragEnd={handleDragEnd}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {chan.CanalVenta}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {chan.Comision}%
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${chan.Status === 0
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                            }`}>
                                            {chan.Status === 0 ? t('active') : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end gap-1">
                                            <RowActionButton
                                                icon={Pencil}
                                                label={t('editChannel')}
                                                variant="edit"
                                                onClick={() => openEditModal(chan)}
                                            />
                                            <RowActionButton
                                                icon={Trash2}
                                                label={t('deleteChannel')}
                                                variant="delete"
                                                onClick={() => openDeleteModal(chan)}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Edit/Create Modal */}
            <BaseModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingChannel ? t('editChannel') : t('addChannel')}
                subtitle={editingChannel ? `Editando: ${editingChannel.CanalVenta}` : 'Completa la información del canal de venta'}
                size="lg"
                onConfirm={() => {
                    const form = new FormData();
                    form.append('channel', formData.channel);
                    form.append('commission', formData.commission);
                    handleSubmit({ preventDefault: () => {} } as any);
                }}
                confirmLabel={t('save')}
                cancelLabel={t('cancel')}
                headerVariant="primary"
            >
                <div className="space-y-4">
                    <Input
                        label={t('channelName')}
                        value={formData.channel}
                        onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
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
                title={t('deleteChannel')}
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
                        <p className="font-semibold text-gray-800">¿Eliminar {editingChannel?.CanalVenta}?</p>
                        <p className="text-sm text-gray-500 mt-1">{t('confirmDelete')}</p>
                    </div>
                </div>
            </BaseModal>
        </PageShell>
    );
}
