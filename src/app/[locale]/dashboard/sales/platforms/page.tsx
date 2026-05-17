'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Smartphone, Search, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell, TableBody, TableRow, TableCell, RowActionButton } from '@/components/ThemedGridHeader';
import BaseModal from '@/components/BaseModal';
import PageShell from '@/components/PageShell';

interface Platform {
    IdPlataforma: number;
    Plataforma: string;
    Comision: number;
    Orden: number;
    Status: number;
}

export default function PlatformsPage() {
    const t = useTranslations('Platforms');
    const [platforms, setPlatforms] = useState<Platform[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null);
    const [formData, setFormData] = useState({ platform: '', commission: '', order: '' });
    const [project, setProject] = useState<any>(null);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchPlatforms();
        }
    }, [project]);

    const fetchPlatforms = async () => {
        try {
            const response = await fetch(`/api/platforms?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setPlatforms(data.data);
            }
        } catch (error) {
            console.error('Error fetching platforms:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async () => {
        try {
            const url = editingPlatform
                ? `/api/platforms/${editingPlatform.IdPlataforma}`
                : '/api/platforms';

            const method = editingPlatform ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    platform: formData.platform,
                    commission: parseFloat(formData.commission),
                    order: parseInt(formData.order)
                })
            });

            if (response.ok) {
                fetchPlatforms();
                setIsModalOpen(false);
                setFormData({ platform: '', commission: '', order: '' });
                setEditingPlatform(null);
            }
        } catch (error) {
            console.error('Error saving platform:', error);
        }
    };

    const handleDelete = async () => {
        if (!editingPlatform) return;
        try {
            const response = await fetch(`/api/platforms/${editingPlatform.IdPlataforma}?projectId=${project.idProyecto}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchPlatforms();
                setIsDeleteModalOpen(false);
                setEditingPlatform(null);
            }
        } catch (error) {
            console.error('Error deleting platform:', error);
        }
    };

    const openEditModal = (platform: Platform) => {
        setEditingPlatform(platform);
        setFormData({
            platform: platform.Plataforma,
            commission: platform.Comision.toString(),
            order: platform.Orden.toString()
        });
        setIsModalOpen(true);
    };

    const openDeleteModal = (platform: Platform) => {
        setEditingPlatform(platform);
        setIsDeleteModalOpen(true);
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Platform, direction: 'asc' | 'desc' } | null>(null);

    const sortedAndFilteredPlatforms = platforms
        .filter(plat =>
            plat.Plataforma.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;
            if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
            if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    const handleSort = (key: keyof Platform) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    return (
        <PageShell title={t('title')} subtitle={`${platforms.length} plataformas registradas`} icon={Smartphone} actions={
            <div className="flex gap-2 items-center flex-wrap">
                <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg flex-1 min-w-[200px] max-w-xs">
                    <Search size={18} className="text-gray-400" />
                    <input
                        type="text"
                        placeholder={t('search') || 'Search...'}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 outline-none text-sm text-gray-700 placeholder-gray-400 bg-transparent"
                    />
                </div>
                <Button
                    variant="solid"
                    leftIcon={Plus}
                    iconBox
                    size="sm"
                    onClick={() => {
                        setEditingPlatform(null);
                        setFormData({ platform: '', commission: '', order: '' });
                        setIsModalOpen(true);
                    }}
                >
                    {t('addPlatform')}
                </Button>
            </div>
        }>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 290px)' }}>
                    <table className="min-w-full border-collapse">
                        <ThemedGridHeader className="sticky top-0 z-10 shadow-sm">
                            <ThemedGridHeaderCell
                                sortable
                                sortDir={sortConfig?.key === 'Plataforma' ? sortConfig.direction : null}
                                onClick={() => handleSort('Plataforma')}
                            >
                                {t('platformName')}
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell
                                sortable
                                sortDir={sortConfig?.key === 'Comision' ? sortConfig.direction : null}
                                onClick={() => handleSort('Comision')}
                            >
                                {t('commission')}
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell
                                sortable
                                sortDir={sortConfig?.key === 'Orden' ? sortConfig.direction : null}
                                onClick={() => handleSort('Orden')}
                            >
                                {t('order')}
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
                            empty={sortedAndFilteredPlatforms.length === 0}
                            emptyMessage={searchTerm ? 'Sin resultados para tu búsqueda' : 'Aún no hay plataformas. Agrega la primera.'}
                            colSpan={5}
                        >
                            {sortedAndFilteredPlatforms.map((plat) => (
                                <TableRow key={plat.IdPlataforma}>
                                    <TableCell>
                                        <span className="font-medium text-gray-900">{plat.Plataforma}</span>
                                    </TableCell>
                                    <TableCell muted>{plat.Comision}%</TableCell>
                                    <TableCell muted>{plat.Orden}</TableCell>
                                    <TableCell>
                                        <span className={`badge ${plat.Status === 0 ? 'badge-green' : 'badge-red'}`}>
                                            {plat.Status === 0 ? t('active') : 'Inactivo'}
                                        </span>
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex items-center justify-end gap-1">
                                            <RowActionButton
                                                icon={Pencil}
                                                label={t('editPlatform')}
                                                variant="edit"
                                                onClick={() => openEditModal(plat)}
                                            />
                                            <RowActionButton
                                                icon={Trash2}
                                                label={t('deletePlatform')}
                                                variant="delete"
                                                onClick={() => openDeleteModal(plat)}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </table>

                    {/* Footer con conteo */}
                    {!isLoading && sortedAndFilteredPlatforms.length > 0 && (
                        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                            <span className="text-xs text-gray-600 font-medium">
                                {sortedAndFilteredPlatforms.length} de {platforms.length} plataformas
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit/Create Modal */}
            <BaseModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingPlatform ? t('editPlatform') : t('addPlatform')}
                subtitle={editingPlatform ? `Editando: ${editingPlatform.Plataforma}` : 'Completa la información de la plataforma'}
                size="lg"
                onConfirm={handleSubmit}
                confirmLabel={t('save')}
                cancelLabel={t('cancel')}
                headerVariant="primary"
            >
                <div className="space-y-4">
                    <Input
                        label={t('platformName')}
                        value={formData.platform}
                        onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
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
                    <Input
                        label={t('order')}
                        type="number"
                        value={formData.order}
                        onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                        required
                    />
                </div>
            </BaseModal>

            {/* Delete Confirmation Modal */}
            <BaseModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Eliminar plataforma"
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
                        <p className="font-semibold text-gray-800">¿Eliminar {editingPlatform?.Plataforma}?</p>
                        <p className="text-sm text-gray-500 mt-1">{t('confirmDelete')}</p>
                    </div>
                </div>
            </BaseModal>
        </PageShell>
    );
}
