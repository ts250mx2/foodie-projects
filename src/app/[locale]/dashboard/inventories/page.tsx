'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import PageShell from '@/components/PageShell';
import { 
    Package,
    Tag,
    ClipboardList,
    Scale,
    Trash2,
    ChevronRight 
} from 'lucide-react';

export default function InventoriesDashboardPage() {
    const t = useTranslations('Navigation');
    const params = useParams();
    const locale = params.locale as string;
    const { colors } = useTheme();

    const menuCards = [
        {
            key: 'products',
            title: t('products'),
            description: locale === 'es' 
                ? 'Catálogo de materias primas, insumos y cálculo de costeo de rendimiento.' 
                : 'Raw materials catalog, inputs and yield costing calculation.',
            href: `/dashboard/inventories/products`,
            icon: Tag,
            badge: locale === 'es' ? 'Productos' : 'Products'
        },
        {
            key: 'inventoryCapture',
            title: t('inventoryCapture'),
            description: locale === 'es' 
                ? 'Ingreso y control manual del inventario físico periódico por sucursal.' 
                : 'Manual entry and control of periodic physical inventory by branch.',
            href: `/dashboard/inventories/capture`,
            icon: ClipboardList,
            badge: locale === 'es' ? 'Captura' : 'Capture'
        },
        {
            key: 'minMax',
            title: t('minMax'),
            description: locale === 'es' 
                ? 'Configuración de niveles de inventario mínimos y máximos para compras.' 
                : 'Configuration of minimum and maximum inventory levels for procurement.',
            href: `/dashboard/inventories/min-max`,
            icon: Scale,
            badge: locale === 'es' ? 'Stock' : 'Stock'
        },
        {
            key: 'wasteCapture',
            title: t('wasteCapture'),
            description: locale === 'es' 
                ? 'Registro detallado de productos desechados, mermas e incidencias.' 
                : 'Detailed record of discarded products, wastes and incidents.',
            href: `/dashboard/inventories/waste-capture`,
            icon: Trash2,
            badge: locale === 'es' ? 'Mermas' : 'Wastes'
        }
    ];

    return (
        <PageShell 
            title={t('inventories')} 
            subtitle={locale === 'es' 
                ? 'Administración y control del almacén de materias primas, stocks mínimos/máximos, mermas e inventario físico.' 
                : 'Administration and control of raw materials warehouse, minimum/maximum stocks, wastes and physical inventory.'}
            icon={Package}
        >
            <div className="max-w-7xl mx-auto py-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {menuCards.map((card) => {
                        const IconComponent = card.icon;
                        return (
                            <Link 
                                key={card.key}
                                href={`/${locale}${card.href}`}
                                className="group relative bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 hover:shadow-xl hover:border-transparent transition-all duration-300 transform hover:-translate-y-1.5 overflow-hidden flex flex-col justify-between min-h-[220px]"
                            >
                                {/* Bottom Glowing Border on Hover */}
                                <div 
                                    className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                    style={{
                                        backgroundImage: `linear-gradient(to right, ${colors.colorFondo1}, ${colors.colorFondo2 || colors.colorFondo1})`
                                    }}
                                />

                                <div>
                                    {/* Icon & Badge Row */}
                                    <div className="flex items-center justify-between mb-5">
                                        <div 
                                            className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                                            style={{
                                                backgroundColor: `${colors.colorFondo1}10`, // 10% opacity
                                                color: colors.colorFondo1
                                            }}
                                        >
                                            <IconComponent size={24} strokeWidth={2} />
                                        </div>
                                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 uppercase tracking-wider">
                                            {card.badge}
                                        </span>
                                    </div>

                                    {/* Text Info */}
                                    <h3 className="text-lg font-bold text-gray-900 mb-2 transition-colors duration-200 group-hover:text-primary-600">
                                        {card.title}
                                    </h3>
                                    
                                    <p className="text-sm text-gray-500 leading-relaxed mb-6">
                                        {card.description}
                                    </p>
                                </div>

                                {/* Click to enter action row */}
                                <div className="flex items-center text-xs font-bold uppercase tracking-wider mt-auto" style={{ color: colors.colorFondo1 }}>
                                    <span className="mr-1.5">{locale === 'es' ? 'Ingresar' : 'Enter'}</span>
                                    <ChevronRight 
                                        size={14} 
                                        className="transform group-hover:translate-x-1.5 transition-transform duration-300" 
                                    />
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </PageShell>
    );
}
