'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import Button from '@/components/Button';

function OCRSimpleUploadContent() {
    const t = useTranslations('OCRSimpleUpload');
    const searchParams = useSearchParams();
    const projectId = searchParams.get('projectId');
    
    // State
    const [projectTheme, setProjectTheme] = useState<{
        titulo: string;
        colorFondo1: string;
        colorFondo2: string;
        colorLetra: string;
        logo64: string | null;
    } | null>(null);
    
    const [description, setDescription] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch Project Theme
    useEffect(() => {
        if (projectId) {
            fetch(`/api/project-header?projectId=${projectId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        setProjectTheme({
                            titulo: data.titulo,
                            colorFondo1: data.colorFondo1,
                            colorFondo2: data.colorFondo2,
                            colorLetra: data.colorLetra,
                            logo64: data.logo64
                        });
                    }
                })
                .catch(err => console.error('Error loading project theme:', err));
        }
    }, [projectId]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setFiles(prev => [...prev, ...newFiles]);
            const newPreviews = newFiles.map(file => URL.createObjectURL(file));
            setPreviews(prev => [...prev, ...newPreviews]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const resetForm = () => {
        setFiles([]);
        setPreviews([]);
        setDescription('');
        setMessage(null);
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = error => reject(error);
        });
    };

    const handleSave = async () => {
        if (!projectId) {
            setMessage({ type: 'error', text: t('noProject') });
            return;
        }
        if (!description || files.length === 0) {
            alert('Por favor ingrese una descripción y tome al menos una foto.');
            return;
        }

        setIsSaving(true);
        setMessage(null);
        try {
            const base64Files = await Promise.all(files.map(fileToBase64));
            
            const response = await fetch('/api/ocr/documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    description,
                    documents: base64Files
                })
            });

            const data = await response.json();
            if (data.success) {
                setMessage({ type: 'success', text: '¡El lote de documentos se dio de alta correctamente!' });
                setFiles([]);
                setPreviews([]);
                setDescription('');
            } else {
                setMessage({ type: 'error', text: t('error') + ': ' + (data.message || '') });
            }
        } catch (error: any) {
            console.error('Error saving documents:', error);
            setMessage({ type: 'error', text: t('error') + ': ' + error.message });
        } finally {
            setIsSaving(false);
        }
    };

    if (!projectId) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
                <style jsx global>{`
                    body { -webkit-tap-highlight-color: transparent; }
                `}</style>
                <div className="bg-white p-8 rounded-3xl shadow-xl space-y-4">
                    <span className="text-6xl">⚠️</span>
                    <h1 className="text-xl font-bold text-[#000000]">{t('noProject')}</h1>
                    <p className="text-gray-500 text-sm">Escanea el código QR desde el dashboard del proyecto.</p>
                </div>
            </div>
        );
    }

    const themeColors = {
        primary: projectTheme?.colorFondo1 || '#FF6B35',
        secondary: projectTheme?.colorFondo2 || '#F7931E',
        text: projectTheme?.colorLetra || '#FFFFFF'
    };

    return (
        <div className="min-h-screen bg-white flex flex-col font-sans select-none overflow-x-hidden">
            <style jsx global>{`
                body { 
                    -webkit-tap-highlight-color: transparent;
                    background-color: white;
                }
                input, button {
                    -webkit-appearance: none;
                }
            `}</style>

            {/* Mobile-style Header */}
            <div 
                className="p-6 pt-10 rounded-b-[3rem] shadow-lg transition-colors duration-500"
                style={{
                    background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})`,
                    color: themeColors.text
                }}
            >
                <div className="flex justify-between items-start mb-2">
                    <h1 className="text-3xl font-black leading-tight drop-shadow-sm">
                        {projectTheme?.titulo || t('title')}
                    </h1>
                    {projectTheme?.logo64 ? (
                        <img 
                            src={projectTheme.logo64} 
                            alt="Logo" 
                            className="w-12 h-12 object-contain bg-white/20 p-1 rounded-xl backdrop-blur-sm"
                        />
                    ) : (
                        <span className="bg-white/20 p-2 rounded-2xl backdrop-blur-sm text-2xl">📄</span>
                    )}
                </div>
                <p className="font-bold text-sm border-l-2 border-white/30 pl-3 opacity-90">
                    {t('subtitle')}
                </p>
            </div>

            <div className="flex-1 p-6 space-y-8">
                {/* Status Message */}
                {message && (
                    <div className={`p-5 rounded-3xl flex flex-col items-center text-center gap-4 animate-in fade-in zoom-in duration-300 ${
                        message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                        <span className="text-5xl">{message.type === 'success' ? '✅' : '❌'}</span>
                        <div className="space-y-1">
                            <p className="font-black text-lg">{message.text}</p>
                            {message.type === 'success' && (
                                <p className="text-sm font-medium opacity-80">¿Deseas agregar más documentos?</p>
                            )}
                        </div>
                        {message.type === 'success' && (
                            <button 
                                onClick={resetForm}
                                className="w-full py-3 bg-white text-green-700 font-black rounded-2xl shadow-sm border border-green-100 active:scale-95 transition-all"
                            >
                                ➕ AGREGAR OTRO LOTE
                            </button>
                        )}
                    </div>
                )}

                {!message && (
                    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                        {/* Form */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">{t('description')}</label>
                            <input 
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Ej: Facturas Proveedor X - Marzo"
                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 transition-all font-black text-[#000000] placeholder:text-gray-300"
                                style={{ '--tw-ring-color': `${themeColors.primary}20` } as any}
                            />
                        </div>

                        {/* Camera Button */}
                        <div className="relative">
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                multiple 
                                accept="image/*" 
                                capture="environment" 
                                onChange={handleFileChange} 
                                className="hidden" 
                            />
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full border-2 border-dashed rounded-[2.5rem] p-12 flex flex-col items-center justify-center gap-4 active:scale-95 transition-all group"
                                style={{ 
                                    backgroundColor: `${themeColors.primary}10`,
                                    borderColor: `${themeColors.primary}40`,
                                    color: themeColors.primary
                                }}
                            >
                                <div className="w-20 h-20 bg-white rounded-3xl shadow-md flex items-center justify-center text-4xl group-hover:scale-110 transition-transform">
                                    📸
                                </div>
                                <span className="font-black text-xl mb-1">{t('addPhoto')}</span>
                                <span className="text-xs font-black bg-white px-4 py-1.5 rounded-full shadow-sm uppercase tracking-wide">
                                    {files.length} FOTOS LISTAS
                                </span>
                            </button>
                        </div>

                        {/* Previews List */}
                        {previews.length > 0 && (
                            <div className="grid grid-cols-2 gap-4">
                                {previews.map((src, idx) => (
                                    <div key={idx} className="relative aspect-square rounded-[2rem] overflow-hidden border-2 border-white bg-gray-100 shadow-lg animate-in zoom-in duration-200">
                                        <img src={src} alt="Capture" className="w-full h-full object-cover" />
                                        <button 
                                            onClick={() => removeFile(idx)}
                                            className="absolute top-3 right-3 w-10 h-10 bg-black/60 text-white rounded-full flex items-center justify-center backdrop-blur-md active:bg-red-500 shadow-sm"
                                        >
                                            <span className="text-lg font-bold">✕</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Sticky Action */}
            {!message && (
                <div className="p-6 sticky bottom-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 pb-12 flex flex-col gap-4">
                    <Button 
                        onClick={handleSave} 
                        disabled={isSaving || files.length === 0}
                        className="w-full py-5 rounded-3xl font-black text-xl shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-2"
                        style={{ 
                            backgroundColor: files.length === 0 ? '#E5E7EB' : themeColors.primary,
                            color: files.length === 0 ? '#9CA3AF' : themeColors.text,
                            boxShadow: files.length === 0 ? 'none' : `0 20px 40px -15px ${themeColors.primary}50`
                        }}
                    >
                        {isSaving ? (
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                {t('saving')}
                            </div>
                        ) : (
                            <>{files.length > 0 ? '🚀' : '📥'} {t('save')}</>
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
}

export default function OCRSimpleUploadPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-black animate-pulse text-primary-500">CARGANDO...</div>}>
            <OCRSimpleUploadContent />
        </Suspense>
    );
}
