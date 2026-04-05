'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from './Button';
import Input from './Input';

interface BranchSalesChannelsModalProps {
    branchId: number;
    projectId: number;
    isTabMode?: boolean;
}

interface SalesChannel {
    IdCanalVenta: number;
    CanalVenta: string;
    Comision: number;
    Orden: number;
}

export default function BranchSalesChannelsModal({ branchId, projectId, isTabMode }: BranchSalesChannelsModalProps) {
    const t = useTranslations('SalesChannels');
    const [channels, setChannels] = useState<SalesChannel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Form state
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        canalVenta: '',
        comision: 0,
        orden: 0
    });

    useEffect(() => {
        if (branchId && projectId) {
            fetchChannels();
        }
    }, [branchId, projectId]);

    const fetchChannels = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/branches/${branchId}/sales-channels?projectId=${projectId}`);
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const response = await fetch(`/api/branches/${branchId}/sales-channels`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    idCanalVenta: editingId,
                    ...formData
                })
            });

            if (response.ok) {
                setFormData({ canalVenta: '', comision: 0, orden: 0 });
                setEditingId(null);
                fetchChannels();
            }
        } catch (error) {
            console.error('Error saving sales channel:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (channel: SalesChannel) => {
        setEditingId(channel.IdCanalVenta);
        setFormData({
            canalVenta: channel.CanalVenta,
            comision: channel.Comision,
            orden: channel.Orden
        });
    };

    const handleDelete = async (id: number) => {
        if (!confirm(t('confirmDelete'))) return;

        try {
            const response = await fetch(
                `/api/branches/${branchId}/sales-channels?projectId=${projectId}&idCanalVenta=${id}`,
                { method: 'DELETE' }
            );

            if (response.ok) {
                fetchChannels();
            }
        } catch (error) {
            console.error('Error deleting sales channel:', error);
        }
    };

    const handleCancel = () => {
        setEditingId(null);
        setFormData({ canalVenta: '', comision: 0, orden: 0 });
    };

    return (
        <div className="space-y-6">
            <div className="bg-primary-50/50 p-6 rounded-xl border border-primary-100">
                <h3 className="text-sm font-bold text-primary-800 uppercase mb-4">
                    {editingId ? t('editChannel') : t('addChannel')}
                </h3>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-2">
                        <Input
                            label={t('channelName')}
                            value={formData.canalVenta}
                            onChange={(e) => setFormData({ ...formData, canalVenta: e.target.value })}
                            placeholder="Ej. Uber Eats, Mostrador..."
                            required
                        />
                    </div>
                    <div>
                        <Input
                            label={t('commission')}
                            type="number"
                            step="0.01"
                            value={formData.comision}
                            onChange={(e) => setFormData({ ...formData, comision: parseFloat(e.target.value) })}
                            required
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button type="submit" disabled={isSaving} className="flex-1">
                            {isSaving ? '...' : editingId ? t('save') : t('addChannel')}
                        </Button>
                        {editingId && (
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="px-3 py-2 text-gray-500 hover:bg-gray-200 rounded-md transition-colors"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">{t('channelName')}</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">{t('commission')}</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase">{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {isLoading ? (
                            <tr>
                                <td colSpan={3} className="px-6 py-10 text-center text-gray-500">
                                    Cargando...
                                </td>
                            </tr>
                        ) : channels.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-6 py-10 text-center text-gray-500">
                                    No hay canales de venta registrados.
                                </td>
                            </tr>
                        ) : (
                            channels.map((channel) => (
                                <tr key={channel.IdCanalVenta} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{channel.CanalVenta}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{channel.Comision}%</td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleEdit(channel)}
                                            className="text-lg mr-4 hover:scale-125 transition-transform"
                                            title={t('editChannel')}
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => handleDelete(channel.IdCanalVenta)}
                                            className="text-lg hover:scale-125 transition-transform"
                                            title={t('deleteChannel')}
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
