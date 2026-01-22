'use client';

import { useState, useEffect } from 'react';
import Button from './Button';
import Input from './Input';

interface EmployeeAccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    employeeId: number;
    employeeName: string;
    projectId: number;
}

export default function EmployeeAccessModal({
    isOpen,
    onClose,
    employeeId,
    employeeName,
    projectId
}: EmployeeAccessModalProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [domain, setDomain] = useState('');
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        repeatPassword: '',
        isAdmin: false
    });
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && employeeId) {
            fetchAccessData();
        }
    }, [isOpen, employeeId]);

    const fetchAccessData = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch(`/api/employees/${employeeId}/access?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                setDomain(data.domain || '');
                setFormData({
                    username: data.username || '',
                    password: '',
                    repeatPassword: '',
                    isAdmin: data.isAdmin || false
                });
            }
        } catch (error) {
            console.error('Error fetching access data:', error);
            setError('Error al cargar los datos de acceso');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validate passwords match
        if (formData.password !== formData.repeatPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        // Validate password is provided for new access or when changing
        if (!formData.username && !formData.password) {
            setError('El usuario y contraseña son requeridos');
            return;
        }

        setIsSaving(true);
        try {
            const response = await fetch(`/api/employees/${employeeId}/access`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    username: formData.username,
                    password: formData.password,
                    isAdmin: formData.isAdmin
                })
            });

            const data = await response.json();
            if (response.ok && data.success) {
                onClose();
            } else {
                setError(data.message || 'Error al guardar el acceso');
            }
        } catch (error) {
            console.error('Error saving access:', error);
            setError('Error al guardar el acceso');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-lg">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">
                        Acceso - {employeeName}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
                        ×
                    </button>
                </div>

                {isLoading ? (
                    <div className="text-center py-8 text-gray-500">Cargando...</div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Usuario
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    placeholder="usuario"
                                    required
                                />
                                <span className="text-gray-600 font-medium">@{domain}</span>
                            </div>
                        </div>

                        <Input
                            label="Contraseña"
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            required={!formData.username}
                            placeholder="••••••••"
                        />

                        <Input
                            label="Repetir Contraseña"
                            type="password"
                            value={formData.repeatPassword}
                            onChange={(e) => setFormData({ ...formData, repeatPassword: e.target.value })}
                            required={!formData.username}
                            placeholder="••••••••"
                        />

                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                            <span className="text-sm font-medium text-gray-700">Es Administrador</span>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, isAdmin: !formData.isAdmin })}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${formData.isAdmin ? 'bg-orange-500' : 'bg-gray-200'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isAdmin ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                            >
                                Cancelar
                            </button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? 'Guardando...' : 'Guardar'}
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
