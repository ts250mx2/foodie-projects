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
    emoji: string;
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
        ocrProcessing: false,
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
                { key: 'project', href: '/dashboard/config/project', emoji: '📋' },
                { key: 'initialLoad', href: '/dashboard/config/initial-load', emoji: '🚀' },
                { key: 'branches', href: '/dashboard/settings/branches', emoji: '📍' },
                { key: 'employees', href: '/dashboard/payroll/employees', emoji: '👥' },
                { key: 'taxes', href: '/dashboard/config/taxes', emoji: '🧾' },
                // { key: 'tips', href: '/dashboard/settings/tips', emoji: '💰' },
                { key: 'breakEvenAnalysis', href: '/dashboard/config/break-even', emoji: '📈' }
            ]
        },
        {
            title: 'sales',
            emoji: '💰',
            items: [
                { key: 'salesChannelsCapture', href: '/dashboard/sales/channels-capture', emoji: '🏪' },
                // { key: 'tipsCapture', href: '/dashboard/sales/tips-capture', emoji: '💸' }
            ]
        },
        {
            title: 'inventories',
            emoji: '📦',
            items: [
                { key: 'products', href: '/dashboard/inventories/products', emoji: '🏷️' },
                { key: 'inventoryCapture', href: '/dashboard/inventories/capture', emoji: '📝' },
                { key: 'minMax', href: '/dashboard/inventories/min-max', emoji: '⚖️' },
                { key: 'wasteCapture', href: '/dashboard/inventories/waste-capture', emoji: '🗑️' }
            ]
        },
        {
            title: 'purchases',
            emoji: '🛒',
            items: [
                { key: 'suppliers', href: '/dashboard/purchases/suppliers', emoji: '🏢' },
                { key: 'purchasesCapture', href: '/dashboard/purchases/capture', emoji: '📄' }
            ]
        },
        {
            title: 'expenses',
            emoji: '💸',
            items: [
                { key: 'expenseConcepts', href: '/dashboard/expenses/concepts', emoji: '💡' },
                { key: 'expensesCapture', href: '/dashboard/expenses/capture', emoji: '🖋️' }
            ]
        },
        {
            title: 'payroll',
            emoji: '👥',
            items: [
                { key: 'schedules', href: '/dashboard/payroll/schedules', emoji: '📅' },
                { key: 'payrollCapture', href: '/dashboard/payroll/capture', emoji: '🧮' }
            ]
        },
        {
            title: 'production',
            emoji: '🍳',
            items: [
                { key: 'subRecipes', href: '/dashboard/production/sub-recipes', emoji: '🥣' },
                { key: 'dishes', href: '/dashboard/production/dishes', emoji: '🍽️' },
                { key: 'productionCapture', href: '/dashboard/production/capture', emoji: '👨‍🍳' },
                { key: 'materialExplosion', href: '/dashboard/production/material-explosion', emoji: '💥' }
            ]
        },
        {
            title: 'ocrProcessing',
            emoji: '🧠',
            items: [
                { key: 'receiptCapture', href: '/dashboard/ocr/receipt-capture', emoji: '📸' },
                { key: 'ocrDocuments', href: '/dashboard/ocr/documents', emoji: '📄' }
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
                                className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen && !isCollapsed ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
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
                                                    <div className="flex items-center gap-2">
                                                        <span>{item.emoji}</span>
                                                        <span>{t(item.key)}</span>
                                                    </div>
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
