'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import CostingModal, { Product } from '@/components/CostingModal';
import PageShell from '@/components/PageShell';
import LoadingSpinner from '@/components/LoadingSpinner';
import BaseModal from '@/components/BaseModal';
import ThemedGridHeader, { ThemedGridHeaderCell, TableBody, TableRow, TableCell, RowActionButton } from '@/components/ThemedGridHeader';
import { Zap, Printer, BookOpen, UtensilsCrossed, Pencil, X, PackageSearch, ShoppingCart, Trash2, Plus, Check, LayoutGrid, Camera, Loader2 } from 'lucide-react';

interface SubRecipe {
    IdProducto: number;
    Producto: string;
    Codigo: string;
    Categoria: string;
    Presentacion: string;
    Precio: number;
    ArchivoImagen?: string;
    UnidadMedidaInventario?: string;
    NumIngredientes?: number; // productos en su receta/costeo
    tipo: '1' | '2'; // 1=platillo, 2=sub-receta (asignado al cargar)
}

interface CartItem {
    productId: number;
    nombre: string;
    codigo: string;
    unidad: string;
    tipo: '1' | '2';
    cantidad: string;
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

type Filter = 'all' | '1' | '2';

export default function MaterialExplosionPage() {
    const t = useTranslations('MaterialExplosion');
    const tCommon = useTranslations('Common');
    const { colors } = useTheme();

    const [projectId, setProjectId] = useState<number | null>(null);
    const [items, setItems] = useState<SubRecipe[]>([]);
    const [filter, setFilter] = useState<Filter>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [isExploding, setIsExploding] = useState(false);
    const [explosionResults, setExplosionResults] = useState<MaterialResult[] | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    // Carrito fijo a la derecha: mezcla platillos y sub-recetas.
    // Persistente por proyecto en localStorage (sobrevive al cambiar de pantalla).
    const [cart, setCart] = useState<CartItem[]>([]);
    const [cartLoaded, setCartLoaded] = useState(false);
    // Modal de cantidad al hacer clic en una card.
    const [qtyTarget, setQtyTarget] = useState<SubRecipe | null>(null);
    const [qtyValue, setQtyValue] = useState('');
    // Subida de imagen desde la card.
    const imgInputRef = useRef<HTMLInputElement>(null);
    const [uploadTarget, setUploadTarget] = useState<SubRecipe | null>(null);
    const [uploadingId, setUploadingId] = useState<number | null>(null);

    const cartStorageKey = (pid: number) => `explosionCart:${pid}`;

    // Restaura el carrito guardado del proyecto.
    useEffect(() => {
        if (!projectId) return;
        try {
            const raw = localStorage.getItem(cartStorageKey(projectId));
            if (raw) setCart(JSON.parse(raw));
        } catch { /* carrito corrupto: se ignora */ }
        setCartLoaded(true);
    }, [projectId]);

    // Guarda el carrito en cada cambio (solo después de restaurarlo).
    useEffect(() => {
        if (projectId && cartLoaded) {
            localStorage.setItem(cartStorageKey(projectId), JSON.stringify(cart));
        }
    }, [cart, projectId, cartLoaded]);

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
    }, [projectId]);

    // Carga platillos Y sub-recetas de una vez; el filtro es solo visual.
    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            const [subsRes, dishesRes] = await Promise.all([
                fetch(`/api/production/sub-recipes?projectId=${projectId}&type=2`),
                fetch(`/api/production/sub-recipes?projectId=${projectId}&type=1`),
            ]);
            const [subs, dishes] = await Promise.all([subsRes.json(), dishesRes.json()]);
            const merged: SubRecipe[] = [
                ...(subs.success ? subs.data.map((r: any) => ({ ...r, tipo: '2' as const })) : []),
                ...(dishes.success ? dishes.data.map((r: any) => ({ ...r, tipo: '1' as const })) : []),
            ].sort((a, b) => String(a.Producto).localeCompare(String(b.Producto)));
            setItems(merged);
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const cartItem = (id: number) => cart.find((c) => c.productId === id);

    // Clic en card: abre el modal de cantidad (precargada si ya está en el carrito).
    const openQtyModal = (recipe: SubRecipe) => {
        setQtyTarget(recipe);
        setQtyValue(cartItem(recipe.IdProducto)?.cantidad || '');
    };

    const confirmQty = () => {
        if (!qtyTarget) return;
        const qty = parseFloat(qtyValue);
        if (!Number.isFinite(qty) || qty <= 0) {
            // Cantidad vacía o 0: si estaba en el carrito, se quita.
            setCart((prev) => prev.filter((c) => c.productId !== qtyTarget.IdProducto));
            setQtyTarget(null);
            return;
        }
        const item: CartItem = {
            productId: qtyTarget.IdProducto,
            nombre: qtyTarget.Producto,
            codigo: qtyTarget.Codigo || '',
            unidad: qtyTarget.UnidadMedidaInventario || 'pza',
            tipo: qtyTarget.tipo,
            cantidad: qtyValue,
        };
        setCart((prev) => {
            const exists = prev.some((c) => c.productId === item.productId);
            return exists ? prev.map((c) => (c.productId === item.productId ? item : c)) : [...prev, item];
        });
        setQtyTarget(null);
    };

    const updateCartQty = (productId: number, value: string) => {
        if (value === '' || /^\d*\.?\d*$/.test(value)) {
            setCart((prev) => prev.map((c) => (c.productId === productId ? { ...c, cantidad: value } : c)));
        }
    };

    const removeFromCart = (productId: number) =>
        setCart((prev) => prev.filter((c) => c.productId !== productId));

    const validCartItems = cart.filter((c) => parseFloat(c.cantidad) > 0);

    const handleExplode = async () => {
        if (!projectId || validCartItems.length === 0) return;

        setIsExploding(true);
        try {
            const response = await fetch('/api/production/explosion/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: projectId,
                    subRecipes: validCartItems.map((c) => ({
                        productId: c.productId,
                        quantity: parseFloat(c.cantidad),
                    })),
                }),
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

    // Convierte el archivo a data URL redimensionado (máx 800px) para guardarlo
    // en tblProductos.ArchivoImagen igual que el resto de la app.
    const fileToDataUrl = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const MAX = 800;
                    const scale = Math.min(1, MAX / Math.max(img.width, img.height));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(img.width * scale);
                    canvas.height = Math.round(img.height * scale);
                    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.85));
                };
                img.onerror = reject;
                img.src = String(reader.result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

    const handleImageSelected = async (file: File) => {
        if (!uploadTarget || !projectId) return;
        const target = uploadTarget;
        setUploadingId(target.IdProducto);
        try {
            const dataUrl = await fileToDataUrl(file);
            const res = await fetch(`/api/products/${target.IdProducto}/image`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, archivoImagen: dataUrl, nombreArchivo: file.name }),
            });
            const data = await res.json();
            if (data.success) {
                setItems((prev) => prev.map((i) => i.IdProducto === target.IdProducto ? { ...i, ArchivoImagen: dataUrl } : i));
            }
        } catch (e) {
            console.error('Error uploading product image:', e);
        } finally {
            setUploadingId(null);
            setUploadTarget(null);
        }
    };

    const filteredItems = items.filter(sr =>
        (filter === 'all' || sr.tipo === filter) &&
        (sr.Producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
            sr.Codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            sr.Categoria?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const grandTotal = explosionResults?.reduce((sum, item) => sum + item.total, 0) || 0;

    const FILTERS: { id: Filter; label: string; icon: React.ElementType }[] = [
        { id: 'all', label: 'Todos', icon: LayoutGrid },
        { id: '2', label: t('subRecipes'), icon: BookOpen },
        { id: '1', label: t('dishes'), icon: UtensilsCrossed },
    ];

    return (
        <PageShell
            title={t('title')}
            subtitle="Haz clic en un platillo o sub-receta para agregarlo al carrito"
            icon={Zap}
            actions={
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Filtro Todos / Sub-recetas / Platillos: amarillo con letras negras */}
                    <div className="flex items-center gap-1 p-0.5 rounded-lg shrink-0" style={{ backgroundColor: 'var(--color-brand-yellow)' }}>
                        {FILTERS.map((f) => {
                            const Icon = f.icon;
                            const isActive = filter === f.id;
                            return (
                                <button
                                    key={f.id}
                                    onClick={() => setFilter(f.id)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${isActive ? 'shadow-sm' : ''}`}
                                    // Background inline: exime a estos botones del estilo "vidrio"
                                    // que globals.css fuerza dentro de .module-header-actions.
                                    style={{ backgroundColor: isActive ? '#ffffff' : 'transparent', color: '#0a0a0a' }}
                                >
                                    <Icon size={14} style={{ color: '#0a0a0a' }} />
                                    {f.label}
                                </button>
                            );
                        })}
                    </div>
                    <input type="text" placeholder={t('searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent w-48" />
                </div>
            }
        >
            {/* Layout: cards a la izquierda + carrito fijo a la derecha */}
            <div className="flex flex-col lg:flex-row gap-4 items-start">
                <div className="flex-1 min-w-0 w-full">
                    {isLoading ? (
                        <div className="py-20">
                            <LoadingSpinner message={tCommon('loading')} size="md" />
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="bg-white p-20 rounded-2xl border-2 border-dashed border-gray-200 text-center">
                            <p className="text-gray-400 font-bold italic">{t('noSubRecipes')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                            {filteredItems.map(recipe => {
                                const inCart = cartItem(recipe.IdProducto);
                                const isSub = recipe.tipo === '2';
                                return (
                                    <div
                                        key={recipe.IdProducto}
                                        onClick={() => openQtyModal(recipe)}
                                        className={`relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all border-2 group cursor-pointer ${
                                            inCart
                                                ? 'border-emerald-500'
                                                : isSub ? 'border-green-300 hover:border-green-500' : 'border-blue-300 hover:border-blue-500'
                                        }`}
                                    >
                                        {/* Badge de "en carrito" */}
                                        {inCart && (
                                            <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-emerald-500 text-white text-[11px] font-black px-2 py-1 rounded-full shadow">
                                                <Check size={12} strokeWidth={3} />
                                                {inCart.cantidad} {inCart.unidad}
                                            </div>
                                        )}
                                        {/* Subir imagen del platillo/sub-receta */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setUploadTarget(recipe);
                                                imgInputRef.current?.click();
                                            }}
                                            className="absolute top-2 left-2 z-10 p-1.5 rounded-full bg-white/90 text-gray-500 hover:text-gray-800 hover:bg-white shadow transition-colors"
                                            title="Subir imagen"
                                            aria-label="Subir imagen"
                                        >
                                            {uploadingId === recipe.IdProducto
                                                ? <Loader2 size={14} className="animate-spin" />
                                                : <Camera size={14} />}
                                        </button>
                                        <div className={`h-32 flex items-center justify-center border-b ${isSub ? 'bg-green-100 border-green-200' : 'bg-blue-100 border-blue-200'}`}>
                                            {recipe.ArchivoImagen ? (
                                                <img
                                                    src={recipe.ArchivoImagen}
                                                    alt={recipe.Producto}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className={`transition-all ${isSub ? 'text-green-500 group-hover:text-green-600' : 'text-blue-500 group-hover:text-blue-600'}`}>
                                                    {isSub ? <BookOpen size={48} strokeWidth={1.5} /> : <UtensilsCrossed size={48} strokeWidth={1.5} />}
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-4 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-baseline gap-1.5 min-w-0">
                                                        <h3 className="font-black text-gray-800 uppercase text-sm leading-tight truncate">{recipe.Producto}</h3>
                                                        <span className="shrink-0 text-[10px] font-semibold text-gray-400 normal-case">
                                                            {Number(recipe.NumIngredientes) || 0} prod.
                                                        </span>
                                                    </div>
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
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${isSub ? 'bg-green-200 text-green-800' : 'bg-blue-200 text-blue-800'}`}>
                                                        {isSub ? t('subRecipes') : t('dishes')}
                                                    </span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-gray-100 text-gray-600">
                                                        {recipe.UnidadMedidaInventario || 'pza'}
                                                    </span>
                                                </div>
                                                <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${inCart ? 'text-emerald-600' : 'text-gray-400 group-hover:text-gray-600'}`}>
                                                    {inCart ? <><Pencil size={11} /> Cambiar</> : <><Plus size={12} /> Agregar</>}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── Carrito fijo a la derecha ─────────────────────────────── */}
                <aside className="w-full lg:w-80 shrink-0 lg:sticky lg:top-20 order-first lg:order-last">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: colors.colorFondo1 }}>
                            <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: colors.colorLetra }}>
                                <ShoppingCart size={16} />
                                Carrito de explosión
                            </h3>
                            {validCartItems.length > 0 && (
                                <span className="min-w-[22px] h-[22px] px-1 rounded-full bg-white/25 text-xs font-black flex items-center justify-center" style={{ color: colors.colorLetra }}>
                                    {validCartItems.length}
                                </span>
                            )}
                        </div>
                        <div className="max-h-[50vh] lg:max-h-[calc(100vh-320px)] overflow-y-auto divide-y divide-gray-100">
                            {cart.length === 0 ? (
                                <div className="p-6 text-center space-y-2">
                                    <ShoppingCart size={28} className="mx-auto text-gray-200" />
                                    <p className="text-sm text-gray-400">El carrito está vacío.<br />Haz clic en una card para agregar.</p>
                                </div>
                            ) : (
                                cart.map((c) => (
                                    <div key={c.productId} className="px-4 py-2.5 flex items-center gap-2">
                                        <span className={`shrink-0 ${c.tipo === '2' ? 'text-green-500' : 'text-blue-500'}`}>
                                            {c.tipo === '2' ? <BookOpen size={15} /> : <UtensilsCrossed size={15} />}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-gray-800 truncate uppercase">{c.nombre}</p>
                                            <p className="text-[10px] text-gray-400 uppercase">{c.unidad}</p>
                                        </div>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={c.cantidad}
                                            onChange={(e) => updateCartQty(c.productId, e.target.value)}
                                            className="w-16 px-2 py-1 text-sm text-center font-bold rounded-lg border border-gray-200 focus:outline-none focus:border-blue-500"
                                        />
                                        <button onClick={() => removeFromCart(c.productId)} className="shrink-0 p-1.5 text-gray-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors" aria-label="Quitar del carrito">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-3 border-t border-gray-100 bg-gray-50">
                            <Button
                                onClick={handleExplode}
                                isLoading={isExploding}
                                disabled={validCartItems.length === 0}
                                variant="secondary"
                                size="sm"
                                leftIcon={Zap}
                                className="w-full justify-center"
                            >
                                Explotar materiales
                            </Button>
                        </div>
                    </div>
                </aside>
            </div>

            {/* Input oculto para subir imagen desde las cards */}
            <input
                ref={imgInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageSelected(file);
                    e.target.value = '';
                }}
            />

            {/* ── Modal de cantidad ────────────────────────────────────────── */}
            <BaseModal
                isOpen={!!qtyTarget}
                onClose={() => setQtyTarget(null)}
                title={qtyTarget?.Producto || ''}
                subtitle={cartItem(qtyTarget?.IdProducto || -1) ? 'Ya está en el carrito: ajusta la cantidad (0 lo quita)' : 'Cantidad a explotar'}
                size="sm"
                onConfirm={confirmQty}
                confirmLabel={cartItem(qtyTarget?.IdProducto || -1) ? 'Actualizar carrito' : 'Agregar al carrito'}
            >
                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        inputMode="decimal"
                        autoFocus
                        placeholder="0.00"
                        value={qtyValue}
                        onChange={(e) => {
                            if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) setQtyValue(e.target.value);
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') confirmQty(); }}
                        className="flex-1 px-4 py-3 text-2xl text-center font-black rounded-xl border-2 border-gray-200 focus:outline-none focus:border-blue-500 text-gray-900"
                    />
                    <span className="shrink-0 text-sm font-black uppercase tracking-widest px-3 py-2 rounded-lg bg-gray-100 text-gray-600">
                        {qtyTarget?.UnidadMedidaInventario || 'pza'}
                    </span>
                </div>
            </BaseModal>

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
                                    {validCartItems.map((c) => `${c.nombre} (${c.cantidad})`).join(', ')}
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
                    productType={Number(editingProduct.IdTipoProducto ?? (editingProduct as any).tipo ?? 2)}
                />
            )}
        </PageShell>
    );
}
