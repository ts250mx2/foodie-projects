'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import PageShell from '@/components/PageShell';
import { 
    CreditCard,
    LightbulbIcon,
    Scissors,
    ChevronRight 
} from 'lucide-react';

export default function ExpensesDashboardPage() {
    const t = useTranslations('Navigation');
    const params = useParams();
    const locale = params.locale as string;
    const { colors } = useTheme();

    const menuCards = [
        {
            key: 'expenseConcepts',
            title: t('expenseConcepts'),
            description: locale === 'es' 
                ? 'Catálogo de categorías de gastos operativos y administrativos.' 
                : 'Catalog of operational and administrative expense categories.',
            href: `/dashboard/expenses/concepts`,
            icon: LightbulbIcon,
            badge: locale === 'es' ? 'Conceptos' : 'Concepts'
        },
        {
            key: 'expensesCapture',
            title: t('expensesCapture'),
            description: locale === 'es' 
                ? 'Registro diario de gastos operativos, facturas y caja chica.' 
                : 'Daily record of operational expenses, invoices and petty cash.',
            href: `/dashboard/expenses/capture`,
            icon: Scissors,
            badge: locale === 'es' ? 'Captura' : 'Capture'
        }
    ];

    return (
        <PageShell 
            title={t('expenses')} 
            subtitle={locale === 'es' 
                ? 'Control detallado de salidas de dinero, caja chica, gastos fijos y variables del negocio.' 
                : 'Detailed control of cash outflows, petty cash, fixed and variable business expenses.'}
            icon={CreditCard}
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
