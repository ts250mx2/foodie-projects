'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import Button from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import MobileBatchModal, { BatchSelectedPhoto } from '@/components/MobileBatchModal';
import QRCode from 'react-qr-code';

interface ProductImageCaptureModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: number;
    onSuccess?: () => void;
}

type Step = 'capture' | 'preview' | 'register';

export default function ProductImageCaptureModal({ 
    isOpen, 
    onClose, 
    projectId, 
    onSuccess 
}: ProductImageCaptureModalProps) {
    const tCommon = useTranslations('Common');
    const params = useParams();
    const locale = (params?.locale as string) || 'es';
    const { colors } = useTheme();

    // State
    const [step, setStep] = useState<Step>('capture');
    interface OcrItem {
        id: string;
        file: File;
        preview: string;
        selected: boolean;
    }
    const [ocrItems, setOcrItems] = useState<OcrItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedModel, setSelectedModel] = useState<'gpt-4o' | 'claude-sonnet-4-6'>('claude-sonnet-4-6');
    const [isMaximized, setIsMaximized] = useState(false);
    const [maximizedImage, setMaximizedImage] = useState<string | null>(null);
    
    // Camera state
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Mobile/QR state
    const [showQrModal, setShowQrModal] = useState(false);
    const [qrSessionId, setQrSessionId] = useState('');
    const [isPolling, setIsPolling] = useState(false);
    const [showMobileBatchModal, setShowMobileBatchModal] = useState(false);

    // Results state
    const [ocrResult, setOcrResult] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [existingProducts, setExistingProducts] = useState<{ code: string, name: string }[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && projectId) {
            fetchCategories();
            fetchExistingProducts();
        }
    }, [isOpen, projectId]);

    const fetchCategories = async () => {
        try {
            const response = await fetch(`/api/categories?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) setCategories(data.data);
        } catch (error) { console.error('Error fetching categories:', error); }
    };

    const fetchExistingProducts = async () => {
        try {
            const response = await fetch(`/api/products/massive-upload/check-duplicates?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) setExistingProducts(data.products);
        } catch (error) { console.error('Error checking duplicates:', error); }
    };

    const startCamera = async () => {
        setIsCameraOpen(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (error) {
            alert('No se pudo acceder a la cámara');
            setIsCameraOpen(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current?.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsCameraOpen(false);
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg');
            fetch(dataUrl).then(res => res.blob()).then(blob => {
                const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
                setOcrItems(prev => [...prev, { id: uuidv4(), file, preview: dataUrl, selected: true }]);
                setStep('preview');
                stopCamera();
            });
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            const newItems: OcrItem[] = newFiles.map(file => ({
                id: uuidv4(),
                file,
                preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '📄',
                selected: true
            }));
            setOcrItems(prev => [...prev, ...newItems]);
            setStep('preview');
        }
    };

    const handleBatchPhotos = (photos: BatchSelectedPhoto[]) => {
        const converted: OcrItem[] = photos.map(p => ({
            id: p.idDetalleDocumentoOCR.toString(),
            file: new File([Uint8Array.from(atob(p.base64), c => c.charCodeAt(0))], p.filename, { type: 'image/jpeg' }),
            preview: `data:image/jpeg;base64,${p.base64}`,
            selected: true
        }));
        setOcrItems(converted);
        setStep('preview');
    };

    const startQrSession = async () => {
        const sessionId = uuidv4();
        setQrSessionId(sessionId);
        setShowQrModal(true);
        setIsPolling(true);

        try {
            await fetch('/api/ocr/qr-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, action: 'register' })
            });

            const pollInterval = setInterval(async () => {
                try {
                    const response = await fetch(`/api/ocr/qr-sync?sessionId=${sessionId}`);
                    const data = await response.json();
                    if (data.success && data.image) {
                        const dataUrl = data.image;
                        const res = await fetch(dataUrl);
                        const blob = await res.blob();
                        const file = new File([blob], `qr-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
                        setOcrItems(prev => [...prev, { id: uuidv4(), file, preview: dataUrl, selected: true }]);
                        setStep('preview');
                        clearInterval(pollInterval);
                        setIsPolling(false);
                        setShowQrModal(false);
                    }
                } catch (err) { console.error('Polling error:', err); }
            }, 2000);
            return () => { clearInterval(pollInterval); setIsPolling(false); };
        } catch (err) {
            console.error('Error registering QR session:', err);
            setShowQrModal(false);
        }
    };

    const processOcr = async () => {
        const selectedItems = ocrItems.filter(item => item.selected);
        if (selectedItems.length === 0) return;

        setIsProcessing(true);
        try {
            const formData = new FormData();
            formData.append('model', selectedModel);
            formData.append('projectId', projectId.toString());
            selectedItems.forEach(item => formData.append('image', item.file));

            const response = await fetch('/api/products/ocr/process', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                const products = data.data.products.map((p: any) => ({
                    ...p,
                    id: uuidv4(),
                    idCategoria: null,
                    producto: p.systemName ? p.systemName.toUpperCase() : p.description.toUpperCase(),
                    codigo: p.systemCodigo || p.CodigoBarras || '',
                    precio: p.precio || 0,
                    cantidadCompra: 1,
                    autoLinked: p.isLinked,
                    suggestions: p.suggestions || []
                }));
                setOcrResult(products);
                setStep('register');
            } else {
                alert('Error: ' + data.message);
            }
        } catch (error) {
            alert('Error al procesar imágenes');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveProducts = async () => {
        const validProducts = ocrResult
            .filter(p => !p.isLinked) // Only new products or manually handle linked
            .map(p => ({
                Producto: p.producto,
                Codigo: p.codigo,
                IdCategoria: p.idCategoria,
                CantidadCompra: 1,
                Precio: p.precio || 0,
                IdTipoProducto: 0
            }));

        if (validProducts.length === 0) {
            alert('No hay productos nuevos para registrar.');
            return;
        }

        if (!confirm(`¿Desea registrar estos ${validProducts.length} productos en el catálogo?`)) {
            return;
        }

        setIsSaving(true);
        try {
            const response = await fetch('/api/products/massive-upload/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    products: validProducts
                })
            });
            const data = await response.json();
            if (data.success) {
                alert(`Se han registrado ${validProducts.length} productos correctamente.`);
                onSuccess?.();
                onClose();
                resetModal();
            } else {
                alert('Error: ' + data.message);
            }
        } catch (error) {
            alert('Error al guardar productos');
        } finally {
            setIsSaving(false);
        }
    };

    const resetModal = () => {
        setStep('capture');
        setOcrItems([]);
        setOcrResult([]);
    };

    const isDuplicate = (name: string, code: string) => {
        return existingProducts.some(p => 
            p.name.toLowerCase() === name.toLowerCase() || 
            (code && p.code === code)
        );
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 ${!isOpen ? 'hidden' : ''}`}>
            <div className={`bg-white w-full transition-all duration-300 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100 ${isMaximized ? 'max-w-[98vw] h-[95vh]' : 'max-w-4xl max-h-[90vh]'}`}>
                
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                            <span className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg">📸</span>
                            Carga de Productos por Imagen
                        </h2>
                        <p className="text-xs text-slate-400 font-medium mt-1">Digitaliza productos para tu catálogo con IA</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex flex-col gap-1 items-end">
                            <label className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Motor de Inteligencia</label>
                            <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-1.5 border border-slate-100 shadow-sm text-[9px] font-black text-indigo-600 shadow-inner">
                                CLAUDE 3.5
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setIsMaximized(!isMaximized)} 
                                className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors"
                                title={isMaximized ? "Restaurar" : "Maximizar"}
                            >
                                {isMaximized ? '🗗' : '🗖'}
                            </button>
                            <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">✕</button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-8 relative">
                    {isProcessing && (
                        <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-[2px] flex flex-col items-center justify-center animate-in fade-in duration-300">
                            <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                            <p className="text-sm font-black text-slate-700 tracking-widest uppercase animate-pulse">Analizando Productos...</p>
                        </div>
                    )}

                    {step === 'capture' && (
                        <div className="animate-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <button onClick={startCamera} className="flex flex-col items-center justify-center p-8 rounded-[2rem] bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group">
                                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-sm group-hover:scale-110 transition-transform">📸</div>
                                    <span className="text-xs font-black text-slate-700 uppercase tracking-widest">Cámara PC</span>
                                </button>
                                <button onClick={() => setShowMobileBatchModal(true)} className="flex flex-col items-center justify-center p-8 rounded-[2rem] bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group">
                                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-sm group-hover:scale-110 transition-transform">📱</div>
                                    <span className="text-xs font-black text-slate-700 uppercase tracking-widest">Lotes Móvil</span>
                                </button>
                                <button onClick={startQrSession} className="flex flex-col items-center justify-center p-8 rounded-[2rem] bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group">
                                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-sm group-hover:scale-110 transition-transform">🔗</div>
                                    <span className="text-xs font-black text-slate-700 uppercase tracking-widest">QR Sync</span>
                                </button>
                                <div className="relative">
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple accept="image/*" className="hidden" />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full h-full border-4 border-dashed border-slate-100 bg-slate-50/30 rounded-[2rem] flex flex-col items-center justify-center p-8 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group"
                                    >
                                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-sm group-hover:scale-110 transition-transform">🖼️</div>
                                        <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Subir Archivos</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="animate-in slide-in-from-right-4 duration-500 flex flex-col gap-8">
                             <div className="flex flex-wrap gap-4 justify-center">
                                {ocrItems.map((item) => (
                                    <div 
                                        key={item.id} 
                                        className={`relative w-40 h-40 rounded-3xl overflow-hidden shadow-lg border-4 transition-all cursor-pointer ${item.selected ? 'border-indigo-500 scale-105' : 'border-white opacity-70 hover:opacity-100'}`}
                                        onClick={() => setOcrItems(prev => prev.map(it => it.id === item.id ? { ...it, selected: !it.selected } : it))}
                                    >
                                        <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center z-10 transition-colors ${item.selected ? 'bg-indigo-500 text-white' : 'bg-black/30 text-transparent border-2 border-white'}`}>
                                            ✓
                                        </div>
                                        <img src={item.preview} className="w-full h-full object-cover" />
                                        <div className="absolute bottom-2 left-2 flex gap-1 z-20">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setMaximizedImage(item.preview);
                                                }} 
                                                className="w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-indigo-600 transition-colors"
                                                title="Ver más grande"
                                            >
                                                🔍
                                            </button>
                                        </div>
                                        <div className="absolute top-2 right-2 z-20">
                                            <button onClick={(e) => {
                                                e.stopPropagation();
                                                setOcrItems(prev => prev.filter(it => it.id !== item.id));
                                            }} className="w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors">
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-center gap-4">
                                <Button onClick={() => setStep('capture')} variant="secondary">Capturar Más</Button>
                                <Button onClick={processOcr} isLoading={isProcessing}>Analizar Productos</Button>
                            </div>
                        </div>
                    )}

                    {step === 'register' && (
                        <div className="animate-in slide-in-from-bottom-4 duration-500 flex flex-col gap-6">
                            <div className="bg-slate-50 rounded-[2rem] overflow-hidden border border-slate-100">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-slate-100/50 font-black text-slate-400 uppercase tracking-widest">
                                        <tr>
                                            <th className="px-6 py-4">Producto</th>
                                            <th className="px-6 py-4">Código</th>
                                            <th className="px-6 py-4">Categoría</th>
                                            <th className="px-6 py-4 text-center">Precio</th>
                                            <th className="px-6 py-4">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {ocrResult.map((p, i) => {
                                            const duplicate = isDuplicate(p.producto, p.codigo);
                                            return (
                                                <tr key={p.id} className="hover:bg-white transition-colors">
                                                    <td className="px-6 py-3">
                                                        <input 
                                                            className="bg-transparent border-none font-bold text-slate-700 w-full focus:ring-0" 
                                                            value={p.producto}
                                                            onChange={(e) => {
                                                                const next = [...ocrResult];
                                                                next[i].producto = e.target.value.toUpperCase();
                                                                setOcrResult(next);
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <input 
                                                            className="bg-transparent border-none text-slate-500 w-full focus:ring-0" 
                                                            value={p.codigo}
                                                            onChange={(e) => {
                                                                const next = [...ocrResult];
                                                                next[i].codigo = e.target.value.toUpperCase();
                                                                setOcrResult(next);
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <select 
                                                            className="bg-transparent border-none text-indigo-600 font-bold focus:ring-0"
                                                            value={p.idCategoria || ''}
                                                            onChange={(e) => {
                                                                const next = [...ocrResult];
                                                                next[i].idCategoria = e.target.value;
                                                                setOcrResult(next);
                                                            }}
                                                        >
                                                            <option value="">Categoría...</option>
                                                            {categories.map(c => <option key={c.IdCategoria} value={c.IdCategoria}>{c.ImagenCategoria} {c.Categoria}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="px-6 py-3 text-center">
                                                        <input 
                                                            type="number"
                                                            className="bg-transparent border-none text-center w-20 focus:ring-0" 
                                                            value={p.precio}
                                                            onChange={(e) => {
                                                                const next = [...ocrResult];
                                                                next[i].precio = parseFloat(e.target.value) || 0;
                                                                setOcrResult(next);
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        {p.isLinked ? (
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-black">EXISTENTE</span>
                                                                {p.autoLinked && (
                                                                    <span className="text-[9px] text-slate-400 font-medium italic">Auto: {p.systemName}</span>
                                                                )}
                                                            </div>
                                                        ) : p.suggestions?.length > 0 ? (
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-black w-fit">SIMILAR AL {Math.round(p.suggestions[0].similarity * 100)}%</span>
                                                                <select 
                                                                    className="text-[9px] text-slate-500 bg-slate-100 rounded border-none focus:ring-0 py-0.5"
                                                                    onChange={(e) => {
                                                                        const selected = p.suggestions.find((s: any) => s.id.toString() === e.target.value);
                                                                        if (selected) {
                                                                            const next = [...ocrResult];
                                                                            next[i] = {
                                                                                ...next[i],
                                                                                producto: selected.name,
                                                                                codigo: selected.code,
                                                                                isLinked: true,
                                                                                systemId: selected.id
                                                                            };
                                                                            setOcrResult(next);
                                                                        }
                                                                    }}
                                                                >
                                                                    <option value="">¿Es este?</option>
                                                                    {p.suggestions.map((s: any) => (
                                                                        <option key={s.id} value={s.id}>{s.name} ({Math.round(s.similarity * 100)}%)</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-black">NUEVO</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex justify-end gap-4">
                                <Button onClick={() => setStep('preview')} variant="secondary">Atrás</Button>
                                <Button onClick={handleSaveProducts} isLoading={isSaving} className="bg-indigo-600">Registrar Productos</Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Sub-modals */}
            <MobileBatchModal
                isOpen={showMobileBatchModal}
                onClose={() => setShowMobileBatchModal(false)}
                projectId={projectId}
                onPhotosSelected={handleBatchPhotos}
            />

            {showQrModal && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center relative">
                        <button onClick={() => { setShowQrModal(false); setIsPolling(false); }} className="absolute top-4 right-4 text-gray-400">✕</button>
                        <h3 className="text-xl font-bold mb-4">Escanea para capturar</h3>
                        <div className="bg-white p-4 rounded-2xl border-4 border-gray-50 mb-6">
                            <QRCode
                                value={`${window.location.origin}/${locale}/ocr/qr-capture?id=${qrSessionId}`}
                                size={200}
                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                            />
                        </div>
                        <p className="text-sm text-indigo-600 font-bold animate-pulse">Esperando captura...</p>
                    </div>
                </div>
            )}

            {/* Image Lightbox */}
            {maximizedImage && (
                <div 
                    className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300"
                    onClick={() => setMaximizedImage(null)}
                >
                    <button 
                        className="absolute top-8 right-8 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl flex items-center justify-center transition-colors"
                        onClick={() => setMaximizedImage(null)}
                    >✕</button>
                    <img 
                        src={maximizedImage} 
                        alt="Maximized" 
                        className="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-in zoom-in duration-300"
                    />
                </div>
            )}
        </div>
    );
}
