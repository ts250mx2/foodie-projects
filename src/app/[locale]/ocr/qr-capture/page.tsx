'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/Button';

export default function QrCapturePage() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('id');
    
    const [isCameraStarted, setIsCameraStarted] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!sessionId) {
            setError('Sesión inválida o expirada.');
        } else {
            startCamera();
        }
        return () => stopCamera();
    }, [sessionId]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsCameraStarted(true);
            }
        } catch (err) {
            console.error('Error camera:', err);
            setError('No se pudo acceder a la cámara. Por favor permite los permisos.');
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach(track => track.stop());
        }
    };

    const handleCapture = async () => {
        if (!videoRef.current || !canvasRef.current || !sessionId) return;

        setIsUploading(true);
        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const base64Image = canvas.toDataURL('image/jpeg', 0.8);

            const response = await fetch('/api/ocr/qr-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, image: base64Image })
            });

            const data = await response.json();
            if (data.success) {
                setSuccess(true);
                stopCamera();
            } else {
                throw new Error(data.message);
            }
        } catch (err: any) {
            setError('Error al subir la imagen: ' + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white text-4xl mb-6 shadow-lg">✓</div>
                <h1 className="text-2xl font-bold text-green-900 mb-2">¡Foto Subida!</h1>
                <p className="text-green-700">Ya puedes cerrar esta pestaña y continuar en tu computadora.</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-red-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center text-white text-4xl mb-6 shadow-lg">!</div>
                <h1 className="text-2xl font-bold text-red-900 mb-2">Error</h1>
                <p className="text-red-700">{error}</p>
                <Button onClick={() => window.location.reload()} className="mt-6">Reintentar</Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black flex flex-col">
            <div className="p-6 bg-white/10 backdrop-blur-md text-white flex justify-between items-center z-10">
                <h1 className="font-bold">Captura de Documento</h1>
                <span className="text-xs opacity-60">ID: {sessionId?.slice(0, 8)}...</span>
            </div>

            <div className="flex-1 relative overflow-hidden flex items-center justify-center">
                {!isCameraStarted && !error && (
                    <div className="text-white flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                        <p>Iniciando cámara...</p>
                    </div>
                )}
                
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className={`w-full h-full object-cover transition-opacity duration-500 ${isCameraStarted ? 'opacity-100' : 'opacity-0'}`}
                />
                
                {/* Overlay guides */}
                <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none flex items-center justify-center">
                    <div className="w-full h-full border-2 border-white/30 rounded-2xl relative">
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl"></div>
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl"></div>
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl"></div>
                    </div>
                </div>
            </div>

            <canvas ref={canvasRef} className="hidden" />

            <div className="p-10 bg-black flex flex-col items-center gap-6">
                <button 
                    onClick={handleCapture}
                    disabled={!isCameraStarted || isUploading}
                    className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl disabled:opacity-50 active:scale-90 transition-all border-4 border-gray-300"
                >
                    {isUploading ? (
                        <div className="w-10 h-10 border-4 border-gray-200 border-t-primary-600 rounded-full animate-spin" />
                    ) : (
                        <div className="w-16 h-16 rounded-full border-2 border-gray-100" />
                    )}
                </button>
                <p className="text-white/60 text-sm font-medium">Captura tu documento con buena luz</p>
            </div>
        </div>
    );
}
