'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from './Button';
import Input from './Input';

interface BranchPaymentMethodsModalProps {
    branchId: number;
    projectId: number;
    isTabMode?: boolean;
}

interface PaymentMethod {
    IdTerminal: number;
    Terminal: string;
    Comision: number;
}

export default function BranchPaymentMethodsModal({ branchId, projectId, isTabMode }: BranchPaymentMethodsModalProps) {
    const t = useTranslations('Terminals');
    const [methods, setMethods] = useState<PaymentMethod[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Form state
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        terminal: '',
        comision: 0
    });

    useEffect(() => {
        if (branchId && projectId) {
            fetchMethods();
        }
    }, [branchId, projectId]);

    const fetchMethods = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/branches/${branchId}/payment-methods?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                setMethods(data.data);
            }
        } catch (error) {
            console.error('Error fetching payment methods:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const response = await fetch(`/api/branches/${branchId}/payment-methods`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    idTerminal: editingId,
                    ...formData
                })
            });

            if (response.ok) {
                setFormData({ terminal: '', comision: 0 });
                setEditingId(null);
                fetchMethods();
            }
        } catch (error) {
            console.error('Error saving payment method:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (method: PaymentMethod) => {
        setEditingId(method.IdTerminal);
        setFormData({
            terminal: method.Terminal,
            comision: method.Comision
        });
    };

    const handleDelete = async (id: number) => {
        if (!confirm(t('confirmDelete'))) return;

        try {
            const response = await fetch(
                `/api/branches/${branchId}/payment-methods?projectId=${projectId}&idTerminal=${id}`,
                { method: 'DELETE' }
            );

            if (response.ok) {
                fetchMethods();
            }
        } catch (error) {
            console.error('Error deleting payment method:', error);
        }
    };

    const handleCancel = () => {
        setEditingId(null);
        setFormData({ terminal: '', comision: 0 });
    };

    return (
        <div className="space-y-6">
            <div className="bg-blue-50/50 p-6 rounded-xl border border-blue-100">
                <h3 className="text-sm font-bold text-blue-800 uppercase mb-4">
                    {editingId ? t('editTerminal') : t('addTerminal')}
                </h3>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-2">
                        <Input
                            label={t('terminalName')}
                            value={formData.terminal}
                            onChange={(e) => setFormData({ ...formData, terminal: e.target.value })}
                            placeholder="Ej. Efectivo, Terminal Banamex..."
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
                            {isSaving ? '...' : editingId ? t('save') : t('addTerminal')}
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
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">{t('terminalName')}</th>
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
                        ) : methods.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-6 py-10 text-center text-gray-500">
                                    No hay formas de pago registradas.
                                </td>
                            </tr>
                        ) : (
                            methods.map((method) => (
                                <tr key={method.IdTerminal} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{method.Terminal}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{method.Comision}%</td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleEdit(method)}
                                            className="text-lg mr-4 hover:scale-125 transition-transform"
                                            title={t('editTerminal')}
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => handleDelete(method.IdTerminal)}
                                            className="text-lg hover:scale-125 transition-transform"
                                            title={t('deleteTerminal')}
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
