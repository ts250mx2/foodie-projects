'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import Button from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';

function SimpleUploadContent() {
    const t = useTranslations('OCRDocuments');
    const { colors } = useTheme();
    const searchParams = useSearchParams();

    // State
    const [project, setProject] = useState<any>(null);
    const [description, setDescription] = useState('');
    const [images, setImages] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const storedProject = localStorage.getItem('project') || localStorage.getItem('selectedProject');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setImages(prev => [...prev, ...files]);
            const newPreviews = files.map(file => URL.createObjectURL(file));
            setPreviews(prev => [...prev, ...newPreviews]);
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => prev.filter((_, i) => i !== index));
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
        if (!project) {
            alert('No hay un proyecto seleccionado. Por favor regrese al dashboard.');
            return;
        }
        if (!description || images.length === 0) {
            alert('Por favor complete todos los datos.');
            return;
        }

        setIsSaving(true);
        try {
            const base64Files = await Promise.all(images.map(image => fileToBase64(image)));
            
            const response = await fetch('/api/ocr/documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    description,
                    documents: base64Files
                })
            });

            const data = await response.json();
            if (response.ok && data.success) {
                alert(t('success'));
                setImages([]);
                setPreviews([]);
                setDescription('');
            } else {
                alert(t('error') + ': ' + (data.message || ''));
            }
        } catch (error: any) {
            console.error('Error saving:', error);
            alert(t('error') + ': ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-md mx-auto p-4 space-y-6 pb-20">
            <header className="text-center py-6">
                <h1 className="text-2xl font-black text-gray-800 tracking-tight">{t('title')}</h1>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Carga Rápida Móvil</p>
            </header>

            <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 space-y-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">{t('description')}</label>
                    <input 
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Nombre del lote..."
                        className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-red-500 focus:bg-white outline-none font-bold text-gray-700 transition-all"
                    />
                </div>

                <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">{t('uploadFiles')}</label>
                    
                    <div className="grid grid-cols-2 gap-3">
                        {previews.map((src, idx) => (
                            <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border-2 border-white shadow-sm ring-1 ring-gray-100">
                                <img src={src} alt="Preview" className="w-full h-full object-cover" />
                                <button 
                                    onClick={() => removeImage(idx)}
                                    className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center text-[10px] backdrop-blur-md"
                                >✕</button>
                            </div>
                        ))}
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="aspect-square border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-2 bg-gray-50 cursor-pointer active:scale-95 transition-all text-gray-400"
                        >
                            <span className="text-2xl">📸</span>
                            <span className="text-[10px] font-black uppercase tracking-widest">Tomar Foto</span>
                            <input 
                                type="file" 
                                ref={fileInputRef}
                                multiple
                                accept="image/*"
                                capture="environment"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                        </div>
                    </div>
                </div>

                <Button 
                    onClick={handleSave}
                    disabled={isSaving || !description || images.length === 0}
                    className="w-full py-4 font-black uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all"
                    style={{ backgroundColor: colors.colorFondo1 }}
                >
                    {isSaving ? 'Guardando...' : '🚀 Guardar Lote'}
                </Button>
            </div>
        </div>
    );
}

export default function SimpleUploadPage() {
    return (
        <Suspense fallback={<div>Cargando...</div>}>
            <SimpleUploadContent />
        </Suspense>
    );
}
