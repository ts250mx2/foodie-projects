'use client';

import { useTranslations } from 'next-intl';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@/contexts/ThemeContext';
import { Menu, LogOut, ChevronRight, User } from 'lucide-react';

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
    const { colors } = useTheme();

    const [userName, setUserName] = useState(initialUserName || '');
    const [projectLogo, setProjectLogo] = useState('');
    const [projectTitle, setProjectTitle] = useState('');
    const [projectName, setProjectName] = useState('');

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

    const handleLogout = () => {
        localStorage.removeItem('user');
        onLogout ? onLogout() : router.push('/');
    };

    const displayTitle = projectTitle || `Foodie Guru${projectName ? ` · ${projectName}` : ''}`;
    const isDashboardHome = pathname === `/${locale}/dashboard`;
    const { crumbs, current } = buildBreadcrumbs(pathname, locale);

    return (
        <header
            className="fixed top-0 left-0 right-0 h-16 z-50 flex flex-col justify-center px-4 border-b bg-white shadow-sm"
            style={{ 
                borderColor: '#e2e8f0'
            }}
        >
            <div className="flex items-center justify-between gap-4">
                {/* Left: hamburger + logo + title + breadcrumb */}
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        onClick={onToggleSidebar}
                        className="shrink-0 p-2 rounded-lg hover:bg-slate-100 text-slate-650 hover:text-slate-800 transition-colors"
                        aria-label="Toggle Sidebar"
                    >
                        <Menu size={20} />
                    </button>

                    {projectLogo ? (
                        <img
                            src={projectLogo}
                            alt="Logo"
                            className="h-9 w-auto object-contain shrink-0"
                            onError={() => setProjectLogo('')}
                        />
                    ) : null}

                    <div className="flex flex-col min-w-0">
                        <span
                            className="text-sm font-bold leading-tight truncate text-slate-800"
                        >
                            {displayTitle}
                        </span>

                        {/* Breadcrumb — solo cuando no es la home del dashboard */}
                        {!isDashboardHome && (
                            <nav className="flex items-center gap-1" aria-label="Breadcrumb">
                                {crumbs.map((crumb, i) => (
                                    <span key={i} className="flex items-center gap-1">
                                        {i > 0 && (
                                            <ChevronRight size={10} className="text-slate-400" />
                                        )}
                                        <Link
                                            href={crumb.href}
                                            className="text-[11px] hover:underline transition-opacity opacity-75 hover:opacity-100 whitespace-nowrap text-slate-500 hover:text-slate-700"
                                        >
                                            {crumb.label}
                                        </Link>
                                    </span>
                                ))}
                                {crumbs.length > 0 && (
                                    <>
                                        <ChevronRight size={10} className="text-slate-400" />
                                        <span
                                            className="text-[11px] font-semibold whitespace-nowrap text-slate-700"
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
                <div className="flex items-center gap-3 shrink-0">
                    <div
                        className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200/50 text-slate-700"
                    >
                        <User size={14} className="opacity-70 text-slate-500" />
                        <span className="text-sm font-medium">{userName || 'Usuario'}</span>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200/50 text-slate-700 transition-colors"
                        title={t('logout')}
                    >
                        <LogOut size={15} className="text-slate-500" />
                        <span className="hidden sm:inline">{t('logout')}</span>
                    </button>
                </div>
            </div>
        </header>
    );
}
