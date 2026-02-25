'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Button from '@/components/Button';
import { useTranslations } from 'next-intl';
import CryptoJS from 'crypto-js';

const SECRET_KEY = 'foodie-instructions-secret';

interface Instruction {
    numeroPaso: number;
    instrucciones: string;
    rutaArchivo: string | null;
    archivoDocumento: string | null;
    nombreArchivo: string | null;
}

export default function MobileInstructionsPage() {
    const searchParams = useSearchParams();

    // Obfuscated Token Decode
    let projectId: string | null = searchParams?.get('projectId') || null;
    let productId: string | null = searchParams?.get('productId') || null;
    const qToken = searchParams?.get('q');

    if (qToken) {
        try {
            const decodedUrlComponent = decodeURIComponent(qToken);
            const bytes = CryptoJS.AES.decrypt(decodedUrlComponent, SECRET_KEY);
            const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
            const decoded = JSON.parse(decryptedString);

            projectId = decoded.p?.toString() || null;
            productId = decoded.i?.toString() || null;
        } catch (e) {
            console.error('Invalid token format or decryption failed', e);
        }
    }

    const t = useTranslations('Product');

    const [productDetails, setProductDetails] = useState<{ Producto: string; ArchivoImagen: string | null } | null>(null);
    const [instructions, setInstructions] = useState<Instruction[]>([]);
    const [newInstruction, setNewInstruction] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Video Recording States
    const [isRecording, setIsRecording] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [recordingStep, setRecordingStep] = useState<number | null>(null);

    // File input fallback
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingStep, setUploadingStep] = useState<number | null>(null);

    useEffect(() => {
        if (projectId && productId) {
            fetchProductDetails();
            fetchInstructions();
        } else {
            setIsLoading(false);
        }
    }, [projectId, productId]);

    // Cleanup camera when unmounting
    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, []);

    const fetchProductDetails = async () => {
        try {
            const response = await fetch(`/api/products/${productId}?projectId=${projectId}`);
            const data = await response.json();
            if (data.success && data.data) {
                setProductDetails({
                    Producto: data.data.Producto,
                    ArchivoImagen: data.data.ArchivoImagen
                });
            }
        } catch (error) {
            console.error('Error fetching product details:', error);
        }
    };

    const fetchInstructions = async () => {
        try {
            const response = await fetch(`/api/products/${productId}/instructions?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                setInstructions(data.data.map((item: any) => ({
                    numeroPaso: item.NumeroPaso,
                    instrucciones: item.Instrucciones,
                    rutaArchivo: item.RutaArchivo,
                    archivoDocumento: item.ArchivoDocumento,
                    nombreArchivo: item.NombreArchivo
                })));
            }
        } catch (error) {
            console.error('Error fetching instructions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const saveInstructions = async (updatedInstructions: Instruction[]) => {
        setInstructions(updatedInstructions);
        try {
            const response = await fetch(`/api/products/${productId}/instructions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    instructions: updatedInstructions.map(i => ({
                        instrucciones: i.instrucciones,
                        rutaArchivo: i.rutaArchivo,
                        archivoDocumento: i.archivoDocumento,
                        nombreArchivo: i.nombreArchivo
                    }))
                })
            });

            if (!response.ok) {
                await fetchInstructions();
                alert('Error al guardar los cambios');
            }
        } catch (error) {
            console.error('Error saving instructions:', error);
            await fetchInstructions();
            alert('Error al guardar los cambios');
        }
    };

    const handleAddInstruction = async () => {
        if (!newInstruction.trim()) {
            alert('Por favor ingrese una instrucción');
            return;
        }

        setIsSaving(true);
        try {
            const newInstructionObj = {
                instrucciones: newInstruction,
                rutaArchivo: null,
                archivoDocumento: null,
                nombreArchivo: null
            };

            const response = await fetch(`/api/products/${productId}/instructions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    instructions: [
                        ...instructions.map(i => ({
                            instrucciones: i.instrucciones,
                            rutaArchivo: i.rutaArchivo,
                            archivoDocumento: i.archivoDocumento,
                            nombreArchivo: i.nombreArchivo
                        })),
                        newInstructionObj
                    ]
                })
            });

            if (response.ok) {
                await fetchInstructions();
                setNewInstruction('');
            } else {
                alert('Error al guardar la instrucción');
            }
        } catch (error) {
            console.error('Error adding instruction:', error);
            alert('Error al guardar la instrucción');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteInstruction = async (numeroPaso: number) => {
        if (!confirm('¿Está seguro que desea eliminar este paso?')) return;

        setIsSaving(true);
        try {
            const filtered = instructions.filter(i => i.numeroPaso !== numeroPaso);
            await saveInstructions(filtered);
        } catch (error) {
            console.error('Error deleting instruction:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleInstructionChange = (numeroPaso: number, newText: string) => {
        const newInstructions = instructions.map(i =>
            i.numeroPaso === numeroPaso ? { ...i, instrucciones: newText } : i
        );
        setInstructions(newInstructions);
    };

    const handleInstructionBlur = () => {
        saveInstructions(instructions);
    };

    const handleMoveUp = async (numeroPaso: number) => {
        if (numeroPaso === 1) return;
        setIsSaving(true);
        try {
            const newInstructions = [...instructions];
            const currentIndex = numeroPaso - 1;
            const previousIndex = currentIndex - 1;
            [newInstructions[currentIndex], newInstructions[previousIndex]] = [newInstructions[previousIndex], newInstructions[currentIndex]];
            await saveInstructions(newInstructions);
        } catch (error) {
            console.error('Error moving instruction up:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleMoveDown = async (numeroPaso: number) => {
        if (numeroPaso === instructions.length) return;
        setIsSaving(true);
        try {
            const newInstructions = [...instructions];
            const currentIndex = numeroPaso - 1;
            const nextIndex = currentIndex + 1;
            [newInstructions[currentIndex], newInstructions[nextIndex]] = [newInstructions[nextIndex], newInstructions[currentIndex]];
            await saveInstructions(newInstructions);
        } catch (error) {
            console.error('Error moving instruction down:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveFile = async (numeroPaso: number) => {
        if (!confirm('¿Está seguro que desea eliminar este archivo adjunto?')) return;
        setIsSaving(true);
        try {
            const newInstructions = instructions.map(i =>
                i.numeroPaso === numeroPaso ? { ...i, archivoDocumento: null, nombreArchivo: null, rutaArchivo: null } : i
            );
            await saveInstructions(newInstructions);
        } catch (error) {
            console.error('Error removing file:', error);
        } finally {
            setIsSaving(false);
        }
    };

    // --- Media/Video Handlers ---

    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    const startRecording = async (step: number) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }, // Try to use back camera on mobile
                audio: true
            });
            setCameraStream(stream);
            setRecordingStep(step);
            setRecordedChunks([]);

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    setRecordedChunks(prev => [...prev, event.data]);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Error accessing camera:', err);
            alert('No se pudo acceder a la cámara o micrófono. Por favor revisa los permisos.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.onstop = async () => {
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                const file = new File([blob], `video-step-${recordingStep}.webm`, { type: 'video/webm' });

                if (recordingStep !== null) {
                    await uploadFileForStep(recordingStep, file);
                }

                stopCamera();
                setIsRecording(false);
                setRecordingStep(null);
                setRecordedChunks([]);
            };
            mediaRecorderRef.current.stop();
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
        }
        stopCamera();
        setIsRecording(false);
        setRecordingStep(null);
        setRecordedChunks([]);
    };

    // Generic upload method
    const uploadFileForStep = async (step: number, file: File) => {
        setIsUploading(true);
        try {
            // Convert file to Base64 (Warning: large videos might be slow. Consider uploading via form data to S3 or a local folder eventually, but for now we follow the existing base64 flow)
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve, reject) => {
                reader.onload = () => {
                    const base64String = (reader.result as string).split(',')[1];
                    resolve(base64String);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const base64Data = await base64Promise;

            const newInstructions = instructions.map(i =>
                i.numeroPaso === step ? {
                    ...i,
                    archivoDocumento: base64Data,
                    nombreArchivo: file.name,
                    rutaArchivo: null
                } : i
            );

            await saveInstructions(newInstructions);
        } catch (error) {
            console.error('Error processing file:', error);
            alert('Error al procesar el archivo. Si es un video, podría ser demasiado grande.');
        } finally {
            setIsUploading(false);
            setUploadingStep(null);
        }
    };

    const handleFileSelect = (numeroPaso: number) => {
        setUploadingStep(numeroPaso);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && uploadingStep !== null) {
            await uploadFileForStep(uploadingStep, e.target.files[0]);
        }
    };

    if (!projectId || !productId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-500 p-6 text-center">
                <span className="text-4xl mb-4">⚠️</span>
                <p>Parámetros faltantes en el enlace QR. Por favor escanea de nuevo desde el sistema principal.</p>
            </div>
        );
    }

    // Video Recording Override UI
    if (cameraStream && recordingStep !== null) {
        return (
            <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted // mute to avoid feedback loop
                    className="w-full h-full object-cover absolute inset-0"
                />

                {/* Overlay UI */}
                <div className="absolute top-8 left-0 right-0 px-4 flex justify-between items-center z-10">
                    <span className="bg-black/50 text-white px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase flex items-center gap-2">
                        {isRecording && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                        {isRecording ? 'Grabando...' : 'Preparando...'}
                    </span>
                    <button
                        onClick={cancelRecording}
                        className="bg-white/20 hover:bg-white/40 backdrop-blur text-white px-3 py-1 rounded-full text-sm font-bold transition-all"
                    >
                        Cancelar
                    </button>
                </div>

                <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center z-10">
                    {isRecording ? (
                        <button
                            onClick={stopRecording}
                            className="bg-red-600 border-[6px] border-white/40 w-20 h-20 rounded-lg shadow-xl shadow-red-600/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
                        >
                            <div className="w-6 h-6 bg-white rounded-sm" />
                        </button>
                    ) : (
                        <button
                            disabled
                            className="bg-gray-400 border-[6px] border-white/20 w-20 h-20 rounded-full flex items-center justify-center opacity-50"
                        >
                        </button>
                    )}
                </div>

                {isUploading && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
                        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-white font-bold tracking-widest uppercase">Guardando Video...</p>
                        <p className="text-white/60 text-xs mt-2">Por favor no cierres la aplicación</p>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-orange-600 text-white p-4 sticky top-0 z-10 shadow-md flex items-center gap-4">
                {productDetails?.ArchivoImagen ? (
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/50 flex-shrink-0 bg-white shadow-sm flex items-center justify-center">
                        <img
                            src={productDetails.ArchivoImagen.startsWith('data:') ? productDetails.ArchivoImagen : `data:image/jpeg;base64,${productDetails.ArchivoImagen}`}
                            alt={productDetails.Producto}
                            className="w-full h-full object-cover"
                        />
                    </div>
                ) : (
                    <div className="w-14 h-14 rounded-full border-2 border-white/50 flex-shrink-0 bg-white/20 flex items-center justify-center text-3xl">
                        🍽️
                    </div>
                )}
                <div className="flex-1 truncate">
                    <h1 className="text-lg leading-tight font-black truncate">{productDetails?.Producto || 'Cargando Producto...'}</h1>
                </div>
            </header>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleFileChange}
            />

            <main className="flex-1 p-4 flex flex-col gap-6 w-full max-w-md mx-auto relative pb-24">
                {/* Global loading state overlay */}
                {isUploading && (
                    <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
                        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="font-bold text-orange-600 tracking-widest uppercase">Subiendo archivo...</p>
                    </div>
                )}

                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {instructions.map((instruction) => (
                            <div key={instruction.numeroPaso} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="bg-blue-100 text-blue-800 text-xs font-black px-2 py-1 rounded-md uppercase tracking-wider">
                                        Paso {instruction.numeroPaso}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleMoveUp(instruction.numeroPaso)}
                                            disabled={instruction.numeroPaso === 1}
                                            className="px-2 py-1 flex items-center justify-center rounded-md bg-gray-50 border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                                        >
                                            ⬆️
                                        </button>
                                        <button
                                            onClick={() => handleMoveDown(instruction.numeroPaso)}
                                            disabled={instruction.numeroPaso === instructions.length}
                                            className="px-2 py-1 flex items-center justify-center rounded-md bg-gray-50 border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                                        >
                                            ⬇️
                                        </button>
                                        <button
                                            onClick={() => handleDeleteInstruction(instruction.numeroPaso)}
                                            className="text-gray-400 hover:text-red-500 p-1 ml-2"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>

                                <textarea
                                    value={instruction.instrucciones}
                                    onChange={(e) => handleInstructionChange(instruction.numeroPaso, e.target.value)}
                                    onBlur={handleInstructionBlur}
                                    className="w-full text-sm text-gray-700 bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-lg p-3 resize-none focus:outline-none transition-all"
                                    rows={3}
                                    placeholder="Describe el paso aquí..."
                                />

                                <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                                    {instruction.archivoDocumento || instruction.rutaArchivo ? (
                                        <div className="flex flex-col gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
                                            <a
                                                href={instruction.archivoDocumento
                                                    ? `/api/products/instructions/download?projectId=${projectId}&productId=${productId}&stepNumber=${instruction.numeroPaso}`
                                                    : instruction.rutaArchivo || '#'
                                                }
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-700 text-xs font-bold truncate flex-1 flex items-center gap-1.5"
                                            >
                                                <span className="text-lg">📎</span>
                                                <span className="truncate">{instruction.nombreArchivo || 'Archivo Adjunto'}</span>
                                            </a>
                                            <div className="grid grid-cols-3 gap-2 mt-1">
                                                <button
                                                    onClick={() => startRecording(instruction.numeroPaso)}
                                                    className="w-full text-[9px] bg-white border border-blue-200 text-orange-600 px-1 py-1.5 rounded font-bold uppercase flex flex-col justify-center items-center gap-0.5 relative active:bg-orange-50"
                                                >
                                                    <span className="text-sm">🎥</span> Grabar
                                                </button>
                                                <button
                                                    onClick={() => handleFileSelect(instruction.numeroPaso)}
                                                    className="w-full text-[9px] bg-white border border-blue-200 text-blue-600 px-1 py-1.5 rounded font-bold uppercase flex flex-col justify-center items-center gap-0.5 relative active:bg-blue-50"
                                                >
                                                    <span className="text-sm">📂</span> Subir
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveFile(instruction.numeroPaso)}
                                                    className="w-full text-[9px] bg-white border border-red-200 text-red-600 px-1 py-1.5 rounded font-bold uppercase flex flex-col justify-center items-center gap-0.5 relative active:bg-red-50"
                                                >
                                                    <span className="text-sm">🗑️</span> Quitar
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-full grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => startRecording(instruction.numeroPaso)}
                                                className="flex flex-col items-center justify-center p-3 rounded-lg bg-orange-50 border border-orange-100 text-orange-600 active:bg-orange-100 transition-colors"
                                            >
                                                <span className="text-xl mb-1">🎥</span>
                                                <span className="text-[10px] font-bold uppercase tracking-widest">Grabar Video</span>
                                            </button>
                                            <button
                                                onClick={() => handleFileSelect(instruction.numeroPaso)}
                                                className="flex flex-col items-center justify-center p-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 active:bg-gray-100 transition-colors"
                                            >
                                                <span className="text-xl mb-1">📂</span>
                                                <span className="text-[10px] font-bold uppercase tracking-widest">Subir Archivo</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {instructions.length === 0 && (
                            <div className="text-center bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-gray-500">
                                <span className="text-4xl block mb-2">📝</span>
                                No hay pasos todavía. Agrega el primero abajo.
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Sticky Bottom Add Area */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
                <div className="max-w-md mx-auto flex gap-2">
                    <textarea
                        value={newInstruction}
                        onChange={(e) => setNewInstruction(e.target.value)}
                        className="flex-1 bg-gray-50 border border-gray-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 h-12"
                        placeholder="Escribe un nuevo paso..."
                        rows={1}
                    />
                    <button
                        onClick={handleAddInstruction}
                        disabled={isSaving || !newInstruction.trim()}
                        className="bg-orange-600 text-white rounded-lg px-6 font-bold shadow-sm active:transform active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center"
                    >
                        {isSaving ? '...' : '✚'}
                    </button>
                </div>
            </div>
        </div>
    );
}
