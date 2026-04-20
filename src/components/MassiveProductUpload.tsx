'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/Button';
import * as XLSX from 'xlsx';
import { useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import QRCode from 'react-qr-code';
import { v4 as uuidv4 } from 'uuid';
import { useParams } from 'next/navigation';

interface MassiveProductUploadProps {
    onSuccess?: () => void;
    hideHeader?: boolean;
}

export default function MassiveProductUpload({ onSuccess, hideHeader = false }: MassiveProductUploadProps) {
    const t = useTranslations('Navigation');
    const params = useParams();
    const locale = params.locale as string;
    const [project, setProject] = useState<any>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [uploadedData, setUploadedData] = useState<any[]>([]);
    const [existingProducts, setExistingProducts] = useState<{ code: string, name: string }[]>([]);
    const [existingCategories, setExistingCategories] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isOcrMode, setIsOcrMode] = useState(false);
    const [selectedModel, setSelectedModel] = useState<'claude-opus-4-6' | 'gpt-4o'>('claude-opus-4-6');
    const [ocrPreviews, setOcrPreviews] = useState<string[]>([]);
    const [ocrFiles, setOcrFiles] = useState<File[]>([]);
    const [allCategories, setAllCategories] = useState<{ IdCategoria: number, Categoria: string }[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const ocrFileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [showQrModal, setShowQrModal] = useState(false);
    const [qrSessionId, setQrSessionId] = useState('');
    const [isPolling, setIsPolling] = useState(false);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) setProject(JSON.parse(storedProject));
    }, []);

    const fetchExistingProducts = async () => {
        if (!project?.idProyecto) return;
        try {
            const response = await fetch(`/api/products/massive-upload/check-duplicates?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setExistingProducts(data.products);
                setExistingCategories(data.categories);
            }

            // Also fetch all categories for the fallback picker
            const catRes = await fetch(`/api/categories?projectId=${project.idProyecto}`);
            const catData = await catRes.json();
            if (catData.success) {
                setAllCategories(catData.data);
            }
        } catch (error) {
            console.error('Error fetching existing products data:', error);
        }
    };

    const processFile = async (file: File) => {
        await fetchExistingProducts();

        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);

            // Map keys to expected format if needed, or just set it
            setUploadedData(json);
        };
        reader.readAsArrayBuffer(file);
    };

    const isDuplicateCode = (code: any) => {
        if (!code) return false;
        return existingProducts.some(p => p.code === code.toString());
    };

    const isDuplicateName = (name: any) => {
        if (!name) return false;
        return existingProducts.some(p => p.name?.toLowerCase() === name.toString().toLowerCase());
    };

    const isInvalidCategory = (category: any) => {
        if (!category) return false;
        return !existingCategories.some(c => c.toLowerCase() === category.toString().toLowerCase());
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsOcrMode(false);
            processFile(file);
        }
    };

    const handleOcrFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setOcrFiles(prev => [...prev, ...newFiles]);
            const newPreviews = newFiles.map(file => {
                if (file.type.startsWith('image/')) return URL.createObjectURL(file);
                if (file.type === 'application/pdf') return '📄 PDF Document';
                return '📂 File';
            });
            setOcrPreviews(prev => [...prev, ...newPreviews]);
            setIsOcrMode(true);
        }
    };

    const startQrSession = async () => {
        const sessionId = uuidv4();
        setQrSessionId(sessionId);
        setShowQrModal(true);
        setIsPolling(true);

        // Register session in backend
        try {
            await fetch('/api/ocr/qr-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, action: 'register' })
            });

            // Start polling
            const pollInterval = setInterval(async () => {
                try {
                    const response = await fetch(`/api/ocr/qr-sync?sessionId=${sessionId}`);
                    const data = await response.json();

                    if (data.success && data.image) {
                        // Received image
                        const dataUrl = data.image;
                        const res = await fetch(dataUrl);
                        const blob = await res.blob();
                        const file = new File([blob], `qr-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });

                        setOcrFiles(prev => [...prev, file]);
                        setOcrPreviews(prev => [...prev, dataUrl]);

                        // Cleanup
                        clearInterval(pollInterval);
                        setIsPolling(false);
                        setShowQrModal(false);
                    }
                } catch (err) {
                    console.error('Polling error:', err);
                }
            }, 2000);

            // Cleanup on modal close or unmount
            return () => {
                clearInterval(pollInterval);
                setIsPolling(false);
            };
        } catch (err) {
            console.error('Error registering QR session:', err);
            alert('Error al iniciar sesión QR');
            setShowQrModal(false);
        }
    };

    const startCamera = async () => {
        setIsCameraOpen(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (error) {
            console.error('Error accessing camera:', error);
            alert('No se pudo acceder a la cámara. Revisa los permisos.');
            setIsCameraOpen(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach(track => track.stop());
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
            canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);

            const dataUrl = canvas.toDataURL('image/jpeg');
            fetch(dataUrl)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
                    setOcrFiles(prev => [...prev, file]);
                    setOcrPreviews(prev => [...prev, dataUrl]);
                    stopCamera();
                });
        }
    };

    const removeOcrFile = (index: number) => {
        setOcrFiles(prev => prev.filter((_, i) => i !== index));
        setOcrPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const processOcr = async () => {
        if (ocrFiles.length === 0 || !project?.idProyecto) return;

        setIsProcessing(true);
        try {
            const formData = new FormData();
            ocrFiles.forEach(file => formData.append('image', file));
            formData.append('model', selectedModel);
            formData.append('projectId', project.idProyecto.toString());

            const response = await fetch('/api/products/ocr/process', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                const formattedData = data.data.products.map((p: any) => ({
                    Producto: p.description,
                    CodigoBarras: p.CodigoBarras || '',
                    Precio: p.price,
                    CantidadCompra: p.cantidadCompra || 1,
                    Categoria: p.category,
                    IdCategoria: p.IdCategoria,
                    UnidadMedidaCompra: p.purchaseUnit || '',
                    // OCR Metadata
                    _isOcr: true,
                    _isLinked: p.isLinked,
                    _systemId: p.systemId
                }));
                setUploadedData(formattedData);
                await fetchExistingProducts();
            } else {
                alert('Error en OCR: ' + data.message);
            }
        } catch (error) {
            console.error('Error processing OCR:', error);
            alert('Error procesando OCR');
        } finally {
            setIsProcessing(false);
        }
    };

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    }, [project]);

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const onDragLeave = () => {
        setIsDragging(false);
    };

    const handleDownloadTemplate = async () => {
        if (!project?.idProyecto) return;

        setIsDownloading(true);
        try {
            const response = await fetch(`/api/products/massive-upload/template?projectId=${project.idProyecto}`);
            if (!response.ok) throw new Error('Error al generar la plantilla');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'plantilla_productos.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading template:', error);
            alert('Error al descargar la plantilla. Por favor intente de nuevo.');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleProcessUpload = async () => {
        if (!project?.idProyecto || uploadedData.length === 0) return;

        // If it's OCR mode, we might need to save relationships first or during the process
        const isOcrBatch = uploadedData.some(row => row._isOcr);

        if (isOcrBatch) {
            setIsProcessing(true);
            try {
                // Confirm price updates and mappings
                const mappingsToSave = uploadedData
                    .filter(row => row._isOcr && row._systemId)
                    .map(row => ({
                        ocrDescription: row.Producto,
                        systemId: row._systemId,
                        price: row.Precio
                    }));

                if (mappingsToSave.length > 0) {
                    if (confirm(`Se actualizarán ${mappingsToSave.length} precios de productos existentes. ¿Desea continuar?`)) {
                        await fetch('/api/ocr/relationships/save', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                projectId: project.idProyecto,
                                mappings: mappingsToSave
                            })
                        });
                    }
                }

                // For new products, we use the standard process (excluding already linked ones)
                const newProducts = uploadedData
                    .filter(row => !row._systemId)
                    .map(row => ({
                        Producto: row.Producto,
                        Codigo: row.CodigoBarras || '', // Map to system Codigo
                        Precio: row.Precio,
                        Categoria: row.Categoria,
                        IdCategoria: row.IdCategoria,
                        UnidadMedidaCompra: row.UnidadMedidaCompra,
                        IdTipoProducto: 0, // Force Materia Prima
                        CantidadCompra: row.CantidadCompra || 1
                    }));

                if (newProducts.length > 0) {
                    const response = await fetch('/api/products/massive-upload/process', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            projectId: project.idProyecto,
                            products: newProducts
                        })
                    });
                    const data = await response.json();
                    if (data.success) {
                        alert('Carga masiva completada');
                        setUploadedData([]);
                        if (onSuccess) onSuccess();
                    } else {
                        alert('Error: ' + data.message);
                    }
                } else if (mappingsToSave.length > 0) {
                    alert('Precios actualizados exitosamente');
                    setUploadedData([]);
                    if (onSuccess) onSuccess();
                }
            } catch (error: any) {
                console.error('Error processing OCR upload:', error);
                alert('Ocurrió un error al procesar la carga: ' + error.message);
            } finally {
                setIsProcessing(false);
            }
            return;
        }

        // Filter valid products: no duplicates in Code or Name
        const validProducts = uploadedData.filter(row =>
            !isDuplicateCode(row.Codigo) && !isDuplicateName(row.Producto)
        );

        if (validProducts.length === 0) {
            alert('No hay productos válidos para procesar (todos tienen advertencias de duplicado).');
            return;
        }

        if (!confirm(`Se van a procesar ${validProducts.length} productos de los ${uploadedData.length} cargados. ¿Desea continuar?`)) {
            return;
        }

        setIsProcessing(true);
        try {
            const response = await fetch('/api/products/massive-upload/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    products: validProducts
                })
            });

            const data = await response.json();
            if (data.success) {
                alert(data.message);
                setUploadedData([]);
                setExistingProducts([]);
                setExistingCategories([]);
                if (onSuccess) onSuccess();
            } else {
                throw new Error(data.message);
            }
        } catch (error: any) {
            console.error('Error processing upload:', error);
            alert('Error: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className={hideHeader ? "" : "p-6"}>
            {!hideHeader && (
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">
                            📦 {t('massiveProductUpload')}
                        </h1>
                        <p className="text-gray-600 mt-2">
                            Utiliza esta herramienta para cargar múltiples productos de forma rápida.
                        </p>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mb-4 gap-2">
                <div className="flex gap-2">
                    <Button
                        onClick={() => {
                            setIsOcrMode(true);
                            setUploadedData([]);
                        }}
                        variant={isOcrMode ? "primary" : "secondary"}
                        className="text-xs"
                    >
                        📄 Carga por OCR
                    </Button>
                    <Button
                        onClick={() => {
                            setIsOcrMode(false);
                            setUploadedData([]);
                        }}
                        variant={!isOcrMode ? "primary" : "secondary"}
                        className="text-xs"
                    >
                        📊 Carga por Excel
                    </Button>
                </div>
                {!isOcrMode && (
                    <Button
                        onClick={handleDownloadTemplate}
                        isLoading={isDownloading}
                        variant="secondary"
                        className="text-xs"
                    >
                        📥 Descargar Plantilla
                    </Button>
                )}
            </div>

            {isOcrMode ? (
                <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                        <div className="flex-1 space-y-4">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                🤖 Configuración OCR
                            </h3>
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Modelo IA</label>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setSelectedModel('claude-opus-4-6')}
                                        className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all border-2 flex items-center justify-center gap-2 ${selectedModel === 'claude-opus-4-6'
                                            ? 'bg-primary-50 border-primary-400 text-primary-700 shadow-sm'
                                            : 'bg-gray-50 border-transparent text-gray-400 hover:border-gray-200'
                                            }`}
                                    >
                                        🤖 Claude 3.5
                                    </button>
                                    <button
                                        onClick={() => setSelectedModel('gpt-4o')}
                                        className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all border-2 flex items-center justify-center gap-2 ${selectedModel === 'gpt-4o'
                                            ? 'bg-emerald-50 border-emerald-400 text-emerald-700 shadow-sm'
                                            : 'bg-gray-50 border-transparent text-gray-400 hover:border-gray-200'
                                            }`}
                                    >
                                        🌿 GPT-4o
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-[2] space-y-4">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                📤 Archivos y Fotos
                            </h3>
                            <div className="flex gap-4 overflow-x-auto pb-4 min-h-[120px] snap-x">
                                <div
                                    onClick={startCamera}
                                    className="min-w-[120px] h-[120px] border-2 border-dashed border-primary-300 rounded-xl flex flex-col items-center justify-center gap-2 bg-primary-50/30 cursor-pointer hover:bg-primary-50 hover:border-primary-400 transition-all font-bold text-primary-600 text-[10px] text-center p-2 snap-start group"
                                >
                                    <span className="text-3xl group-hover:scale-110 transition-transform">📸</span>
                                    Cámara Directa
                                </div>
                                <div
                                    onClick={startQrSession}
                                    className="min-w-[120px] h-[120px] border-2 border-dashed border-indigo-300 rounded-xl flex flex-col items-center justify-center gap-2 bg-indigo-50/30 cursor-pointer hover:bg-indigo-50 hover:border-indigo-400 transition-all font-bold text-indigo-600 text-[10px] text-center p-2 snap-start group"
                                >
                                    <span className="text-3xl group-hover:scale-110 transition-transform">📱</span>
                                    Tomar con QR
                                </div>
                                {ocrPreviews.map((src, idx) => (
                                    <div key={idx} className="relative min-w-[120px] h-[120px] rounded-xl overflow-hidden shadow-md border-2 border-white bg-gray-50 flex items-center justify-center text-[10px] text-gray-500 font-bold p-2 text-center snap-start">
                                        {src.startsWith('blob:') || src.startsWith('data:') ? (
                                            <img src={src} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-2xl">📄</span>
                                                {src}
                                            </div>
                                        )}
                                        <button
                                            onClick={() => removeOcrFile(idx)}
                                            className="absolute top-1 right-1 bg-black/50 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] backdrop-blur-sm"
                                        >✕</button>
                                    </div>
                                ))}
                                <div
                                    onClick={() => ocrFileInputRef.current?.click()}
                                    className="min-w-[120px] h-[120px] border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 bg-white cursor-pointer hover:bg-gray-50 hover:border-primary-400 transition-all font-bold text-gray-400 text-[10px] text-center p-2 snap-start group"
                                >
                                    <span className="text-3xl group-hover:scale-110 transition-transform">➕</span>
                                    Subir Archivo
                                    <input
                                        type="file"
                                        ref={ocrFileInputRef}
                                        accept="image/*, application/pdf, .xlsx, .xls"
                                        multiple
                                        onChange={handleOcrFileChange}
                                        className="hidden"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Camera Modal */}
                    {isCameraOpen && (
                        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-in fade-in duration-300">
                            <button
                                onClick={stopCamera}
                                className="absolute top-6 right-6 text-white text-2xl z-[110] bg-white/10 w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md"
                            >✕</button>

                            <div className="relative w-full max-w-lg aspect-[3/4] overflow-hidden rounded-2xl shadow-2xl border-2 border-white/20">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 border-2 border-white/20 pointer-events-none">
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-white/40 rounded-3xl opacity-50"></div>
                                </div>
                            </div>

                            <canvas ref={canvasRef} className="hidden" />

                            <div className="mt-12 flex items-center gap-12">
                                <button
                                    onClick={capturePhoto}
                                    className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl border-4 border-white/30 hover:scale-110 active:scale-95 transition-all"
                                >
                                    <div className="w-16 h-16 rounded-full border-2 border-gray-100"></div>
                                </button>
                            </div>

                            <p className="mt-6 text-white/60 text-sm font-medium tracking-wide">Captura tu documento con buena luz</p>
                        </div>
                    )}

                    {/* QR Modal */}
                    {showQrModal && (
                        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
                            <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center relative">
                                <button
                                    onClick={() => { setShowQrModal(false); setIsPolling(false); }}
                                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                                >✕</button>

                                <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 text-3xl mb-4">📱</div>
                                <h3 className="text-xl font-bold text-gray-800 mb-2">Escanea para capturar</h3>
                                <p className="text-sm text-gray-500 mb-8">Escanea este código con tu celular para tomar la foto del documento.</p>

                                <div className="bg-white p-4 rounded-2xl border-4 border-gray-50 shadow-inner mb-8">
                                    <QRCode
                                        value={`${window.location.origin}/${locale}/ocr/qr-capture?id=${qrSessionId}`}
                                        size={200}
                                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                        viewBox={`0 0 256 256`}
                                    />
                                </div>

                                <div className="flex items-center gap-2 text-sm text-indigo-600 font-medium animate-pulse">
                                    <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                                    Esperando captura...
                                </div>
                            </div>
                        </div>
                    )}
                    {ocrFiles.length > 0 && !isProcessing && (
                        <div className="mt-8 flex justify-center border-t border-gray-100 pt-6">
                            <Button
                                onClick={processOcr}
                                variant="primary"
                                className="w-full max-w-md py-4 text-lg font-black shadow-xl"
                            >
                                🔍 Procesar {ocrFiles.length} documento{ocrFiles.length > 1 ? 's' : ''} con {selectedModel === 'gpt-4o' ? '🌿 GPT-4o' : '🤖 Claude'}
                            </Button>
                        </div>
                    )}
                    {isProcessing && (
                        <div className="mt-8 flex flex-col items-center justify-center gap-3 border-t border-gray-100 pt-6 animate-pulse">
                            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-sm font-black text-primary-600 uppercase tracking-widest">Analizando documentos con IA...</p>
                        </div>
                    )}
                </div>
            ) : (
                <div
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    className={`
                        border-2 border-dashed rounded-xl p-10 mb-8 flex flex-col items-center justify-center transition-all cursor-pointer
                        ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-white hover:border-primary-400'}
                    `}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        id="file-upload"
                        className="hidden"
                        accept=".xlsx, .xls, .csv"
                        onChange={handleFileChange}
                    />
                    <label htmlFor="file-upload" className="flex flex-col items-center cursor-pointer w-full h-full">
                        <span className="text-6xl mb-4 text-center">📄</span>
                        <p className="text-xl font-bold text-gray-700 text-center">
                            Arrastra tu archivo Excel aquí
                        </p>
                        <p className="text-gray-500 mt-2 text-sm">
                            O haz clic para navegar entre tus archivos (.xlsx, .xls, .csv)
                        </p>
                    </label>
                </div>
            )}

            {uploadedData.length > 0 && (
                <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <div className="flex flex-col gap-2">
                            <h2 className="font-semibold text-gray-800">Vista Previa de Datos ({uploadedData.length})</h2>
                            <div className="flex flex-wrap gap-2 text-[10px]">
                                <span className="flex items-center gap-1 text-primary-600 bg-primary-50 px-2 py-0.5 rounded border border-primary-100 italic">
                                    <span className="w-1.5 h-1.5 bg-primary-400 rounded-full"></span>
                                    Advertencia: Duplicado o Inexistente en el sistema
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setUploadedData([]);
                                setExistingProducts([]);
                                setExistingCategories([]);
                            }}
                            className="text-red-500 hover:text-red-600 text-sm font-medium"
                        >
                            Limpiar
                        </button>
                    </div>
                    <div className="overflow-x-auto max-h-[400px]">
                        <table className="w-full text-left text-sm">
                            <thead className="sticky top-0 bg-gray-100 text-gray-600 uppercase text-xs font-semibold z-10">
                                <tr>
                                    {Object.keys(uploadedData[0]).map((key) => (
                                        <th key={key} className="px-4 py-3 border-b whitespace-nowrap">{key}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {uploadedData.map((row, idx) => {
                                    const isOcr = row._isOcr;
                                    const isLinked = row._isLinked;
                                    const systemId = row._systemId;

                                    const hasDuplicateCode = !isOcr && isDuplicateCode(row.Codigo || row.CodigoBarras);
                                    const hasDuplicateName = !isOcr && isDuplicateName(row.Producto);
                                    const hasInvalidCategory = isInvalidCategory(row.Categoria);

                                    const hasIssues = hasDuplicateCode || hasDuplicateName || hasInvalidCategory;

                                    return (
                                        <tr key={idx} className={`hover:bg-gray-50 transition-colors ${hasIssues ? 'bg-primary-50/20' : ''}`}>
                                            {Object.keys(uploadedData[0]).filter(k => !k.startsWith('_')).map((key, vIdx) => {
                                                const val = row[key];
                                                const isCodeIssue = (key === 'Codigo' || key === 'CodigoBarras') && hasDuplicateCode;
                                                const isNameIssue = key === 'Producto' && hasDuplicateName;
                                                const isCatIssue = key === 'Categoria' && hasInvalidCategory;

                                                const isCritical = isCodeIssue || isNameIssue || isCatIssue;

                                                let title = "";
                                                if (isCodeIssue) title = "Este código ya existe";
                                                if (isNameIssue) title = "Este nombre de producto ya existe";
                                                if (isCatIssue) title = "Esta categoría no existe en el sistema";

                                                if (isOcr && key === 'Producto') {
                                                    return (
                                                        <td key={vIdx} className="px-4 py-3">
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-gray-700 font-bold">{val}</span>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {isLinked ? (
                                                                        <span className="text-[10px] text-green-700 font-black bg-green-100 border border-green-200 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                                                            ✔ Vinculado (ID: {systemId})
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[10px] text-blue-700 font-black bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                                                            ✨ Nuevo Producto
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    );
                                                }

                                                if (isOcr && key === 'Precio' && isLinked) {
                                                    return (
                                                        <td key={vIdx} className="px-4 py-3">
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-gray-700 font-bold">${val}</span>
                                                                <span className="text-[9px] text-orange-600 font-black bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded uppercase">
                                                                    Precio se actualizará
                                                                </span>
                                                            </div>
                                                        </td>
                                                    );
                                                }

                                                return (
                                                    <td key={vIdx} className={`px-4 py-3 text-gray-700 ${isCritical ? 'text-primary-600 font-medium' : ''}`}>
                                                        <div className="flex items-center gap-2">
                                                            {val}
                                                            {isCritical && (
                                                                <span title={title} className="cursor-help text-primary-500">
                                                                    ⚠️
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                        <Button
                            onClick={handleProcessUpload}
                            isLoading={isProcessing}
                            variant="primary"
                        >
                            🚀 Procesar Carga Masiva
                        </Button>
                    </div>
                </div>
            )}

            {!uploadedData.length && (
                <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 flex flex-col items-center justify-center min-h-[200px]">
                    <div className="text-5xl mb-3 opacity-20">📊</div>
                    <p className="text-gray-500 text-center text-sm max-w-xs">
                        Sube un archivo para ver la vista previa de los productos antes de realizar la carga masiva al sistema.
                    </p>
                </div>
            )}
        </div>
    );
}
