'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

// Define menu types for better type safety
type MenuItem = {
    key: string;
    href: string;
};

type MenuSection = {
    title: string;
    emoji: string;
    items: MenuItem[];
};

interface SidebarProps {
    isCollapsed?: boolean;
    onExpand?: () => void;
}

export default function Sidebar({ isCollapsed = false, onExpand }: SidebarProps) {
    const t = useTranslations('Navigation');
    const params = useParams();
    const pathname = usePathname();
    const locale = params.locale as string;
    const { colors } = useTheme();

    // State to track expanded sections
    // Default open all or just specific ones? Let's keep them all open by default or allow toggling
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        configuration: false,
        sales: false,
        inventories: false,
        purchases: false,
        expenses: false,
        payroll: false,
        production: false,
    });
    const [searchTerm, setSearchTerm] = useState('');

    const toggleSection = (title: string) => {
        setOpenSections(prev => ({
            ...prev,
            [title]: !prev[title]
        }));
    };

    const menuItems: MenuSection[] = [
        {
            title: 'configuration',
            emoji: '⚙️',
            items: [
                { key: 'project', href: '/dashboard/config/project' },
                { key: 'branches', href: '/dashboard/settings/branches' },
                { key: 'tips', href: '/dashboard/settings/tips' },
                { key: 'terminals', href: '/dashboard/sales/terminals' },
                { key: 'salesChannels', href: '/dashboard/sales/channels' },
                { key: 'paymentChannels', href: '/dashboard/config/payment-channels' },
                { key: 'employees', href: '/dashboard/payroll/employees' },
                { key: 'positions', href: '/dashboard/payroll/positions' },
                { key: 'documentTypes', href: '/dashboard/settings/document-types' }
            ]
        },
        {
            title: 'sales',
            emoji: '💰',
            items: [
                { key: 'salesTerminalsCapture', href: '/dashboard/sales/terminals-capture' },
                { key: 'salesChannelsCapture', href: '/dashboard/sales/channels-capture' },
                { key: 'tipsCapture', href: '/dashboard/sales/tips-capture' }
            ]
        },
        {
            title: 'inventories',
            emoji: '📦',
            items: [
                { key: 'categories', href: '/dashboard/inventories/categories' },
                { key: 'presentations', href: '/dashboard/inventories/presentations' },
                { key: 'products', href: '/dashboard/inventories/products' },
                { key: 'inventoryCapture', href: '/dashboard/inventories/capture' }
            ]
        },
        {
            title: 'purchases',
            emoji: '🛒',
            items: [
                { key: 'suppliers', href: '/dashboard/purchases/suppliers' },
                { key: 'purchasesCapture', href: '/dashboard/purchases/capture' }
            ]
        },
        {
            title: 'expenses',
            emoji: '💸',
            items: [
                { key: 'expenseConcepts', href: '/dashboard/expenses/concepts' },
                { key: 'expensesCapture', href: '/dashboard/expenses/capture' }
            ]
        },
        {
            title: 'payroll',
            emoji: '👥',
            items: [
                { key: 'schedules', href: '/dashboard/payroll/schedules' },
                { key: 'payrollCapture', href: '/dashboard/payroll/capture' }
            ]
        },
        {
            title: 'production',
            emoji: '🍳',
            items: [
                { key: 'rawMaterials', href: '/dashboard/production/raw-materials' },
                { key: 'subRecipes', href: '/dashboard/production/sub-recipes' },
                { key: 'dishes', href: '/dashboard/production/dishes' },
                { key: 'menuSections', href: '/dashboard/production/menu-sections' },
                { key: 'productionCapture', href: '/dashboard/production/capture' }
            ]
        }
    ];

    // Filter menu items based on search term
    const filteredMenuItems = menuItems.map(section => ({
        ...section,
        items: section.items.filter(item =>
            searchTerm === '' ||
            t(item.key).toLowerCase().includes(searchTerm.toLowerCase()) ||
            t(section.title).toLowerCase().includes(searchTerm.toLowerCase())
        )
    })).filter(section => section.items.length > 0);

    return (
        <aside
            className={`fixed top-16 left-0 ${isCollapsed ? 'w-20' : 'w-64'} h-[calc(100vh-4rem)] overflow-y-auto shadow-xl z-40 transition-all duration-300`}
            style={{
                background: `linear-gradient(to bottom, ${colors.colorFondo1}, ${colors.colorFondo2})`
            }}
        >
            <nav className="p-4 space-y-2">
                {/* Search Input */}
                {!isCollapsed && (
                    <div className="mb-4">
                        <input
                            type="text"
                            placeholder="🔍 Buscar menú..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-white/20 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/30 transition-all placeholder:opacity-70"
                            style={{
                                color: colors.colorLetra
                            }}
                        />
                    </div>
                )}

                <div className="mb-6">
                    <Link
                        href={`/${locale}/dashboard`}
                        className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-4'} py-3 rounded-xl transition-all duration-200 ${pathname === `/${locale}/dashboard`
                            ? 'bg-white shadow-md font-bold'
                            : 'hover:bg-white/10'
                            }`}
                        style={{
                            color: pathname === `/${locale}/dashboard` ? colors.colorFondo1 : colors.colorLetra
                        }}
                        title={isCollapsed ? t('dashboard') : ''}
                    >
                        <span className="text-xl">🏠</span>
                        {!isCollapsed && <span className="font-medium">{t('dashboard')}</span>}
                    </Link>
                </div>

                {filteredMenuItems.map((section) => {
                    const isOpen = openSections[section.title];
                    const isActive = section.items.some(item => pathname === `/${locale}${item.href}`);

                    return (
                        <div key={section.title} className="rounded-xl overflow-hidden mb-1">
                            <button
                                onClick={() => {
                                    if (isCollapsed) {
                                        onExpand?.();
                                        // Also ensure the section we clicked opens
                                        if (!openSections[section.title]) {
                                            toggleSection(section.title);
                                        }
                                    } else {
                                        toggleSection(section.title);
                                    }
                                }}
                                className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-4'} py-3 transition-colors duration-200 ${isActive && !isOpen
                                    ? 'bg-white/20 font-medium'
                                    : 'hover:bg-white/10'
                                    }`}
                                style={{ color: colors.colorLetra }}
                                title={isCollapsed ? t(section.title) : ''}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-xl shadow-sm filter drop-shadow-sm">{section.emoji}</span>
                                    {!isCollapsed && <span className="font-medium text-sm">{t(section.title)}</span>}
                                </div>
                                {!isCollapsed && (
                                    <span className={`text-xs transition-transform duration-200 opacity-70 ${isOpen ? 'rotate-180' : ''}`}>
                                        ▼
                                    </span>
                                )}
                            </button>

                            <div
                                className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen && !isCollapsed ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                                    }`}
                            >
                                <ul className="bg-black/10 py-2 space-y-1">
                                    {section.items.map((item) => {
                                        const isItemActive = pathname === `/${locale}${item.href}`;
                                        return (
                                            <li key={item.key}>
                                                <Link
                                                    href={`/${locale}${item.href}`}
                                                    className={`block pl-12 pr-4 py-2 text-sm transition-colors border-l-2 ml-4 ${isItemActive
                                                        ? 'font-bold bg-white/10'
                                                        : 'border-transparent opacity-70 hover:opacity-100 hover:border-white/50'
                                                        }`}
                                                    style={{
                                                        borderLeftColor: isItemActive ? colors.colorLetra : 'transparent',
                                                        color: colors.colorLetra
                                                    }}
                                                >
                                                    {t(item.key)}
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </div>
                    );
                })}
            </nav>
        </aside>
    );
}
