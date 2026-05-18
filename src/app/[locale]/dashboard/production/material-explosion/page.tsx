'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import Input from '@/components/Input';
import CostingModal, { Product } from '@/components/CostingModal';
import PageShell from '@/components/PageShell';
import LoadingSpinner from '@/components/LoadingSpinner';
import ThemedGridHeader, { ThemedGridHeaderCell, TableBody, TableRow, TableCell, RowActionButton } from '@/components/ThemedGridHeader';
import { Zap, Printer, BookOpen, UtensilsCrossed, Pencil, X, PackageSearch } from 'lucide-react';

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
                    <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg shrink-0">
                        <button
                            onClick={() => { setActiveType('2'); setQuantities({}); }}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1 ${activeType === '2' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <BookOpen size={14} />
                            {t('subRecipes')}
                        </button>
                        <button
                            onClick={() => { setActiveType('1'); setQuantities({}); }}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1 ${activeType === '1' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <UtensilsCrossed size={14} />
                            {t('dishes')}
                        </button>
                    </div>
                    <input type="text" placeholder={t('searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent w-48" />
                    <Button onClick={handleExplode} isLoading={isExploding} disabled={isLoading || Object.values(quantities).every(q => !parseFloat(q))} variant="secondary" size="sm" leftIcon={Zap} iconBox>
                        {t('explode')}
                    </Button>
                </div>
            }
        >

            {isLoading ? (
                <div className="py-20">
                    <LoadingSpinner message={tCommon('loading')} size="md" />
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
                                    <div className={`text-gray-300 group-hover:text-gray-400 transition-all ${activeType === '2' ? 'text-green-300 group-hover:text-green-400' : 'text-blue-300 group-hover:text-blue-400'}`}>
                                        {activeType === '2' ? <BookOpen size={48} strokeWidth={1.5} /> : <UtensilsCrossed size={48} strokeWidth={1.5} />}
                                    </div>
                                )}
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-black text-gray-800 uppercase text-sm leading-tight truncate">{recipe.Producto}</h3>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">{recipe.Codigo}</p>
                                    </div>
                                    <RowActionButton
                                        icon={Pencil}
                                        label="Editar Costeo"
                                        variant="edit"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingProduct(recipe as any);
                                        }}
                                    />
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
                            className="px-6 py-4 text-white flex justify-between items-center sticky top-0 z-10"
                            style={{ backgroundColor: colors.colorFondo1, backgroundImage: 'none', color: colors.colorLetra }}
                        >
                            <div className="flex-1 min-w-0">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <PackageSearch size={20} />
                                    {t('results')}
                                </h2>
                                <p className="text-xs opacity-90 mt-1 line-clamp-2">
                                    {subRecipes
                                        .filter(sr => parseFloat(quantities[sr.IdProducto]) > 0)
                                        .map(sr => `${sr.Producto} (${quantities[sr.IdProducto]})`)
                                        .join(', ')}
                                </p>
                            </div>
                            <button
                                onClick={() => setExplosionResults(null)}
                                className="shrink-0 p-1.5 rounded-lg hover:bg-white/20 transition-colors ml-4"
                                title={t('close')}
                            >
                                <X size={20} strokeWidth={2} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-auto p-6">
                            <table className="w-full min-w-full divide-y divide-gray-200 border-collapse">
                                <ThemedGridHeader>
                                    <ThemedGridHeaderCell>{t('product')}</ThemedGridHeaderCell>
                                    <ThemedGridHeaderCell align="center">{t('quantity')}</ThemedGridHeaderCell>
                                    <ThemedGridHeaderCell align="center">{t('unit')}</ThemedGridHeaderCell>
                                    <ThemedGridHeaderCell align="right">{t('cost')}</ThemedGridHeaderCell>
                                    <ThemedGridHeaderCell align="right">{t('total')}</ThemedGridHeaderCell>
                                    <ThemedGridHeaderCell align="center">Acciones</ThemedGridHeaderCell>
                                </ThemedGridHeader>
                                <TableBody empty={explosionResults.length === 0} emptyMessage="Sin resultados" colSpan={6}>
                                    {explosionResults.map((item) => (
                                        <TableRow key={item.productId}>
                                            <TableCell>
                                                <div className="font-bold text-gray-900">{item.product}</div>
                                                <div className="text-xs text-gray-500 font-medium mt-0.5">{item.code}</div>
                                            </TableCell>
                                            <TableCell align="center" className="font-bold text-blue-600">
                                                {item.quantity.toFixed(3)}
                                            </TableCell>
                                            <TableCell align="center" muted className="text-xs uppercase font-medium">
                                                {item.unit}
                                            </TableCell>
                                            <TableCell align="right" muted>
                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.price)}
                                            </TableCell>
                                            <TableCell align="right" className="font-bold text-gray-900">
                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.total)}
                                            </TableCell>
                                            <TableCell align="center">
                                                <RowActionButton
                                                    icon={Pencil}
                                                    label="Editar Insumo"
                                                    variant="edit"
                                                    onClick={() => setEditingProduct(item.productData)}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </table>
                        </div>

                        {/* Footer with Summary */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center gap-4">
                            <div className="text-right">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Estimado</p>
                                <p className="text-2xl font-bold text-blue-600 mt-1">
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(grandTotal)}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={() => window.print()} variant="secondary" size="sm" leftIcon={Printer}>
                                    PDF
                                </Button>
                                <Button onClick={() => setExplosionResults(null)} size="sm">
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
