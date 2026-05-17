'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import {
    LayoutDashboard,
    Settings,
    DollarSign,
    Package,
    ShoppingCart,
    CreditCard,
    Users,
    ChefHat,
    ScanText,
    Search,
    ChevronDown,
    FolderOpen,
    Rocket,
    MapPin,
    UserCheck,
    Receipt,
    TrendingUp,
    Store,
    Calculator,
    Tag,
    ClipboardList,
    Scale,
    Trash2,
    Truck,
    FileText,
    Scissors,
    UtensilsCrossed,
    Flame,
    Zap,
    CalendarDays,
    Banknote,
    LightbulbIcon,
    PenLine,
    Book,
    Layers,
    Camera,
    Files,
} from 'lucide-react';

type MenuItem = {
    key: string;
    href: string;
    icon: React.ElementType;
};

type MenuSection = {
    title: string;
    icon: React.ElementType;
    items: MenuItem[];
};

interface SidebarProps {
    isCollapsed?: boolean;
    onExpand?: () => void;
}

const menuItems: MenuSection[] = [
    {
        title: 'configuration',
        icon: Settings,
        items: [
            { key: 'project', href: '/dashboard/config/project', icon: FolderOpen },
            { key: 'initialLoad', href: '/dashboard/config/initial-load', icon: Rocket },
            { key: 'branches', href: '/dashboard/settings/branches', icon: MapPin },
            { key: 'employees', href: '/dashboard/payroll/employees', icon: UserCheck },
            { key: 'taxes', href: '/dashboard/config/taxes', icon: Receipt },
            { key: 'breakEvenAnalysis', href: '/dashboard/config/break-even', icon: TrendingUp },
        ],
    },
    {
        title: 'sales',
        icon: DollarSign,
        items: [
            { key: 'salesChannelsCapture', href: '/dashboard/sales/channels-capture', icon: Store },
            { key: 'appPriceCalculator', href: '/dashboard/sales/app-price-calculator', icon: Calculator },
        ],
    },
    {
        title: 'inventories',
        icon: Package,
        items: [
            { key: 'products', href: '/dashboard/inventories/products', icon: Tag },
            { key: 'inventoryCapture', href: '/dashboard/inventories/capture', icon: ClipboardList },
            { key: 'minMax', href: '/dashboard/inventories/min-max', icon: Scale },
            { key: 'wasteCapture', href: '/dashboard/inventories/waste-capture', icon: Trash2 },
        ],
    },
    {
        title: 'purchases',
        icon: ShoppingCart,
        items: [
            { key: 'suppliers', href: '/dashboard/purchases/suppliers', icon: Truck },
            { key: 'purchaseOrders', href: '/dashboard/purchases/purchase-orders', icon: FileText },
            { key: 'purchasesCapture', href: '/dashboard/purchases/capture', icon: PenLine },
        ],
    },
    {
        title: 'expenses',
        icon: CreditCard,
        items: [
            { key: 'expenseConcepts', href: '/dashboard/expenses/concepts', icon: LightbulbIcon },
            { key: 'expensesCapture', href: '/dashboard/expenses/capture', icon: Scissors },
        ],
    },
    {
        title: 'payroll',
        icon: Users,
        items: [
            { key: 'schedules', href: '/dashboard/payroll/schedules', icon: CalendarDays },
            { key: 'payrollCapture', href: '/dashboard/payroll/capture', icon: Banknote },
        ],
    },
    {
        title: 'production',
        icon: ChefHat,
        items: [
            { key: 'subRecipes', href: '/dashboard/production/sub-recipes', icon: Book },
            { key: 'dishes', href: '/dashboard/production/dishes', icon: UtensilsCrossed },
            { key: 'productionCapture', href: '/dashboard/production/capture', icon: Flame },
            { key: 'materialExplosion', href: '/dashboard/production/material-explosion', icon: Zap },
        ],
    },
    {
        title: 'ocrProcessing',
        icon: ScanText,
        items: [
            { key: 'receiptCapture', href: '/dashboard/ocr/receipt-capture', icon: Camera },
            { key: 'ocrDocuments', href: '/dashboard/ocr/documents', icon: Files },
        ],
    },
];

export default function Sidebar({ isCollapsed = false, onExpand }: SidebarProps) {
    const t = useTranslations('Navigation');
    const params = useParams();
    const pathname = usePathname();
    const locale = params.locale as string;
    const { colors } = useTheme();
    const [searchTerm, setSearchTerm] = useState('');

    // Determinar qué sección contiene la ruta activa
    const getActiveSection = () => {
        for (const section of menuItems) {
            if (section.items.some(item => pathname === `/${locale}${item.href}`)) {
                return section.title;
            }
        }
        return null;
    };

    const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
        const active = getActiveSection();
        const initial: Record<string, boolean> = {};
        menuItems.forEach(s => { initial[s.title] = s.title === active; });
        return initial;
    });

    // Abrir automáticamente la sección activa cuando cambia la ruta
    useEffect(() => {
        const active = getActiveSection();
        if (active) {
            setOpenSections(prev => ({ ...prev, [active]: true }));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    const toggleSection = (title: string) => {
        setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
    };

    const filteredSections = menuItems.map(section => ({
        ...section,
        items: section.items.filter(item =>
            searchTerm === '' ||
            t(item.key).toLowerCase().includes(searchTerm.toLowerCase()) ||
            t(section.title).toLowerCase().includes(searchTerm.toLowerCase())
        ),
    })).filter(s => s.items.length > 0);

    return (
        <aside
            className={`fixed top-16 left-0 ${isCollapsed ? 'w-[68px]' : 'w-64'} h-[calc(100vh-4rem)] overflow-y-auto z-40 transition-all duration-300 custom-scrollbar`}
            style={{ background: `linear-gradient(180deg, ${colors.colorFondo1}, ${colors.colorFondo2})` }}
        >
            <nav className="p-3 flex flex-col gap-1">
                {/* Buscador */}
                {!isCollapsed && (
                    <div className="relative mb-2">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" style={{ color: colors.colorLetra }} />
                        <input
                            type="text"
                            placeholder="Buscar módulo..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl bg-white/15 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/20 transition-all placeholder:opacity-50"
                            style={{ color: colors.colorLetra }}
                        />
                    </div>
                )}

                {/* Dashboard link */}
                <Link
                    href={`/${locale}/dashboard`}
                    title={isCollapsed ? t('dashboard') : ''}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 mb-1
                        ${pathname === `/${locale}/dashboard`
                            ? 'bg-white shadow-md font-semibold'
                            : 'hover:bg-white/15 font-medium'
                        }
                        ${isCollapsed ? 'justify-center' : ''}
                    `}
                    style={{
                        color: pathname === `/${locale}/dashboard` ? colors.colorFondo1 : colors.colorLetra,
                    }}
                >
                    <LayoutDashboard size={18} className="shrink-0" />
                    {!isCollapsed && <span className="text-sm">{t('dashboard')}</span>}
                </Link>

                {/* Divisor */}
                <div className="border-t border-white/15 my-1" />

                {/* Secciones */}
                {filteredSections.map(section => {
                    const SectionIcon = section.icon;
                    const isOpen = openSections[section.title];
                    const hasActiveChild = section.items.some(item => pathname === `/${locale}${item.href}`);

                    return (
                        <div key={section.title}>
                            <button
                                onClick={() => {
                                    if (isCollapsed) {
                                        onExpand?.();
                                        if (!openSections[section.title]) toggleSection(section.title);
                                    } else {
                                        toggleSection(section.title);
                                    }
                                }}
                                title={isCollapsed ? t(section.title) : ''}
                                className={`w-full flex items-center px-3 py-2.5 rounded-xl transition-all duration-150 group
                                    ${hasActiveChild && !isOpen ? 'bg-white/20 font-semibold' : 'hover:bg-white/15'}
                                    ${isCollapsed ? 'justify-center' : 'justify-between'}
                                `}
                                style={{ color: colors.colorLetra }}
                            >
                                <div className="flex items-center gap-3">
                                    <SectionIcon size={18} className="shrink-0" />
                                    {!isCollapsed && (
                                        <span className="text-sm font-medium">{t(section.title)}</span>
                                    )}
                                </div>
                                {!isCollapsed && (
                                    <ChevronDown
                                        size={14}
                                        className={`opacity-60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                                    />
                                )}
                            </button>

                            {/* Items de la sección */}
                            {!isCollapsed && (
                                <div
                                    className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}
                                >
                                    <ul className="mt-0.5 ml-3 pl-4 border-l border-white/20 flex flex-col gap-0.5 py-1">
                                        {section.items.map(item => {
                                            const ItemIcon = item.icon;
                                            const isActive = pathname === `/${locale}${item.href}`;
                                            return (
                                                <li key={item.key}>
                                                    <Link
                                                        href={`/${locale}${item.href}`}
                                                        className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-all duration-150
                                                            ${isActive
                                                                ? 'bg-white font-semibold shadow-sm'
                                                                : 'hover:bg-white/15 opacity-80 hover:opacity-100'
                                                            }
                                                        `}
                                                        style={{
                                                            color: isActive ? colors.colorFondo1 : colors.colorLetra,
                                                        }}
                                                    >
                                                        <ItemIcon size={14} className="shrink-0" />
                                                        <span>{t(item.key)}</span>
                                                    </Link>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>
        </aside>
    );
}
