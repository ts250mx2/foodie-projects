'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type AppResult = {
    priceWithoutIva: number;
    ivaTransfered: number;
    commissionAmount: number;
    ivaCommission: number;
    totalCommission: number;
    ivaRetained: number;
    isrRetained: number;
    netIncome: number;
    finalProfit: number;
    netMargin: number;
};

type Product = {
    IdProducto: number;
    Producto: string;
    Precio: number;
    Costo: number;
    IVA: number;
};

export default function AppPriceCalculatorPage() {
    const tNav = useTranslations('Navigation');
    const t = useTranslations('AppPriceCalculator');
    const { colors } = useTheme();

    // Input States
    const [productName, setProductName] = useState<string>('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [isProductListOpen, setIsProductListOpen] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [linkCosts, setLinkCosts] = useState(false);
    const productListRef = useRef<HTMLDivElement>(null);

    const [prices, setPrices] = useState({ uber: 539, didi: 539, rappi: 539 });
    const [commissions, setCommissions] = useState({ uber: 33, didi: 30, rappi: 33 });
    const [cost, setCost] = useState<number>(58);
    const [ivaPct, setIvaPct] = useState<number>(16);
    const [retencionIvaPct, setRetencionIvaPct] = useState<number>(8);
    const [retencionIsrPct, setRetencionIsrPct] = useState<number>(1);

    // Calculation States
    const [results, setResults] = useState<{ uber: AppResult; didi: AppResult; rappi: AppResult }>({
        uber: { priceWithoutIva: 0, ivaTransfered: 0, commissionAmount: 0, ivaCommission: 0, totalCommission: 0, ivaRetained: 0, isrRetained: 0, netIncome: 0, finalProfit: 0, netMargin: 0 },
        didi: { priceWithoutIva: 0, ivaTransfered: 0, commissionAmount: 0, ivaCommission: 0, totalCommission: 0, ivaRetained: 0, isrRetained: 0, netIncome: 0, finalProfit: 0, netMargin: 0 },
        rappi: { priceWithoutIva: 0, ivaTransfered: 0, commissionAmount: 0, ivaCommission: 0, totalCommission: 0, ivaRetained: 0, isrRetained: 0, netIncome: 0, finalProfit: 0, netMargin: 0 }
    });

    // Fetch Products from Database
    const fetchProducts = useCallback(async (projectId: number) => {
        try {
            const response = await fetch(`/api/products?projectId=${projectId}&tipoProducto=1`);
            const data = await response.json();
            if (data.success && Array.isArray(data.data)) {
                setProducts(data.data);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    }, []);

    // Fetch Commissions from Database
    const fetchCommissions = useCallback(async (projectId: number) => {
        try {
            const response = await fetch(`/api/sales-channels?projectId=${projectId}`);
            const data = await response.json();
            if (data.success && Array.isArray(data.data)) {
                setCommissions(prev => {
                    const next = { ...prev };
                    data.data.forEach((channel: any) => {
                        const name = channel.CanalVenta.toUpperCase();
                        if (name === 'UBER') next.uber = channel.Comision;
                        if (name === 'DIDI') next.didi = channel.Comision;
                        if (name === 'RAPPI') next.rappi = channel.Comision;
                    });
                    return next;
                });
            }
        } catch (error) {
            console.error('Error fetching commissions:', error);
        }
    }, []);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            try {
                const project = JSON.parse(storedProject);
                if (project.idProyecto) {
                    fetchCommissions(project.idProyecto);
                    fetchProducts(project.idProyecto);
                }
            } catch (e) {
                console.error('Error parsing project data', e);
            }
        }

        // Click away listener for product list
        const handleClickOutside = (event: MouseEvent) => {
            if (productListRef.current && !productListRef.current.contains(event.target as Node)) {
                setIsProductListOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [fetchCommissions, fetchProducts]);

    const handleProductSelect = (product: Product) => {
        setProductName(product.Producto);
        setSelectedProduct(product);
        setIsProductListOpen(false);
        setProductSearch(product.Producto);
        
        if (linkCosts) {
            // Populate price and cost if available
            if (product.Precio) {
                setPrices({ uber: product.Precio, didi: product.Precio, rappi: product.Precio });
            }
            if (product.Costo) {
                setCost(product.Costo);
            }
        } else {
            // Reset to zero if linking is disabled
            setPrices({ uber: 0, didi: 0, rappi: 0 });
            setCost(0);
        }
    };

    const exportToPDF = () => {
        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            const timestamp = new Date().toLocaleString();
            
            // Title
            doc.setFontSize(20);
            doc.setTextColor(0, 0, 0);
            doc.text('Calculadora de Precios y Utilidad', 105, 20, { align: 'center' });
            
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Generado el: ${timestamp}`, 105, 28, { align: 'center' });

            if (productName) {
                doc.setFontSize(16);
                doc.setTextColor(0, 51, 153);
                doc.text(productName.toUpperCase(), 105, 40, { align: 'center' });
            }

            // Summary Table
            autoTable(doc, {
                startY: 50,
                head: [['Resumen', 'Uber', 'Didi', 'Rappi']],
                body: [
                    ['Precio de Menú', formatCurrency(prices.uber), formatCurrency(prices.didi), formatCurrency(prices.rappi)],
                    ['Ingreso Neto', formatCurrency(results.uber.netIncome), formatCurrency(results.didi.netIncome), formatCurrency(results.rappi.netIncome)],
                    ['Utilidad Final', formatCurrency(results.uber.finalProfit), formatCurrency(results.didi.finalProfit), formatCurrency(results.rappi.finalProfit)],
                    ['Margen Neto', formatPercent(results.uber.netMargin), formatPercent(results.didi.netMargin), formatPercent(results.rappi.netMargin)]
                ],
                theme: 'grid',
                headStyles: { fillColor: [40, 40, 40] },
                styles: { fontSize: 10, halign: 'center' },
                columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } }
            });

            // Detailed Calculations Table
            const finalY = (doc as any).lastAutoTable.finalY || 100;
            autoTable(doc, {
                startY: finalY + 10,
                head: [['Detalle de Cálculos', 'Uber', 'Didi', 'Rappi']],
                body: [
                    ['Precio sin IVA', formatCurrency(results.uber.priceWithoutIva), formatCurrency(results.didi.priceWithoutIva), formatCurrency(results.rappi.priceWithoutIva)],
                    ['IVA Trasladado', formatCurrency(results.uber.ivaTransfered), formatCurrency(results.didi.ivaTransfered), formatCurrency(results.rappi.ivaTransfered)],
                    ['Comisión Plataforma', `-${formatCurrency(results.uber.commissionAmount)}`, `-${formatCurrency(results.didi.commissionAmount)}`, `-${formatCurrency(results.rappi.commissionAmount)}`],
                    ['IVA de Comisión', `-${formatCurrency(results.uber.ivaCommission)}`, `-${formatCurrency(results.didi.ivaCommission)}`, `-${formatCurrency(results.rappi.ivaCommission)}`],
                    ['Total Comisión', `-${formatCurrency(results.uber.totalCommission)}`, `-${formatCurrency(results.didi.totalCommission)}`, `-${formatCurrency(results.rappi.totalCommission)}`],
                    ['Retención IVA', `-${formatCurrency(results.uber.ivaRetained)}`, `-${formatCurrency(results.didi.ivaRetained)}`, `-${formatCurrency(results.rappi.ivaRetained)}`],
                    ['Retención ISR', `-${formatCurrency(results.uber.isrRetained)}`, `-${formatCurrency(results.didi.isrRetained)}`, `-${formatCurrency(results.rappi.isrRetained)}`],
                    ['Costo Unitario', formatCurrency(cost), formatCurrency(cost), formatCurrency(cost)]
                ],
                theme: 'striped',
                headStyles: { fillColor: [70, 70, 70] },
                styles: { fontSize: 9, halign: 'right' },
                columnStyles: { 0: { halign: 'left' } }
            });

            // Footer
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text(`Foodie Guru - Dashboard Administrativo`, 105, 285, { align: 'center' });
            }

            doc.save(`Calculadora_${productName || 'App'}_${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error al generar el PDF. Por favor intente de nuevo.');
        }
    };

    useEffect(() => {
        const calculateForPlatform = (menuPrice: number, platformCommission: number) => {
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

            return {
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
            };
        };

        setResults({
            uber: calculateForPlatform(prices.uber, commissions.uber),
            didi: calculateForPlatform(prices.didi, commissions.didi),
            rappi: calculateForPlatform(prices.rappi, commissions.rappi)
        });
    }, [prices, cost, commissions, ivaPct, retencionIvaPct, retencionIsrPct]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
    };

    const formatPercent = (value: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'percent', minimumFractionDigits: 2 }).format(value);
    };

    const platforms: (keyof typeof prices)[] = ['uber', 'didi', 'rappi'];

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                <div className="w-10 h-10 hidden md:block"></div>
                <h1 className="text-3xl font-bold text-center text-black">
                    {t('title')}
                </h1>
                <button
                    onClick={exportToPDF}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-full font-bold shadow-lg transition-all hover:scale-105 active:scale-95"
                >
                    <span>📄</span> Exportar PDF
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Inputs Section */}
                <div 
                    className="lg:col-span-3 bg-white/40 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl text-black"
                >
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                        <span>📥</span> {t('inputs')}
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Product Selection Dropdown */}
                        <div className="md:col-span-3 relative" ref={productListRef}>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-sm font-medium opacity-80">Buscar Platillo / Producto (tipo 1)</label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input 
                                        type="checkbox" 
                                        checked={linkCosts}
                                        onChange={(e) => setLinkCosts(e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-all"
                                    />
                                    <span className="text-sm font-semibold opacity-70 group-hover:opacity-100 transition-opacity">Vincular costos y precios</span>
                                </label>
                            </div>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={productSearch}
                                    onChange={(e) => {
                                        setProductSearch(e.target.value);
                                        setIsProductListOpen(true);
                                    }}
                                    onFocus={() => setIsProductListOpen(true)}
                                    placeholder="Escribe para buscar un platillo..."
                                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-black font-bold text-lg pr-10"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none">
                                    🔍
                                </div>
                            </div>

                            {isProductListOpen && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto backdrop-blur-xl">
                                    {products
                                        .filter(p => p.Producto.toLowerCase().includes(productSearch.toLowerCase()))
                                        .map(product => (
                                            <button
                                                key={product.IdProducto}
                                                onClick={() => handleProductSelect(product)}
                                                className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-none group"
                                            >
                                                <div className="font-bold text-black group-hover:text-blue-700">{product.Producto}</div>
                                                <div className="text-xs opacity-50 flex gap-4 mt-1">
                                                    <span>Base: {formatCurrency(product.Precio || 0)}</span>
                                                    <span>Costo: {formatCurrency(product.Costo || 0)}</span>
                                                    <span>IVA: {product.IVA}%</span>
                                                </div>
                                            </button>
                                        ))}
                                    {products.filter(p => p.Producto.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                                        <div className="p-4 text-center text-gray-500 italic">
                                            No se encontraron platillos activos
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Prices per Platform */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-lg border-b border-black/10 pb-2">Precios</h3>
                            {platforms.map(platform => (
                                <div key={platform}>
                                    <label className="block text-sm font-medium opacity-80 mb-1">{t(`menuPrice${platform.charAt(0).toUpperCase() + platform.slice(1)}`)}</label>
                                    <input 
                                        type="number" 
                                        value={prices[platform]}
                                        onChange={(e) => setPrices({...prices, [platform]: Number(e.target.value)})}
                                        className="w-full bg-white/50 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-black font-bold"
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Commissions per Platform */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-lg border-b border-black/10 pb-2">Comisiones (%)</h3>
                            {platforms.map(platform => (
                                <div key={platform}>
                                    <label className="block text-sm font-medium opacity-80 mb-1">{t(`commission${platform.charAt(0).toUpperCase() + platform.slice(1)}`)}</label>
                                    <input 
                                        type="number" 
                                        value={commissions[platform]}
                                        onChange={(e) => setCommissions({...commissions, [platform]: Number(e.target.value)})}
                                        className="w-full bg-white/50 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-black font-bold"
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Common Inputs */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-lg border-b border-black/10 pb-2">Costos e Impuestos</h3>
                            <div>
                                <label className="block text-sm font-medium opacity-80 mb-1">{t('cost')}</label>
                                <input 
                                    type="number" 
                                    value={cost}
                                    onChange={(e) => setCost(Number(e.target.value))}
                                    className="w-full bg-white/50 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-black font-bold"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="block text-xs font-medium opacity-80 mb-1">{t('iva')}</label>
                                    <input 
                                        type="number" 
                                        value={ivaPct}
                                        onChange={(e) => setIvaPct(Number(e.target.value))}
                                        className="w-full bg-white/50 border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-black font-bold text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium opacity-80 mb-1">Ret.IVA</label>
                                    <input 
                                        type="number" 
                                        value={retencionIvaPct}
                                        onChange={(e) => setRetencionIvaPct(Number(e.target.value))}
                                        className="w-full bg-white/50 border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-black font-bold text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium opacity-80 mb-1">Ret.ISR</label>
                                    <input 
                                        type="number" 
                                        value={retencionIsrPct}
                                        onChange={(e) => setRetencionIsrPct(Number(e.target.value))}
                                        className="w-full bg-white/50 border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-black font-bold text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Calculations Section */}
                <div 
                    className="lg:col-span-3 bg-white/40 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl text-black"
                >
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                        <span>⚙️</span> {t('calculations')}
                    </h2>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-black/10">
                                    <th className="py-2 px-4 opacity-70">Concepto</th>
                                    <th className="py-2 px-4 text-right">Uber</th>
                                    <th className="py-2 px-4 text-right">Didi</th>
                                    <th className="py-2 px-4 text-right">Rappi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5">
                                <tr>
                                    <td className="py-3 px-4 opacity-70 font-medium">{t('priceWithoutIva')}</td>
                                    {platforms.map(p => <td key={p} className="py-3 px-4 text-right font-bold">{formatCurrency(results[p].priceWithoutIva)}</td>)}
                                </tr>
                                <tr>
                                    <td className="py-3 px-4 opacity-70 font-medium">{t('ivaTransfered')}</td>
                                    {platforms.map(p => <td key={p} className="py-3 px-4 text-right font-bold">{formatCurrency(results[p].ivaTransfered)}</td>)}
                                </tr>
                                <tr className="text-red-700">
                                    <td className="py-3 px-4 opacity-70 font-medium">{t('commissionAmount')}</td>
                                    {platforms.map(p => <td key={p} className="py-3 px-4 text-right font-bold">-{formatCurrency(results[p].commissionAmount)}</td>)}
                                </tr>
                                <tr className="text-red-700">
                                    <td className="py-3 px-4 opacity-70 font-medium">{t('ivaCommission')}</td>
                                    {platforms.map(p => <td key={p} className="py-3 px-4 text-right font-bold">-{formatCurrency(results[p].ivaCommission)}</td>)}
                                </tr>
                                <tr className="font-black text-red-800 bg-red-50/30">
                                    <td className="py-3 px-4 opacity-70">{t('totalCommission')}</td>
                                    {platforms.map(p => <td key={p} className="py-3 px-4 text-right">-{formatCurrency(results[p].totalCommission)}</td>)}
                                </tr>
                                <tr className="text-orange-700">
                                    <td className="py-3 px-4 opacity-70 font-medium">{t('ivaRetained')}</td>
                                    {platforms.map(p => <td key={p} className="py-3 px-4 text-right font-bold">-{formatCurrency(results[p].ivaRetained)}</td>)}
                                </tr>
                                <tr className="text-orange-700">
                                    <td className="py-3 px-4 opacity-70 font-medium">{t('isrRetained')}</td>
                                    {platforms.map(p => <td key={p} className="py-3 px-4 text-right font-bold">-{formatCurrency(results[p].isrRetained)}</td>)}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Summary Section */}
                <div className="lg:col-span-3">
                    <h2 className="text-2xl font-bold mb-8 text-center flex flex-col items-center justify-center gap-3 text-black">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">📊</span> {t('summary')}
                        </div>
                        {productName && (
                            <span className="text-blue-800 text-lg opacity-80 mt-1 uppercase tracking-widest">{productName}</span>
                        )}
                    </h2>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {platforms.map(p => (
                            <div key={p} className="bg-white/60 backdrop-blur-lg rounded-2xl p-6 border border-white/30 shadow-2xl text-black">
                                <h3 className="text-xl font-black text-center mb-6 uppercase tracking-wider border-b border-black/10 pb-2">{p}</h3>
                                
                                <div className="space-y-4">
                                    <div className="bg-black/5 p-4 rounded-xl border border-black/10 text-center shadow-inner">
                                        <p className="text-xs opacity-70 mb-1 font-medium">{t('menuPrice')}</p>
                                        <p className="text-xl font-black">{formatCurrency(prices[p])}</p>
                                    </div>
                                    <div className="bg-black/5 p-4 rounded-xl border border-black/10 text-center shadow-inner">
                                        <p className="text-xs opacity-70 mb-1 font-medium">{t('netIncome')}</p>
                                        <p className="text-xl font-black text-blue-800">{formatCurrency(results[p].netIncome)}</p>
                                    </div>
                                    <div className="bg-black/5 p-4 rounded-xl border border-black/10 text-center shadow-inner">
                                        <p className="text-xs opacity-70 mb-1 font-medium">{t('finalProfit')}</p>
                                        <p className={`text-xl font-black ${results[p].finalProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                            {formatCurrency(results[p].finalProfit)}
                                        </p>
                                    </div>
                                    <div className="bg-black/5 p-4 rounded-xl border border-black/10 text-center shadow-inner">
                                        <p className="text-xs opacity-70 mb-1 font-medium">{t('netMargin')}</p>
                                        <p className={`text-xl font-black ${results[p].netMargin >= 0.2 ? 'text-green-700' : results[p].netMargin >= 0.1 ? 'text-yellow-700' : 'text-red-700'}`}>
                                            {formatPercent(results[p].netMargin)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 pt-8 border-t border-black/10 flex flex-wrap justify-center gap-4 text-black">
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
