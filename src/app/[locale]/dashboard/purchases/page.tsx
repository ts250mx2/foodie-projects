'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import PageShell from '@/components/PageShell';
import { 
    ShoppingCart, 
    Truck, 
    FileText, 
    PenLine, 
    ChevronRight 
} from 'lucide-react';

export default function PurchasesDashboardPage() {
    const t = useTranslations('Navigation');
    const params = useParams();
    const locale = params.locale as string;
    const { colors } = useTheme();

    const menuCards = [
        {
            key: 'suppliers',
            title: t('suppliers'),
            description: locale === 'es' 
                ? 'Administración de proveedores, contactos, números de teléfono y correo electrónico.' 
                : 'Management of suppliers, contacts, phone numbers and email.',
            href: `/dashboard/purchases/suppliers`,
            icon: Truck,
            badge: locale === 'es' ? 'Contactos' : 'Contacts'
        },
        {
            key: 'purchaseOrders',
            title: t('purchaseOrders'),
            description: locale === 'es'
                ? 'Gestión de pedidos de insumos por categorías y generación de reportes en PDF.'
                : 'Management of input orders by categories and PDF report generation.',
            href: `/dashboard/purchases/purchase-orders`,
            icon: FileText,
            badge: locale === 'es' ? 'Pedidos' : 'Orders'
        },
        {
            key: 'purchasesCapture',
            title: t('purchasesCapture'),
            description: locale === 'es'
                ? 'Registro diario de facturas de compra, formas de pago e insumos ingresados.'
                : 'Daily record of purchase invoices, payment channels and inputted materials.',
            href: `/dashboard/purchases/capture`,
            icon: PenLine,
            badge: locale === 'es' ? 'Facturas' : 'Invoices'
        }
    ];

    return (
        <PageShell 
            title={t('purchases')} 
            subtitle={locale === 'es' 
                ? 'Gestión y control de proveedores, órdenes de compra y captura de facturas.' 
                : 'Management and control of suppliers, purchase orders, and invoice captures.'}
            icon={ShoppingCart}
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
