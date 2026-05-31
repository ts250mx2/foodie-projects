'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import Input from '@/components/Input';
import Button from '@/components/Button';
import AuthFooter from '@/components/AuthFooter';
import GeoShape from '@/components/brand/GeoShape';
import { useTranslations, useLocale } from 'next-intl';

export default function LoginPage() {
    const t = useTranslations('Auth');
    const locale = useLocale();
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
                setTimeout(() => {
                    window.location.href = `/${locale}/dashboard`;
                }, 1000);
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
                    data.errors.forEach((error: { path: (string | number)[]; message: string }) => {
                        newErrors[error.path[0]] = error.message;
                    });
                    setErrors(newErrors);
                }
            }
        } catch {
            setMessage(t('connectionError'));
        } finally {
            setIsLoading(false);
        }
    };

    const isSuccess = message.includes('exitoso');

    return (
        <div className="min-h-screen flex bg-brand-cream">
            {/* ───────────────────── Panel de marca (desktop) ───────────────────── */}
            <aside className="relative hidden lg:flex lg:w-1/2 overflow-hidden bg-brand-blue">
                {/* Composición Bauhaus */}
                <GeoShape variant="half-bottom" color="var(--color-brand-green)" size={360} className="absolute -top-12 -left-16" />
                <GeoShape variant="donut" color="var(--color-brand-yellow)" size={96} ring={18} className="absolute top-20 right-24" />
                <GeoShape variant="quarter-br" color="var(--color-brand-yellow)" size={200} className="absolute top-1/2 right-0 -translate-y-1/2" />
                <GeoShape variant="circle" color="var(--color-brand-orange)" size={128} className="absolute bottom-28 left-24" />
                <GeoShape variant="half-top" color="var(--color-brand-green)" size={280} className="absolute -bottom-12 right-12" />

                {/* Contenido */}
                <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">
                    <span className="brand-wordmark text-2xl text-white">
                        Foodie Gurú<sup className="text-[0.5em] align-super">®</sup>
                    </span>

                    <div>
                        <h2 className="brand-display text-6xl xl:text-7xl text-white drop-shadow-sm">
                            Ser<br />Restaurantero<br />es un arte
                        </h2>
                        <p className="mt-6 max-w-xs font-brand text-xs font-semibold uppercase tracking-[0.2em] text-white/75">
                            Para romper las reglas<br />hay que conocerlas
                        </p>
                    </div>

                    <span className="font-brand text-[11px] font-medium uppercase tracking-[0.25em] text-white/60">
                        Despacho de consultoría de restaurantes
                    </span>
                </div>
            </aside>

            {/* ───────────────────── Panel del formulario ───────────────────── */}
            <main className="relative flex w-full items-center justify-center overflow-hidden p-6 sm:p-10 lg:w-1/2">
                {/* Acento geométrico (sutil, visible sobre todo en móvil) */}
                <GeoShape variant="quarter-tr" color="var(--color-brand-yellow)" size={140} className="absolute right-0 top-0 opacity-90 lg:opacity-40" />
                <GeoShape variant="circle" color="var(--color-brand-blue)" size={72} className="absolute bottom-8 left-8 opacity-80 lg:hidden" />

                <div className="relative z-10 w-full max-w-md">
                    {/* Encabezado / logo */}
                    <div className="mb-8 flex flex-col items-center text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-md">
                            <Image
                                src="/images/foodie-guru-logo.png"
                                alt="Foodie Gurú"
                                width={48}
                                height={48}
                                priority
                                className="object-contain"
                            />
                        </div>
                        <h1 className="brand-display text-3xl text-brand-black">
                            Bienvenido
                        </h1>
                        <p className="mt-1 text-sm text-gray-500">{t('loginTitle')}</p>
                    </div>

                    {/* Tarjeta del formulario */}
                    <div className="rounded-3xl border border-black/5 bg-white p-8 shadow-xl shadow-brand-blue/5">
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
                                <Link href="/forgot-password" className="text-sm font-medium text-brand-blue hover:underline">
                                    {t('forgotPassword') || '¿Olvidaste tu contraseña?'}
                                </Link>
                            </div>

                            {message && (
                                <div
                                    className={`rounded-xl p-4 text-sm font-medium ${
                                        isSuccess
                                            ? 'bg-brand-green/10 text-brand-green'
                                            : 'bg-brand-orange/10 text-brand-orange'
                                    }`}
                                >
                                    {message}
                                </div>
                            )}

                            <Button
                                type="submit"
                                isLoading={isLoading}
                                className="w-full !h-12 !rounded-xl !text-base font-bold uppercase tracking-wide"
                                style={{ background: 'var(--color-brand-orange)', color: '#fff' }}
                            >
                                {t('submitLogin')}
                            </Button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-sm text-gray-600">
                                {t('noAccount')}{' '}
                                <Link href="/register" className="font-semibold text-brand-blue transition-colors hover:underline">
                                    {t('registerLink')}
                                </Link>
                            </p>
                        </div>
                    </div>

                    {/* Volver al inicio */}
                    <div className="mt-6 text-center">
                        <Link href="/" className="text-sm text-gray-500 transition-colors hover:text-brand-blue">
                            ← {t('backToHome')}
                        </Link>
                    </div>

                    <AuthFooter />
                </div>
            </main>
        </div>
    );
}
