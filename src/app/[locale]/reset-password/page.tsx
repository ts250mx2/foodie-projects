'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation'; // Use standard hook for query params
import { Link } from '@/i18n/navigation';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { useTranslations, useLocale } from 'next-intl';

export default function ResetPasswordPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const t = useTranslations('Auth');
    const locale = useLocale();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setMessage(locale === 'en' ? 'Passwords do not match' : 'Las contraseñas no coinciden');
            return;
        }

        if (!token) {
            setMessage(locale === 'en' ? 'Missing token' : 'Token faltante');
            return;
        }

        setIsLoading(true);
        setMessage('');

        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });

            const data = await response.json();

            if (data.success) {
                setIsSuccess(true);
                setMessage(locale === 'en' ? 'Password updated successfully! Redirecting...' : 'Contraseña actualizada exitosamente! Redirigiendo...');
                setTimeout(() => router.push(`/${locale}/login`), 2000);
            } else {
                setMessage(data.message || (locale === 'en' ? 'Error resetting password' : 'Error al restablecer la contraseña'));
            }

        } catch (error) {
            setMessage(locale === 'en' ? 'Connection error' : 'Error de conexión');
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="text-center">
                    <h1 className="text-xl text-red-500 mb-4">{locale === 'en' ? 'Invalid Link' : 'Enlace Inválido'}</h1>
                    <Link href="/login" className="text-orange-500 hover:underline">
                        {locale === 'en' ? 'Go to Login' : 'Ir a Iniciar Sesión'}
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent mb-2">
                        Foodie Guru
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        {locale === 'en' ? 'Set New Password' : 'Crear Nueva Contraseña'}
                    </p>
                </div>

                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <Input
                            label={t('password')}
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                        />

                        <Input
                            label={t('repeatPassword')}
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                        />

                        {message && (
                            <div className={`p-4 rounded-lg ${isSuccess
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                {message}
                            </div>
                        )}

                        <Button type="submit" isLoading={isLoading} className="w-full">
                            {locale === 'en' ? 'Update Password' : 'Actualizar Contraseña'}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
