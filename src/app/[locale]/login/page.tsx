'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { useTranslations } from 'next-intl';

export default function LoginPage() {
    const router = useRouter();
    const t = useTranslations('Auth');
    const [formData, setFormData] = useState({
        identifier: '',
        password: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrors({});
        setMessage('');

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (data.success) {
                setMessage(t('loginSuccess'));
                // Store user and project data in localStorage
                if (data.project) {
                    localStorage.setItem('project', JSON.stringify(data.project));
                }
                localStorage.setItem('user', JSON.stringify(data.user));
                setTimeout(() => router.push('/dashboard'), 1000);
            } else {
                // Map server error messages to translations if possible, or fallback
                let errorMsg = data.message;
                if (data.message === 'Credenciales inválidas' || data.message === 'Usuario no encontrado') {
                    errorMsg = t('invalidCredentials'); // Simplify to generic invalid credentials for security or map specific
                    if (data.message === 'Usuario no encontrado') errorMsg = t('userNotFound');
                }
                setMessage(errorMsg || t('invalidCredentials'));

                if (data.errors) {
                    const newErrors: Record<string, string> = {};
                    data.errors.forEach((error: any) => {
                        newErrors[error.path[0]] = error.message;
                    });
                    setErrors(newErrors);
                }
            }
        } catch (error) {
            setMessage(t('connectionError'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo/Title */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent mb-2">
                        Foodie Guru
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">{t('loginTitle')}</p>
                </div>

                {/* Login Card */}
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <Input
                            label={t('identifier')}
                            type="text"
                            value={formData.identifier}
                            onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
                            error={errors.identifier}
                            required
                            placeholder={t('identifier')}
                        />

                        <Input
                            label={t('password')}
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            error={errors.password}
                            required
                            placeholder="••••••••"
                        />

                        <div className="flex justify-end">
                            <Link href="/forgot-password" className="text-sm text-orange-500 hover:text-orange-600 font-medium hover:underline">
                                {t('forgotPassword') || '¿Olvidaste tu contraseña?'}
                            </Link>
                        </div>

                        {message && (
                            <div className={`p-4 rounded-lg ${message.includes('exitoso')
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                {message}
                            </div>
                        )}

                        <Button type="submit" isLoading={isLoading} className="w-full">
                            {t('submitLogin')}
                        </Button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-gray-600 dark:text-gray-400">
                            {t('noAccount')}{' '}
                            <Link href="/register" className="text-orange-500 hover:text-orange-600 font-medium transition-colors">
                                {t('registerLink')}
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Back to Home */}
                <div className="mt-6 text-center">
                    <Link href="/" className="text-gray-600 dark:text-gray-400 hover:text-orange-500 transition-colors">
                        ← {t('backToHome')}
                    </Link>
                </div>
            </div>
        </div>
    );
}
