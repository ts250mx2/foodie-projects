'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/Button';
import Input from '@/components/Input';

interface ProjectSettings {
    Logo64: string;
    Proyecto: string;
    Titulo: string;
    ColorFondo1: string;
    ColorFondo2: string;
    ColorLetra: string;
}

interface UserSettings {
    CorreoElectronico: string;
    Usuario: string;
    Telefono: string;
}

export default function ProjectSettingsPage() {
    const t = useTranslations('ProjectSettings');
    const [projectData, setProjectData] = useState<ProjectSettings>({
        Logo64: '',
        Proyecto: '',
        Titulo: '',
        ColorFondo1: '#FF6B35',
        ColorFondo2: '#F7931E',
        ColorLetra: '#FFFFFF'
    });
    const [userData, setUserData] = useState<UserSettings>({
        CorreoElectronico: '',
        Usuario: '',
        Telefono: ''
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [project, setProject] = useState<any>(null);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        const storedUser = localStorage.getItem('user');
        if (storedProject) setProject(JSON.parse(storedProject));
        if (storedUser) setUser(JSON.parse(storedUser));
    }, []);

    useEffect(() => {
        if (project?.idProyecto && user?.idUsuario) {
            fetchSettings();
        }
    }, [project, user]);

    const fetchSettings = async () => {
        try {
            const response = await fetch(`/api/project-settings?projectId=${project.idProyecto}&userId=${user.idUsuario}`);
            const data = await response.json();
            if (data.success) {
                setProjectData(data.projectData);
                setUserData(data.userData);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setProjectData({ ...projectData, Logo64: base64String });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage('');

        try {
            const response = await fetch('/api/project-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    userId: user.idUsuario,
                    projectData: {
                        Logo64: projectData.Logo64, // This will be the file path or empty
                        Titulo: projectData.Titulo,
                        ColorFondo1: projectData.ColorFondo1,
                        ColorFondo2: projectData.ColorFondo2,
                        ColorLetra: projectData.ColorLetra
                    },
                    userData: {
                        Usuario: userData.Usuario,
                        Telefono: userData.Telefono
                    },
                    logoFile: projectData.Logo64.startsWith('data:image') ? projectData.Logo64 : null
                })
            });

            const data = await response.json();
            if (data.success) {
                setMessage('Configuración guardada exitosamente');
                // Update logo path if a new one was saved
                if (data.logoPath) {
                    setProjectData({ ...projectData, Logo64: data.logoPath });
                }
            } else {
                setMessage('Error al guardar la configuración');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            setMessage('Error al guardar la configuración');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="p-6">Cargando...</div>;
    }

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Configuración del Proyecto</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Project Settings Card */}
                <div className="bg-white rounded-lg shadow p-6 space-y-6">
                    <h2 className="text-xl font-semibold text-gray-800 border-b pb-3">Información del Proyecto</h2>

                    {/* Logo Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
                        <div className="flex items-center gap-4">
                            {projectData.Logo64 && (
                                <img
                                    src={projectData.Logo64.startsWith('/') ? projectData.Logo64 : `/${projectData.Logo64}`}
                                    alt="Logo"
                                    className="w-24 h-24 object-contain border rounded-lg"
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                    }}
                                />
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                            />
                        </div>
                    </div>

                    {/* Project Name (Read-only) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Proyecto</label>
                        <input
                            type="text"
                            value={projectData.Proyecto}
                            disabled
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                        />
                    </div>

                    {/* Project Title */}
                    <Input
                        label="Título del Proyecto"
                        value={projectData.Titulo}
                        onChange={(e) => setProjectData({ ...projectData, Titulo: e.target.value })}
                    />

                    {/* Color Pickers */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Color Fondo 1</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={projectData.ColorFondo1}
                                    onChange={(e) => setProjectData({ ...projectData, ColorFondo1: e.target.value })}
                                    className="h-10 w-20 rounded border border-gray-300 cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={projectData.ColorFondo1}
                                    onChange={(e) => setProjectData({ ...projectData, ColorFondo1: e.target.value })}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Color Fondo 2</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={projectData.ColorFondo2}
                                    onChange={(e) => setProjectData({ ...projectData, ColorFondo2: e.target.value })}
                                    className="h-10 w-20 rounded border border-gray-300 cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={projectData.ColorFondo2}
                                    onChange={(e) => setProjectData({ ...projectData, ColorFondo2: e.target.value })}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Color Letra</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={projectData.ColorLetra}
                                    onChange={(e) => setProjectData({ ...projectData, ColorLetra: e.target.value })}
                                    className="h-10 w-20 rounded border border-gray-300 cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={projectData.ColorLetra}
                                    onChange={(e) => setProjectData({ ...projectData, ColorLetra: e.target.value })}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* User Settings Card */}
                <div className="bg-white rounded-lg shadow p-6 space-y-6">
                    <h2 className="text-xl font-semibold text-gray-800 border-b pb-3">Información del Usuario</h2>

                    {/* Email (Read-only) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Correo Electrónico</label>
                        <input
                            type="email"
                            value={userData.CorreoElectronico}
                            disabled
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                        />
                    </div>

                    {/* User Name */}
                    <Input
                        label="Nombre"
                        value={userData.Usuario}
                        onChange={(e) => setUserData({ ...userData, Usuario: e.target.value })}
                    />

                    {/* Phone */}
                    <Input
                        label="Teléfono"
                        value={userData.Telefono}
                        onChange={(e) => setUserData({ ...userData, Telefono: e.target.value })}
                    />
                </div>

                {/* Message */}
                {message && (
                    <div className={`p-4 rounded-lg ${message.includes('exitosamente')
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                        }`}>
                        {message}
                    </div>
                )}

                {/* Save Button */}
                <div className="flex justify-end">
                    <Button type="submit" isLoading={isSaving}>
                        Guardar Configuración
                    </Button>
                </div>
            </form>
        </div>
    );
}
