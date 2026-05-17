'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Pencil, Trash2 } from 'lucide-react';
import Button from './Button';
import Input from './Input';
import ThemedGridHeader, { ThemedGridHeaderCell, TableBody, TableRow, TableCell, RowActionButton } from '@/components/ThemedGridHeader';

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

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full border-collapse">
                    <ThemedGridHeader className="sticky top-0 z-10 shadow-sm">
                        <ThemedGridHeaderCell>
                            {t('terminalName')}
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell>
                            {t('commission')}
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell align="right">
                            {t('actions')}
                        </ThemedGridHeaderCell>
                    </ThemedGridHeader>
                    <TableBody
                        loading={isLoading}
                        empty={methods.length === 0}
                        emptyMessage="No hay formas de pago registradas."
                        colSpan={3}
                    >
                        {methods.map((method) => (
                            <TableRow key={method.IdTerminal}>
                                <TableCell>
                                    <span className="font-medium text-gray-900">{method.Terminal}</span>
                                </TableCell>
                                <TableCell>
                                    <span className="text-gray-600">{method.Comision}%</span>
                                </TableCell>
                                <TableCell align="right">
                                    <div className="flex items-center justify-end gap-1">
                                        <RowActionButton
                                            icon={Pencil}
                                            label={t('editTerminal')}
                                            variant="edit"
                                            onClick={() => handleEdit(method)}
                                        />
                                        <RowActionButton
                                            icon={Trash2}
                                            label={t('deleteTerminal')}
                                            variant="delete"
                                            onClick={() => handleDelete(method.IdTerminal)}
                                        />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </table>
            </div>
        </div>
    );
}
