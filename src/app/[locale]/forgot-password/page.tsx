'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { useTranslations, useLocale } from 'next-intl';

export default function ForgotPasswordPage() {
    const router = useRouter();
    const t = useTranslations('Auth');
    const locale = useLocale();
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage('');
        setIsSuccess(false);

        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, locale }),
            });

            const data = await response.json();

            // Always show success message for security
            setIsSuccess(true);
            setMessage(locale === 'en'
                ? 'If an account exists with this email, you will receive a reset link shortly.'
                : 'Si existe una cuenta con este correo, recibirás un enlace de recuperación en breve.');

        } catch (error) {
            setMessage(locale === 'en' ? 'Connection error. Please try again.' : 'Error de conexión. Intenta nuevamente.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent mb-2">
                        Foodie Guru
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        {locale === 'en' ? 'Reset Password' : 'Recuperar Contraseña'}
                    </p>
                </div>

                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <Input
                            label={t('email')}
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="tu@email.com"
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
                            {locale === 'en' ? 'Send Reset Link' : 'Enviar Enlace'}
                        </Button>
                    </form>

                    <div className="mt-6 text-center">
                        <Link href="/login" className="text-gray-600 dark:text-gray-400 hover:text-orange-500 transition-colors">
                            ← {locale === 'en' ? 'Back to Login' : 'Volver a Iniciar Sesión'}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
