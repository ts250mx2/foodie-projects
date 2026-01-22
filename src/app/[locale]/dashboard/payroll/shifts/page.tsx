'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';

interface Shift {
    IdTurno: number;
    Turno: string;
    IdSucursal: number;
    Sucursal: string;
    HoraInicio: string | null;
    HoraFin: string | null;
    Status: number;
}

interface Branch {
    IdSucursal: number;
    Sucursal: string;
}

export default function ShiftsPage() {
    const t = useTranslations('Shifts');
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingShift, setEditingShift] = useState<Shift | null>(null);
    const [formData, setFormData] = useState({
        shift: '',
        branchId: '',
        startTime: '',
        endTime: ''
    });
    const [project, setProject] = useState<any>(null);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchShifts();
            fetchBranches();
        }
    }, [project]);

    const fetchShifts = async () => {
        try {
            const response = await fetch(`/api/shifts?projectId=${project.idProyecto}`);
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

    const fetchBranches = async () => {
        try {
            const response = await fetch(`/api/branches?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setBranches(data.data);
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingShift
                ? `/api/shifts/${editingShift.IdTurno}`
                : '/api/shifts';

            const method = editingShift ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    shift: formData.shift,
                    branchId: formData.branchId,
                    startTime: formData.startTime,
                    endTime: formData.endTime
                })
            });

            if (response.ok) {
                fetchShifts();
                setIsModalOpen(false);
                setFormData({ shift: '', branchId: '', startTime: '', endTime: '' });
                setEditingShift(null);
            }
        } catch (error) {
            console.error('Error saving shift:', error);
        }
    };

    const handleDelete = async () => {
        if (!editingShift) return;
        try {
            const response = await fetch(`/api/shifts/${editingShift.IdTurno}?projectId=${project.idProyecto}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchShifts();
                setIsDeleteModalOpen(false);
                setEditingShift(null);
            }
        } catch (error) {
            console.error('Error deleting shift:', error);
        }
    };

    const openEditModal = (shift: Shift) => {
        setEditingShift(shift);
        setFormData({
            shift: shift.Turno,
            branchId: shift.IdSucursal.toString(),
            startTime: shift.HoraInicio || '',
            endTime: shift.HoraFin || ''
        });
        setIsModalOpen(true);
    };

    const openDeleteModal = (shift: Shift) => {
        setEditingShift(shift);
        setIsDeleteModalOpen(true);
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Shift, direction: 'asc' | 'desc' } | null>(null);

    const sortedAndFilteredShifts = shifts
        .filter(shift =>
            shift.Turno.toLowerCase().includes(searchTerm.toLowerCase()) ||
            shift.Sucursal?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;
            const aValue = a[key];
            const bValue = b[key];
            if (aValue == null || bValue == null) return 0;
            if (aValue < bValue) return direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    const handleSort = (key: keyof Shift) => {
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
                    setEditingShift(null);
                    setFormData({ shift: '', branchId: '', startTime: '', endTime: '' });
                    setIsModalOpen(true);
                }}>
                    {t('addShift')}
                </Button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <ThemedGridHeader>
                        <ThemedGridHeaderCell
                            className="cursor-pointer hover:opacity-80"
                            onClick={() => handleSort('Turno')}
                        >
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1">
                                    {t('shiftName')}
                                    {sortConfig?.key === 'Turno' && (
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
                        <ThemedGridHeaderCell
                            className="cursor-pointer hover:opacity-80"
                            onClick={() => handleSort('Sucursal')}
                        >
                            <div className="flex items-center gap-1">
                                {t('branch')}
                                {sortConfig?.key === 'Sucursal' && (
                                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                )}
                            </div>
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell>
                            {t('startTime')}
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell>
                            {t('endTime')}
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell>
                            {t('active')}
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell className="text-right">
                            {t('actions')}
                        </ThemedGridHeaderCell>
                    </ThemedGridHeader>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedAndFilteredShifts.map((shift) => (
                            <tr key={shift.IdTurno} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {shift.Turno}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {shift.Sucursal || 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {shift.HoraInicio || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {shift.HoraFin || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${shift.Status === 0
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                        }`}>
                                        {shift.Status === 0 ? t('active') : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => openEditModal(shift)}
                                        className="text-xl mr-4 hover:scale-110 transition-transform"
                                        title={t('editShift')}
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => openDeleteModal(shift)}
                                        className="text-xl hover:scale-110 transition-transform"
                                        title={t('deleteShift')}
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
                            {editingShift ? t('editShift') : t('addShift')}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                label={t('shiftName')}
                                value={formData.shift}
                                onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                                required
                            />
                            <div className="flex flex-col">
                                <label className="text-sm font-medium text-gray-700 mb-1">
                                    {t('branch')}
                                </label>
                                <select
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                    value={formData.branchId}
                                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                                    required
                                >
                                    <option value="">{t('selectBranch')}</option>
                                    {branches.map(branch => (
                                        <option key={branch.IdSucursal} value={branch.IdSucursal}>
                                            {branch.Sucursal}
                                        </option>
                                    ))}
                                </select>
                            </div>
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
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{t('deleteShift')}</h3>
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
                                {t('deleteShift')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
