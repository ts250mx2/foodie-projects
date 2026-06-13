import type { ElementType } from 'react';
import {
    LayoutDashboard,
    Settings,
    DollarSign,
    Package,
    ShoppingCart,
    CreditCard,
    Users,
    ChefHat,
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
    Sparkles,
} from 'lucide-react';

export type MenuItem = {
    key: string;
    href: string;
    icon: ElementType;
    emoji: string;
    label?: string; // etiqueta directa (omite i18n) para items nuevos
};

export type MenuSection = {
    title: string;
    icon: ElementType;
    emoji: string;
    color: string; // color de la burbuja del módulo (los items lo heredan)
    items: MenuItem[];
    label?: string; // etiqueta directa (omite i18n) para secciones nuevas
};

// Links de primer nivel fuera de las secciones
export const DASHBOARD_LINK = { href: '/dashboard', icon: LayoutDashboard, color: '#f97316' }; // naranja marca
export const AGENT_LINK = { href: '/dashboard/agente', icon: ChefHat, color: '#8b5cf6' }; // violeta

export const menuItems: MenuSection[] = [
    {
        title: 'reportsAI',
        label: 'Reportes IA',
        icon: TrendingUp,
        emoji: '📊',
        color: '#06b6d4', // cyan
        items: [
            { key: 'advancedAgent', label: 'Agente Avanzado', href: '/dashboard/reportes/nuevo', icon: Sparkles, emoji: '🤖' },
            { key: 'myReports', label: 'Mis Reportes', href: '/dashboard/reportes', icon: Layers, emoji: '📁' },
        ],
    },
    {
        title: 'configuration',
        icon: Settings,
        emoji: '⚙️',
        color: '#64748b', // slate
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
        color: '#10b981', // esmeralda
        items: [
            { key: 'salesChannelsCapture', href: '/dashboard/sales/channels-capture', icon: Store, emoji: '🏪' },
            { key: 'appPriceCalculator', href: '/dashboard/sales/app-price-calculator', icon: Calculator, emoji: '🧮' },
        ],
    },
    {
        title: 'inventories',
        icon: Package,
        emoji: '📦',
        color: '#f59e0b', // ámbar
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
        color: '#14b8a6', // teal
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
        color: '#ec4899', // rosa
        items: [
            { key: 'expenseConcepts', href: '/dashboard/expenses/concepts', icon: LightbulbIcon, emoji: '💡' },
            { key: 'expensesCapture', href: '/dashboard/expenses/capture', icon: Scissors, emoji: '✂️' },
        ],
    },
    {
        title: 'payroll',
        icon: Users,
        emoji: '👥',
        color: '#6366f1', // índigo
        items: [
            { key: 'schedules', href: '/dashboard/payroll/schedules', icon: CalendarDays, emoji: '📅' },
            { key: 'payrollCapture', href: '/dashboard/payroll/capture', icon: Banknote, emoji: '💵' },
        ],
    },
    {
        title: 'production',
        icon: ChefHat,
        emoji: '👨‍🍳',
        color: '#ef4444', // rojo
        items: [
            { key: 'subRecipes', href: '/dashboard/production/sub-recipes', icon: Book, emoji: '📖' },
            { key: 'dishes', href: '/dashboard/production/dishes', icon: UtensilsCrossed, emoji: '🍲' },
            { key: 'productionCapture', href: '/dashboard/production/capture', icon: Flame, emoji: '🔥' },
            { key: 'materialExplosion', href: '/dashboard/production/material-explosion', icon: Zap, emoji: '⚡' },
        ],
    },
];

export type ModuleTheme = {
    color: string;
    /** Icono del item del menú; solo presente cuando la ruta coincide exactamente con un item */
    icon?: ElementType;
};

// Rutas que no están en el menú pero pertenecen a un módulo (por primer segmento tras /dashboard)
const SEGMENT_TO_SECTION: Record<string, string> = {
    config: 'configuration',
    settings: 'configuration',
    sales: 'sales',
    inventories: 'inventories',
    purchases: 'purchases',
    expenses: 'expenses',
    payroll: 'payroll',
    production: 'production',
    reportes: 'reportsAI',
};

/** Devuelve color e icono del módulo para una ruta SIN locale (ej. /dashboard/sales/channels-capture) */
export function getModuleTheme(path: string): ModuleTheme | null {
    if (path === DASHBOARD_LINK.href) return { color: DASHBOARD_LINK.color, icon: DASHBOARD_LINK.icon };
    if (path === AGENT_LINK.href || path.startsWith(`${AGENT_LINK.href}/`)) {
        return { color: AGENT_LINK.color, icon: AGENT_LINK.icon };
    }

    for (const section of menuItems) {
        const item = section.items.find(i => i.href === path);
        if (item) return { color: section.color, icon: item.icon };
    }

    // Fallback: hereda el color de la sección, sin forzar icono (la página usa el suyo)
    const segment = path.split('/')[2];
    const sectionTitle = segment ? SEGMENT_TO_SECTION[segment] : undefined;
    const section = sectionTitle ? menuItems.find(s => s.title === sectionTitle) : undefined;
    return section ? { color: section.color } : null;
}
