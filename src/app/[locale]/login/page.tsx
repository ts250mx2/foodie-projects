'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import Input from '@/components/Input';
import Button from '@/components/Button';
import AuthFooter from '@/components/AuthFooter';
import GeoShape from '@/components/brand/GeoShape';
import { useTranslations, useLocale } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';

// Paleta del PDF (hex explícitos: los vars --color-brand-green/orange están cruzados en globals.css)
const BLUE = '#3b3be8';
const GREEN = '#34b14a';
const ORANGE = '#f4481e';
const YELLOW = '#f8e14c';
const CREAM = '#f5efe1';

export default function LoginPage() {
    const t = useTranslations('Auth');
    const locale = useLocale();
    const [formData, setFormData] = useState({ identifier: '', password: '' });
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
                if (data.project) localStorage.setItem('project', JSON.stringify(data.project));
                
                // Agregamos isEmployee e isAdmin al objeto user
                const userObj = {
                    ...data.user,
                    isEmployee: data.isEmployee || false
                };
                localStorage.setItem('user', JSON.stringify(userObj));
                
                // Guardamos permisos
                if (data.permissions) {
                    localStorage.setItem('permissions', JSON.stringify(data.permissions));
                } else {
                    localStorage.removeItem('permissions');
                }

                setTimeout(() => { window.location.href = `/${locale}/dashboard`; }, 1000);
            } else {
                let errorMsg = data.message;
                if (data.message === 'Credenciales inválidas' || data.message === 'Usuario no encontrado') {
                    errorMsg = t('invalidCredentials');
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
        <div className="relative min-h-screen flex overflow-hidden" style={{ backgroundColor: CREAM }}>
            {/* ── Language Switcher top-right ── */}
            <div className="absolute top-4 right-4 z-30 text-gray-800">
                <LanguageSwitcher />
            </div>

            {/* ── Logo top-left ── */}
            <div className="absolute top-0 left-0 z-30 rounded-br-[3.5rem] px-8 py-5 shadow-md flex items-center justify-center"
                style={{ backgroundColor: CREAM }}>
                <Image
                    src="/images/foodie-solutions-logo.png"
                    alt="Foodie Solutions"
                    width={140}
                    height={60}
                    priority
                    className="h-auto object-contain"
                />
            </div>

            {/* ───────────────────── Panel de marca (desktop) ───────────────────── */}
            <aside className="relative hidden lg:flex lg:w-1/2 overflow-hidden" style={{ backgroundColor: GREEN }}>
                {/* Banda azul diagonal superior (pendiente suave, baja un poco hacia la derecha) */}
                <div
                    className="absolute inset-x-0 top-0 h-[26%]"
                    style={{ backgroundColor: BLUE, clipPath: 'polygon(0 0, 100% 0, 100% 62%, 0 100%)' }}
                />

                {/* Círculo naranja — centro en la esquina inf-der, solo el cuarto sup-izq es visible (25%) */}
                <div className="absolute rounded-full pointer-events-none" style={{ backgroundColor: ORANGE, width: 700, height: 700, right: '-350px', bottom: '-450px' }} />
                {/* Pequeño arco amarillo — apenas asomando por el borde inferior derecho (bajado un 70% más) */}
                <div className="absolute rounded-full pointer-events-none" style={{ backgroundColor: YELLOW, width: 160, height: 160, right: '-80px', bottom: '-153px' }} />

                {/* Contenido */}
                <div className="relative flex w-full flex-col justify-between px-12 pt-12 pb-36 xl:px-16 xl:pt-16 xl:pb-36">
                    {/* Espaciador para empujar contenido hacia abajo ahora que el logo está en la esquina superior izquierda */}
                    <div className="h-16" />

                    <div className="-mt-6">
                        <h2 className="brand-display drop-shadow-sm text-6xl xl:text-7xl 2xl:text-8xl" style={{ color: '#ffffff' }}>
                            Ser<br />Restaurantero<br />es un arte
                        </h2>
                        <p className="font-brand mt-6 text-base xl:text-lg font-bold uppercase tracking-wide leading-snug" style={{ color: 'rgba(255,255,255,0.95)' }}>
                            ADMINISTRADOR MASTER DE RESTAURANTES
                        </p>
                    </div>

                    <span className="font-brand text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: 'rgba(255,255,255,0.85)' }}>
                        Despacho de consultoría de restaurantes
                    </span>
                </div>
            </aside>

            {/* ───────────────────── Panel del formulario (fondo crema = root) ───────────────────── */}
            <main className="relative z-20 flex w-full items-center justify-center p-6 sm:p-10 lg:w-1/2">
                {/* Cuarto de círculo verde — esquina superior derecha (hecho un poco más grande) */}
                <GeoShape variant="quarter-bl" color={GREEN} size={320} className="absolute right-0 top-0" />

                {/* Logo removido de esta sección ya que el de la esquina superior izquierda (z-30) cubre toda la interfaz */}

                {/* Acentos para móvil (no hay panel de marca) */}
                <GeoShape variant="circle" color={ORANGE} size={64} className="absolute bottom-8 left-8 opacity-80 lg:hidden" />
                <GeoShape variant="donut" color={BLUE} size={56} ring={12} className="absolute bottom-24 right-10 opacity-80 lg:hidden" />

                <div className="relative z-10 w-full max-w-md">
                    {/* Encabezado / logo */}
                    <div className="mb-7 flex flex-col items-center text-center">
                        <h1 className="brand-display mt-4 text-4xl" style={{ color: '#0a0a0a' }}>
                            Bienvenido
                        </h1>
                        <p className="mt-1 text-sm text-gray-500">{t('loginTitle')}</p>
                    </div>

                    {/* Tarjeta del formulario */}
                    <div className="rounded-3xl border border-black/5 bg-white p-8 shadow-xl" style={{ boxShadow: '0 20px 45px -20px rgba(59,59,232,0.25)' }}>
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
                                <Link href="/forgot-password" className="text-sm font-medium hover:underline" style={{ color: BLUE }}>
                                    {t('forgotPassword') || '¿Olvidaste tu contraseña?'}
                                </Link>
                            </div>

                            {message && (
                                <div
                                    className="rounded-xl p-4 text-sm font-medium"
                                    style={isSuccess
                                        ? { backgroundColor: 'rgba(52,177,74,0.12)', color: GREEN }
                                        : { backgroundColor: 'rgba(244,72,30,0.12)', color: ORANGE }}
                                >
                                    {message}
                                </div>
                            )}

                            <Button
                                type="submit"
                                isLoading={isLoading}
                                className="w-full !h-12 !rounded-xl !text-base font-bold uppercase tracking-wide"
                                style={{ background: BLUE, color: '#fff' }}
                            >
                                {t('submitLogin')}
                            </Button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-sm text-gray-600">
                                {t('noAccount')}{' '}
                                <Link href="/register" className="font-semibold transition-colors hover:underline" style={{ color: BLUE }}>
                                    {t('registerLink')}
                                </Link>
                            </p>
                        </div>
                    </div>

                    {/* Volver al inicio */}
                    <div className="mt-6 text-center">
                        <Link href="/" className="text-sm text-gray-500 transition-colors hover:text-gray-800">
                            ← {t('backToHome')}
                        </Link>
                    </div>

                    <AuthFooter />
                </div>
            </main>

            {/* ── Composición geométrica anclada al borde inferior, montada sobre la división ── */}
            {/* Se anclan con `bottom` (no top%) para que siempre queden abajo y cortadas, sin */}
            {/* importar el alto de la pantalla; el centro horizontal se fija con calc(% - mitad). */}
            <div className="pointer-events-none absolute inset-0 z-[15] hidden lg:block">
                {/* Rectángulo amarillo vertical — panel derecho, esquina inferior izquierda (más cuadrado, más ancho, alineado y pegado a la mitad) */}
                <div className="absolute" style={{ backgroundColor: YELLOW, width: 180, height: 180, borderRadius: '1rem', left: '50%', bottom: '20px' }} />
                {/* Círculo azul — centrado bajo el cuadro amarillo, justo tocándose, más ancho */}
                <div className="absolute rounded-full" style={{ backgroundColor: BLUE, width: 160, height: 160, left: 'calc(50% + 10px)', bottom: '-140px' }} />
            </div>

            {/* Powered by — esquina inferior derecha */}
            <div className="absolute bottom-4 right-6 z-20 text-right pointer-events-none hidden sm:block">
                <p className="font-brand text-[8px] font-bold uppercase tracking-widest text-gray-400">
                    Powered by:
                </p>
                <Image
                    src="/images/foodie-guru-logo.png"
                    alt="Foodie Gurú"
                    width={75}
                    height={32}
                    className="ml-auto h-auto object-contain"
                />
                <p className="font-brand text-[8px] font-bold uppercase tracking-widest text-gray-400 mt-0.5" style={{ color: '#9ca3af' }}>
                    Despacho de consultoría de restaurantes
                </p>
            </div>
        </div>
    );
}
