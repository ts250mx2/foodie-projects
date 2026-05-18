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
import { RowActionButton } from '@/components/ThemedGridHeader';
import { Rocket, Upload, Image, Edit, Trash2, Plus, X, Search } from 'lucide-react';

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
        { id: 1, title: 'Carga de productos', count: step1Products.length, onClick: () => setIsStep1Open(true) },
        { id: 2, title: 'Categorización', count: step2Products.length, onClick: () => setIsStep2Open(true) },
        { id: 3, title: 'Parámetros de Inventario', count: step3Products.length, onClick: () => setIsPreviewOpen(true) },
        { id: 4, title: 'Parámetros de Receta', count: step4Products.length, onClick: () => setIsStep4Open(true) },
        { id: 5, title: 'Imágenes', count: step5Products.length, onClick: () => setIsStep5Open(true) },
        { id: 6, title: 'Inventario Inicial', count: step6Products.length, onClick: () => setIsStep6Open(true) }
    ];

    return (
        <PageShell title={t('title')} subtitle="Gestión de flujo de carga inicial." icon={Rocket}>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {steps.map((step) => (
                    <div key={step.id} onClick={step.onClick} className="group bg-white rounded-xl border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md transition-all duration-200 p-6 cursor-pointer flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-semibold text-gray-500 uppercase">Paso {step.id}</span>
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 group-hover:bg-gray-200 transition-colors">
                                {step.id === 1 && <Upload size={20} className="text-gray-600" />}
                                {step.id === 2 && <Rocket size={20} className="text-gray-600" />}
                                {step.id === 3 && <Edit size={20} className="text-gray-600" />}
                                {step.id === 4 && <Edit size={20} className="text-gray-600" />}
                                {step.id === 5 && <Image size={20} className="text-gray-600" />}
                                {step.id === 6 && <Plus size={20} className="text-gray-600" />}
                            </span>
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 mb-3">{step.title}</h3>
                        <div className="mt-auto">
                            <div className="text-2xl font-bold text-gray-900">{step.count}</div>
                            <div className="text-xs text-gray-500 font-medium">productos</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* STEP 1 MODAL */}
            {isStep1Open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-6xl max-h-[90vh] rounded-xl shadow-lg flex flex-col overflow-hidden border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Paso 1: Carga de productos ({step1Products.length})</h2>
                                <p className="text-xs text-gray-500 mt-1">Gestiona el buffer de productos importados.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button onClick={() => setIsExcelModalOpen(true)} variant="secondary" size="sm" leftIcon={Upload}>Excel</Button>
                                <Button onClick={() => setIsImageModalOpen(true)} variant="secondary" size="sm" leftIcon={Image}>Imagen</Button>
                                <Button onClick={() => setIsAddingManual(true)} variant="solid" size="sm" leftIcon={Plus}>Manual</Button>
                                <button onClick={() => setIsStep1Open(false)} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-6">
                            <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead className="bg-gray-50 font-semibold text-gray-700 border-b border-gray-200"><tr><th className="px-6 py-3">Documento</th><th className="px-6 py-3">Producto</th><th className="px-6 py-3">Precio</th><th className="px-6 py-3">Código</th><th className="px-6 py-3 text-center">Acciones</th></tr></thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {isAddingManual && (
                                            <tr className="bg-gray-50 border-y-2 border-gray-300">
                                                <td className="px-6 py-3 text-gray-500 text-xs font-semibold">MANUAL</td>
                                                <td className="px-6 py-3"><input autoFocus className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="Nombre del producto" value={newManualProduct.producto} onChange={(e) => setNewManualProduct({...newManualProduct, producto: e.target.value.toUpperCase()})} /></td>
                                                <td className="px-6 py-3"><input type="number" className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="0.00" value={newManualProduct.precio || ''} onChange={(e) => setNewManualProduct({...newManualProduct, precio: parseFloat(e.target.value) || 0})} /></td>
                                                <td className="px-6 py-3"><input className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="Código (opcional)" value={newManualProduct.codigo} onChange={(e) => setNewManualProduct({...newManualProduct, codigo: e.target.value.toUpperCase()})} /></td>
                                                <td className="px-6 py-3 text-center flex items-center justify-center gap-2">
                                                    <button onClick={handleAddManual} className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm">Guardar</button>
                                                    <button onClick={() => setIsAddingManual(false)} className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition-colors text-sm">Cancelar</button>
                                                </td>
                                            </tr>
                                        )}
                                        {step1Products.map((p, index) => {
                                            const id = p.IdBuffer || p.idBuffer || index;
                                            return (
                                                <tr key={id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-3 text-gray-500 text-xs">{p.ProductoDocumento || '-'}</td>
                                                    <td className="px-6 py-3"><input className="w-full px-2 py-1 border-0 border-b border-gray-300 focus:border-blue-500 focus:outline-none text-sm font-medium" value={p.Producto} onChange={(e) => handleUpdateBuffer(id as number, 'Producto', e.target.value.toUpperCase())} /></td>
                                                    <td className="px-6 py-3"><input type="number" className="w-20 px-2 py-1 border-0 border-b border-gray-300 focus:border-blue-500 focus:outline-none text-sm" value={p.Precio} onChange={(e) => handleUpdateBuffer(id as number, 'Precio', parseFloat(e.target.value) || 0)} /></td>
                                                    <td className="px-6 py-3"><input className="w-full px-2 py-1 border-0 border-b border-gray-300 focus:border-blue-500 focus:outline-none text-sm" value={p.Codigo} onChange={(e) => handleUpdateBuffer(id as number, 'Codigo', e.target.value.toUpperCase())} /></td>
                                                    <td className="px-6 py-3 text-center"><button onClick={() => handleDeleteBuffer(id, 'step1')} className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={16} /></button></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {step1Products.length === 0 && <div className="py-16 text-center text-gray-400 text-sm">No hay productos pendientes de categorizar.</div>}
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
                            <Button onClick={() => setIsStep1Open(false)} variant="secondary" size="sm">Cerrar</Button>
                            <Button onClick={() => { setIsStep1Open(false); setIsStep2Open(true); }} size="sm">Siguiente</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 2 MODAL */}
            {isStep2Open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-7xl h-[95vh] rounded-xl shadow-lg flex flex-col overflow-hidden border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Paso 2: Categorización ({step2Products.length})</h2>
                                <p className="text-xs text-gray-500 mt-1">Arrastra los productos a sus categorías.</p>
                            </div>
                            <button onClick={() => setIsStep2Open(false)} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 flex overflow-hidden p-4 gap-4 bg-white">
                            <div className="w-1/2 flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden">
                                <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col gap-3">
                                    <span className="text-xs font-semibold text-gray-600">SIN CATEGORÍA ({filteredStep2Products.length})</span>
                                    <input type="text" placeholder="Buscar producto..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                                </div>
                                <div className="flex-1 overflow-auto p-4 grid grid-cols-2 gap-3 content-start">
                                    {filteredStep2Products.map((p, index) => {
                                        const id = p.IdBuffer || p.idBuffer || `p-${index}`;
                                        return (
                                            <div key={id} draggable onDragStart={(e) => handleDragStart(e, id)} onDragEnd={handleDragEnd} onClick={(e) => toggleSelect(id, e)}
                                                className={`p-3 rounded-lg border transition-all cursor-move ${selectedIds.includes(id) ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}
                                            >
                                                <div className="text-xs font-semibold text-gray-900 line-clamp-1">{p.Producto}</div>
                                                <div className="text-xs text-gray-500 mt-1 flex justify-between"><span>{p.Codigo}</span><span>${p.Precio}</span></div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="w-1/2 flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden">
                                <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col gap-3">
                                    <span className="text-xs font-semibold text-gray-600">CATEGORÍAS</span>
                                    <input type="text" placeholder="Buscar categoría..." value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                                </div>
                                <div className="flex-1 overflow-auto p-4 grid grid-cols-2 gap-4 content-start">
                                    {filteredCategories.map((c) => (
                                        <div key={c.IdCategoria} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDragEnter={(e) => { e.preventDefault(); setDragOverId(c.IdCategoria); }} onDragLeave={() => setDragOverId(null)} onDrop={(e) => handleDrop(e, c.IdCategoria)}
                                            onClick={() => { setViewingCategory(c); fetchCategoryProducts(c.IdCategoria); }}
                                            className={`p-4 rounded-lg border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center relative ${dragOverId === c.IdCategoria ? 'bg-blue-50 border-blue-400 scale-105' : 'bg-gray-50 border-gray-300 hover:border-blue-400'}`}
                                        >
                                            <div className="text-2xl mb-2 pointer-events-none">{c.ImagenCategoria || '📁'}</div>
                                            <div className="text-xs font-semibold text-gray-900 uppercase tracking-tight pointer-events-none">{c.Categoria}</div>
                                            {categoryCounts[c.IdCategoria] > 0 && <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-lg shadow-lg">{categoryCounts[c.IdCategoria]}</div>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
                            <Button onClick={() => { setIsStep2Open(false); setIsStep1Open(true); }} variant="secondary" size="sm">Anterior</Button>
                            <Button onClick={() => { setIsStep2Open(false); setIsPreviewOpen(true); }} size="sm">Siguiente</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* CATEGORY PRODUCTS DETAIL MODAL */}
            {viewingCategory && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-4xl max-h-[80vh] rounded-xl shadow-lg flex flex-col overflow-hidden border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">{viewingCategory.Categoria} ({categoryProducts.length})</h2>
                                <p className="text-xs text-gray-500 mt-1">Productos vinculados en esta categoría.</p>
                            </div>
                            <button onClick={() => setViewingCategory(null)} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-6">
                            <div className="mb-4 relative">
                                <input type="text" placeholder="Buscar..." value={categoryDetailSearch} onChange={(e) => setCategoryDetailSearch(e.target.value)} className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border bg-white focus:outline-none transition-all placeholder:text-gray-400 text-gray-700" style={{ borderColor: '#e5e7eb' }} />
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#9ca3af' }} />
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                {filteredCategoryProducts.map(p => (
                                    <div key={p.IdBuffer || p.idBuffer} className="p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 shadow-sm flex justify-between items-center group transition-all">
                                        <div className="min-w-0 flex-1"><div className="text-sm font-medium text-gray-900 truncate">{p.Producto}</div><div className="text-xs text-gray-500 font-medium mt-0.5">{p.Codigo} · ${p.Precio}</div></div>
                                        <div className="flex items-center gap-1">
                                            <RowActionButton icon={Trash2} label="Desvincular" variant="delete" onClick={() => handleUnlink(p.IdBuffer || p.idBuffer)} />
                                            <RowActionButton icon={Trash2} label="Eliminar" variant="delete" onClick={() => handleDeleteBuffer(p.IdBuffer || p.idBuffer, 'category')} />
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
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-5xl h-[90vh] rounded-xl shadow-lg flex flex-col overflow-hidden border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Paso 3: Parámetros de Inventario ({filteredPreviewProducts.length})</h2>
                                <p className="text-xs text-gray-500 mt-1">Asigna unidades y parámetros de costeo a los productos categorizados.</p>
                            </div>
                            <button onClick={() => setIsPreviewOpen(false)} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-6">
                            <div className="mb-4 relative">
                                <input type="text" placeholder="Buscar..." value={previewSearch} onChange={(e) => setPreviewSearch(e.target.value)} className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border bg-white focus:outline-none transition-all placeholder:text-gray-400 text-gray-700" style={{ borderColor: '#e5e7eb' }} />
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#9ca3af' }} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
                                            className="p-4 bg-white border border-gray-200 hover:border-gray-300 rounded-lg shadow-sm flex flex-col gap-3 group relative cursor-pointer transition-all hover:shadow-md"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-gray-900 truncate">{p.Producto}</div>
                                                    <div className="text-xs text-gray-500 mt-1">{p.Codigo}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-gray-600 font-medium">${p.Precio}</span>
                                                <RowActionButton icon={Trash2} label="Desvincular" variant="delete" onClick={(e) => { e.stopPropagation(); handleUnlink(p.IdBuffer || p.idBuffer); }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
                            <Button onClick={() => { setIsPreviewOpen(false); setIsStep2Open(true); }} variant="secondary" size="sm">Anterior</Button>
                            <Button onClick={() => { setIsPreviewOpen(false); setIsStep4Open(true); }} size="sm">Siguiente</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* INVENTORY PARAMS MODAL (CAPTURA) */}
            {isParamsModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-lg rounded-xl shadow-lg flex flex-col overflow-hidden border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Parámetros de Inventario</h2>
                                <p className="text-xs text-gray-500 mt-1">{selectedBufferProduct?.Producto}</p>
                            </div>
                            <button onClick={() => setIsParamsModalOpen(false)} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Unidad Medida Compra *</label>
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                >
                                    <option value="">Seleccionar Unidad...</option>
                                    {COMMON_UNITS.sort().map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Cantidad (Contenido) *</label>
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    placeholder="Ej. 1.00"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Unidad Medida Inventario *</label>
                                <select
                                    value={inventoryParams.unidadMedidaInventario}
                                    onChange={(e) => setInventoryParams({...inventoryParams, unidadMedidaInventario: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                >
                                    <option value="">Seleccionar Unidad...</option>
                                    {COMMON_UNITS.sort().map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
                            <Button onClick={() => setIsParamsModalOpen(false)} variant="secondary" size="sm">Cancelar</Button>
                            <Button onClick={handleSaveInventoryParams} size="sm">Guardar</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 4: RECIPE PARAMS MODAL */}
            {isStep4Open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-5xl h-[90vh] rounded-xl shadow-lg flex flex-col overflow-hidden border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Paso 4: Parámetros de Receta ({step4Products.length})</h2>
                                <p className="text-xs text-gray-500 mt-1">Revisa los productos listos para ser insertados en el catálogo final.</p>
                            </div>
                            <button onClick={() => setIsStep4Open(false)} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-6">
                            <div className="mb-4 relative">
                                <input type="text" placeholder="Buscar..." value={previewSearch} onChange={(e) => setPreviewSearch(e.target.value)} className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border bg-white focus:outline-none transition-all placeholder:text-gray-400 text-gray-700" style={{ borderColor: '#e5e7eb' }} />
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#9ca3af' }} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
                                            className="p-4 bg-white border border-gray-200 hover:border-gray-300 rounded-lg shadow-sm flex flex-col gap-3 group relative cursor-pointer transition-all hover:shadow-md"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-gray-900 truncate">{p.Producto}</div>
                                                    <div className="text-xs text-gray-500 mt-1">{p.Codigo}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-gray-600">📦 {p.UnidadMedidaCompra} · {p.CantidadCompra}</span>
                                                <RowActionButton icon={Trash2} label="Resetear" variant="delete" onClick={(e) => { e.stopPropagation(); handleUpdateBuffer(p.IdBuffer || p.idBuffer, 'resetInventory', null); }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
                            <Button onClick={() => { setIsStep4Open(false); setIsPreviewOpen(true); }} variant="secondary" size="sm">Anterior</Button>
                            <Button onClick={() => { setIsStep4Open(false); setIsStep5Open(true); }} size="sm">Siguiente</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* RECIPE PARAMS MODAL (CAPTURA) */}
            {isRecipeModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-lg rounded-xl shadow-lg flex flex-col overflow-hidden border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Parámetros de Receta</h2>
                                <p className="text-xs text-gray-500 mt-1">{selectedBufferProduct?.Producto}</p>
                            </div>
                            <button onClick={() => setIsRecipeModalOpen(false)} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-3 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Medida Compra</label>
                                    <div className="text-sm font-semibold text-gray-900">{selectedBufferProduct?.UnidadMedidaCompra}</div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad</label>
                                    <div className="text-sm font-semibold text-gray-900">{selectedBufferProduct?.CantidadCompra}</div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Medida Inventario</label>
                                    <div className="text-sm font-semibold text-gray-900">{selectedBufferProduct?.UnidadMedidaInventario}</div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Unidad Medida Receta *</label>
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                >
                                    <option value="">Seleccionar Unidad...</option>
                                    {COMMON_UNITS.sort().map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Contenido (Conversión) *</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={recipeParams.conversionSimple === 0 ? '' : recipeParams.conversionSimple}
                                    onChange={(e) => setRecipeParams({...recipeParams, conversionSimple: parseFloat(e.target.value) || 0})}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <p className="mt-2 text-xs text-gray-500">Define cuántos/as <b>{recipeParams.unidadMedidaRecetario || 'unidades'}</b> contiene un/a <b>{selectedBufferProduct?.UnidadMedidaInventario || 'unidad'}</b>.</p>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
                            <Button onClick={() => setIsRecipeModalOpen(false)} variant="secondary" size="sm">Cancelar</Button>
                            <Button onClick={handleSaveRecipeParams} size="sm">Guardar</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 5: IMAGES MODAL */}
            {isStep5Open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-5xl h-[90vh] rounded-xl shadow-lg flex flex-col overflow-hidden border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Paso 5: Imágenes ({step5Products.length})</h2>
                                <p className="text-xs text-gray-500 mt-1">Captura o sube una imagen para cada producto.</p>
                            </div>
                            <button onClick={() => setIsStep5Open(false)} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {step5Products.map((p, index) => {
                                    const cat = categories.find(c => c.IdCategoria === p.IdCategoria);
                                    return (
                                        <div key={p.IdBuffer || p.idBuffer || index} className="p-4 bg-white border border-gray-200 hover:border-gray-300 rounded-lg shadow-sm flex flex-col gap-3 group relative overflow-hidden transition-all">
                                            {p.ArchivoImagen && (
                                                <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-50 rounded-bl-lg flex items-center justify-center text-emerald-600 font-bold">
                                                    ✓
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-lg shadow-sm overflow-hidden">
                                                    {p.ArchivoImagen ? <img src={p.ArchivoImagen} className="w-full h-full object-cover" alt={p.Producto} /> : <Image className="w-6 h-6 text-gray-400" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-gray-900 truncate">{p.Producto}</div>
                                                    <div className="text-xs text-gray-500">{p.Codigo}</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    onClick={() => {
                                                        setSelectedBufferProduct(p);
                                                        setIsSingleImageCaptureOpen(true);
                                                    }}
                                                    variant="secondary"
                                                    size="sm"
                                                    leftIcon={Image}
                                                    className="flex-1"
                                                >
                                                    Gestionar
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
                            <Button onClick={() => { setIsStep5Open(false); setIsStep4Open(true); }} variant="secondary" size="sm">Anterior</Button>
                            <Button onClick={() => { setIsStep5Open(false); setIsStep6Open(true); }} size="sm">Siguiente</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 6: INITIAL INVENTORY MODAL */}
            {isStep6Open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-5xl h-[90vh] rounded-xl shadow-lg flex flex-col overflow-hidden border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Paso 6: Inventario Inicial ({step6Products.length})</h2>
                                <p className="text-xs text-gray-500 mt-1">Revisión final de productos listos para el sistema.</p>
                            </div>
                            <button onClick={() => setIsStep6Open(false)} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {step6Products.map((p, index) => {
                                    const cat = categories.find(c => c.IdCategoria === p.IdCategoria);
                                    return (
                                        <div key={p.IdBuffer || p.idBuffer || index} className="bg-white border border-gray-200 hover:border-gray-300 rounded-lg shadow-sm overflow-hidden flex flex-col group relative transition-all hover:shadow-md">
                                            <div className="h-32 relative overflow-hidden bg-gray-100">
                                                {p.ArchivoImagen ? (
                                                    <img src={p.ArchivoImagen} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={p.Producto} />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-3xl opacity-10">📸</div>
                                                )}
                                                <button
                                                    onClick={() => handleUpdateBuffer(p.IdBuffer || p.idBuffer, 'ArchivoImagen', null)}
                                                    className="absolute top-2 right-2 p-1.5 bg-white/80 hover:bg-white text-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                    title="Eliminar imagen"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                            <div className="p-4 flex-1 flex flex-col justify-between">
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900 truncate">{p.Producto}</div>
                                                    <div className="text-xs text-gray-500 mt-1">{p.Codigo}</div>
                                                </div>
                                                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
                                                    <div>
                                                        <span className="text-gray-500 font-medium block">Inventario</span>
                                                        <span className="text-gray-900 font-semibold">{p.UnidadMedidaInventario}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-gray-500 font-medium block">Receta</span>
                                                        <span className="text-gray-900 font-semibold">{p.UnidadMedidaRecetario}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
                            <Button onClick={() => { setIsStep6Open(false); setIsStep5Open(true); }} variant="secondary" size="sm">Anterior</Button>
                            <Button onClick={() => alert('✅ Carga finalizada con éxito. Procesando productos...')} size="sm">Finalizar Carga</Button>
                        </div>
                    </div>
                </div>
            )}

            {isExcelModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-xl shadow-lg flex flex-col overflow-hidden border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <h2 className="text-lg font-bold text-gray-900">Cargar desde Excel</h2>
                            <button onClick={() => setIsExcelModalOpen(false)} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500">
                                <X size={18} />
                            </button>
                        </div>
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
