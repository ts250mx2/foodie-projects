'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import TipProfileEarningsModal from '@/components/TipProfileEarningsModal';
import TipProfileExpensesModal from '@/components/TipProfileExpensesModal';
import ThemedGridHeader, { ThemedGridHeaderCell, TableRow, TableCell, TableBody, RowActionButton } from '@/components/ThemedGridHeader';
import PageShell from '@/components/PageShell';
import BaseModal from '@/components/BaseModal';
import { useTheme } from '@/contexts/ThemeContext';
import { DollarSign, Pencil, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface TipProfile {
    IdPerfilPropina: number;
    PerfilPropina: string;
    EsActivo: number;
    Status: number;
    FechaAct: string;
}

export default function TipsProfilesPage() {
    const { colors } = useTheme();
    const [profiles, setProfiles] = useState<TipProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isEarningsModalOpen, setIsEarningsModalOpen] = useState(false);
    const [isExpensesModalOpen, setIsExpensesModalOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<TipProfile | null>(null);
    const [selectedProfileForEarnings, setSelectedProfileForEarnings] = useState<TipProfile | null>(null);
    const [selectedProfileForExpenses, setSelectedProfileForExpenses] = useState<TipProfile | null>(null);
    const [profileName, setProfileName] = useState('');
    const [esActivo, setEsActivo] = useState(1);
    const [project, setProject] = useState<any>(null);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchProfiles();
        }
    }, [project]);

    const fetchProfiles = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/tips-profiles?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setProfiles(data.data);
            }
        } catch (error) {
            console.error('Error fetching profiles:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        try {
            const url = editingProfile
                ? `/api/tips-profiles/${editingProfile.IdPerfilPropina}`
                : '/api/tips-profiles';
            const method = editingProfile ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    profileName,
                    esActivo
                })
            });

            if (response.ok) {
                fetchProfiles();
                setIsModalOpen(false);
                setProfileName('');
                setEditingProfile(null);
            }
        } catch (error) {
            console.error('Error saving profile:', error);
        }
    };

    const handleDelete = async () => {
        if (!editingProfile) return;
        try {
            const response = await fetch(`/api/tips-profiles/${editingProfile.IdPerfilPropina}?projectId=${project.idProyecto}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                fetchProfiles();
                setIsDeleteModalOpen(false);
                setEditingProfile(null);
            }
        } catch (error) {
            console.error('Error deleting profile:', error);
        }
    };

    const openEditModal = (profile: TipProfile) => {
        setEditingProfile(profile);
        setProfileName(profile.PerfilPropina);
        setEsActivo(profile.EsActivo ?? 1);
        setIsModalOpen(true);
    };

    const openDeleteModal = (profile: TipProfile) => {
        setEditingProfile(profile);
        setIsDeleteModalOpen(true);
    };

    const openEarningsModal = (profile: TipProfile) => {
        setSelectedProfileForEarnings(profile);
        setIsEarningsModalOpen(true);
    };

    const openExpensesModal = (profile: TipProfile) => {
        setSelectedProfileForExpenses(profile);
        setIsExpensesModalOpen(true);
    };

    return (
        <PageShell
            title="Administración de Perfiles de Propinas"
            subtitle={`${profiles.length} perfiles registrados`}
            icon={DollarSign}
            actions={
                <Button onClick={() => {
                    setEditingProfile(null);
                    setProfileName('');
                    setIsModalOpen(true);
                }}>
                    Agregar Perfil
                </Button>
            }
        >
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100 table-row-hover">
                    <ThemedGridHeader>
                        <ThemedGridHeaderCell>
                            Perfil de Propina
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell>
                            Estado
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell>
                            Fecha Actualización
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell className="text-right">
                            Acciones
                        </ThemedGridHeaderCell>
                    </ThemedGridHeader>
                    <TableBody loading={isLoading} empty={profiles.length === 0}>
                        {profiles.map((profile) => (
                            <TableRow key={profile.IdPerfilPropina}>
                                <TableCell className="font-medium text-gray-900">
                                    {profile.PerfilPropina}
                                </TableCell>
                                <TableCell>
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${profile.EsActivo === 1
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                        }`}>
                                        {profile.EsActivo === 1 ? 'Activo' : 'Inactivo'}
                                    </span>
                                </TableCell>
                                <TableCell className="text-gray-500">
                                    {new Date(profile.FechaAct).toLocaleString()}
                                </TableCell>
                                <TableCell align="right">
                                    <div className="flex items-center justify-end gap-1.5">
                                        <RowActionButton
                                            icon={Pencil}
                                            label="Editar"
                                            variant="edit"
                                            onClick={() => openEditModal(profile)}
                                        />
                                        <RowActionButton
                                            icon={ArrowUpRight}
                                            label="Ingresos"
                                            onClick={() => openEarningsModal(profile)}
                                        />
                                        <RowActionButton
                                            icon={ArrowDownRight}
                                            label="Egresos"
                                            onClick={() => openExpensesModal(profile)}
                                        />
                                        <RowActionButton
                                            icon={Trash2}
                                            label="Eliminar"
                                            variant="delete"
                                            onClick={() => openDeleteModal(profile)}
                                        />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </table>

                {/* Footer con conteo */}
                {!isLoading && profiles.length > 0 && (
                    <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <span className="text-xs text-gray-600 font-medium">
                            {profiles.length} perfiles
                        </span>
                    </div>
                )}
            </div>

            {/* Edit/Create Modal */}
            <BaseModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingProfile ? 'Editar Perfil' : 'Agregar Perfil'}
                onConfirm={handleSubmit}
                confirmLabel="Guardar"
                cancelLabel="Cancelar"
            >
                <div className="space-y-4">
                    <Input
                        label="Nombre del Perfil"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        required
                    />

                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                        <span className="text-sm font-medium text-gray-700">Estado Activo</span>
                        <button
                            type="button"
                            onClick={() => setEsActivo(esActivo === 1 ? 0 : 1)}
                            className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                            style={{ backgroundColor: esActivo === 1 ? colors.colorFondo1 : '#e5e7eb' }}
                        >
                            <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${esActivo === 1 ? 'translate-x-5' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>
                </div>
            </BaseModal>

            {/* Delete Confirmation Modal */}
            <BaseModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Eliminar Perfil"
                onConfirm={handleDelete}
                confirmLabel="Eliminar"
                confirmVariant="danger"
                cancelLabel="Cancelar"
            >
                <p className="text-gray-500 text-sm">¿Está seguro de eliminar este perfil de propina?</p>
            </BaseModal>

            {selectedProfileForEarnings && (
                <TipProfileEarningsModal
                    isOpen={isEarningsModalOpen}
                    onClose={() => setIsEarningsModalOpen(false)}
                    profileId={selectedProfileForEarnings.IdPerfilPropina}
                    profileName={selectedProfileForEarnings.PerfilPropina}
                    projectId={project.idProyecto}
                />
            )}
            {selectedProfileForExpenses && (
                <TipProfileExpensesModal
                    isOpen={isExpensesModalOpen}
                    onClose={() => setIsExpensesModalOpen(false)}
                    profileId={selectedProfileForExpenses.IdPerfilPropina}
                    profileName={selectedProfileForExpenses.PerfilPropina}
                    projectId={project.idProyecto}
                />
            )}
        </PageShell>
    );
}
