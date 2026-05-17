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
    emoji: string;
};

type MenuSection = {
    title: string;
    icon: React.ElementType;
    emoji: string;
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
        emoji: '⚙️',
        items: [
            { key: 'project', href: '/dashboard/config/project', icon: FolderOpen, emoji: '📁' },
            { key: 'initialLoad', href: '/dashboard/config/initial-load', icon: Rocket, emoji: '🚀' },
            { key: 'branches', href: '/dashboard/settings/branches', icon: MapPin, emoji: '📍' },
            { key: 'employees', href: '/dashboard/payroll/employees', icon: UserCheck, emoji: '🧑‍💼' },
            { key: 'taxes', href: '/dashboard/config/taxes', icon: Receipt, emoji: '🧾' },
            { key: 'breakEvenAnalysis', href: '/dashboard/config/break-even', icon: TrendingUp, emoji: '📈' },
        ],
    },
    {
        title: 'sales',
        icon: DollarSign,
        emoji: '💰',
        items: [
            { key: 'salesChannelsCapture', href: '/dashboard/sales/channels-capture', icon: Store, emoji: '🏪' },
            { key: 'appPriceCalculator', href: '/dashboard/sales/app-price-calculator', icon: Calculator, emoji: '🧮' },
        ],
    },
    {
        title: 'inventories',
        icon: Package,
        emoji: '📦',
        items: [
            { key: 'products', href: '/dashboard/inventories/products', icon: Tag, emoji: '🏷️' },
            { key: 'inventoryCapture', href: '/dashboard/inventories/capture', icon: ClipboardList, emoji: '📋' },
            { key: 'minMax', href: '/dashboard/inventories/min-max', icon: Scale, emoji: '⚖️' },
            { key: 'wasteCapture', href: '/dashboard/inventories/waste-capture', icon: Trash2, emoji: '🗑️' },
        ],
    },
    {
        title: 'purchases',
        icon: ShoppingCart,
        emoji: '🛒',
        items: [
            { key: 'suppliers', href: '/dashboard/purchases/suppliers', icon: Truck, emoji: '🚚' },
            { key: 'purchaseOrders', href: '/dashboard/purchases/purchase-orders', icon: FileText, emoji: '📄' },
            { key: 'purchasesCapture', href: '/dashboard/purchases/capture', icon: PenLine, emoji: '📝' },
        ],
    },
    {
        title: 'expenses',
        icon: CreditCard,
        emoji: '💳',
        items: [
            { key: 'expenseConcepts', href: '/dashboard/expenses/concepts', icon: LightbulbIcon, emoji: '💡' },
            { key: 'expensesCapture', href: '/dashboard/expenses/capture', icon: Scissors, emoji: '✂️' },
        ],
    },
    {
        title: 'payroll',
        icon: Users,
        emoji: '👥',
        items: [
            { key: 'schedules', href: '/dashboard/payroll/schedules', icon: CalendarDays, emoji: '📅' },
            { key: 'payrollCapture', href: '/dashboard/payroll/capture', icon: Banknote, emoji: '💵' },
        ],
    },
    {
        title: 'production',
        icon: ChefHat,
        emoji: '👨‍🍳',
        items: [
            { key: 'subRecipes', href: '/dashboard/production/sub-recipes', icon: Book, emoji: '📖' },
            { key: 'dishes', href: '/dashboard/production/dishes', icon: UtensilsCrossed, emoji: '🍲' },
            { key: 'productionCapture', href: '/dashboard/production/capture', icon: Flame, emoji: '🔥' },
            { key: 'materialExplosion', href: '/dashboard/production/material-explosion', icon: Zap, emoji: '⚡' },
        ],
    },
    {
        title: 'ocrProcessing',
        icon: ScanText,
        emoji: '📸',
        items: [
            { key: 'receiptCapture', href: '/dashboard/ocr/receipt-capture', icon: Camera, emoji: '📷' },
            { key: 'ocrDocuments', href: '/dashboard/ocr/documents', icon: Files, emoji: '🗂️' },
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
            style={{ 
                backgroundColor: colors.colorFondo1,
                borderRight: '1px solid rgba(255, 255, 255, 0.08)'
            }}
        >
            <nav className="p-3 flex flex-col gap-1">
                {/* Buscador */}
                {!isCollapsed && (
                    <div className="relative mb-2">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
                        <input
                            type="text"
                            placeholder="Buscar módulo..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl bg-white/12 border border-white/10 text-white placeholder:text-white/50 focus:bg-white/18 focus:ring-2 focus:ring-white/20 focus:outline-none transition-all"
                        />
                    </div>
                )}

                {/* Dashboard link */}
                <Link
                    href={`/${locale}/dashboard`}
                    title={isCollapsed ? t('dashboard') : ''}
                    className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 mb-1
                        ${pathname === `/${locale}/dashboard`
                            ? 'bg-white font-semibold shadow-md'
                            : 'hover:bg-white/10 font-medium text-white/80 hover:text-white'
                        }
                        ${isCollapsed ? 'justify-center' : ''}
                    `}
                    style={{
                        color: pathname === `/${locale}/dashboard` ? colors.colorFondo1 : '#ffffff',
                    }}
                >
                    <LayoutDashboard size={18} className="shrink-0" />
                    {!isCollapsed && <span className="text-sm">{t('dashboard')}</span>}
                </Link>

                {/* Divisor */}
                <div className="border-t border-white/10 my-1" />

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
                                className={`w-full flex items-center px-3 py-2.5 rounded-xl transition-all duration-150 group text-white/85 hover:text-white hover:bg-white/10
                                    ${hasActiveChild && !isOpen ? 'bg-white/18 font-semibold text-white' : 'font-medium'}
                                    ${isCollapsed ? 'justify-center' : 'justify-between'}
                                  `}
                                style={{ color: '#ffffff' }}
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
                                    <ul className="mt-0.5 ml-3 pl-4 border-l border-white/15 flex flex-col gap-0.5 py-1">
                                        {section.items.map(item => {
                                            const ItemIcon = item.icon;
                                            const isActive = pathname === `/${locale}${item.href}`;
                                            return (
                                                <li key={item.key}>
                                                    <Link
                                                        href={`/${locale}${item.href}`}
                                                        className={`relative flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-all duration-150
                                                            ${isActive
                                                                ? 'bg-white font-semibold shadow-md'
                                                                : 'hover:bg-white/10 text-white/80 hover:text-white font-medium'
                                                            }
                                                        `}
                                                        style={{
                                                            color: isActive ? colors.colorFondo1 : '#ffffff',
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
