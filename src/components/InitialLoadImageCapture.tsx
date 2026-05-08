'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Button from '@/components/Button';

interface InitialLoadImageCaptureProps {
    isOpen: boolean;
    onClose: () => void;
    productName: string;
    onSave: (base64: string) => Promise<void>;
}

export default function InitialLoadImageCapture({
    isOpen,
    onClose,
    productName,
    onSave
}: InitialLoadImageCaptureProps) {
    const [preview, setPreview] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Handle paste
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (!isOpen) return;
            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    if (blob) {
                        const reader = new FileReader();
                        reader.onload = (event) => setPreview(event.target?.result as string);
                        reader.readAsDataURL(blob);
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [isOpen]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => setPreview(event.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => setPreview(event.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleSuggestAI = async () => {
        const confirmGen = window.confirm('Generar una imagen con IA tiene un costo adicional. ¿Deseas continuar?');
        if (!confirmGen) return;

        setIsGenerating(true);
        try {
            const response = await fetch('/api/ai/suggest-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productName })
            });
            const data = await response.json();
            if (data.success && data.image) {
                setPreview(data.image);
            } else {
                alert('No se pudo generar la imagen: ' + (data.message || 'Error desconocido'));
            }
        } catch (error) {
            alert('Error al conectar con la IA');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleConfirm = async () => {
        if (!preview) return;
        setIsSaving(true);
        try {
            await onSave(preview);
            setPreview(null);
            onClose();
        } catch (error) {
            alert('Error al guardar la imagen');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Imagen del Producto</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{productName}</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 transition-colors">✕</button>
                </div>

                <div className="p-8 space-y-6">
                    {!preview ? (
                        <div 
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            className={`h-64 border-4 border-dashed rounded-[2rem] flex flex-col items-center justify-center transition-all ${isDragging ? 'border-indigo-400 bg-indigo-50/50 scale-[0.98]' : 'border-slate-100 bg-slate-50'}`}
                        >
                            <div className="text-5xl mb-4">🖼️</div>
                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Arrastra, Pega o Carga una imagen</p>
                            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                            <div className="flex gap-2">
                                <Button onClick={() => fileInputRef.current?.click()} className="bg-white text-slate-600 border border-slate-200 shadow-sm text-xs py-2 h-auto px-6">SUBIR ARCHIVO</Button>
                                <Button onClick={handleSuggestAI} isLoading={isGenerating} className="bg-indigo-600 shadow-lg shadow-indigo-100 text-xs py-2 h-auto px-6">SUGERIR CON IA 🪄</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="relative h-64 rounded-[2rem] overflow-hidden group shadow-2xl border-4 border-white">
                            <img src={preview} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                <Button onClick={() => setPreview(null)} variant="secondary" className="bg-white/20 text-white border-white/40 backdrop-blur-md">CAMBIAR</Button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex gap-3">
                    <Button onClick={onClose} className="flex-1 bg-slate-200 text-slate-500">CANCELAR</Button>
                    <Button 
                        onClick={handleConfirm} 
                        isLoading={isSaving} 
                        disabled={!preview}
                        className="flex-1 bg-indigo-600 shadow-lg shadow-indigo-100"
                    >
                        GUARDAR
                    </Button>
                </div>
            </div>
        </div>
    );
}
