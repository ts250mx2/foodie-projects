'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter, Link } from '@/i18n/navigation';
import Input from '@/components/Input';
import PhoneInput from '@/components/PhoneInput';
import CountrySelect from '@/components/CountrySelect';
import Button from '@/components/Button';
import AuthFooter from '@/components/AuthFooter';
import GeoShape from '@/components/brand/GeoShape';
import { useTranslations, useLocale } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';

// Paleta del PDF — misma que en login/page.tsx y landing page
const BLUE   = '#3b3be8';
const GREEN  = '#34b14a';
const ORANGE = '#f4481e';
const YELLOW = '#f8e14c';
const CREAM  = '#f5efe1';

const idiomas = ['Español', 'English', 'Português', 'Français', 'Deutsch'];

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
                locale,
            };

            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (data.success) {
                setMessage('¡Registro exitoso! Redirigiendo al login...');
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
        } catch {
            setMessage('Error de conexión. Intenta nuevamente.');
        } finally {
            setIsLoading(false);
        }
    };

    const isSuccess = message.includes('exitoso') || message.includes('Registro exitoso');

    // Estilo compartido para el select de idioma (match con Input component)
    const selectStyle: React.CSSProperties = {
        width: '100%',
        padding: '0.625rem 1rem',
        borderRadius: '0.75rem',
        border: '1.5px solid #e5e7eb',
        backgroundColor: '#ffffff',
        color: '#0a0a0a',
        fontSize: '0.875rem',
        outline: 'none',
        transition: 'border-color 150ms',
        appearance: 'none',
        WebkitAppearance: 'none',
        MozAppearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.75rem center',
        paddingRight: '2.5rem',
    };

    return (
        <div className="relative min-h-screen flex overflow-hidden" style={{ backgroundColor: CREAM }}>

            {/* ── Language Switcher top-right ── */}
            <div className="absolute top-4 right-4 z-30 text-gray-800">
                <LanguageSwitcher />
            </div>

            {/* ── Logo top-left (sobre todo) ── */}
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

            {/* ───────────────────── Panel de marca (desktop izquierda) ───────────────────── */}
            <aside className="relative hidden lg:flex lg:w-[42%] overflow-hidden flex-col"
                style={{ backgroundColor: ORANGE }}>

                {/* Banda azul diagonal superior */}
                <div
                    className="absolute inset-x-0 top-0 h-[28%]"
                    style={{ backgroundColor: BLUE, clipPath: 'polygon(0 0, 100% 0, 100% 58%, 0 100%)' }}
                />

                {/* Círculo verde grande — esquina inf-der, solo el cuarto sup-izq visible */}
                <div className="absolute rounded-full pointer-events-none"
                    style={{ backgroundColor: GREEN, width: 600, height: 600, right: '-300px', bottom: '-380px' }} />

                {/* Arco amarillo pequeño — asomando en esquina inferior derecha */}
                <div className="absolute rounded-full pointer-events-none"
                    style={{ backgroundColor: YELLOW, width: 140, height: 140, right: '-70px', bottom: '-120px' }} />

                {/* Formas decorativas izquierda — ancladas al borde */}
                <div className="pointer-events-none absolute z-10"
                    style={{ left: '-80px', top: '55%', transform: 'translateY(-50%)' }}>
                    <GeoShape variant="half-right" color={YELLOW} size={180} />
                </div>

                {/* Contenido del panel */}
                <div className="relative z-10 flex w-full flex-col justify-between px-12 py-12 xl:px-16 xl:py-16 h-full">
                    {/* Espaciador para bajar el texto debajo del logo */}
                    <div className="h-20" />

                    <div className="-mt-4">
                        <h2 className="brand-display drop-shadow-sm text-5xl xl:text-6xl 2xl:text-7xl leading-none"
                            style={{ color: '#ffffff' }}>
                            Empieza<br />tu negocio<br />hoy
                        </h2>
                        <p className="font-brand mt-6 text-sm xl:text-base font-bold uppercase tracking-wide leading-snug"
                            style={{ color: 'rgba(255,255,255,0.95)' }}>
                            ADMINISTRADOR MASTER DE RESTAURANTES
                        </p>

                        {/* Steps resumidos */}
                        <div className="mt-8 space-y-3">
                            {[
                                { n: '01', label: 'Registra tu proyecto' },
                                { n: '02', label: 'Configura tus sucursales' },
                                { n: '03', label: 'Controla todo desde un solo lugar' },
                            ].map(({ n, label }) => (
                                <div key={n} className="flex items-center gap-3">
                                    <span className="font-brand text-xs font-bold"
                                        style={{ color: 'rgba(255,255,255,0.5)' }}>
                                        {n}
                                    </span>
                                    <span className="font-brand text-sm font-semibold"
                                        style={{ color: 'rgba(255,255,255,0.9)' }}>
                                        {label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <span className="font-brand text-[11px] font-bold uppercase tracking-[0.08em]"
                        style={{ color: 'rgba(255,255,255,0.75)' }}>
                        Despacho de consultoría de restaurantes
                    </span>
                </div>
            </aside>

            {/* ───────────────────── Panel del formulario (crema) ───────────────────── */}
            <main className="relative z-20 flex w-full items-start justify-center overflow-y-auto p-6 sm:p-8 pt-24 pb-10 lg:w-[58%]">

                {/* Cuarto de círculo azul — esquina superior derecha */}
                <GeoShape variant="quarter-bl" color={BLUE} size={280} className="absolute right-0 top-0 opacity-90" />

                {/* Acentos móvil */}
                <GeoShape variant="circle" color={ORANGE} size={56} className="absolute bottom-10 left-6 opacity-70 lg:hidden" />
                <GeoShape variant="donut" color={GREEN} size={48} ring={10} className="absolute bottom-24 right-8 opacity-60 lg:hidden" />

                <div className="relative z-10 w-full max-w-xl">

                    {/* Encabezado del formulario */}
                    <div className="mb-6 flex flex-col items-center text-center">
                        <h1 className="brand-display mt-2 text-4xl" style={{ color: '#0a0a0a' }}>
                            Crear cuenta
                        </h1>
                        <p className="mt-1.5 text-sm text-gray-500">{t('registerTitle')}</p>
                    </div>

                    {/* Tarjeta del formulario */}
                    <div className="rounded-3xl border border-black/5 bg-white p-6 sm:p-8 shadow-xl"
                        style={{ boxShadow: '0 20px 45px -20px rgba(244,72,30,0.20)' }}>
                        <form onSubmit={handleSubmit} className="space-y-5">

                            {/* ── Sección: Proyecto ── */}
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="h-5 w-1 rounded-full" style={{ backgroundColor: ORANGE }} />
                                    <h2 className="font-brand text-xs font-bold uppercase tracking-widest text-gray-500">
                                        Información del Proyecto
                                    </h2>
                                </div>

                                <div className="space-y-4">
                                    <Input
                                        label={t('project')}
                                        type="text"
                                        value={formData.nombreProyecto}
                                        onChange={(e) => setFormData({ ...formData, nombreProyecto: e.target.value })}
                                        error={errors.nombreProyecto}
                                        required
                                        placeholder="Mi Restaurante"
                                    />

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <CountrySelect
                                            label={t('country')}
                                            value={formData.pais}
                                            onChange={(value) => setFormData({ ...formData, pais: value })}
                                            error={errors.pais}
                                            placeholder={t('country')}
                                        />

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                {t('language')}
                                            </label>
                                            <select
                                                value={formData.idioma}
                                                onChange={(e) => setFormData({ ...formData, idioma: e.target.value })}
                                                style={selectStyle}
                                                required
                                            >
                                                <option value="">Selecciona idioma</option>
                                                {idiomas.map((idioma) => (
                                                    <option key={idioma} value={idioma}>{idioma}</option>
                                                ))}
                                            </select>
                                            {errors.idioma && (
                                                <p className="mt-1 text-xs" style={{ color: ORANGE }}>{errors.idioma}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Divisor */}
                            <div className="relative my-1">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-100" />
                                </div>
                            </div>

                            {/* ── Sección: Usuario ── */}
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="h-5 w-1 rounded-full" style={{ backgroundColor: BLUE }} />
                                    <h2 className="font-brand text-xs font-bold uppercase tracking-widest text-gray-500">
                                        Información de Usuario
                                    </h2>
                                </div>

                                <div className="space-y-4">
                                    <Input
                                        label={t('user')}
                                        type="text"
                                        value={formData.nombreUsuario}
                                        onChange={(e) => setFormData({ ...formData, nombreUsuario: e.target.value })}
                                        error={errors.nombreUsuario}
                                        required
                                        placeholder="Juan Pérez"
                                    />

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                            </div>

                            {/* Mensaje de estado */}
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

                            {/* Botón submit */}
                            <Button
                                type="submit"
                                isLoading={isLoading}
                                className="w-full !h-12 !rounded-xl !text-base font-bold uppercase tracking-wide"
                                style={{ background: ORANGE, color: '#fff' }}
                            >
                                {t('submitRegister')}
                            </Button>

                            {/* Aviso de privacidad */}
                            <p className="text-center text-xs text-gray-400">
                                Al registrarte, aceptas nuestro{' '}
                                <Link href="/privacy-policy"
                                    className="font-semibold hover:underline transition-colors"
                                    style={{ color: BLUE }}>
                                    Aviso de Privacidad
                                </Link>
                            </p>
                        </form>

                        {/* ¿Ya tienes cuenta? */}
                        <div className="mt-5 text-center">
                            <p className="text-sm text-gray-600">
                                {t('hasAccount')}{' '}
                                <Link href="/login"
                                    className="font-semibold transition-colors hover:underline"
                                    style={{ color: BLUE }}>
                                    {t('loginLink')}
                                </Link>
                            </p>
                        </div>
                    </div>

                    {/* Volver al inicio */}
                    <div className="mt-5 text-center">
                        <Link href="/" className="text-sm text-gray-500 transition-colors hover:text-gray-800">
                            ← {t('backToHome')}
                        </Link>
                    </div>

                    <AuthFooter />
                </div>
            </main>

            {/* ── Composición geométrica en la división desktop ── */}
            <div className="pointer-events-none absolute inset-0 z-[15] hidden lg:block">
                {/* Rectángulo naranja vertical — pegado a la mitad, esquina inferior */}
                <div className="absolute" style={{ backgroundColor: ORANGE, width: 160, height: 160, borderRadius: '1rem', left: '42%', bottom: '24px', transform: 'translateX(-50%)' }} />
                {/* Círculo azul — centrado bajo el cuadro */}
                <div className="absolute rounded-full" style={{ backgroundColor: BLUE, width: 140, height: 140, left: 'calc(42% + 8px)', bottom: '-130px', transform: 'translateX(-50%)' }} />
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
                <p className="font-brand text-[8px] font-bold uppercase tracking-widest mt-0.5" style={{ color: '#9ca3af' }}>
                    Despacho de consultoría de restaurantes
                </p>
            </div>
        </div>
    );
}
