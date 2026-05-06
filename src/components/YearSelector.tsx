'use client';

import { useTranslations } from 'next-intl';

interface YearSelectorProps {
    selectedYear: number;
    onYearChange: (year: number) => void;
}

export default function YearSelector({ selectedYear, onYearChange }: YearSelectorProps) {
    const t = useTranslations('PurchasesCapture');
    
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

    return (
        <div className="flex flex-col min-w-[90px]">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1 ml-1">
                {t('year')}
            </label>
            <select
                value={selectedYear}
                onChange={(e) => onYearChange(parseInt(e.target.value))}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm"
            >
                {years.map((year) => (
                    <option key={year} value={year}>
                        {year}
                    </option>
                ))}
            </select>
        </div>
    );
}
