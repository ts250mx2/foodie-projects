'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import Link from 'next/link';

export default function InitialLoadPage() {
    const t = useTranslations('InitialLoad');
    const { colors } = useTheme();

    const steps = [
        {
            id: 1,
            title: t('step1Title'),
            description: t('step1Desc'),
            emoji: '🏷️',
            href: '/dashboard/inventories/products',
            color: 'from-blue-500 to-indigo-600'
        },
        {
            id: 2,
            title: t('step2Title'),
            description: t('step2Desc'),
            emoji: '📂',
            href: '/dashboard/inventories/products',
            color: 'from-emerald-500 to-teal-600'
        },
        {
            id: 3,
            title: t('step3Title'),
            description: t('step3Desc'),
            emoji: '⚖️',
            href: '/dashboard/inventories/products',
            color: 'from-amber-500 to-orange-600'
        },
        {
            id: 4,
            title: t('step4Title'),
            description: t('step4Desc'),
            emoji: '🥣',
            href: '/dashboard/production/sub-recipes',
            color: 'from-rose-500 to-pink-600'
        },
        {
            id: 5,
            title: t('step5Title'),
            description: t('step5Desc'),
            emoji: '📝',
            href: '/dashboard/inventories/capture',
            color: 'from-violet-500 to-purple-600'
        }
    ];

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <header className="mb-10">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">{t('title')}</h1>
                <p className="text-gray-500 italic">Sigue estos pasos para configurar tu proyecto correctamente.</p>
                <div className="h-1 w-20 bg-indigo-500 rounded-full mt-4"></div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {steps.map((step) => (
                    <Link 
                        key={step.id} 
                        href={step.href}
                        className="group relative overflow-hidden bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 flex flex-col h-full"
                    >
                        {/* Gradient Header */}
                        <div className={`h-2 w-full bg-gradient-to-r ${step.color}`}></div>
                        
                        <div className="p-6 flex flex-col flex-grow">
                            <div className="flex justify-between items-start mb-4">
                                <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-wider">
                                    {step.title}
                                </span>
                                <span className="text-4xl group-hover:scale-125 transition-transform duration-300 transform-gpu">
                                    {step.emoji}
                                </span>
                            </div>
                            
                            <h2 className="text-lg font-bold text-gray-800 mb-4 group-hover:text-indigo-600 transition-colors">
                                {step.description}
                            </h2>
                            
                            <div className="mt-auto flex items-center text-sm font-medium text-indigo-500 group-hover:translate-x-2 transition-transform">
                                Ir a realizar paso 
                                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                            </div>
                        </div>

                        {/* Decorative Background Element */}
                        <div className="absolute -right-6 -bottom-6 text-8xl opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
                            {step.emoji}
                        </div>
                    </Link>
                ))}
            </div>
            
            <footer className="mt-16 text-center text-gray-400 text-sm">
                © {new Date().getFullYear()} Foodie Guru - Gestión Gastronómica Inteligente
            </footer>
        </div>
    );
}
