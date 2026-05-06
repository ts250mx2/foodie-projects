'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { v4 as uuidv4 } from 'uuid';
import Button from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import MobileBatchModal, { BatchSelectedPhoto } from '@/components/MobileBatchModal';

interface Product {
    name: string;
    rawMaterial: number;
    packaging: number;
}

interface BreakEvenProductImageCaptureModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: number;
    onAddProducts: (products: Product[]) => void;
}

type Step = 'capture' | 'preview' | 'confirm';

export default function BreakEvenProductImageCaptureModal({ 
    isOpen, 
    onClose, 
    projectId, 
    onAddProducts 
}: BreakEvenProductImageCaptureModalProps) {
    const tNav = useTranslations('Navigation');
    const tCommon = useTranslations('Common');
    const { colors } = useTheme();

    const [step, setStep] = useState<Step>('capture');
    interface OcrItem {
        id: string;
        file: File;
        preview: string;
        selected: boolean;
    }
    const [ocrItems, setOcrItems] = useState<OcrItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [ocrResult, setOcrResult] = useState<any[]>([]);
    const [showMobileBatchModal, setShowMobileBatchModal] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ocrFileInputRef = useRef<HTMLInputElement>(null);

    // Reset modal when opened/closed
    useEffect(() => {
        if (isOpen) {
            setStep('capture');
            setOcrItems([]);
            setOcrResult([]);
        }
    }, [isOpen]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (error) {
            alert('No se pudo acceder a la cámara');
        }
    };

    const stopCamera = () => {
        if (videoRef.current?.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
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

    const handleOcrFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            const newItems: OcrItem[] = newFiles.map(file => {
                const preview = URL.createObjectURL(file);
                return { id: uuidv4(), file, preview, selected: true };
            });
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

    const processOcr = async () => {
        const selectedItems = ocrItems.filter(item => item.selected);
        if (selectedItems.length === 0) return;

        setIsProcessing(true);
        try {
            const formData = new FormData();
            selectedItems.forEach(item => formData.append('image', item.file));
            formData.append('model', 'claude-opus-4-6');

            const res = await fetch('/api/expenses/process-receipt', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                const products = data.data.concepts.map((c: any) => ({
                    name: c.description.toUpperCase(),
                    rawMaterial: c.price || 0,
                    packaging: 0,
                    selected: true
                }));
                setOcrResult(products);
                setStep('confirm');
            } else {
                alert('Error al procesar: ' + data.message);
            }
        } catch (error) {
            alert('Error en el servidor');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleConfirm = () => {
        const selected = ocrResult.filter(p => p.selected).map(p => ({
            name: p.name,
            rawMaterial: p.rawMaterial,
            packaging: p.packaging
        }));
        if (selected.length > 0) {
            onAddProducts(selected);
            onClose();
        } else {
            alert('Selecciona al menos un producto');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white/20">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                            <span className="bg-orange-600 text-white p-2 rounded-xl shadow-lg">📸</span>
                            Carga Masiva de Productos
                        </h2>
                        <p className="text-xs text-slate-400 font-medium mt-1">Escanea listas o facturas para cargar productos rápidamente</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors font-black text-xl">✕</button>
                </div>

                <div className="flex-1 overflow-auto p-8 relative">
                    {isProcessing && (
                        <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-[2px] flex flex-col items-center justify-center animate-in fade-in duration-300">
                            <div className="w-16 h-16 border-4 border-slate-100 border-t-orange-600 rounded-full animate-spin mb-4"></div>
                            <p className="text-sm font-black text-slate-700 tracking-widest uppercase animate-pulse">Analizando Documentos...</p>
                        </div>
                    )}

                    {step === 'capture' && (
                        <div className="animate-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <button 
                                    onClick={() => { startCamera(); }} 
                                    className="flex flex-col items-center justify-center p-10 rounded-[2.5rem] bg-slate-50 border border-slate-100 hover:border-orange-200 hover:bg-orange-50/30 transition-all group"
                                >
                                    <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-4xl mb-4 shadow-sm group-hover:scale-110 transition-transform">📸</div>
                                    <span className="text-sm font-black text-slate-700 uppercase tracking-widest">Cámara Directa</span>
                                </button>
                                <button 
                                    onClick={() => setShowMobileBatchModal(true)} 
                                    className="flex flex-col items-center justify-center p-10 rounded-[2.5rem] bg-slate-50 border border-slate-100 hover:border-orange-200 hover:bg-orange-50/30 transition-all group"
                                >
                                    <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-4xl mb-4 shadow-sm group-hover:scale-110 transition-transform">📱</div>
                                    <span className="text-sm font-black text-slate-700 uppercase tracking-widest">Lotes de Celular</span>
                                </button>
                                <div className="relative">
                                    <input type="file" ref={ocrFileInputRef} onChange={handleOcrFileChange} multiple accept="image/*" className="hidden" />
                                    <button
                                        onClick={() => ocrFileInputRef.current?.click()}
                                        className="w-full h-full border-4 border-dashed border-slate-100 bg-slate-50/30 rounded-[3rem] flex flex-col items-center justify-center p-12 hover:border-orange-200 hover:bg-orange-50/30 transition-all group"
                                    >
                                        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-4xl mb-4 shadow-sm group-hover:scale-110 transition-transform">🖼️</div>
                                        <span className="text-sm font-black text-orange-600 uppercase tracking-widest">Subir Imágenes</span>
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
                                        onClick={() => setOcrItems(prev => prev.map(it => it.id === item.id ? { ...it, selected: !it.selected } : it))}
                                        className={`relative w-40 h-40 rounded-3xl overflow-hidden shadow-lg border-4 transition-all cursor-pointer ${item.selected ? 'border-orange-500 scale-105' : 'border-white opacity-70 hover:opacity-100'}`}
                                    >
                                        <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center z-10 ${item.selected ? 'bg-orange-500 text-white' : 'bg-black/30 text-transparent border-2 border-white'}`}>✓</div>
                                        <img src={item.preview} alt="preview" className="w-full h-full object-cover" />
                                        <button onClick={(e) => {
                                            e.stopPropagation();
                                            setOcrItems(prev => {
                                                const next = prev.filter(it => it.id !== item.id);
                                                if (next.length === 0) setStep('capture');
                                                return next;
                                            });
                                        }} className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors z-10">✕</button>
                                    </div>
                                ))}
                                <button onClick={() => ocrFileInputRef.current?.click()} className="w-40 h-40 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 transition-all">
                                    <span className="text-2xl">➕</span>
                                    <span className="text-[10px] font-black uppercase mt-2">Agregar</span>
                                </button>
                            </div>
                            <div className="flex justify-center gap-4">
                                <Button variant="secondary" onClick={() => setStep('capture')} className="px-8 py-4 rounded-xl font-black uppercase text-xs">Atrás</Button>
                                <Button onClick={processOcr} className="px-12 py-4 rounded-xl bg-orange-600 text-white font-black tracking-widest uppercase shadow-xl shadow-orange-100 hover:scale-105 transition-all">🚀 Procesar</Button>
                            </div>
                        </div>
                    )}

                    {step === 'confirm' && (
                        <div className="animate-in slide-in-from-bottom-4 duration-500 flex flex-col gap-6">
                            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 mb-2">
                                <p className="text-xs font-black text-orange-800 uppercase tracking-wider">Productos Detectados</p>
                                <p className="text-[10px] text-orange-600/70 font-medium mt-0.5">Selecciona los productos que deseas añadir a tu análisis de punto de equilibrio.</p>
                            </div>
                            <div className="space-y-3">
                                {ocrResult.map((p, idx) => (
                                    <div key={idx} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${p.selected ? 'bg-white border-orange-200 shadow-md ring-1 ring-orange-50' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                        <input 
                                            type="checkbox" 
                                            checked={p.selected} 
                                            onChange={() => {
                                                const next = [...ocrResult];
                                                next[idx].selected = !next[idx].selected;
                                                setOcrResult(next);
                                            }}
                                            className="w-5 h-5 rounded-lg border-2 border-slate-200 text-orange-600 focus:ring-orange-500 transition-all cursor-pointer"
                                        />
                                        <div className="flex-1 flex flex-col gap-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre del Producto</label>
                                            <input 
                                                type="text" 
                                                value={p.name} 
                                                onChange={(e) => {
                                                    const next = [...ocrResult];
                                                    next[idx].name = e.target.value.toUpperCase();
                                                    setOcrResult(next);
                                                }}
                                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-orange-400 transition-all"
                                            />
                                        </div>
                                        <div className="w-32 flex flex-col gap-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Costo MP</label>
                                            <input 
                                                type="number" 
                                                value={p.rawMaterial} 
                                                onChange={(e) => {
                                                    const next = [...ocrResult];
                                                    next[idx].rawMaterial = parseFloat(e.target.value) || 0;
                                                    setOcrResult(next);
                                                }}
                                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-700 outline-none focus:bg-white focus:border-orange-400 text-right transition-all"
                                            />
                                        </div>
                                        <div className="w-32 flex flex-col gap-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Empaque</label>
                                            <input 
                                                type="number" 
                                                value={p.packaging} 
                                                onChange={(e) => {
                                                    const next = [...ocrResult];
                                                    next[idx].packaging = parseFloat(e.target.value) || 0;
                                                    setOcrResult(next);
                                                }}
                                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-700 outline-none focus:bg-white focus:border-orange-400 text-right transition-all"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between items-center mt-6 pt-6 border-t border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total seleccionados: {ocrResult.filter(p => p.selected).length}</p>
                                <div className="flex gap-3">
                                    <Button variant="secondary" onClick={() => setStep('preview')} className="px-8 h-12 rounded-xl font-black uppercase text-xs">Atrás</Button>
                                    <Button onClick={handleConfirm} className="px-10 h-12 bg-orange-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-100 hover:bg-orange-700 transition-all">Añadir Productos</Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <MobileBatchModal 
                isOpen={showMobileBatchModal}
                onClose={() => setShowMobileBatchModal(false)}
                projectId={projectId}
                onProcessAsExpense={handleBatchPhotos}
                onProcessAsPurchase={handleBatchPhotos}
            />
        </div>
    );
}
