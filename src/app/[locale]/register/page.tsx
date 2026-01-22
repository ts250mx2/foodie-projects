'use client';

import { useState } from 'react';
import { useRouter, Link } from '@/i18n/navigation';
import Input from '@/components/Input';
import PhoneInput from '@/components/PhoneInput';
import CountrySelect from '@/components/CountrySelect';
import Button from '@/components/Button';
import { useTranslations, useLocale } from 'next-intl';



const idiomas = [
    'Español', 'English', 'Português', 'Français', 'Deutsch'
];

export default function RegisterPage() {
    const router = useRouter();
    const t = useTranslations('Auth');
    const locale = useLocale();
    const [formData, setFormData] = useState({
        nombreProyecto: '',
        nombreUsuario: '',
        correoElectronico: '',
        telefono: '',
        password: '',
        repetirPassword: '',
        pais: '',
        phoneCode: '52',
        idioma: '',
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
            const payload = {
                ...formData,
                telefono: `+${formData.phoneCode}${formData.telefono}`,
                locale
            };

            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (data.success) {
                setMessage('Registro exitoso! Redirigiendo al login...');
                setTimeout(() => router.push('/login'), 2000);
            } else {
                setMessage(data.message || 'Error en el registro');
                if (data.errors) {
                    const newErrors: Record<string, string> = {};
                    data.errors.forEach((error: any) => {
                        newErrors[error.path[0]] = error.message;
                    });
                    setErrors(newErrors);
                }
            }
        } catch (error) {
            setMessage('Error de conexión. Intenta nuevamente.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4 py-12">
            <div className="w-full max-w-2xl">
                {/* Logo/Title */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent mb-2">
                        Foodie Guru
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">{t('registerTitle')}</p>
                </div>

                {/* Registration Card */}
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Project Info */}
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Información del Proyecto</h2>

                            <Input
                                label={t('project')}
                                type="text"
                                value={formData.nombreProyecto}
                                onChange={(e) => setFormData({ ...formData, nombreProyecto: e.target.value })}
                                error={errors.nombreProyecto}
                                required
                                placeholder="Mi Restaurante"
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <CountrySelect
                                    label={t('country')}
                                    value={formData.pais}
                                    onChange={(value) => setFormData({ ...formData, pais: value })}
                                    error={errors.pais}
                                    placeholder={t('country')}
                                />

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        {t('language')}
                                    </label>
                                    <select
                                        value={formData.idioma}
                                        onChange={(e) => setFormData({ ...formData, idioma: e.target.value })}
                                        className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-orange-500 dark:border-gray-600 dark:focus:border-orange-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-200"
                                        required
                                    >
                                        <option value="">Selecciona/Idioma</option>
                                        {idiomas.map((idioma) => (
                                            <option key={idioma} value={idioma}>{idioma}</option>
                                        ))}
                                    </select>
                                    {errors.idioma && <p className="mt-1 text-sm text-red-500">{errors.idioma}</p>}
                                </div>
                            </div>
                        </div>

                        {/* User Info */}
                        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Información de Usuario</h2>

                            <Input
                                label={t('user')}
                                type="text"
                                value={formData.nombreUsuario}
                                onChange={(e) => setFormData({ ...formData, nombreUsuario: e.target.value })}
                                error={errors.nombreUsuario}
                                required
                                placeholder="Juan Pérez"
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label={t('email')}
                                    type="email"
                                    value={formData.correoElectronico}
                                    onChange={(e) => setFormData({ ...formData, correoElectronico: e.target.value })}
                                    error={errors.correoElectronico}
                                    required
                                    placeholder="tu@email.com"
                                />

                                <PhoneInput
                                    label={t('phone')}
                                    value={formData.telefono}
                                    onChange={(value) => setFormData({ ...formData, telefono: value })}
                                    countryCode={formData.phoneCode}
                                    onCountryCodeChange={(code) => setFormData({ ...formData, phoneCode: code })}
                                    error={errors.telefono}
                                    placeholder="1234567890"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label={t('password')}
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    error={errors.password}
                                    required
                                    placeholder="••••••••"
                                />

                                <Input
                                    label={t('repeatPassword')}
                                    type="password"
                                    value={formData.repetirPassword}
                                    onChange={(e) => setFormData({ ...formData, repetirPassword: e.target.value })}
                                    error={errors.repetirPassword}
                                    required
                                    placeholder="••••••••"
                                />
                            </div>
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
                            {t('submitRegister')}
                        </Button>

                        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                            Al registrarte, aceptas nuestro{' '}
                            <Link href="/privacy-policy" className="text-orange-500 hover:text-orange-600 font-medium transition-colors">
                                Aviso de Privacidad
                            </Link>
                        </p>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-gray-600 dark:text-gray-400">
                            {t('hasAccount')}{' '}
                            <Link href="/login" className="text-orange-500 hover:text-orange-600 font-medium transition-colors">
                                {t('loginLink')}
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Back to Home */}
                <div className="mt-6 text-center">
                    <Link href="/" className="text-gray-600 dark:text-gray-400 hover:text-orange-500 transition-colors">
                        ← Volver al inicio
                    </Link>
                </div>
            </div>
        </div>
    );
}
