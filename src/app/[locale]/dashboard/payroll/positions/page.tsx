'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell, TableRow, TableCell, TableBody, RowActionButton } from '@/components/ThemedGridHeader';
import PageShell from '@/components/PageShell';
import BaseModal from '@/components/BaseModal';
import { useTheme } from '@/contexts/ThemeContext';
import { Briefcase, Pencil, Trash2, Plus } from 'lucide-react';

interface Position {
    IdPuesto: number;
    Puesto: string;
    Status: number;
    TienePropina: number;
}

export default function PositionsPage() {
    const t = useTranslations('Positions');
    const { colors } = useTheme();
    const [positions, setPositions] = useState<Position[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingPosition, setEditingPosition] = useState<Position | null>(null);
    const [formData, setFormData] = useState({ position: '', hasTips: false });
    const [project, setProject] = useState<any>(null);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchPositions();
        }
    }, [project]);

    const fetchPositions = async () => {
        try {
            const response = await fetch(`/api/positions?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setPositions(data.data);
            }
        } catch (error) {
            console.error('Error fetching positions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        try {
            const url = editingPosition
                ? `/api/positions/${editingPosition.IdPuesto}`
                : '/api/positions';

            const method = editingPosition ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    position: formData.position,
                    hasTips: formData.hasTips ? 1 : 0
                })
            });

            if (response.ok) {
                fetchPositions();
                setIsModalOpen(false);
                setFormData({ position: '', hasTips: false });
                setEditingPosition(null);
            }
        } catch (error) {
            console.error('Error saving position:', error);
        }
    };

    const handleDelete = async () => {
        if (!editingPosition) return;
        try {
            const response = await fetch(`/api/positions/${editingPosition.IdPuesto}?projectId=${project.idProyecto}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchPositions();
                setIsDeleteModalOpen(false);
                setEditingPosition(null);
            }
        } catch (error) {
            console.error('Error deleting position:', error);
        }
    };

    const openEditModal = (position: Position) => {
        setEditingPosition(position);
        setFormData({
            position: position.Puesto,
            hasTips: position.TienePropina === 1
        });
        setIsModalOpen(true);
    };

    const openDeleteModal = (position: Position) => {
        setEditingPosition(position);
        setIsDeleteModalOpen(true);
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Position, direction: 'asc' | 'desc' } | null>(null);

    const sortedAndFilteredPositions = positions
        .filter(position =>
            position.Puesto.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;
            if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
            if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    const handleSort = (key: keyof Position) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    return (
        <PageShell title={t('title')} subtitle={`${positions.length} puestos registrados`} icon={Briefcase} actions={<Button
                    onClick={() => {
                        setEditingPosition(null);
                        setFormData({ position: '', hasTips: false });
                        setIsModalOpen(true);
                    }}
                    variant="solid"
                    leftIcon={Plus}
                    iconBox
                    size="sm"
                >
                    {t('addPosition')}
                </Button>}>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 290px)' }}>
                    <table className="min-w-full divide-y divide-gray-100 table-row-hover border-collapse">
                        <ThemedGridHeader>
                            <ThemedGridHeaderCell
                                className="cursor-pointer hover:opacity-80"
                                onClick={() => handleSort('Puesto')}
                            >
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1">
                                        {t('positionName')}
                                        {sortConfig?.key === 'Puesto' && (
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
                                {t('hasTips')}
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell>
                                {t('active')}
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell className="text-right">
                                {t('actions')}
                            </ThemedGridHeaderCell>
                        </ThemedGridHeader>
                        <TableBody loading={isLoading} empty={sortedAndFilteredPositions.length === 0}>
                            {sortedAndFilteredPositions.map((position) => (
                                <TableRow key={position.IdPuesto}>
                                    <TableCell className="font-medium text-gray-900">
                                        {position.Puesto}
                                    </TableCell>
                                    <TableCell>
                                        {position.TienePropina === 1 ? 'Sí' : 'No'}
                                    </TableCell>
                                    <TableCell>
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${position.Status === 0
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                            }`}>
                                            {position.Status === 0 ? t('active') : 'Inactive'}
                                        </span>
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <RowActionButton
                                                icon={Pencil}
                                                label={t('editPosition')}
                                                variant="edit"
                                                onClick={() => openEditModal(position)}
                                            />
                                            <RowActionButton
                                                icon={Trash2}
                                                label={t('deletePosition')}
                                                variant="delete"
                                                onClick={() => openDeleteModal(position)}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </table>

                    {/* Footer con conteo */}
                    {!isLoading && sortedAndFilteredPositions.length > 0 && (
                        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                            <span className="text-xs text-gray-600 font-medium">
                                {sortedAndFilteredPositions.length} de {positions.length} puestos
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit/Create Modal */}
            <BaseModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingPosition ? t('editPosition') : t('addPosition')}
                onConfirm={handleSubmit}
                confirmLabel={t('save')}
                cancelLabel={t('cancel')}
            >
                <div className="space-y-4">
                    <Input
                        label={t('positionName')}
                        value={formData.position}
                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                        required
                    />
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">
                            {t('hasTips')}
                        </label>
                        <div
                            onClick={() => setFormData({ ...formData, hasTips: !formData.hasTips })}
                            className={`w-12 h-6 flex-shrink-0 rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out ${formData.hasTips ? 'bg-primary-500' : 'bg-gray-300'}`}
                            style={{ backgroundColor: formData.hasTips ? colors.colorFondo1 : undefined }}
                        >
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${formData.hasTips ? 'translate-x-6' : 'translate-x-0'}`} />
                        </div>
                    </div>
                </div>
            </BaseModal>

            {/* Delete Confirmation Modal */}
            <BaseModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title={t('deletePosition')}
                onConfirm={handleDelete}
                confirmLabel={t('deletePosition')}
                confirmVariant="danger"
                cancelLabel={t('cancel')}
            >
                <p className="text-gray-500 text-sm">{t('confirmDelete')}</p>
            </BaseModal>
        </PageShell>
    );
}
