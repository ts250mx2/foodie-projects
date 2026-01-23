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
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);

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

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64String = reader.result as string;

                // Update local preview immediately
                setProjectData(prev => ({ ...prev, Logo64: base64String }));

                // Auto-save to backend
                try {
                    setMessage('Guardando logo...');
                    const response = await fetch('/api/project-settings', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            projectId: project.idProyecto,
                            userId: user.idUsuario,
                            projectData: {
                                ...projectData,
                                Logo64: base64String // Ensure we send the new logo
                            },
                            userData: {
                                Usuario: userData.Usuario,
                                Telefono: userData.Telefono
                            },
                            logoFile: base64String
                        })
                    });

                    const data = await response.json();
                    if (data.success) {
                        setMessage('Logo actualizado exitosamente');
                        // Dispatch event to update Header
                        window.dispatchEvent(new CustomEvent('project-logo-updated', { detail: base64String }));
                    } else {
                        setMessage('Error al guardar el logo');
                    }
                } catch (error) {
                    console.error('Error saving logo:', error);
                    setMessage('Error al guardar el logo');
                }
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

                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        {/* Logo Upload Section */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
                            <div className="flex flex-col items-start gap-4">
                                <div
                                    onClick={() => !isUploadingLogo && document.getElementById('logoInput')?.click()}
                                    className={`cursor-pointer group relative w-40 h-40 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden hover:border-orange-500 transition-colors bg-gray-50 ${isUploadingLogo ? 'opacity-75 cursor-wait' : ''}`}
                                >
                                    {isUploadingLogo ? (
                                        <div className="flex flex-col items-center">
                                            <svg className="animate-spin h-8 w-8 text-orange-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span className="text-xs text-gray-500">Subiendo...</span>
                                        </div>
                                    ) : projectData.Logo64 ? (
                                        <img
                                            src={projectData.Logo64}
                                            alt="Logo"
                                            className="w-full h-full object-contain p-2"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                                target.parentElement?.classList.add('broken-image');
                                            }}
                                        />
                                    ) : (
                                        <div className="text-center p-4">
                                            <svg className="w-10 h-10 mx-auto text-gray-400 group-hover:text-orange-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                            <span className="text-xs font-medium text-gray-500 group-hover:text-orange-500">Subir Logo</span>
                                        </div>
                                    )}

                                    {/* Overlay on hover */}
                                    {!isUploadingLogo && (
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                                        </div>
                                    )}
                                </div>

                                <input
                                    id="logoInput"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                    className="hidden"
                                />
                                <p className="text-xs text-gray-500 max-w-[10rem] text-center">
                                    Click en la imagen para actualizar el logo.
                                </p>
                            </div>
                        </div>

                        {/* Project Fields Section */}
                        <div className="flex-1 space-y-6 w-full">
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
                        </div>
                    </div>

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
