'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PendingPhoto {
    id: string;
    dataUrl: string;   // full data url for display
    base64: string;    // only the base64 payload
}

interface UploadedPhoto {
    dataUrl: string;
    status: 'done' | 'error';
    errorMsg?: string;
}

interface ProjectTheme {
    titulo: string;
    colorFondo1: string;
    colorFondo2: string;
    colorLetra: string;
    logo64: string | null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function MobileUploadContent() {
    const params = useParams();
    const searchParams = useSearchParams();
    const uuid = params?.uuid as string;
    const projectId = searchParams.get('projectId') || '';

    const [isValid, setIsValid] = useState<boolean | null>(null);
    const [theme, setTheme] = useState<ProjectTheme | null>(null);

    // Pending = staged photos waiting for user to hit "Subir"
    const [pending, setPending] = useState<PendingPhoto[]>([]);
    // Uploaded = already sent to server
    const [uploaded, setUploaded] = useState<UploadedPhoto[]>([]);

    const [isUploading, setIsUploading] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [zoomSrc, setZoomSrc] = useState<string | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const today = new Date().toISOString().split('T')[0];

    // ── Validate UUID + load theme ────────────────────────────────────────────
    useEffect(() => {
        if (!uuid || !projectId) { setIsValid(false); return; }

        // Validate UUID
        fetch(`/api/ocr/project-uuid?projectId=${projectId}`)
            .then(r => r.json())
            .then(data => setIsValid(data.success && data.uuid === uuid))
            .catch(() => setIsValid(false));

        // Load project theme
        fetch(`/api/project-header?projectId=${projectId}`)
            .then(r => r.json())
            .then(data => {
                if (data.success) setTheme({
                    titulo: data.titulo || 'Subir Recibos',
                    colorFondo1: data.colorFondo1 || '#7033ff',
                    colorFondo2: data.colorFondo2 || '#a855f7',
                    colorLetra: data.colorLetra || '#ffffff',
                    logo64: data.logo64 || null
                });
            })
            .catch(() => { });
    }, [uuid, projectId]);

    const primary = theme?.colorFondo1 || '#7033ff';
    const secondary = theme?.colorFondo2 || '#a855f7';
    const letra = theme?.colorLetra || '#ffffff';

    // ── Camera ────────────────────────────────────────────────────────────────
    const startCamera = async () => {
        setIsCameraOpen(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch {
            alert('No se pudo acceder a la cámara. Usa "Galería" para subir imágenes.');
            setIsCameraOpen(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current?.srcObject)
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
        setIsCameraOpen(false);
    };

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;
        const v = videoRef.current;
        const c = canvasRef.current;
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        c.getContext('2d')?.drawImage(v, 0, 0);
        const dataUrl = c.toDataURL('image/jpeg', 0.85);
        stopCamera();
        resizeAndQueue(dataUrl);
    };

    // ── File picker ───────────────────────────────────────────────────────────
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        Array.from(e.target.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = () => resizeAndQueue(reader.result as string);
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    };

    /**
     * Resize + compress a dataUrl to at most 1920px on longest side, quality 0.75.
     * This keeps base64 payload under ~500 KB, preventing iOS Safari body-size errors.
     */
    const resizeAndQueue = (dataUrl: string) => {
        const img = new Image();
        img.onload = () => {
            const MAX = 1920;
            let { width, height } = img;
            if (width > MAX || height > MAX) {
                if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
                else { width = Math.round(width * MAX / height); height = MAX; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.75);
            const base64 = compressed.split(',')[1];
            if (!base64) { alert('No se pudo procesar la imagen. Intenta con otra foto.'); return; }
            setPending(prev => [...prev, {
                id: `${Date.now()}-${Math.random()}`,
                dataUrl: compressed,
                base64
            }]);
        };
        img.onerror = () => alert('No se pudo leer la imagen seleccionada.');
        img.src = dataUrl;
    };

    // Legacy (kept for direct camera capture path)
    const addPending = (dataUrl: string) => {
        resizeAndQueue(dataUrl);
    };

    const removePending = (id: string) =>
        setPending(prev => prev.filter(p => p.id !== id));

    // ── Upload ────────────────────────────────────────────────────────────────
    const handleUploadAll = async () => {
        if (pending.length === 0) return;
        setIsUploading(true);

        const results: UploadedPhoto[] = [];
        for (const photo of pending) {
            try {
                const res = await fetch('/api/ocr/mobile-batches', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectId: parseInt(projectId),
                        uuid,
                        date: today,
                        imageBase64: photo.base64
                    })
                });
                const data = await res.json();
                if (data.success) {
                    results.push({ dataUrl: photo.dataUrl, status: 'done' });
                } else {
                    results.push({
                        dataUrl: photo.dataUrl,
                        status: 'error',
                        errorMsg: data.message || `Error HTTP ${res.status}`
                    });
                }
            } catch (err: any) {
                results.push({
                    dataUrl: photo.dataUrl,
                    status: 'error',
                    errorMsg: 'Sin conexión: ' + (err.message || 'Error de red')
                });
            }
        }

        setUploaded(prev => [...prev, ...results]);
        setPending([]);
        setIsUploading(false);
    };

    // ── States ────────────────────────────────────────────────────────────────
    if (isValid === null) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}>
                <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    if (!isValid) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="text-center bg-white p-10 rounded-3xl shadow-xl">
                    <div className="text-6xl mb-4">🔒</div>
                    <h1 className="text-xl font-black text-gray-800 mb-2">Enlace inválido</h1>
                    <p className="text-gray-400 text-sm">Este QR no es válido o ya no está activo.</p>
                </div>
            </div>
        );
    }

    const doneCount = uploaded.filter(u => u.status === 'done').length;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans select-none overflow-x-hidden">
            {/* Global style for mobile */}
            <style>{`body { -webkit-tap-highlight-color: transparent; background: #f9fafb; }`}</style>

            {/* ─── Header ─── */}
            <div
                className="px-6 pt-10 pb-8 rounded-b-[2.5rem] shadow-lg"
                style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})`, color: letra }}
            >
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        {theme?.logo64 ? (
                            <img src={theme.logo64} alt="Logo" className="w-11 h-11 object-contain bg-white/20 p-1.5 rounded-2xl" />
                        ) : (
                            <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center text-2xl backdrop-blur-sm">📸</div>
                        )}
                        <div>
                            <h1 className="text-xl font-black leading-tight drop-shadow-sm">{theme?.titulo || 'Subir Recibos'}</h1>
                            <p className="text-xs opacity-75 font-medium">{today}</p>
                        </div>
                    </div>
                    {doneCount > 0 && (
                        <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-3 py-1.5 text-xs font-black uppercase tracking-wider">
                            ✅ {doneCount} subida{doneCount !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>

                {/* Capture buttons */}
                <div className="flex gap-3 mt-4">
                    <button
                        onClick={startCamera}
                        className="flex-1 py-5 bg-white/20 backdrop-blur-sm hover:bg-white/30 active:scale-95 rounded-2xl flex flex-col items-center gap-2 transition-all border border-white/20"
                    >
                        <span className="text-3xl">📷</span>
                        <span className="text-xs font-black uppercase tracking-wider" style={{ color: letra }}>Cámara</span>
                    </button>
                    <div className="flex-1 relative">
                        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-5 bg-white/20 backdrop-blur-sm hover:bg-white/30 active:scale-95 rounded-2xl flex flex-col items-center gap-2 transition-all border border-white/20"
                        >
                            <span className="text-3xl">🖼️</span>
                            <span className="text-xs font-black uppercase tracking-wider" style={{ color: letra }}>Galería</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── Camera View ─── */}
            {isCameraOpen && (
                <div className="fixed inset-0 z-[100] bg-black flex flex-col">
                    <video ref={videoRef} autoPlay playsInline className="flex-1 object-contain w-full" />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="px-8 py-6 pb-12 flex justify-between items-center bg-black/70 backdrop-blur-md">
                        <button
                            onClick={stopCamera}
                            className="w-14 h-14 rounded-full bg-white/10 text-white text-2xl flex items-center justify-center active:scale-90 transition-transform border border-white/20"
                        >
                            ✕
                        </button>
                        <button
                            onClick={capturePhoto}
                            className="w-20 h-20 bg-white rounded-full border-4 border-gray-200 active:scale-90 transition-transform shadow-2xl shadow-white/20"
                        />
                        <div className="w-14" />
                    </div>
                </div>
            )}

            {/* ─── Zoom Lightbox ─── */}
            {zoomSrc && (
                <div
                    className="fixed inset-0 z-[90] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setZoomSrc(null)}
                >
                    <div className="relative max-w-full max-h-full" onClick={e => e.stopPropagation()}>
                        <img
                            src={zoomSrc}
                            alt="Vista ampliada"
                            className="max-w-[92vw] max-h-[85vh] rounded-3xl object-contain shadow-2xl border-2 border-white/10"
                        />
                        <button
                            onClick={() => setZoomSrc(null)}
                            className="absolute -top-3 -right-3 w-10 h-10 bg-black/70 border border-white/20 text-white rounded-full flex items-center justify-center text-lg font-black shadow-lg"
                        >
                            ✕
                        </button>
                        <p className="absolute -bottom-8 left-0 right-0 text-center text-white/40 text-xs font-medium">
                            Toca fuera para cerrar
                        </p>
                    </div>
                </div>
            )}

            {/* ─── Content ─── */}
            <div className="flex-1 px-5 py-6 space-y-6">

                {/* Pending photos section */}
                {pending.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                                🕐 Por Subir — {pending.length} foto{pending.length !== 1 ? 's' : ''}
                            </p>
                            <button
                                onClick={() => setPending([])}
                                className="text-[10px] font-black text-red-400 uppercase tracking-widest px-3 py-1 rounded-full border border-red-100 active:bg-red-50"
                            >
                                Borrar todas
                            </button>
                        </div>

                        {/* Grid */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            {pending.map(photo => (
                                <div
                                    key={photo.id}
                                    className="relative aspect-square rounded-3xl overflow-hidden bg-gray-100 shadow-md border-2 border-white animate-in zoom-in duration-200"
                                >
                                    {/* Image */}
                                    <img
                                        src={photo.dataUrl}
                                        alt="Pendiente"
                                        className="w-full h-full object-cover"
                                    />

                                    {/* Zoom button */}
                                    <button
                                        onClick={() => setZoomSrc(photo.dataUrl)}
                                        className="absolute bottom-3 left-3 w-9 h-9 bg-black/50 backdrop-blur-sm text-white rounded-full flex items-center justify-center text-sm active:scale-90 transition-transform border border-white/20"
                                        title="Ver en grande"
                                    >
                                        🔍
                                    </button>

                                    {/* Delete button */}
                                    <button
                                        onClick={() => removePending(photo.id)}
                                        className="absolute top-3 right-3 w-9 h-9 bg-red-500/80 backdrop-blur-sm text-white rounded-full flex items-center justify-center text-lg font-black active:bg-red-600 active:scale-90 transition-all shadow-lg border border-white/20"
                                    >
                                        ✕
                                    </button>

                                    {/* Pending badge */}
                                    <div className="absolute top-3 left-3 bg-amber-400 text-black text-[9px] font-black px-2 py-0.5 rounded-full uppercase shadow-sm">
                                        Pendiente
                                    </div>
                                </div>
                            ))}

                            {/* Add more tile */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="aspect-square rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-300 active:bg-gray-50 transition-colors"
                            >
                                <span className="text-3xl">➕</span>
                                <span className="text-[10px] font-black uppercase tracking-widest">Más</span>
                            </button>
                        </div>

                        {/* Upload button */}
                        <button
                            onClick={handleUploadAll}
                            disabled={isUploading}
                            className="w-full py-5 rounded-3xl font-black text-lg flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl"
                            style={{
                                background: isUploading
                                    ? '#d1d5db'
                                    : `linear-gradient(135deg, ${primary}, ${secondary})`,
                                color: isUploading ? '#9ca3af' : letra,
                                boxShadow: isUploading ? 'none' : `0 16px 32px -10px ${primary}60`
                            }}
                        >
                            {isUploading ? (
                                <>
                                    <span className="w-5 h-5 border-2 border-gray-400/30 border-t-gray-500 rounded-full animate-spin" />
                                    Subiendo...
                                </>
                            ) : (
                                <>
                                    🚀 Subir {pending.length} foto{pending.length !== 1 ? 's' : ''}
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* Uploaded photos section */}
                {uploaded.length > 0 && (
                    <div>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                            ✅ Subidas hoy — {doneCount} foto{doneCount !== 1 ? 's' : ''}
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            {uploaded.map((photo, i) => (
                                <div
                                    key={i}
                                    className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 border-2 border-white shadow-sm"
                                >
                                    <img
                                        src={photo.dataUrl}
                                        alt="Subida"
                                        className="w-full h-full object-cover"
                                        onClick={() => setZoomSrc(photo.dataUrl)}
                                    />
                                    {/* Status overlay */}
                                    <div className={`absolute inset-0 flex flex-col items-end justify-end p-2 ${photo.status === 'done' ? 'bg-green-500/10' : 'bg-red-500/30'}`}>
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shadow-md ${photo.status === 'done' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                            {photo.status === 'done' ? '✓' : '!'}
                                        </div>
                                        {photo.status === 'error' && photo.errorMsg && (
                                            <div className="absolute bottom-0 left-0 right-0 bg-red-600/90 backdrop-blur-sm px-2 py-1.5 text-white text-[9px] font-black leading-tight text-center">
                                                {photo.errorMsg}
                                            </div>
                                        )}
                                    </div>
                                    {/* Zoom */}
                                    <button
                                        onClick={() => setZoomSrc(photo.dataUrl)}
                                        className="absolute inset-0 w-full h-full opacity-0"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {pending.length === 0 && uploaded.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="text-6xl mb-5 opacity-30">🧾</div>
                        <p className="text-sm font-black text-gray-300 uppercase tracking-widest mb-2">
                            Sin fotos aún
                        </p>
                        <p className="text-xs text-gray-300 max-w-[220px] leading-relaxed">
                            Usa la cámara o galería para agregar fotos de recibos. Podrás revisar y eliminar antes de subir.
                        </p>
                    </div>
                )}

                {/* After upload success */}
                {pending.length === 0 && uploaded.length > 0 && (
                    <div
                        className="mt-2 p-5 rounded-3xl text-center"
                        style={{ background: `${primary}15`, border: `1px solid ${primary}30` }}
                    >
                        <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: primary }}>
                            ¿Más recibos?
                        </p>
                        <p className="text-xs text-gray-400">Usa los botones de arriba para agregar más fotos al lote de hoy.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function MobileUploadPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="w-12 h-12 border-4 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
            </div>
        }>
            <MobileUploadContent />
        </Suspense>
    );
}
