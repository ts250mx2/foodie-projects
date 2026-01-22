'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import TipProfileEarningsModal from '@/components/TipProfileEarningsModal';
import TipProfileExpensesModal from '@/components/TipProfileExpensesModal';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';

interface TipProfile {
    IdPerfilPropina: number;
    PerfilPropina: string;
    EsActivo: number;
    Status: number;
    FechaAct: string;
}

export default function TipsProfilesPage() {
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Administración de Perfiles de Propinas</h1>
                <Button onClick={() => {
                    setEditingProfile(null);
                    setProfileName('');
                    setIsModalOpen(true);
                }}>
                    Agregar Perfil
                </Button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
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
                    <tbody className="bg-white divide-y divide-gray-200">
                        {isLoading ? (
                            <tr>
                                <td colSpan={3} className="px-6 py-4 text-center text-gray-500">Cargando...</td>
                            </tr>
                        ) : profiles.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-6 py-4 text-center text-gray-500">No hay perfiles registrados</td>
                            </tr>
                        ) : (
                            profiles.map((profile) => (
                                <tr key={profile.IdPerfilPropina} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {profile.PerfilPropina}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${profile.EsActivo === 1
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                            }`}>
                                            {profile.EsActivo === 1 ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(profile.FechaAct).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => openEditModal(profile)}
                                            className="text-xl mr-4 hover:scale-110 transition-transform"
                                            title="Editar"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => openEarningsModal(profile)}
                                            className="text-xl mr-4 hover:scale-110 transition-transform"
                                            title="Ingresos"
                                        >
                                            💰
                                        </button>
                                        <button
                                            onClick={() => openExpensesModal(profile)}
                                            className="text-xl mr-4 hover:scale-110 transition-transform"
                                            title="Egresos"
                                        >
                                            💸
                                        </button>
                                        <button
                                            onClick={() => openDeleteModal(profile)}
                                            className="text-xl hover:scale-110 transition-transform"
                                            title="Eliminar"
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

            {/* Edit/Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">
                            {editingProfile ? 'Editar Perfil' : 'Agregar Perfil'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
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
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${esActivo === 1 ? 'bg-orange-600' : 'bg-gray-200'
                                        }`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${esActivo === 1 ? 'translate-x-5' : 'translate-x-0'
                                            }`}
                                    />
                                </button>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                                >
                                    Cancelar
                                </button>
                                <Button type="submit">
                                    Guardar
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
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Eliminar Perfil</h3>
                        <p className="text-gray-500 mb-6">¿Está seguro de eliminar este perfil de propina?</p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
        </div>
    );
}
