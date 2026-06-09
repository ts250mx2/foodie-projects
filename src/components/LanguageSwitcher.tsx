'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { ChangeEvent, useState, useTransition } from 'react';

interface LanguageSwitcherProps {
    className?: string;
}

export default function LanguageSwitcher({ className = '' }: LanguageSwitcherProps) {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();

    const onSelectChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const nextLocale = e.target.value;
        startTransition(() => {
            router.replace(pathname, { locale: nextLocale });
        });
    };

    return (
        <div className={`relative ${className}`}>
            <select
                defaultValue={locale}
                onChange={onSelectChange}
                disabled={isPending}
                className="appearance-none border-none px-3 py-1.5 pr-7 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400 hover:brightness-110 transition-all cursor-pointer text-sm font-bold tracking-wide"
                style={{
                    backgroundColor: '#f4481e',
                    color: '#ffffff',
                    WebkitTextFillColor: '#ffffff',
                    colorScheme: 'light',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none'
                }}
            >
                <option value="es" className="text-gray-900 bg-white">🇪🇸 Español</option>
                <option value="en" className="text-gray-900 bg-white">🇺🇸 English</option>
                <option value="fr" className="text-gray-900 bg-white">🇫🇷 Français</option>
                <option value="de" className="text-gray-900 bg-white">🇩🇪 Deutsch</option>
                <option value="pt" className="text-gray-900 bg-white">🇵🇹 Português</option>
                <option value="it" className="text-gray-900 bg-white">🇮🇹 Italiano</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-1.5 pointer-events-none text-white opacity-90">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </div>
        </div>
    );
}
