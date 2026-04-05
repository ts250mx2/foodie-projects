'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import Button from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import QRCode from 'react-qr-code';

function ReceiptCaptureContent() {
    const t = useTranslations('ReceiptCapture');
    const tModal = useTranslations('ExpensesModal');
    const navT = useTranslations('Navigation');
    const searchParams = useSearchParams();
    const router = useRouter();
    const { colors } = useTheme();

    // State
    const [isMobile, setIsMobile] = useState(false);
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [concepts, setConcepts] = useState<any[]>([]);
    const [selectedConceptId, setSelectedConceptId] = useState('');
    const [project, setProject] = useState<any>(null);

    // Multi-image state
    const [images, setImages] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [ocrResult, setOcrResult] = useState<any>(null);
    const [amount, setAmount] = useState('');
    const [reference, setReference] = useState('');
    const [selectedModel, setSelectedModel] = useState<'claude-opus-4-6' | 'gpt-4o'>('claude-opus-4-6');
    
    // Result concepts (extracted items)
    const [extractedItems, setExtractedItems] = useState<any[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Detect mobile
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Load initial data
    useEffect(() => {
        const storedProject = localStorage.getItem('selectedProject');
        if (storedProject) {
            const parsedProject = JSON.parse(storedProject);
            setProject(parsedProject);
            fetchBranches(parsedProject.idProyecto);
            fetchConcepts(parsedProject.idProyecto);
        }

        const branchId = searchParams.get('branchId');
        if (branchId) setSelectedBranch(branchId);
    }, [searchParams]);

    const fetchBranches = async (projectId: number) => {
        try {
            const response = await fetch(`/api/branches?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                setBranches(data.data);
                if (data.data.length > 0 && !selectedBranch) {
                    setSelectedBranch(data.data[0].IdSucursal.toString());
                }
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        }
    };

    const fetchConcepts = async (projectId: number) => {
        try {
            const response = await fetch(`/api/expense-concepts?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                setConcepts(data.data);
            }
        } catch (error) {
            console.error('Error fetching concepts:', error);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setImages(prev => [...prev, ...newFiles]);
            const newPreviews = newFiles.map(file => URL.createObjectURL(file));
            setPreviews(prev => [...prev, ...newPreviews]);
            setOcrResult(null);
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const processReceipt = async () => {
        if (images.length === 0) return;
        setIsProcessing(true);
        try {
            const formData = new FormData();
            images.forEach(img => {
                formData.append('image', img);
            });
            formData.append('model', selectedModel);

            const response = await fetch('/api/expenses/process-receipt', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                setOcrResult(data.data);
                setAmount(data.data.total?.toString() || '');
                setReference(data.data.provider || '');
                setExtractedItems(data.data.concepts || []);
            } else {
                alert(t('error') + ': ' + data.message);
            }
        } catch (error) {
            console.error('Error processing receipt:', error);
            alert(t('error'));
        } finally {
            setIsProcessing(false);
        }
    };

    const handleItemChange = (index: number, field: string, value: any) => {
        const newItems = [...extractedItems];
        newItems[index] = { ...newItems[index], [field]: value };
        
        // Recalculate total for the item
        if (field === 'quantity' || field === 'price') {
            newItems[index].total = Number(newItems[index].quantity) * Number(newItems[index].price);
        }
        
        setExtractedItems(newItems);
        
        // Recalculate grand total
        const newTotal = newItems.reduce((acc, item) => acc + (Number(item.total) || 0), 0);
        setAmount(newTotal.toFixed(2));
    };

    const addItem = () => {
        setExtractedItems([...extractedItems, { description: '', quantity: 1, price: 0, total: 0 }]);
    };

    const removeItem = (index: number) => {
        const newItems = extractedItems.filter((_, i) => i !== index);
        setExtractedItems(newItems);
        const newTotal = newItems.reduce((acc, item) => acc + (Number(item.total) || 0), 0);
        setAmount(newTotal.toFixed(2));
    };

    const handleSave = async () => {
        if (!selectedConceptId || !amount || !selectedBranch) {
            alert('Por favor seleccione una sucursal, un concepto y verifique el monto.');
            return;
        }

        try {
            const now = new Date();
            const formData = new FormData();
            formData.append('projectId', project.idProyecto.toString());
            formData.append('branchId', selectedBranch);
            formData.append('day', now.getDate().toString());
            formData.append('month', now.getMonth().toString());
            formData.append('year', now.getFullYear().toString());
            formData.append('conceptId', selectedConceptId);
            formData.append('amount', amount);
            formData.append('reference', reference);
            
            // Note: Currently tblGastos might not support detailed items, 
            // but we can pass the info or save it in a field like 'Observaciones' if needed.
            // For now we'll stick to the existing API structure but save the total.
            
            if (images.length > 0) formData.append('file', images[0]); // Save first image as main reference

            const response = await fetch('/api/expenses/daily', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                alert(t('success'));
                setImages([]);
                setPreviews([]);
                setOcrResult(null);
                setAmount('');
                setReference('');
                setExtractedItems([]);
            } else {
                alert('Error al guardar el gasto');
            }
        } catch (error) {
            console.error('Error saving expense:', error);
            alert('Error al guardar el gasto');
        }
    };

    const qrValue = typeof window !== 'undefined' 
        ? `${window.location.origin}${window.location.pathname}?branchId=${selectedBranch}`
        : '';

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-black text-gray-800 tracking-tight">{navT('ocrProcessing')}</h1>
                    <p className="text-gray-500 text-sm font-medium">{navT('receiptCapture')}</p>
                </div>
                
                <div className="flex flex-col gap-2 min-w-[200px]">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Sucursal</label>
                    <select 
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="w-full p-2.5 bg-gray-50 border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-red-500 transition-all cursor-pointer"
                    >
                        {branches.map(b => (
                            <option key={b.IdSucursal} value={b.IdSucursal}>{b.Sucursal}</option>
                        ))}
                    </select>
                </div>

                {/* Model Selector */}
                <div className="flex flex-col gap-2 min-w-[220px]">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Modelo IA</label>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSelectedModel('claude-opus-4-6')}
                            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all border-2 ${
                                selectedModel === 'claude-opus-4-6'
                                    ? 'bg-primary-50 border-primary-400 text-primary-700'
                                    : 'bg-gray-50 border-transparent text-gray-400 hover:border-gray-200'
                            }`}
                        >
                            🤖 Claude
                        </button>
                        <button
                            onClick={() => setSelectedModel('gpt-4o')}
                            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all border-2 ${
                                selectedModel === 'gpt-4o'
                                    ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                                    : 'bg-gray-50 border-transparent text-gray-400 hover:border-gray-200'
                            }`}
                        >
                            🌿 GPT-4o
                        </button>
                    </div>
                </div>
            </header>

            {!isMobile && previews.length === 0 ? (
                // Desktop View (No images yet): Show QR Code
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="bg-white p-10 rounded-3xl shadow-xl border-2 border-slate-50 flex flex-col items-center justify-center gap-8 text-center">
                        <div className="bg-white p-6 rounded-3xl shadow-inner border border-gray-100">
                            <QRCode value={qrValue} size={250} level="H" />
                        </div>
                        <div className="space-y-3">
                            <h2 className="text-xl font-black text-gray-800">Escanear con Celular</h2>
                            <p className="text-gray-500 text-sm max-w-xs mx-auto leading-relaxed">
                                Escanea este código para abrir la cámara de tu móvil y procesar los recibos directamente.
                            </p>
                        </div>
                    </div>

                    <div className="bg-white p-10 rounded-3xl shadow-xl border-2 border-slate-50 flex flex-col items-center justify-center gap-6 text-center border-dashed border-gray-300">
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full h-full min-h-[300px] border-4 border-dashed border-gray-100 rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-red-500 hover:bg-red-50/30 transition-all group"
                        >
                            <span className="text-6xl text-gray-200 group-hover:scale-110 transition-transform">📂</span>
                            <span className="font-black text-gray-400 group-hover:text-red-600 transition-colors">Subir Imagen Manualmente</span>
                            <input 
                                type="file" 
                                ref={fileInputRef}
                                accept="image/*" 
                                multiple
                                onChange={handleFileChange} 
                                className="hidden" 
                            />
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Main Content Area (Previews and Results) */}
            {(isMobile || previews.length > 0) && (
                <div className={`${isMobile ? 'max-w-md mx-auto' : 'w-full'} space-y-6`}>
                    
                    {/* Image Previews Carousel/Grid */}
                    <div className="space-y-4">
                        <h3 className="font-black text-gray-800 flex items-center gap-2">
                            🖼️ Imágenes ({previews.length})
                        </h3>
                        <div className="flex gap-4 overflow-x-auto pb-4 snap-x pr-4">
                            {previews.map((src, idx) => (
                                <div key={idx} className="relative min-w-[200px] h-[150px] rounded-2xl overflow-hidden shadow-md border-2 border-white snap-start">
                                    <img src={src} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                                    <button 
                                        onClick={() => removeImage(idx)}
                                        className="absolute top-1 right-1 bg-black/50 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold backdrop-blur-sm"
                                    >✕</button>
                                </div>
                            ))}
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="min-w-[150px] h-[150px] border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-2 bg-white cursor-pointer hover:bg-gray-50 transition-all font-bold text-gray-400 text-xs text-center p-2"
                            >
                                <span className="text-2xl">➕</span>
                                {t('takePhoto')}
                                <input 
                                    type="file" 
                                    ref={fileInputRef}
                                    accept="image/*" 
                                    capture="environment" 
                                    multiple
                                    onChange={handleFileChange} 
                                    className="hidden" 
                                />
                            </div>
                        </div>
                    </div>

                    {!ocrResult && !isProcessing && previews.length > 0 && (
                        <Button 
                            className="w-full py-4 text-lg font-black shadow-lg" 
                            onClick={processReceipt}
                            style={{ backgroundColor: colors.colorFondo1 }}
                        >
                            🔍 Procesar {previews.length} Imagen{previews.length > 1 ? 'es' : ''} con {selectedModel === 'claude-opus-4-6' ? '🤖 Claude' : '🌿 GPT-4o'}
                        </Button>
                    )}

                    {isProcessing && (
                        <div className="text-center py-8 flex flex-col items-center gap-4 bg-white rounded-3xl border border-gray-100 shadow-sm animate-pulse">
                            <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="font-black text-red-600 uppercase tracking-widest text-xs">{t('processing')}</p>
                            <p className="text-gray-400 text-xs">Analizando ticket largo y extrayendo conceptos...</p>
                        </div>
                    )}

                    {ocrResult && (
                        <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 space-y-6 animate-in slide-in-from-bottom-8 duration-500">
                            <div className="flex justify-between items-center border-b pb-4">
                                <h3 className="font-black text-lg text-gray-800 flex items-center gap-2">
                                    ✨ {t('extractedInfo')}
                                </h3>
                                <div className="text-right">
                                    <span className="text-[10px] font-black text-gray-400 uppercase block tracking-widest">Total Extracto</span>
                                    <span className="text-xl font-black text-red-600">${amount}</span>
                                </div>
                            </div>
                            
                            <div className="space-y-6">
                                {/* Header Info */}
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">{t('provider')}</label>
                                        <input 
                                            value={reference} 
                                            onChange={(e) => setReference(e.target.value)}
                                            className="w-full p-3 bg-gray-50 rounded-xl border-2 border-transparent focus:border-red-500 focus:bg-white transition-all font-bold text-gray-700"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">{tModal('concept')}</label>
                                        <select 
                                            value={selectedConceptId}
                                            onChange={(e) => setSelectedConceptId(e.target.value)}
                                            className="w-full p-3 bg-gray-50 rounded-xl border-2 border-transparent focus:border-red-500 focus:bg-white transition-all font-bold text-gray-700 cursor-pointer"
                                        >
                                            <option value="">{tModal('select')}</option>
                                            {concepts.map(c => (
                                                <option key={c.IdConceptoGasto} value={c.IdConceptoGasto}>
                                                    {c.ConceptoGasto}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Items Table */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Conceptos Detallados</label>
                                        <button 
                                            onClick={addItem}
                                            className="text-xs font-black text-red-600 hover:text-red-700 bg-red-50 px-3 py-1 rounded-full transition-colors"
                                        >
                                            ＋ Agregar Fila
                                        </button>
                                    </div>
                                    <div className="border border-gray-50 rounded-2xl overflow-hidden shadow-inner">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-gray-50 text-gray-400 font-black tracking-widest uppercase">
                                                    <th className="p-3 text-left">Concepto</th>
                                                    <th className="p-3 text-center w-16">Cant.</th>
                                                    <th className="p-3 text-center w-24">Precio</th>
                                                    <th className="p-3 text-right w-24">Total</th>
                                                    <th className="p-3 w-8"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {extractedItems.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="p-2">
                                                            <input 
                                                                value={item.description} 
                                                                onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                                                className="w-full bg-transparent p-1 focus:ring-1 focus:ring-red-500 rounded font-medium"
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <input 
                                                                type="number"
                                                                value={item.quantity} 
                                                                onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                                                className="w-full bg-transparent p-1 text-center font-bold"
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <span className="text-gray-300">$</span>
                                                                <input 
                                                                    type="number"
                                                                    value={item.price} 
                                                                    onChange={(e) => handleItemChange(idx, 'price', e.target.value)}
                                                                    className="w-full bg-transparent p-1 text-center font-bold"
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="p-2 text-right font-black text-gray-800">
                                                            ${(item.total || 0).toFixed(2)}
                                                        </td>
                                                        <td className="p-2">
                                                            <button 
                                                                onClick={() => removeItem(idx)}
                                                                className="text-gray-300 hover:text-red-500 transition-colors"
                                                            >✕</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {extractedItems.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="p-8 text-center text-gray-400 italic">
                                                            No se detectaron conceptos individuales. Puedes agregarlos manualmente.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                            <tfoot className="bg-gray-50/50">
                                                <tr className="font-black">
                                                    <td colSpan={3} className="p-3 text-right text-gray-500 uppercase tracking-widest text-[9px]">Suma Total</td>
                                                    <td className="p-3 text-right text-red-600 text-sm">${amount}</td>
                                                    <td></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-4">
                                    <button 
                                        onClick={() => { setOcrResult(null); }}
                                        className="flex-1 py-4 bg-gray-100 text-gray-500 font-bold rounded-2xl hover:bg-gray-200 transition-all active:scale-95"
                                    >
                                        Reintentar Captura
                                    </button>
                                    <button 
                                        onClick={handleSave}
                                        className="flex-[2] py-4 text-white font-black rounded-2xl shadow-lg hover:brightness-110 active:scale-95 transition-all uppercase tracking-widest text-sm"
                                        style={{ backgroundColor: colors.colorFondo1 }}
                                    >
                                        🚀 Confirmar y Guardar Gasto
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function ReceiptCapturePage() {
    return (
        <Suspense fallback={<div className="p-10 text-center font-bold animate-pulse text-red-600">Inicializando motor OCR...</div>}>
            <ReceiptCaptureContent />
        </Suspense>
    );
}
