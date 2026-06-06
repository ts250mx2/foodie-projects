'use client';

import { useTranslations } from 'next-intl';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, LogOut, ChevronRight, User, CreditCard } from 'lucide-react';
import BillingModal from './BillingModal';
import LanguageSwitcher from '../LanguageSwitcher';

interface HeaderProps {
    userName: string;
    onLogout?: () => void;
    onToggleSidebar?: () => void;
}

// Mapa de segmentos de URL a etiquetas legibles
const ROUTE_LABELS: Record<string, string> = {
    dashboard: 'Dashboard',
    config: 'Configuración',
    project: 'Proyecto',
    'initial-load': 'Carga Inicial',
    taxes: 'Impuestos',
    'break-even': 'Punto de Equilibrio',
    'payment-channels': 'Canales de Pago',
    settings: 'Ajustes',
    branches: 'Sucursales',
    'document-types': 'Tipos de Documento',
    tips: 'Propinas',
    sales: 'Ventas',
    capture: 'Captura',
    'channels-capture': 'Captura por Canal',
    'terminals-capture': 'Captura por Terminal',
    'tips-capture': 'Captura de Propinas',
    channels: 'Canales',
    terminals: 'Terminales',
    platforms: 'Plataformas',
    'app-price-calculator': 'Calculadora de Precio',
    inventories: 'Inventarios',
    products: 'Productos',
    categories: 'Categorías',
    presentations: 'Presentaciones',
    'min-max': 'Mín/Máx',
    'waste-capture': 'Captura de Merma',
    production: 'Producción',
    dishes: 'Platillos',
    'raw-materials': 'Materias Primas',
    'sub-recipes': 'Subrecetas',
    'recipe-categories': 'Categorías de Receta',
    'menu-sections': 'Secciones de Menú',
    'material-explosion': 'Explosión de Materiales',
    payroll: 'Nómina',
    employees: 'Empleados',
    positions: 'Puestos',
    shifts: 'Turnos',
    schedules: 'Horarios',
    purchases: 'Compras',
    suppliers: 'Proveedores',
    'purchase-orders': 'Órdenes de Compra',
    expenses: 'Gastos',
    concepts: 'Conceptos',
    receipt: 'Recibo',
    ocr: 'OCR',
    upload: 'Subir',
    documents: 'Documentos',
    'receipt-capture': 'Captura de Recibo',
    'massive-product-upload': 'Carga Masiva',
};

function buildBreadcrumbs(pathname: string, locale: string) {
    const base = `/${locale}`;
    const relative = pathname.replace(base, '');
    const segments = relative.split('/').filter(Boolean);

    const crumbs: { label: string; href: string }[] = [
        { label: 'Inicio', href: `/${locale}/dashboard` },
    ];

    let accumulated = `/${locale}`;
    for (const seg of segments) {
        accumulated += `/${seg}`;
        const label = ROUTE_LABELS[seg] ?? seg;
        crumbs.push({ label, href: accumulated });
    }

    // Quitar el último (es la página actual) para no duplicar
    return { crumbs: crumbs.slice(0, -1), current: crumbs[crumbs.length - 1]?.label ?? '' };
}

export default function Header({ userName: initialUserName, onLogout, onToggleSidebar }: HeaderProps) {
    const t = useTranslations('Navigation');
    const router = useRouter();
    const pathname = usePathname();
    const params = useParams();
    const locale = params.locale as string;

    const [userName, setUserName] = useState(initialUserName || '');
    const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
    const [projectLogo, setProjectLogo] = useState('');
    const [projectTitle, setProjectTitle] = useState('');
    const [projectName, setProjectName] = useState('');

    const fetchProjectSettings = async (projectId: number) => {
        try {
            const response = await fetch(`/api/project-header?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                setProjectTitle(data.titulo || '');
                setProjectLogo(data.logo64 || '');
            }
        } catch { /* ignore */ }
    };

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const storedProject = localStorage.getItem('project');

        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                if (user.nombreUsuario) setUserName(user.nombreUsuario);
            } catch { /* ignore */ }
        }

        if (storedProject) {
            try {
                const project = JSON.parse(storedProject);
                if (project.nombre) setProjectName(project.nombre);
                if (project.idProyecto) fetchProjectSettings(project.idProyecto);
            } catch { /* ignore */ }
        }

        const handleLogoUpdate = (event: CustomEvent) => {
            if (event.detail) setProjectLogo(event.detail);
        };
        window.addEventListener('project-logo-updated', handleLogoUpdate as EventListener);
        return () => window.removeEventListener('project-logo-updated', handleLogoUpdate as EventListener);
    }, []);

    useEffect(() => {
        const queryParams = new URLSearchParams(window.location.search);
        if (queryParams.get('payment')) {
            setIsBillingModalOpen(true);
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('user');
        onLogout ? onLogout() : router.push('/');
    };

    const displayTitle = projectTitle || `Foodie Guru${projectName ? ` · ${projectName}` : ''}`;
    const isDashboardHome = pathname === `/${locale}/dashboard`;
    const { crumbs, current } = buildBreadcrumbs(pathname, locale);

    return (
        <header
            className="fixed top-0 left-0 right-0 h-16 z-50 flex flex-col justify-center px-4 shadow-sm text-white overflow-visible"
            style={{
                backgroundColor: 'var(--color-brand-green)'
            }}
        >
            <div className="flex items-center justify-between gap-4">
                {/* Left: hamburger + logo + title + breadcrumb */}
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        onClick={onToggleSidebar}
                        className="shrink-0 p-2 rounded-lg text-white hover:text-white hover:bg-black/15 transition-colors"
                        aria-label="Toggle Sidebar"
                    >
                        <Menu size={20} />
                    </button>

                    <div className="h-[58px] w-[58px] rounded-full bg-white border-2 border-white/80 shadow-xl overflow-hidden shrink-0 relative z-10" style={{ marginTop: '-2px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
                        <img
                            src={projectLogo || '/images/foodie-guru-logo.png'}
                            alt="Logo"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                                if (projectLogo) {
                                    setProjectLogo('');
                                } else {
                                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                                }
                             }}
                        />
                    </div>

                    <div className="flex flex-col min-w-0">
                        <span
                            className="text-sm font-bold leading-tight truncate text-white"
                        >
                            {displayTitle}
                        </span>

                        {/* Breadcrumb — solo cuando no es la home del dashboard */}
                        {!isDashboardHome && (
                            <nav className="flex items-center gap-1" aria-label="Breadcrumb">
                                {crumbs.map((crumb, i) => (
                                    <span key={i} className="flex items-center gap-1">
                                        {i > 0 && (
                                            <ChevronRight size={10} className="text-white/80" />
                                        )}
                                        <Link
                                            href={crumb.href}
                                            className="text-[11px] hover:underline whitespace-nowrap text-white/95 hover:text-white"
                                        >
                                            {crumb.label}
                                        </Link>
                                    </span>
                                ))}
                                {crumbs.length > 0 && (
                                    <>
                                        <ChevronRight size={10} className="text-white/80" />
                                        <span
                                            className="text-[11px] font-semibold whitespace-nowrap text-white"
                                        >
                                            {current}
                                        </span>
                                    </>
                                )}
                            </nav>
                        )}
                    </div>
                </div>

                {/* Right: usuario + logout */}
                <div className="flex items-center gap-2 shrink-0">
                    <LanguageSwitcher className="hidden sm:block text-white" />

                    <button
                        onClick={() => setIsBillingModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold rounded-lg border border-white/20 transition-all hover:bg-white/10 active:scale-95 text-white"
                        title="Pagar Suscripción"
                    >
                        <CreditCard size={15} />
                        <span className="hidden md:inline">Pagar</span>
                    </button>

                    <div
                        className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/15 border border-white/20 text-white text-sm"
                    >
                        <User size={14} className="text-white/90" />
                        <span className="font-medium">{userName || 'Usuario'}</span>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold rounded-lg border border-yellow-300/60 transition-colors hover:brightness-110"
                        style={{ backgroundColor: 'var(--color-brand-yellow)', color: '#0a0a0a' }}
                        title={t('logout')}
                    >
                        <LogOut size={15} />
                        <span className="hidden sm:inline">{t('logout')}</span>
                    </button>
                </div>
            </div>

            <BillingModal
                isOpen={isBillingModalOpen}
                onClose={() => setIsBillingModalOpen(false)}
            />
        </header>
    );
}
