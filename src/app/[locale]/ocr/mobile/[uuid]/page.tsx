'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

export default function MobileUploadPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const uuid = params?.uuid as string;
    const projectId = searchParams.get('projectId') || '';

    const [photos, setPhotos] = useState<{ preview: string; status: 'uploading' | 'done' | 'error' }[]>([]);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isValid, setIsValid] = useState<boolean | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const today = new Date().toISOString().split('T')[0];

    // Validate UUID on mount
    useEffect(() => {
        if (!uuid || !projectId) { setIsValid(false); return; }
        fetch(`/api/ocr/project-uuid?projectId=${projectId}`)
            .then(r => r.json())
            .then(data => setIsValid(data.success && data.uuid === uuid))
            .catch(() => setIsValid(false));
    }, [uuid, projectId]);

    const uploadPhoto = async (base64: string, preview: string) => {
        const idx = photos.length;
        setPhotos(prev => [...prev, { preview, status: 'uploading' }]);
        try {
            const res = await fetch('/api/ocr/mobile-batches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: parseInt(projectId), uuid, date: today, imageBase64: base64 })
            });
            const data = await res.json();
            setPhotos(prev => prev.map((p, i) => i === idx ? { ...p, status: data.success ? 'done' : 'error' } : p));
        } catch {
            setPhotos(prev => prev.map((p, i) => i === idx ? { ...p, status: 'error' } : p));
        }
    };

    const startCamera = async () => {
        setIsCameraOpen(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch {
            alert('No se pudo acceder a la cámara. Usa "Subir imagen" en su lugar.');
            setIsCameraOpen(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current?.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }
        setIsCameraOpen(false);
    };

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const base64 = dataUrl.split(',')[1];
        uploadPhoto(base64, dataUrl);
        stopCamera();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        Array.from(e.target.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result as string;
                const base64 = dataUrl.split(',')[1];
                uploadPhoto(base64, dataUrl);
            };
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    };

    // Loading state
    if (isValid === null) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-slate-700 border-t-red-500 rounded-full animate-spin" />
            </div>
        );
    }

    // Invalid
    if (isValid === false) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
                <div className="text-center">
                    <div className="text-5xl mb-4">❌</div>
                    <h1 className="text-white text-xl font-black mb-2">Enlace inválido</h1>
                    <p className="text-slate-400 text-sm">Este QR no es válido o ya expiró.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col">
            {/* Header */}
            <div className="px-6 py-5 bg-slate-800 border-b border-slate-700 flex items-center gap-3">
                <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-xl">📸</div>
                <div>
                    <h1 className="text-white font-black text-base leading-tight">Subir Fotos de Recibos</h1>
                    <p className="text-slate-400 text-xs">{today} • {photos.filter(p => p.status === 'done').length} foto{photos.filter(p => p.status === 'done').length !== 1 ? 's' : ''} guardada{photos.filter(p => p.status === 'done').length !== 1 ? 's' : ''}</p>
                </div>
            </div>

            {/* Camera View */}
            {isCameraOpen && (
                <div className="fixed inset-0 z-50 bg-black flex flex-col">
                    <video ref={videoRef} autoPlay playsInline className="flex-1 object-contain w-full" />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="p-8 flex justify-between items-center bg-black/60">
                        <button onClick={stopCamera} className="text-white text-4xl w-14 h-14 flex items-center justify-center">✕</button>
                        <button
                            onClick={capturePhoto}
                            className="w-20 h-20 bg-white rounded-full border-4 border-slate-300 active:scale-90 transition-transform shadow-2xl"
                        />
                        <div className="w-14" />
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="p-6 flex gap-4">
                <button
                    onClick={startCamera}
                    className="flex-1 flex flex-col items-center justify-center gap-2 py-8 bg-red-600 hover:bg-red-500 active:scale-95 rounded-3xl transition-all shadow-lg shadow-red-900/40"
                >
                    <span className="text-4xl">📷</span>
                    <span className="text-white font-black text-sm uppercase tracking-widest">Tomar Foto</span>
                </button>
                <div className="flex-1 relative">
                    <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-full flex flex-col items-center justify-center gap-2 py-8 bg-slate-700 hover:bg-slate-600 active:scale-95 rounded-3xl transition-all"
                    >
                        <span className="text-4xl">🖼️</span>
                        <span className="text-white font-black text-sm uppercase tracking-widest">Subir Imagen</span>
                    </button>
                </div>
            </div>

            {/* Photo Grid */}
            {photos.length > 0 && (
                <div className="px-6 pb-8 flex-1">
                    <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-4">Fotos de hoy</p>
                    <div className="grid grid-cols-3 gap-3">
                        {photos.map((photo, i) => (
                            <div key={i} className="relative aspect-square rounded-2xl overflow-hidden bg-slate-800">
                                <img src={photo.preview} alt="" className="w-full h-full object-cover" />
                                <div className={`absolute inset-0 flex items-center justify-center transition-all ${
                                    photo.status === 'uploading' ? 'bg-black/60' :
                                    photo.status === 'done' ? 'bg-green-600/20' : 'bg-red-600/40'
                                }`}>
                                    {photo.status === 'uploading' && (
                                        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                    )}
                                    {photo.status === 'done' && (
                                        <div className="absolute bottom-2 right-2 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-black shadow-lg">✓</div>
                                    )}
                                    {photo.status === 'error' && (
                                        <div className="text-white text-center p-2">
                                            <div className="text-xl">❌</div>
                                            <div className="text-[10px] font-black">Error</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {photos.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16 opacity-40">
                    <div className="text-6xl mb-4">🧾</div>
                    <p className="text-slate-300 text-sm font-black uppercase tracking-widest text-center">Toma fotos de tus recibos</p>
                    <p className="text-slate-500 text-xs text-center mt-2">Las fotos se guardan automáticamente y estarán disponibles para procesar en la app</p>
                </div>
            )}
        </div>
    );
}
