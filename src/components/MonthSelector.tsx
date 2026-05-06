'use client';

import { useTranslations } from 'next-intl';

interface MonthSelectorProps {
    selectedMonth: number;
    onMonthChange: (month: number) => void;
}

export default function MonthSelector({ selectedMonth, onMonthChange }: MonthSelectorProps) {
    const t = useTranslations('PurchasesCapture');

    return (
        <div className="flex flex-col min-w-[120px]">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1 ml-1">
                {t('month')}
            </label>
            <select
                value={selectedMonth}
                onChange={(e) => onMonthChange(parseInt(e.target.value))}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm"
            >
                {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>
                        {t(`months.${i}`)}
                    </option>
                ))}
            </select>
        </div>
    );
}
