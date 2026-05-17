'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import Link from 'next/link';
import { useState, useEffect, useMemo, useCallback } from 'react';
import MassiveProductUpload from '@/components/MassiveProductUpload';
import ProductImageCaptureModal from '@/components/ProductImageCaptureModal';
import InitialLoadImageCapture from '@/components/InitialLoadImageCapture';
import Button from '@/components/Button';
import { useParams } from 'next/navigation';
import PageShell from '@/components/PageShell';
import { Rocket } from 'lucide-react';

export default function InitialLoadPage() {
    const t = useTranslations('InitialLoad');
    const { colors } = useTheme();
    const params = useParams();
    const [project, setProject] = useState<any>(null);

    // Modal states
    const [isStep1Open, setIsStep1Open] = useState(false);
    const [isStep2Open, setIsStep2Open] = useState(false);
    const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    
    // Data states
    const [bufferProducts, setBufferProducts] = useState<any[]>([]); // ALL products
    const [categories, setCategories] = useState<any[]>([]);
    const [categoryCounts, setCategoryCounts] = useState<Record<number, number>>({});
    const [selectedIds, setSelectedIds] = useState<any[]>([]); 
    const [isLoading, setIsLoading] = useState(false);

    // Detail view for a specific category
    const [viewingCategory, setViewingCategory] = useState<any>(null);
    const [categoryProducts, setCategoryProducts] = useState<any[]>([]);

    // Drag state
    const [dragOverId, setDragOverId] = useState<number | null>(null);

    // Search states
    const [productSearch, setProductSearch] = useState('');
    const [categorySearch, setCategorySearch] = useState('');
    const [isStep4Open, setIsStep4Open] = useState(false);
    const [isStep5Open, setIsStep5Open] = useState(false);
    const [isStep6Open, setIsStep6Open] = useState(false);
    const [isSingleImageCaptureOpen, setIsSingleImageCaptureOpen] = useState(false);
    const [previewSearch, setPreviewSearch] = useState('');
    const [categoryDetailSearch, setCategoryDetailSearch] = useState('');

    // Inventory Params Modal (Step 3 -> 4)
    const [isParamsModalOpen, setIsParamsModalOpen] = useState(false);
    const [selectedBufferProduct, setSelectedBufferProduct] = useState<any>(null);
    const [inventoryParams, setInventoryParams] = useState({
        unidadMedidaCompra: '',
        cantidadCompra: 1,
        unidadMedidaInventario: ''
    });

    // Recipe Params Modal (Step 4 -> 5)
    const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
    const [recipeParams, setRecipeParams] = useState({
        unidadMedidaRecetario: '',
        conversionSimple: 1
    });

    // Manual Entry State
    const [isAddingManual, setIsAddingManual] = useState(false);
    const [newManualProduct, setNewManualProduct] = useState({
        producto: '',
        precio: 0,
        codigo: ''
    });

    const CONVERSION_FACTORS: Record<string, number> = {
        'kg': 1, 'kilo': 1, 'kilogramo': 1, 'kilos': 1,
        'g': 0.001, 'gramo': 0.001, 'gramos': 0.001,
        'lb': 0.453592, 'libra': 0.453592,
        'oz': 0.0283495, 'onza': 0.0283495,
        'l': 1, 'litro': 1, 'litros': 1,
        'ml': 0.001, 'mililitro': 0.001,
        'gal': 3.78541, 'galon': 3.78541,
        'fl-oz': 0.0295735, 'onza fluida': 0.0295735,
        'taza': 0.236588,
        'pieza': 1, 'pz': 1, 'piezas': 1
    };

    const calculateDefaultConversion = (inventoryUnit: string, recipeUnit: string) => {
        const invFactor = CONVERSION_FACTORS[inventoryUnit.toLowerCase()] || 1;
        const recFactor = CONVERSION_FACTORS[recipeUnit.toLowerCase()] || 1;
        
        // If both units are in the same system (or both not found), calculate ratio
        // We assume 1 Inventory Unit = X Recipe Units
        // So Conversion = invFactor / recFactor
        // Example: 1 kg (1) = 1000 g (0.001) -> 1 / 0.001 = 1000
        return invFactor / recFactor;
    };

    const COMMON_UNITS = [
        'kg', 'g', 'lb', 'oz', 't', 'ar', 'l', 'ml', 'gal', 'qt', 'pt', 'fl-oz', 'taza', 'garrafon', 'Pieza', 'Caja', 'Paquete', 'Bolsa', 'Frasco', 'Lata', 'Cubeta', 'Tambor', 'Sobres', 'Cartera', 'Kilo', 'Gramo', 'Litro', 'Mililitro'
    ];

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) setProject(JSON.parse(storedProject));
    }, []);

    // FETCH LOGIC
    const fetchData = useCallback(async () => {
        if (!project?.idProyecto) return;
        setIsLoading(true);
        try {
            const [catRes, allRes] = await Promise.all([
                fetch(`/api/config/initial-load/categories`),
                fetch(`/api/config/initial-load/buffer-products?projectId=${project.idProyecto}`)
            ]);
            
            const [catData, allData] = await Promise.all([
                catRes.json(), allRes.json()
            ]);
            
            if (catData.success) setCategories(catData.data);
            
            const countsMap: any = {};
            if (allData.success) {
                setBufferProducts(allData.data);
                allData.data.forEach((p: any) => {
                    if (p.IdCategoria > 0) {
                        countsMap[p.IdCategoria] = (countsMap[p.IdCategoria] || 0) + 1;
                    }
                });
            }
            setCategoryCounts(countsMap);
        } catch (err) { console.error('Error fetching data:', err); }
        finally { setIsLoading(false); }
    }, [project]);

    useEffect(() => {
        if (isStep1Open || isStep2Open || isPreviewOpen) fetchData();
    }, [isStep1Open, isStep2Open, isPreviewOpen, fetchData]);

    const fetchCategoryProducts = async (idCat: number) => {
        if (!project?.idProyecto) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/config/initial-load/buffer-products?projectId=${project.idProyecto}&idCategoria=${idCat}`);
            const data = await res.json();
            if (data.success) {
                setCategoryProducts(data.data);
                setCategoryDetailSearch('');
            }
        } catch (err) { console.error('Error fetching category products:', err); }
        finally { setIsLoading(false); }
    };

    // COMPUTED DATA
    const step1Products = useMemo(() => bufferProducts.filter(p => (p.IdCategoria || 0) === 0), [bufferProducts]);
    const step2Products = useMemo(() => bufferProducts.filter(p => (p.IdCategoria || 0) === 0), [bufferProducts]);
    const step3Products = useMemo(() => bufferProducts.filter(p => (p.IdCategoria || 0) > 0 && (!p.UnidadMedidaCompra || !p.UnidadMedidaInventario)), [bufferProducts]);
    const step4Products = useMemo(() => bufferProducts.filter(p => (p.IdCategoria || 0) > 0 && p.UnidadMedidaCompra && p.UnidadMedidaInventario && !p.UnidadMedidaRecetario), [bufferProducts]);
    const step5Products = useMemo(() => bufferProducts.filter(p => (p.IdCategoria || 0) > 0 && p.UnidadMedidaRecetario), [bufferProducts]);
    const step6Products = useMemo(() => bufferProducts.filter(p => (p.IdCategoria || 0) > 0 && p.ArchivoImagen), [bufferProducts]);
    
    const filteredStep2Products = useMemo(() => {
        return step2Products.filter(p => 
            (p.Producto || '').toLowerCase().includes(productSearch.toLowerCase()) || 
            (p.Codigo || '').toLowerCase().includes(productSearch.toLowerCase())
        );
    }, [step2Products, productSearch]);

    const filteredCategories = useMemo(() => categories.filter(c => (c.Categoria || '').toLowerCase().includes(categorySearch.toLowerCase())), [categories, categorySearch]);

    const filteredPreviewProducts = useMemo(() => {
        return step3Products.filter(p => {
                const search = previewSearch.toLowerCase();
                const cat = categories.find(c => c.IdCategoria === p.IdCategoria);
                const matchesProduct = (p.Producto || '').toLowerCase().includes(search) || (p.Codigo || '').toLowerCase().includes(search);
                const matchesCategory = (cat?.Categoria || '').toLowerCase().includes(search);
                return matchesProduct || matchesCategory;
            });
    }, [step3Products, previewSearch, categories]);

    const filteredStep4Products = useMemo(() => {
        return step4Products.filter(p => {
            const search = previewSearch.toLowerCase(); // Reusing previewSearch for Step 4 too or could use another
            const cat = categories.find(c => c.IdCategoria === p.IdCategoria);
            const matchesProduct = (p.Producto || '').toLowerCase().includes(search) || (p.Codigo || '').toLowerCase().includes(search);
            const matchesCategory = (cat?.Categoria || '').toLowerCase().includes(search);
            return matchesProduct || matchesCategory;
        });
    }, [step4Products, previewSearch, categories]);

    const filteredCategoryProducts = useMemo(() => {
        return categoryProducts.filter(p => 
            (p.Producto || '').toLowerCase().includes(categoryDetailSearch.toLowerCase()) ||
            (p.Codigo || '').toLowerCase().includes(categoryDetailSearch.toLowerCase())
        );
    }, [categoryProducts, categoryDetailSearch]);

    // ACTIONS
    const handleUpdateBuffer = async (idBuffer: number, field: string, value: any) => {
        if (!project?.idProyecto) return;
        try {
            const payload: any = {
                projectId: project.idProyecto,
                idBuffer,
                [field]: value
            };
            
            // Special handling for inventory params bulk update
            if (field === 'inventoryParams') {
                delete payload[field];
                payload.UnidadMedidaCompra = value.unidadMedidaCompra;
                payload.CantidadCompra = value.cantidadCompra;
                payload.UnidadMedidaInventario = value.unidadMedidaInventario;
            }

            // Special handling for recipe params bulk update
            if (field === 'recipeParams') {
                delete payload[field];
                payload.UnidadMedidaRecetario = value.unidadMedidaRecetario;
                payload.ConversionSimple = value.conversionSimple;
            }

            // Reset inventory params
            if (field === 'resetInventory') {
                payload.UnidadMedidaCompra = null;
                payload.CantidadCompra = 1;
                payload.UnidadMedidaInventario = null;
            }

            await fetch('/api/config/initial-load/buffer-products', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            fetchData();
        } catch (err) { console.error('Error updating buffer item:', err); }
    };

    const handleAddManual = async () => {
        if (!project?.idProyecto) return;
        if (!newManualProduct.producto) {
            alert('El nombre del producto es obligatorio.');
            return;
        }

        try {
            const res = await fetch('/api/config/initial-load/buffer-products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    ...newManualProduct
                })
            });
            const data = await res.json();
            if (data.success) {
                setIsAddingManual(false);
                setNewManualProduct({ producto: '', precio: 0, codigo: '' });
                fetchData();
            }
        } catch (err) { console.error('Error adding manual product:', err); }
    };

    const handleSaveInventoryParams = async () => {
        if (!selectedBufferProduct || !project?.idProyecto) return;
        if (!inventoryParams.unidadMedidaCompra || !inventoryParams.unidadMedidaInventario || !inventoryParams.cantidadCompra) {
            alert('Todos los campos son obligatorios.');
            return;
        }

        await handleUpdateBuffer(selectedBufferProduct.IdBuffer || selectedBufferProduct.idBuffer, 'inventoryParams', inventoryParams);
        setIsParamsModalOpen(false);
    };

    const handleSaveRecipeParams = async () => {
        if (!selectedBufferProduct || !project?.idProyecto) return;
        if (!recipeParams.unidadMedidaRecetario || !recipeParams.conversionSimple) {
            alert('Todos los campos son obligatorios.');
            return;
        }

        await handleUpdateBuffer(selectedBufferProduct.IdBuffer || selectedBufferProduct.idBuffer, 'recipeParams', recipeParams);
        setIsRecipeModalOpen(false);
    };

    const handleUnlink = async (idBuffer: number) => {
        if (!project?.idProyecto) return;
        try {
            const res = await fetch('/api/config/initial-load/buffer-products', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    ids: [idBuffer],
                    idCategoria: 0
                })
            });
            if ((await res.json()).success) {
                if (viewingCategory) fetchCategoryProducts(viewingCategory.IdCategoria);
                fetchData();
            }
        } catch (err) { console.error('Error unlinking:', err); }
    };

    const handleDeleteBuffer = async (idBuffer: any, from: string) => {
        if (!project?.idProyecto) return;
        if (!confirm('¿Seguro que deseas eliminar este producto?')) return;
        try {
            const res = await fetch(`/api/config/initial-load/buffer-products?projectId=${project.idProyecto}&idBuffer=${idBuffer}`, {
                method: 'DELETE'
            });
            if ((await res.json()).success) {
                if (from === 'category') fetchCategoryProducts(viewingCategory.IdCategoria);
                fetchData();
            }
        } catch (err) { console.error('Error deleting buffer item:', err); }
    };

    // DRAG AND DROP
    const handleDragStart = (e: React.DragEvent, id: any) => {
        let idsToDrag = selectedIds.includes(id) ? selectedIds : [id];
        setSelectedIds(idsToDrag);
        e.dataTransfer.setData('text/plain', JSON.stringify(idsToDrag));
        e.dataTransfer.effectAllowed = 'move';
        e.currentTarget.classList.add('opacity-40');
    };

    const handleDragEnd = (e: React.DragEvent) => {
        e.currentTarget.classList.remove('opacity-40');
        setDragOverId(null);
    };

    const handleDrop = async (e: React.DragEvent, idCategoria: number) => {
        e.preventDefault();
        setDragOverId(null);
        const rawData = e.dataTransfer.getData('text/plain');
        if (!rawData || !project?.idProyecto) return;
        try {
            const ids = JSON.parse(rawData);
            const res = await fetch('/api/config/initial-load/buffer-products', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: project.idProyecto, ids, idCategoria })
            });
            if ((await res.json()).success) {
                fetchData();
                setSelectedIds([]);
            }
        } catch (err) { console.error('Error dropping:', err); }
    };

    const toggleSelect = (id: any, e: React.MouseEvent) => {
        e.stopPropagation();
        if (e.ctrlKey || e.metaKey) setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
        else setSelectedIds([id]);
    };

    const steps = [
        { id: 1, title: 'Carga de productos', count: step1Products.length, emoji: '🏷️', onClick: () => setIsStep1Open(true), color: 'from-blue-500 to-indigo-600' },
        { id: 2, title: 'Categorización', count: step2Products.length, emoji: '📂', onClick: () => setIsStep2Open(true), color: 'from-emerald-500 to-teal-600' },
        { id: 3, title: 'Parámetros de Inventario', count: step3Products.length, emoji: '📦', onClick: () => setIsPreviewOpen(true), color: 'from-amber-500 to-orange-600' },
        { id: 4, title: 'Parámetros de Receta', count: step4Products.length, emoji: '📖', onClick: () => setIsStep4Open(true), color: 'from-purple-500 to-pink-600' },
        { id: 5, title: 'Imágenes', count: step5Products.length, emoji: '📸', onClick: () => setIsStep5Open(true), color: 'from-indigo-500 to-blue-600' },
        { id: 6, title: 'Inventario Inicial', count: step6Products.length, emoji: '🏁', onClick: () => setIsStep6Open(true), color: 'from-emerald-500 to-teal-600' }
    ];

    return (
        <PageShell title={t('title')} subtitle="Gestión de flujo de carga inicial." icon={Rocket}>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {steps.map((step) => (
                    <div key={step.id} onClick={step.onClick} className="group relative overflow-hidden bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 flex flex-col cursor-pointer">
                        <div className={`h-2 w-full bg-gradient-to-r ${step.color}`}></div>
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-xs font-black text-slate-400 uppercase tracking-wider">PASO {step.id}</span>
                                <span className="text-4xl group-hover:scale-125 transition-transform">{step.emoji}</span>
                            </div>
                            <h2 className="text-lg font-bold text-gray-800">{step.title}</h2>
                            <div className="mt-2 text-2xl font-black text-indigo-600">{step.count} <span className="text-xs text-slate-400 font-bold uppercase">Productos</span></div>
                        </div>
                    </div>
                ))}
            </div>

            {/* STEP 1 MODAL */}
            {isStep1Open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-6xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
                        <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                            <div><h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3"><span className="bg-blue-600 text-white p-2 rounded-xl shadow-lg">🏷️</span>Paso 1: Carga de productos ({step1Products.length})</h2><p className="text-xs text-slate-400 font-medium">Gestiona el buffer de productos importados.</p></div>
                            <div className="flex items-center gap-4">
                                <Button onClick={() => setIsExcelModalOpen(true)} className="bg-emerald-600 text-xs h-auto py-2">EXCEL</Button>
                                <Button onClick={() => setIsImageModalOpen(true)} className="bg-indigo-600 text-xs h-auto py-2">IMAGEN</Button>
                                <Button onClick={() => setIsAddingManual(true)} className="bg-amber-600 text-xs h-auto py-2">MANUAL</Button>
                                <button onClick={() => setIsStep1Open(false)} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400">✕</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-8">
                            <div className="bg-slate-50 rounded-[2rem] overflow-hidden border border-slate-100">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-slate-100/50 font-black text-slate-400 uppercase tracking-widest"><tr><th className="px-6 py-4">Documento</th><th className="px-6 py-4">Producto</th><th className="px-6 py-4">Precio</th><th className="px-6 py-4">Código</th><th className="px-6 py-4 text-center">Acciones</th></tr></thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {isAddingManual && (
                                            <tr className="bg-amber-50/50 animate-in slide-in-from-top duration-300">
                                                <td className="px-6 py-3 text-amber-600 font-black italic">MANUAL</td>
                                                <td className="px-6 py-3"><input autoFocus className="bg-white border-2 border-amber-200 rounded-xl px-4 py-2 font-bold text-slate-700 w-full focus:ring-2 focus:ring-amber-400 outline-none" placeholder="NOMBRE DEL PRODUCTO..." value={newManualProduct.producto} onChange={(e) => setNewManualProduct({...newManualProduct, producto: e.target.value.toUpperCase()})} /></td>
                                                <td className="px-6 py-3"><input type="number" className="bg-white border-2 border-amber-200 rounded-xl px-4 py-2 w-24 focus:ring-2 focus:ring-amber-400 outline-none font-bold text-slate-700" placeholder="0.00" value={newManualProduct.precio || ''} onChange={(e) => setNewManualProduct({...newManualProduct, precio: parseFloat(e.target.value) || 0})} /></td>
                                                <td className="px-6 py-3"><input className="bg-white border-2 border-amber-200 rounded-xl px-4 py-2 text-slate-500 w-full focus:ring-2 focus:ring-amber-400 outline-none" placeholder="CÓDIGO (OPCIONAL)..." value={newManualProduct.codigo} onChange={(e) => setNewManualProduct({...newManualProduct, codigo: e.target.value.toUpperCase()})} /></td>
                                                <td className="px-6 py-3 text-center flex items-center justify-center gap-2">
                                                    <button onClick={handleAddManual} className="p-2 bg-emerald-500 text-white rounded-xl shadow-lg hover:bg-emerald-600 transition-all text-lg">✓</button>
                                                    <button onClick={() => setIsAddingManual(false)} className="p-2 bg-slate-200 text-slate-500 rounded-xl shadow-lg hover:bg-slate-300 transition-all text-lg">✕</button>
                                                </td>
                                            </tr>
                                        )}
                                        {step1Products.map((p, index) => {
                                            const id = p.IdBuffer || p.idBuffer || index;
                                            return (
                                                <tr key={id} className="hover:bg-white transition-colors group">
                                                    <td className="px-6 py-3 text-slate-400 italic">{p.ProductoDocumento || 'N/A'}</td>
                                                    <td className="px-6 py-3"><input className="bg-transparent border-none font-bold text-slate-700 w-full focus:ring-0" value={p.Producto} onChange={(e) => handleUpdateBuffer(id as number, 'Producto', e.target.value.toUpperCase())} /></td>
                                                    <td className="px-6 py-3"><input type="number" className="bg-transparent border-none w-20 focus:ring-0 font-bold text-slate-700" value={p.Precio} onChange={(e) => handleUpdateBuffer(id as number, 'Precio', parseFloat(e.target.value) || 0)} /></td>
                                                    <td className="px-6 py-3"><input className="bg-transparent border-none text-slate-500 w-full focus:ring-0" value={p.Codigo} onChange={(e) => handleUpdateBuffer(id as number, 'Codigo', e.target.value.toUpperCase())} /></td>
                                                    <td className="px-6 py-3 text-center"><button onClick={() => handleDeleteBuffer(id, 'step1')} className="text-red-400 hover:text-red-600 transition-colors">🗑️</button></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {step1Products.length === 0 && <div className="py-20 text-center text-slate-300 font-bold italic">No hay productos pendientes de categorizar.</div>}
                            </div>
                        </div>
                        <div className="px-8 py-6 border-t border-slate-50 flex justify-end"><Button onClick={() => { setIsStep1Open(false); setIsStep2Open(true); }} className="px-10 bg-blue-600 shadow-lg shadow-blue-100 uppercase text-xs font-black tracking-widest flex items-center gap-2">Siguiente <span className="text-lg">→</span></Button></div>
                    </div>
                </div>
            )}

            {/* STEP 2 MODAL */}
            {isStep2Open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-7xl h-[95vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
                        <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                            <div><h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3"><span className="bg-emerald-600 text-white p-2 rounded-xl shadow-lg">📂</span>Paso 2: Categorización ({step2Products.length})</h2><p className="text-xs text-slate-400 font-medium">Arrastra los productos a sus categorías.</p></div>
                            <div className="flex items-center gap-4">
                                <button onClick={() => setIsStep2Open(false)} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">✕</button>
                            </div>
                        </div>
                        <div className="flex-1 flex overflow-hidden p-6 gap-6 bg-slate-50/50">
                            <div className="w-1/2 flex flex-col bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                                <div className="p-4 bg-slate-100/30 border-b border-slate-100 flex flex-col gap-3">
                                    <div className="flex justify-between items-center"><span className="text-xs font-black text-slate-500 uppercase tracking-widest">Sin Categoría ({filteredStep2Products.length})</span></div>
                                    <div className="relative"><input type="text" placeholder="Buscar producto..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-white border border-slate-200" /><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span></div>
                                </div>
                                <div className="flex-1 overflow-auto p-4 grid grid-cols-2 gap-3 content-start">
                                    {filteredStep2Products.map((p, index) => {
                                        const id = p.IdBuffer || p.idBuffer || `p-${index}`;
                                        return (
                                            <div key={id} draggable onDragStart={(e) => handleDragStart(e, id)} onDragEnd={handleDragEnd} onClick={(e) => toggleSelect(id, e)}
                                                className={`p-4 rounded-2xl border transition-all cursor-move relative ${selectedIds.includes(id) ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-100' : 'bg-white border-slate-100 hover:border-blue-200 shadow-sm'}`}
                                            >
                                                <div className="text-[11px] font-black text-slate-800 line-clamp-1 uppercase">{p.Producto}</div>
                                                <div className="text-[9px] text-slate-400 mt-1 flex justify-between items-center"><span>{p.Codigo}</span><span className="font-bold text-slate-500">${p.Precio}</span></div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="w-1/2 flex flex-col bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                                <div className="p-4 bg-slate-100/30 border-b border-slate-100 flex flex-col gap-3"><div className="font-black text-xs text-slate-500 uppercase tracking-widest">Categorías</div><div className="relative"><input type="text" placeholder="Buscar categoría..." value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-white border border-slate-200" /><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span></div></div>
                                <div className="flex-1 overflow-auto p-4 grid grid-cols-2 gap-4 content-start">
                                    {filteredCategories.map((c) => (
                                        <div key={c.IdCategoria} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDragEnter={(e) => { e.preventDefault(); setDragOverId(c.IdCategoria); }} onDragLeave={() => setDragOverId(null)} onDrop={(e) => handleDrop(e, c.IdCategoria)}
                                            onClick={() => { setViewingCategory(c); fetchCategoryProducts(c.IdCategoria); }}
                                            className={`p-5 rounded-[2rem] border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center relative ${dragOverId === c.IdCategoria ? 'bg-emerald-100 border-emerald-500 scale-105' : 'bg-slate-50 border-slate-200 hover:border-emerald-500'}`}
                                        >
                                            <div className="text-3xl mb-2 pointer-events-none">{c.ImagenCategoria || '📁'}</div>
                                            <div className="text-xs font-black text-slate-700 uppercase tracking-tight pointer-events-none">{c.Categoria}</div>
                                            {categoryCounts[c.IdCategoria] > 0 && <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg">{categoryCounts[c.IdCategoria]}</div>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="px-8 py-6 border-t border-slate-50 flex justify-between items-center bg-slate-50/30">
                            <Button onClick={() => { setIsStep2Open(false); setIsStep1Open(true); }} className="px-10 bg-slate-500 text-white shadow-lg shadow-slate-100 uppercase text-xs font-black tracking-widest flex items-center gap-2"><span className="text-lg">←</span> Anterior</Button>
                            <Button onClick={() => { setIsStep2Open(false); setIsPreviewOpen(true); }} className="px-10 bg-emerald-600 shadow-lg shadow-emerald-100 uppercase text-xs font-black tracking-widest flex items-center gap-2">Siguiente <span className="text-lg">→</span></Button>
                        </div>
                    </div>
                </div>
            )}

            {/* CATEGORY PRODUCTS DETAIL MODAL */}
            {viewingCategory && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-4xl max-h-[80vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
                        <div className="p-6 border-b border-slate-100 flex flex-col gap-4 bg-slate-50/50">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4"><span className="text-4xl">{viewingCategory.ImagenCategoria || '📁'}</span><div><h3 className="text-xl font-black text-slate-800 uppercase">{viewingCategory.Categoria}</h3><p className="text-xs text-slate-400 font-medium">{categoryProducts.length} Productos vinculados</p></div></div>
                                <button onClick={() => setViewingCategory(null)} className="text-slate-400">✕</button>
                            </div>
                            <div className="relative"><input type="text" placeholder="Buscar en esta categoría..." value={categoryDetailSearch} onChange={(e) => setCategoryDetailSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-white border border-slate-200" /><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span></div>
                        </div>
                        <div className="flex-1 overflow-auto p-6 bg-slate-50/30">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredCategoryProducts.map(p => (
                                    <div key={p.IdBuffer || p.idBuffer} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center group">
                                        <div className="min-w-0 flex-1"><div className="text-sm font-black text-slate-800 truncate uppercase">{p.Producto}</div><div className="text-[10px] text-slate-400 font-medium mt-0.5">CÓDIGO: {p.Codigo} | ${p.Precio}</div></div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => handleUnlink(p.IdBuffer || p.idBuffer)} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all shadow-sm border border-red-100" title="Desvincular de la categoría">🗑️</button>
                                            <button onClick={() => handleDeleteBuffer(p.IdBuffer || p.idBuffer, 'category')} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" title="Eliminar permanentemente">✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TOTAL PREVIEW MODAL */}
            {isPreviewOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
                        <div className="p-8 border-b border-slate-100 flex flex-col gap-4 bg-white shadow-sm">
                            <div className="flex justify-between items-center">
                                <div><h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3"><span className="bg-amber-500 text-white p-2 rounded-xl shadow-lg">⚙️</span>Paso 3: Parámetros de Inventario ({bufferProducts.filter(p => (p.IdCategoria || 0) > 0).length})</h2><p className="text-xs text-slate-400 font-medium">Asigna unidades y parámetros de costeo a los productos categorizados.</p></div>
                                <button onClick={() => setIsPreviewOpen(false)} className="text-slate-400 hover:bg-slate-100 w-10 h-10 rounded-full flex items-center justify-center transition-colors">✕</button>
                            </div>
                            <div className="relative"><input type="text" placeholder="Buscar por producto o categoría..." value={previewSearch} onChange={(e) => setPreviewSearch(e.target.value)} className="w-full pl-12 pr-4 py-3 text-sm rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-amber-200 transition-all font-bold text-slate-700" /><span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl">🔍</span></div>
                        </div>
                        <div className="flex-1 overflow-auto p-8 bg-slate-50/50">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredPreviewProducts.map((p, index) => {
                                    const cat = categories.find(c => c.IdCategoria === p.IdCategoria);
                                    return (
                                        <div 
                                            key={p.IdBuffer || p.idBuffer || index} 
                                            onClick={() => {
                                                setSelectedBufferProduct(p);
                                                setInventoryParams({
                                                    unidadMedidaCompra: p.UnidadMedidaCompra || '',
                                                    cantidadCompra: p.CantidadCompra || 1,
                                                    unidadMedidaInventario: p.UnidadMedidaInventario || ''
                                                });
                                                setIsParamsModalOpen(true);
                                            }}
                                            className="p-5 bg-white border border-slate-100 rounded-[2rem] shadow-sm flex items-center gap-4 group relative cursor-pointer hover:border-amber-400 transition-all"
                                        >
                                            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner">{cat?.ImagenCategoria || '❓'}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[11px] font-black text-slate-800 truncate uppercase tracking-tight">{p.Producto}</div>
                                                <div className="text-[10px] font-bold text-indigo-500 mt-1 uppercase truncate bg-indigo-50 inline-block px-2 py-0.5 rounded-lg">{cat?.Categoria || 'SIN CATEGORÍA'}</div>
                                                <div className="text-[9px] text-slate-300 mt-1 font-medium">{p.Codigo} | ${p.Precio}</div>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleUnlink(p.IdBuffer || p.idBuffer); }}
                                                className="absolute bottom-3 right-3 p-1.5 bg-white text-red-500 rounded-xl hover:bg-red-50 transition-all shadow-sm border border-slate-100 group-hover:border-red-100"
                                                title="Desvincular Categoría"
                                            >
                                                <span className="text-xs">🗑️</span>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="px-8 py-6 border-t border-slate-100 flex justify-between items-center bg-white">
                            <Button onClick={() => { setIsPreviewOpen(false); setIsStep2Open(true); }} className="px-10 bg-slate-500 text-white shadow-lg shadow-slate-100 uppercase text-xs font-black tracking-widest flex items-center gap-2"><span className="text-lg">←</span> Anterior</Button>
                            <Button onClick={() => { setIsPreviewOpen(false); setIsStep4Open(true); }} className="px-10 bg-amber-500 shadow-lg shadow-amber-100 uppercase text-xs font-black tracking-widest flex items-center gap-2">Siguiente <span className="text-lg">→</span></Button>
                        </div>
                    </div>
                </div>
            )}

            {/* INVENTORY PARAMS MODAL (CAPTURA) */}
            {isParamsModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in zoom-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
                        <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                            <div className="flex-1">
                                <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Configurando Parámetros</label>
                                <h3 className="text-2xl font-black text-slate-800 leading-tight uppercase">{selectedBufferProduct?.Producto}</h3>
                                <p className="text-xs text-slate-400 font-medium mt-1">{selectedBufferProduct?.Codigo}</p>
                            </div>
                            <button onClick={() => setIsParamsModalOpen(false)} className="w-12 h-12 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 transition-colors">✕</button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Unidad Medida Compra *</label>
                                <select 
                                    value={inventoryParams.unidadMedidaCompra}
                                    onChange={(e) => {
                                        const newUnit = e.target.value;
                                        let newInvUnit = inventoryParams.unidadMedidaInventario;
                                        if (inventoryParams.cantidadCompra === 1) {
                                            newInvUnit = newUnit;
                                        } else if (newUnit === newInvUnit) {
                                            newInvUnit = '';
                                        }
                                        setInventoryParams({...inventoryParams, unidadMedidaCompra: newUnit, unidadMedidaInventario: newInvUnit});
                                    }}
                                    className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-amber-200"
                                >
                                    <option value="">Seleccionar Unidad...</option>
                                    {COMMON_UNITS.sort().map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Cantidad (Contenido) *</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={inventoryParams.cantidadCompra === 0 ? '' : inventoryParams.cantidadCompra}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        const newQty = val === '' ? 0 : parseFloat(val);
                                        let newInvUnit = inventoryParams.unidadMedidaInventario;
                                        
                                        if (newQty === 1) {
                                            newInvUnit = inventoryParams.unidadMedidaCompra;
                                        } else if (inventoryParams.unidadMedidaCompra === newInvUnit) {
                                            newInvUnit = '';
                                        }
                                        
                                        setInventoryParams({...inventoryParams, cantidadCompra: newQty, unidadMedidaInventario: newInvUnit});
                                    }}
                                    onBlur={(e) => {
                                        if (e.target.value === '') setInventoryParams({...inventoryParams, cantidadCompra: 1});
                                    }}
                                    className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-amber-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    placeholder="Ej. 1.00"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Unidad Medida Inventario *</label>
                                <select 
                                    value={inventoryParams.unidadMedidaInventario}
                                    onChange={(e) => setInventoryParams({...inventoryParams, unidadMedidaInventario: e.target.value})}
                                    className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-amber-200"
                                >
                                    <option value="">Seleccionar Unidad...</option>
                                    {COMMON_UNITS.sort().map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex gap-3">
                            <Button onClick={() => setIsParamsModalOpen(false)} className="flex-1 bg-slate-200 text-slate-500">Cancelar</Button>
                            <Button onClick={handleSaveInventoryParams} className="flex-1 bg-amber-500 shadow-lg shadow-amber-100">Guardar</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 4: RECIPE PARAMS MODAL */}
            {isStep4Open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
                        <div className="p-8 border-b border-slate-100 flex flex-col gap-4 bg-white shadow-sm">
                            <div className="flex justify-between items-center">
                                <div><h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3"><span className="bg-purple-600 text-white p-2 rounded-xl shadow-lg">📖</span>Paso 4: Parámetros de Receta ({step4Products.length})</h2><p className="text-xs text-slate-400 font-medium">Revisa los productos listos para ser insertados en el catálogo final.</p></div>
                                <button onClick={() => setIsStep4Open(false)} className="text-slate-400 hover:bg-slate-100 w-10 h-10 rounded-full flex items-center justify-center transition-colors">✕</button>
                            </div>
                            <div className="relative"><input type="text" placeholder="Buscar por producto o categoría..." value={previewSearch} onChange={(e) => setPreviewSearch(e.target.value)} className="w-full pl-12 pr-4 py-3 text-sm rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-purple-200 transition-all font-bold text-slate-700" /><span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl">🔍</span></div>
                        </div>
                        <div className="flex-1 overflow-auto p-8 bg-slate-50/50">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredStep4Products.map((p, index) => {
                                    const cat = categories.find(c => c.IdCategoria === p.IdCategoria);
                                    return (
                                        <div 
                                            key={p.IdBuffer || p.idBuffer || index} 
                                            onClick={() => {
                                                setSelectedBufferProduct(p);
                                                setRecipeParams({
                                                    unidadMedidaRecetario: p.UnidadMedidaInventario || '',
                                                    conversionSimple: 1
                                                });
                                                setIsRecipeModalOpen(true);
                                            }}
                                            className="p-5 bg-white border border-slate-100 rounded-[2rem] shadow-sm flex items-center gap-4 group relative cursor-pointer hover:border-purple-400 transition-all"
                                        >
                                            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner">{cat?.ImagenCategoria || '❓'}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[11px] font-black text-slate-800 truncate uppercase tracking-tight">{p.Producto}</div>
                                                <div className="text-[10px] font-bold text-indigo-500 mt-1 uppercase truncate bg-indigo-50 inline-block px-2 py-0.5 rounded-lg">{cat?.Categoria || 'SIN CATEGORÍA'}</div>
                                                <div className="text-[9px] text-slate-400 mt-2 font-bold flex flex-wrap gap-2">
                                                    <span className="bg-slate-100 px-2 py-1 rounded-lg">📦 {p.UnidadMedidaCompra}</span>
                                                    <span className="bg-slate-100 px-2 py-1 rounded-lg">⚖️ {p.CantidadCompra} {p.UnidadMedidaInventario}</span>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleUpdateBuffer(p.IdBuffer || p.idBuffer, 'resetInventory', null); }}
                                                className="absolute bottom-3 right-3 p-1.5 bg-white text-red-500 rounded-xl hover:bg-red-50 transition-all shadow-sm border border-slate-100 group-hover:border-red-100"
                                                title="Resetear Parámetros de Inventario"
                                            >
                                                <span className="text-xs">🗑️</span>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="px-8 py-6 border-t border-slate-100 flex justify-between items-center bg-white">
                            <Button onClick={() => { setIsStep4Open(false); setIsPreviewOpen(true); }} className="px-10 bg-slate-500 text-white shadow-lg shadow-slate-100 uppercase text-xs font-black tracking-widest flex items-center gap-2"><span className="text-lg">←</span> Anterior</Button>
                            <Button onClick={() => { setIsStep4Open(false); setIsStep5Open(true); }} className="px-10 bg-purple-600 shadow-lg shadow-purple-100 uppercase text-xs font-black tracking-widest flex items-center gap-2">Siguiente <span className="text-lg">→</span></Button>
                        </div>
                    </div>
                </div>
            )}

            {/* RECIPE PARAMS MODAL (CAPTURA) */}
            {isRecipeModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in zoom-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
                        <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                            <div className="flex-1">
                                <label className="text-[10px] font-black text-purple-500 uppercase tracking-widest">Configurando Parámetros de Receta</label>
                                <h3 className="text-2xl font-black text-slate-800 leading-tight uppercase">{selectedBufferProduct?.Producto}</h3>
                            </div>
                            <button onClick={() => setIsRecipeModalOpen(false)} className="w-12 h-12 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 transition-colors">✕</button>
                        </div>
                        <div className="p-8 space-y-6">
                            {/* Inventory Info (Read-only) */}
                            <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                                <div>
                                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Medida Compra</label>
                                    <div className="text-xs font-bold text-slate-600">{selectedBufferProduct?.UnidadMedidaCompra}</div>
                                </div>
                                <div>
                                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Cantidad</label>
                                    <div className="text-xs font-bold text-slate-600">{selectedBufferProduct?.CantidadCompra}</div>
                                </div>
                                <div>
                                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Medida Inventario</label>
                                    <div className="text-xs font-bold text-slate-600">{selectedBufferProduct?.UnidadMedidaInventario}</div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Unidad Medida Receta *</label>
                                <select 
                                    value={recipeParams.unidadMedidaRecetario}
                                    onChange={(e) => {
                                        const newUnit = e.target.value;
                                        const autoConv = calculateDefaultConversion(selectedBufferProduct?.UnidadMedidaInventario || '', newUnit);
                                        setRecipeParams({
                                            ...recipeParams, 
                                            unidadMedidaRecetario: newUnit,
                                            conversionSimple: autoConv
                                        });
                                    }}
                                    className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-purple-200"
                                >
                                    <option value="">Seleccionar Unidad...</option>
                                    {COMMON_UNITS.sort().map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Contenido (Conversión) *</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        step="0.0001"
                                        value={recipeParams.conversionSimple === 0 ? '' : recipeParams.conversionSimple}
                                        onChange={(e) => setRecipeParams({...recipeParams, conversionSimple: parseFloat(e.target.value) || 0})}
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-purple-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        {recipeParams.unidadMedidaRecetario} por {selectedBufferProduct?.UnidadMedidaInventario}
                                    </div>
                                </div>
                                <p className="mt-2 text-[10px] text-slate-400 font-medium italic">Define cuántos/as <b>{recipeParams.unidadMedidaRecetario || 'unidades de receta'}</b> contiene un/a <b>{selectedBufferProduct?.UnidadMedidaInventario || 'unidad de inventario'}</b>.</p>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex gap-3">
                            <Button onClick={() => setIsRecipeModalOpen(false)} className="flex-1 bg-slate-200 text-slate-500">Cancelar</Button>
                            <Button onClick={handleSaveRecipeParams} className="flex-1 bg-purple-600 shadow-lg shadow-purple-100">Guardar</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 5: IMAGES MODAL */}
            {isStep5Open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
                        <div className="p-8 border-b border-slate-100 flex flex-col gap-4 bg-white shadow-sm">
                            <div className="flex justify-between items-center">
                                <div><h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3"><span className="bg-indigo-500 text-white p-2 rounded-xl shadow-lg">📸</span>Paso 5: Imágenes ({step5Products.length})</h2><p className="text-xs text-slate-400 font-medium">Captura o sube una imagen para cada producto.</p></div>
                                <button onClick={() => setIsStep5Open(false)} className="text-slate-400 hover:bg-slate-100 w-10 h-10 rounded-full flex items-center justify-center transition-colors">✕</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-8 bg-slate-50/50">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {step5Products.map((p, index) => {
                                    const cat = categories.find(c => c.IdCategoria === p.IdCategoria);
                                    return (
                                        <div key={p.IdBuffer || p.idBuffer || index} className="p-5 bg-white border border-slate-100 rounded-[2rem] shadow-sm flex flex-col gap-4 group relative overflow-hidden">
                                            {p.ArchivoImagen && (
                                                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-[2rem] flex items-center justify-center text-emerald-500 font-black animate-in fade-in zoom-in duration-300">
                                                    ✓
                                                </div>
                                            )}
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner overflow-hidden">
                                                    {p.ArchivoImagen ? <img src={p.ArchivoImagen} className="w-full h-full object-cover" /> : cat?.ImagenCategoria || '❓'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[11px] font-black text-slate-800 uppercase tracking-tight leading-tight">{p.Producto}</div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase">{p.Codigo}</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button 
                                                    onClick={() => {
                                                        setSelectedBufferProduct(p);
                                                        setIsSingleImageCaptureOpen(true);
                                                    }}
                                                    className="flex-1 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase"
                                                >
                                                    Gestionar Imagen
                                                </Button>
                                                <button 
                                                    onClick={() => handleUpdateBuffer(p.IdBuffer || p.idBuffer, 'recipeParams', { unidadMedidaRecetario: null, conversionSimple: 0 })}
                                                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                                    title="Resetear Parámetros de Receta"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="px-8 py-6 border-t border-slate-100 flex justify-between items-center bg-white">
                            <Button onClick={() => { setIsStep5Open(false); setIsStep4Open(true); }} className="px-10 bg-slate-500 text-white shadow-lg shadow-slate-100 uppercase text-xs font-black tracking-widest flex items-center gap-2"><span className="text-lg">←</span> Anterior</Button>
                            <Button onClick={() => { setIsStep5Open(false); setIsStep6Open(true); }} className="px-10 bg-indigo-600 shadow-lg shadow-indigo-100 uppercase text-xs font-black tracking-widest flex items-center gap-2">Siguiente <span className="text-lg">→</span></Button>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 6: INITIAL INVENTORY MODAL */}
            {isStep6Open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
                        <div className="p-8 border-b border-slate-100 flex flex-col gap-4 bg-white shadow-sm">
                            <div className="flex justify-between items-center">
                                <div><h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3"><span className="bg-emerald-500 text-white p-2 rounded-xl shadow-lg">🏁</span>Paso 6: Inventario Inicial ({step6Products.length})</h2><p className="text-xs text-slate-400 font-medium">Revisión final de productos listos para el sistema.</p></div>
                                <button onClick={() => setIsStep6Open(false)} className="text-slate-400 hover:bg-slate-100 w-10 h-10 rounded-full flex items-center justify-center transition-colors">✕</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-8 bg-slate-50/50">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {step6Products.map((p, index) => {
                                    const cat = categories.find(c => c.IdCategoria === p.IdCategoria);
                                    return (
                                        <div key={p.IdBuffer || p.idBuffer || index} className="p-0 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm flex flex-col overflow-hidden group relative">
                                            <div className="h-48 relative overflow-hidden bg-slate-100">
                                                {p.ArchivoImagen ? (
                                                    <img src={p.ArchivoImagen} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">📸</div>
                                                )}
                                                <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm p-2 rounded-2xl shadow-sm flex items-center gap-2">
                                                    <span className="text-xl">{cat?.ImagenCategoria || '❓'}</span>
                                                    <span className="text-[10px] font-black text-slate-800 uppercase tracking-tighter">{cat?.Categoria}</span>
                                                </div>
                                                <button 
                                                    onClick={() => handleUpdateBuffer(p.IdBuffer || p.idBuffer, 'ArchivoImagen', null)}
                                                    className="absolute top-4 right-4 p-2 bg-white/80 text-red-500 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-white"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                            <div className="p-6 flex-1 flex flex-col justify-between">
                                                <div>
                                                    <div className="text-xs font-black text-slate-800 uppercase truncate">{p.Producto}</div>
                                                    <div className="text-[10px] text-slate-400 mt-1 font-bold">{p.Codigo}</div>
                                                </div>
                                                <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] font-black text-slate-300 uppercase">Inventario</span>
                                                        <span className="text-[10px] font-bold text-slate-600 uppercase">{p.UnidadMedidaInventario}</span>
                                                    </div>
                                                    <div className="flex flex-col text-right">
                                                        <span className="text-[8px] font-black text-slate-300 uppercase">Receta</span>
                                                        <span className="text-[10px] font-bold text-indigo-600 uppercase">{p.UnidadMedidaRecetario}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="px-8 py-6 border-t border-slate-100 flex justify-between items-center bg-white">
                            <Button onClick={() => { setIsStep6Open(false); setIsStep5Open(true); }} className="px-10 bg-slate-500 text-white shadow-lg shadow-slate-100 uppercase text-xs font-black tracking-widest flex items-center gap-2"><span className="text-lg">←</span> Anterior</Button>
                            <Button onClick={() => alert('✅ Carga finalizada con éxito. Procesando productos...')} className="px-10 bg-emerald-600 shadow-lg shadow-emerald-100 uppercase text-xs font-black tracking-widest flex items-center gap-2">Finalizar Carga ✔</Button>
                        </div>
                    </div>
                </div>
            )}

            {isExcelModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center"><h3 className="text-xl font-black text-slate-800">Cargar desde Excel</h3><button onClick={() => setIsExcelModalOpen(false)} className="text-slate-400">✕</button></div>
                        <div className="p-6 overflow-auto"><MassiveProductUpload hideHeader onlyExcel targetApi="/api/config/initial-load/buffer-products/process" onSuccess={() => { setIsExcelModalOpen(false); fetchData(); }} /></div>
                    </div>
                </div>
            )}
            <ProductImageCaptureModal 
                isOpen={isImageModalOpen} 
                onClose={() => setIsImageModalOpen(false)} 
                projectId={project?.idProyecto} 
                singleBufferId={selectedBufferProduct?.IdBuffer || selectedBufferProduct?.idBuffer} 
                onSuccess={() => { setIsImageModalOpen(false); fetchData(); }} 
                targetApi="/api/config/initial-load/buffer-products/process"
            />
            <InitialLoadImageCapture 
                isOpen={isSingleImageCaptureOpen} 
                onClose={() => setIsSingleImageCaptureOpen(false)}
                productName={selectedBufferProduct?.Producto || ''}
                onSave={async (base64) => {
                    await handleUpdateBuffer(selectedBufferProduct?.IdBuffer || selectedBufferProduct?.idBuffer, 'ArchivoImagen', base64);
                    setIsSingleImageCaptureOpen(false);
                }}
            />
            <footer className="mt-16 text-center text-gray-400 text-sm">© {new Date().getFullYear()} Foodie Guru</footer>
        </PageShell>
    );
}
