'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import { useState, useEffect } from 'react';

export default function AppPriceCalculatorPage() {
    const tNav = useTranslations('Navigation');
    const t = useTranslations('AppPriceCalculator');
    const { colors } = useTheme();

    // Input States
    const [menuPrice, setMenuPrice] = useState<number>(539);
    const [cost, setCost] = useState<number>(58);
    const [platformCommission, setPlatformCommission] = useState<number>(33);
    const [ivaPct, setIvaPct] = useState<number>(16);
    const [retencionIvaPct, setRetencionIvaPct] = useState<number>(8);
    const [retencionIsrPct, setRetencionIsrPct] = useState<number>(1);

    // Calculation States
    const [results, setResults] = useState({
        priceWithoutIva: 0,
        ivaTransfered: 0,
        commissionAmount: 0,
        ivaCommission: 0,
        totalCommission: 0,
        ivaRetained: 0,
        isrRetained: 0,
        netIncome: 0,
        finalProfit: 0,
        netMargin: 0
    });

    useEffect(() => {
        const priceWithoutIva = menuPrice / (1 + (ivaPct / 100));
        const ivaTransfered = menuPrice - priceWithoutIva;
        const commissionAmount = priceWithoutIva * (platformCommission / 100);
        const ivaCommission = commissionAmount * (ivaPct / 100);
        const totalCommission = commissionAmount + ivaCommission;
        const ivaRetained = priceWithoutIva * (retencionIvaPct / 100);
        const isrRetained = priceWithoutIva * (retencionIsrPct / 100);
        const netIncome = menuPrice - totalCommission - ivaRetained - isrRetained;
        const finalProfit = netIncome - cost;
        const netMargin = finalProfit / menuPrice;

        setResults({
            priceWithoutIva,
            ivaTransfered,
            commissionAmount,
            ivaCommission,
            totalCommission,
            ivaRetained,
            isrRetained,
            netIncome,
            finalProfit,
            netMargin
        });
    }, [menuPrice, cost, platformCommission, ivaPct, retencionIvaPct, retencionIsrPct]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
    };

    const formatPercent = (value: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'percent', minimumFractionDigits: 2 }).format(value);
    };

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
            <h1 
                className="text-3xl font-bold mb-8 text-center text-black"
            >
                {t('title')}
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Inputs Section */}
                <div 
                    className="bg-white/40 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl text-black"
                >
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                        <span>📥</span> {t('inputs')}
                    </h2>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium opacity-80 mb-1">{t('menuPrice')}</label>
                            <input 
                                type="number" 
                                value={menuPrice}
                                onChange={(e) => setMenuPrice(Number(e.target.value))}
                                className="w-full bg-white/50 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-black font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium opacity-80 mb-1">{t('cost')}</label>
                            <input 
                                type="number" 
                                value={cost}
                                onChange={(e) => setCost(Number(e.target.value))}
                                className="w-full bg-white/50 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-black font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium opacity-80 mb-1">{t('platformCommission')}</label>
                            <input 
                                type="number" 
                                value={platformCommission}
                                onChange={(e) => setPlatformCommission(Number(e.target.value))}
                                className="w-full bg-white/50 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-black font-bold"
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium opacity-80 mb-1">{t('iva')}</label>
                                <input 
                                    type="number" 
                                    value={ivaPct}
                                    onChange={(e) => setIvaPct(Number(e.target.value))}
                                    className="w-full bg-white/50 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-black font-bold"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium opacity-80 mb-1">{t('retencionIva')}</label>
                                <input 
                                    type="number" 
                                    value={retencionIvaPct}
                                    onChange={(e) => setRetencionIvaPct(Number(e.target.value))}
                                    className="w-full bg-white/50 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-black font-bold"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium opacity-80 mb-1">{t('retencionIsr')}</label>
                                <input 
                                    type="number" 
                                    value={retencionIsrPct}
                                    onChange={(e) => setRetencionIsrPct(Number(e.target.value))}
                                    className="w-full bg-white/50 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-black font-bold"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Calculations Section */}
                <div 
                    className="bg-white/40 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl text-black"
                >
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                        <span>⚙️</span> {t('calculations')}
                    </h2>
                    
                    <div className="space-y-3">
                        <div className="flex justify-between border-b border-gray-300 pb-2">
                            <span className="opacity-70 font-medium">{t('priceWithoutIva')}</span>
                            <span className="font-bold">{formatCurrency(results.priceWithoutIva)}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-300 pb-2">
                            <span className="opacity-70 font-medium">{t('ivaTransfered')}</span>
                            <span className="font-bold">{formatCurrency(results.ivaTransfered)}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-300 pb-2 text-red-700">
                            <span className="opacity-70 font-medium">{t('commissionAmount')}</span>
                            <span className="font-bold">-{formatCurrency(results.commissionAmount)}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-300 pb-2 text-red-700">
                            <span className="opacity-70 font-medium">{t('ivaCommission')}</span>
                            <span className="font-bold">-{formatCurrency(results.ivaCommission)}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-300 pb-2 font-black text-red-800">
                            <span className="opacity-70">{t('totalCommission')}</span>
                            <span className="">-{formatCurrency(results.totalCommission)}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-300 pb-2 text-orange-700">
                            <span className="opacity-70 font-medium">{t('ivaRetained')}</span>
                            <span className="font-bold">-{formatCurrency(results.ivaRetained)}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-300 pb-2 text-orange-700">
                            <span className="opacity-70 font-medium">{t('isrRetained')}</span>
                            <span className="font-bold">-{formatCurrency(results.isrRetained)}</span>
                        </div>
                    </div>
                </div>

                {/* Summary Section */}
                <div 
                    className="lg:col-span-2 bg-white/60 backdrop-blur-lg rounded-2xl p-8 border border-white/30 shadow-2xl mt-4 text-black"
                >
                    <h2 className="text-2xl font-bold mb-8 text-center flex items-center justify-center gap-3">
                        <span className="text-3xl">📊</span> {t('summary')}
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-black/5 p-5 rounded-xl border border-black/10 text-center shadow-inner">
                            <p className="text-sm opacity-70 mb-1 font-medium">{t('menuPrice')}</p>
                            <p className="text-2xl font-black">{formatCurrency(menuPrice)}</p>
                        </div>
                        <div className="bg-black/5 p-5 rounded-xl border border-black/10 text-center shadow-inner">
                            <p className="text-sm opacity-70 mb-1 font-medium">{t('netIncome')}</p>
                            <p className="text-2xl font-black text-blue-800">{formatCurrency(results.netIncome)}</p>
                        </div>
                        <div className="bg-black/5 p-5 rounded-xl border border-black/10 text-center shadow-inner">
                            <p className="text-sm opacity-70 mb-1 font-medium">{t('finalProfit')}</p>
                            <p className={`text-2xl font-black ${results.finalProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                {formatCurrency(results.finalProfit)}
                            </p>
                        </div>
                        <div className="bg-black/5 p-5 rounded-xl border border-black/10 text-center shadow-inner">
                            <p className="text-sm opacity-70 mb-1 font-medium">{t('netMargin')}</p>
                            <p className={`text-2xl font-black ${results.netMargin >= 0.2 ? 'text-green-700' : results.netMargin >= 0.1 ? 'text-yellow-700' : 'text-red-700'}`}>
                                {formatPercent(results.netMargin)}
                            </p>
                        </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-black/10 flex flex-wrap justify-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-600"></div>
                            <span className="text-sm font-semibold opacity-80">Bueno (&gt;20%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-yellow-600"></div>
                            <span className="text-sm font-semibold opacity-80">Regular (10%-20%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-600"></div>
                            <span className="text-sm font-semibold opacity-80">Bajo (&lt;10%)</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
