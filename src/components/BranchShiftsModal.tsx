'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2, Plus, Clock } from 'lucide-react';
import Button from './Button';
import Input from './Input';
import ThemedGridHeader, { ThemedGridHeaderCell, TableBody, TableRow, TableCell, RowActionButton } from '@/components/ThemedGridHeader';

interface Shift {
    IdTurno: number;
    Turno: string;
    HoraInicio: string | null;
    HoraFin: string | null;
}

interface BranchShiftsModalProps {
    isOpen: boolean;
    onClose: () => void;
    branchId: string;
    branchName: string;
    projectId: number;
    isTabMode?: boolean;
}

export default function BranchShiftsModal({ isOpen, onClose, branchId, branchName, projectId, isTabMode }: BranchShiftsModalProps) {
    const t = useTranslations('BranchShiftsModal');
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        shift: '',
        startTime: '',
        endTime: ''
    });

    useEffect(() => {
        if ((isOpen || isTabMode) && branchId) {
            fetchShifts();
        }
    }, [isOpen, isTabMode, branchId]);

    const fetchShifts = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/shifts?projectId=${projectId}&branchId=${branchId}`);
            const data = await response.json();
            if (data.success) {
                setShifts(data.data);
            }
        } catch (error) {
            console.error('Error fetching shifts:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddShift = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await fetch('/api/shifts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    branchId,
                    shift: formData.shift,
                    startTime: formData.startTime,
                    endTime: formData.endTime
                })
            });
            const data = await response.json();
            if (data.success) {
                fetchShifts();
                setFormData({ shift: '', startTime: '', endTime: '' });
            }
        } catch (error) {
            console.error('Error creating shift:', error);
        }
    };

    const handleDeleteShift = async (id: number) => {
        if (!confirm(t('confirmDelete'))) return;
        try {
            const response = await fetch(`/api/shifts/${id}?projectId=${projectId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                fetchShifts();
            }
        } catch (error) {
            console.error('Error deleting shift:', error);
        }
    };

    if (!isOpen && !isTabMode) return null;

    const content = (
        <div className={isTabMode ? "" : "bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto"}>
            {!isTabMode && (
                <div className="flex justify-between items-center mb-6">
                    <h2 className="brand-heading text-lg font-bold text-gray-800">{t('title')} - {branchName}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">✕</button>
                </div>
            )}

            <div className="space-y-6">
                {/* Form to add new shift */}
                <form onSubmit={handleAddShift} className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Plus size={16} /> {t('addNew')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input
                            label={t('shiftName')}
                            placeholder={t('shiftPlaceholder')}
                            value={formData.shift}
                            onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                            required
                        />
                        <Input
                            label={t('startTime')}
                            type="time"
                            value={formData.startTime}
                            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        />
                        <Input
                            label={t('endTime')}
                            type="time"
                            value={formData.endTime}
                            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        />
                    </div>
                    <div className="flex justify-end">
                        <Button type="submit">
                            {t('save')}
                        </Button>
                    </div>
                </form>

                {/* Shifts List */}
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Clock size={16} /> {t('currentShifts')}
                    </h3>
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <table className="w-full border-collapse">
                            <ThemedGridHeader className="sticky top-0 z-10 shadow-sm">
                                <ThemedGridHeaderCell>
                                    {t('shift')}
                                </ThemedGridHeaderCell>
                                <ThemedGridHeaderCell>
                                    {t('hours')}
                                </ThemedGridHeaderCell>
                                <ThemedGridHeaderCell align="right">
                                    {t('actions')}
                                </ThemedGridHeaderCell>
                            </ThemedGridHeader>
                            <TableBody
                                loading={isLoading}
                                empty={shifts.length === 0}
                                emptyMessage={t('noShifts') || 'No hay turnos registrados.'}
                                colSpan={3}
                            >
                                {shifts.map((s) => (
                                    <TableRow key={s.IdTurno}>
                                        <TableCell>
                                            <span className="font-medium text-gray-900 uppercase">{s.Turno}</span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-gray-600">
                                                {s.HoraInicio?.substring(0, 5) || '--:--'} - {s.HoraFin?.substring(0, 5) || '--:--'}
                                            </span>
                                        </TableCell>
                                        <TableCell align="right">
                                            <div className="flex items-center justify-end gap-1">
                                                <RowActionButton
                                                    icon={Trash2}
                                                    label={t('delete')}
                                                    variant="delete"
                                                    onClick={() => handleDeleteShift(s.IdTurno)}
                                                />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </table>
                    </div>
                </div>

                {!isTabMode && (
                    <div className="flex justify-end pt-4 border-t border-gray-100">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm font-medium"
                        >
                            {t('close')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    if (isTabMode) return content;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            {content}
        </div>
    );
}
