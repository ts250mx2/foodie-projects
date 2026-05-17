'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import Input from '@/components/Input';
import CostingModal, { Product } from '@/components/CostingModal';
import PageShell from '@/components/PageShell';
import { Zap } from 'lucide-react';

interface SubRecipe {
    IdProducto: number;
    Producto: string;
    Codigo: string;
    Categoria: string;
    Presentacion: string;
    Precio: number;
    ArchivoImagen?: string;
    UnidadMedidaInventario?: string;
}

interface MaterialResult {
    productId: number;
    product: string;
    code: string;
    quantity: number;
    unit: string;
    price: number;
    total: number;
    category: string;
    productType: number;
    productData: any;
}

export default function MaterialExplosionPage() {
    const t = useTranslations('MaterialExplosion');
    const tCommon = useTranslations('Common');
    const { colors } = useTheme();

    const [projectId, setProjectId] = useState<number | null>(null);
    const [subRecipes, setSubRecipes] = useState<SubRecipe[]>([]);
    const [activeType, setActiveType] = useState<'1' | '2'>('2'); // '2' for sub-recipes, '1' for dishes
    const [quantities, setQuantities] = useState<Record<number, string>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isExploding, setIsExploding] = useState(false);
    const [explosionResults, setExplosionResults] = useState<MaterialResult[] | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            const project = JSON.parse(storedProject);
            setProjectId(project.idProyecto);
        }
    }, []);

    useEffect(() => {
        if (projectId) {
            fetchProducts();
        }
    }, [projectId, activeType]);

    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/production/sub-recipes?projectId=${projectId}&type=${activeType}`);
            const data = await response.json();
            if (data.success) {
                setSubRecipes(data.data);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuantityChange = (productId: number, value: string) => {
        if (value === '' || /^\d*\.?\d*$/.test(value)) {
            setQuantities(prev => ({
                ...prev,
                [productId]: value
            }));
        }
    };

    const handleExplode = async () => {
        if (!projectId) return;

        const subRecipesArray = Object.entries(quantities)
            .filter(([_, qty]) => parseFloat(qty) > 0)
            .map(([id, qty]) => ({
                productId: parseInt(id),
                quantity: parseFloat(qty)
            }));

        if (subRecipesArray.length === 0) {
            alert(tCommon('noChanges') || 'Captura al menos una cantidad');
            return;
        }

        setIsExploding(true);
        try {
            const response = await fetch('/api/production/explosion/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: projectId,
                    subRecipes: subRecipesArray
                })
            });
            const data = await response.json();
            if (data.success) {
                setExplosionResults(data.data);
            }
        } catch (error) {
            console.error('Error exploding materials:', error);
        } finally {
            setIsExploding(false);
        }
    };

    const filteredSubRecipes = subRecipes.filter(sr =>
        sr.Producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sr.Codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sr.Categoria?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const grandTotal = explosionResults?.reduce((sum, item) => sum + item.total, 0) || 0;

    return (
        <PageShell
            title={t('title')}
            icon={Zap}
            actions={
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex gap-1 bg-white/20 p-1 rounded-xl">
                        <button onClick={() => { setActiveType('2'); setQuantities({}); }} className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeType === '2' ? 'bg-white text-green-600 shadow-sm' : 'text-white/70 hover:text-white'}`}>
                            🥣 {t('subRecipes')}
                        </button>
                        <button onClick={() => { setActiveType('1'); setQuantities({}); }} className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeType === '1' ? 'bg-white text-blue-600 shadow-sm' : 'text-white/70 hover:text-white'}`}>
                            🍽️ {t('dishes')}
                        </button>
                    </div>
                    <input type="text" placeholder={t('searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="px-3 py-1.5 text-xs rounded-lg border border-white/30 bg-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-white/50 w-48" />
                    <Button onClick={handleExplode} isLoading={isExploding} disabled={isLoading || Object.values(quantities).every(q => !parseFloat(q))} variant="secondary" size="sm">
                        ⚡ {t('explode')}
                    </Button>
                </div>
            }
        >

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{tCommon('loading')}</p>
                </div>
            ) : filteredSubRecipes.length === 0 ? (
                <div className="bg-white p-20 rounded-2xl border-2 border-dashed border-gray-200 text-center">
                    <p className="text-gray-400 font-bold italic">{t('noSubRecipes')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredSubRecipes.map(recipe => (
                        <div 
                            key={recipe.IdProducto}
                            className={`bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all border-2 group ${
                                activeType === '2' ? 'border-green-50 hover:border-green-200' : 'border-blue-50 hover:border-blue-200'
                            }`}
                        >
                            <div className={`h-32 flex items-center justify-center border-b border-gray-50 ${
                                activeType === '2' ? 'bg-green-50/50' : 'bg-blue-50/50'
                            }`}>
                                {recipe.ArchivoImagen ? (
                                    <img 
                                        src={recipe.ArchivoImagen} 
                                        alt={recipe.Producto} 
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-4xl filter grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                                        {activeType === '2' ? '🥣' : '🍽️'}
                                    </span>
                                )}
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-black text-gray-800 uppercase text-sm leading-tight truncate">{recipe.Producto}</h3>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">{recipe.Codigo}</p>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // Cast to Product (SubRecipe matches most fields)
                                            setEditingProduct(recipe as any);
                                        }}
                                        className="text-gray-400 hover:text-primary-500 transition-colors p-1"
                                        title="Editar Costeo"
                                    >
                                        ✏️
                                    </button>
                                </div>
                                
                                <div className="flex items-center justify-between gap-2">
                                    <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${
                                        activeType === '2' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                        {recipe.UnidadMedidaInventario || 'pza'}
                                    </div>
                                    <div className="w-24">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="0.00"
                                            value={quantities[recipe.IdProducto] || ''}
                                            onChange={(e) => handleQuantityChange(recipe.IdProducto, e.target.value)}
                                            className={`w-full px-3 py-1.5 border-2 rounded-lg text-center font-bold outline-none transition-all ${
                                                activeType === '2' 
                                                ? 'border-green-100 focus:border-green-500 text-green-600' 
                                                : 'border-blue-100 focus:border-blue-500 text-blue-600'
                                            }`}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Results Modal/Overlay */}
            {explosionResults && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-white/20">
                        {/* Header */}
                        <div 
                            className="px-8 py-6 text-white flex justify-between items-center"
                            style={{ background: `linear-gradient(to right, ${colors.colorFondo1}, ${colors.colorFondo2})`, color: colors.colorLetra }}
                        >
                            <div>
                                <h2 className="text-2xl font-black uppercase tracking-tight">{t('results')}</h2>
                                <div className="text-lg font-bold text-white mt-1 line-clamp-2" title={
                                    subRecipes
                                        .filter(sr => parseFloat(quantities[sr.IdProducto]) > 0)
                                        .map(sr => `${sr.Producto} (${quantities[sr.IdProducto]})`)
                                        .join(', ')
                                }>
                                    🚀 {subRecipes
                                        .filter(sr => parseFloat(quantities[sr.IdProducto]) > 0)
                                        .map(sr => `${sr.Producto} (${quantities[sr.IdProducto]})`)
                                        .join(', ')}
                                </div>
                                <p className="text-[10px] opacity-70 font-bold uppercase tracking-widest mt-1 italic">
                                    {explosionResults.length} Insumos Requeridos
                                </p>
                            </div>
                            <button 
                                onClick={() => setExplosionResults(null)}
                                className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors text-xl"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-auto p-8">
                            <div className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('product')}</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">{t('quantity')}</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">{t('unit')}</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">{t('cost')}</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">{t('total')}</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {explosionResults.map((item) => (
                                            <tr key={item.productId} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-gray-800">{item.product}</div>
                                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{item.code}</div>
                                                </td>
                                                <td className="px-6 py-4 text-center font-black text-primary-600">{item.quantity.toFixed(3)}</td>
                                                <td className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-widest italic">{item.unit}</td>
                                                <td className="px-6 py-4 text-right text-sm text-gray-500">
                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.price)}
                                                </td>
                                                <td className="px-6 py-4 text-right font-black text-gray-900">
                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.total)}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <button
                                                        onClick={() => setEditingProduct(item.productData)}
                                                        className="text-gray-400 hover:text-primary-500 transition-colors p-1"
                                                        title="Editar Insumo"
                                                    >
                                                        ✏️
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Footer with Summary */}
                        <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Estimado</p>
                                    <p className="text-3xl font-black text-primary-600">
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(grandTotal)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Button onClick={() => window.print()} variant="secondary" className="px-8">
                                    🖨️ PDF
                                </Button>
                                <Button onClick={() => setExplosionResults(null)} className="px-12 shadow-lg shadow-primary-200">
                                    {t('close')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Costing Modal Integration */}
            {editingProduct && (
                <CostingModal
                    isOpen={!!editingProduct}
                    onClose={() => {
                        setEditingProduct(null);
                        fetchProducts(); // Refresh list to reflect changes
                    }}
                    product={editingProduct}
                    projectId={projectId!}
                    productType={editingProduct.IdTipoProducto ?? parseInt(activeType)}
                />
            )}
        </PageShell>
    );
}
