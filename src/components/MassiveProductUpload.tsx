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
    initialTab?: 'excel' | 'ocr';
    onlyExcel?: boolean;
}

export default function MassiveProductUpload({ 
    onSuccess, 
    hideHeader = false,
    initialTab = 'ocr',
    onlyExcel = false
}: MassiveProductUploadProps) {
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
    const [selectedModel, setSelectedModel] = useState<'claude-sonnet-4-6' | 'gpt-4o'>('claude-sonnet-4-6');
    const [ocrPreviews, setOcrPreviews] = useState<string[]>([]);
    const [ocrFiles, setOcrFiles] = useState<File[]>([]);
    const [allCategories, setAllCategories] = useState<{ IdCategoria: number, Categoria: string }[]>([]);
    const [uploadResults, setUploadResults] = useState<any[] | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const ocrFileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [showQrModal, setShowQrModal] = useState(false);
    const [qrSessionId, setQrSessionId] = useState('');
    const [isPolling, setIsPolling] = useState(false);

    const [activeTab, setActiveTab] = useState<'excel' | 'ocr'>(onlyExcel ? 'excel' : initialTab);

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
            
            // Convert everything to uppercase for consistency
            const uppercasedJson = json.map((row: any) => {
                const newRow: any = {};
                Object.keys(row).forEach(key => {
                    newRow[key] = typeof row[key] === 'string' ? row[key].toUpperCase().trim() : row[key];
                });
                return newRow;
            });

            setUploadedData(uppercasedJson);
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

                        setOcrFiles(prev => [...prev, file]);
                        setOcrPreviews(prev => [...prev, dataUrl]);

                        clearInterval(pollInterval);
                        setIsPolling(false);
                        setShowQrModal(false);
                    }
                } catch (err) {
                    console.error('Polling error:', err);
                }
            }, 2000);

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
        await fetchExistingProducts();
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
                    Codigo: (p.CodigoBarras || '').toString().toUpperCase().trim(),
                    Descripción: (p.description || '').toUpperCase().trim(),
                    'CANTIDAD COMPRA': p.cantidadCompra || 1,
                    _isOcr: true,
                    _isLinked: p.isLinked,
                    _systemId: p.systemId,
                    _systemName: p.systemName,
                    _systemCodigo: p.systemCodigo,
                    suggestions: p.suggestions || []
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

        const isOcrBatch = uploadedData.some(row => row._isOcr);

        if (isOcrBatch) {
            setIsProcessing(true);
            try {
                const mappingsToSave = uploadedData
                    .filter(row => row._isOcr && row._systemId)
                    .map(row => ({
                        ocrDescription: row.Descripción || row.Producto,
                        systemId: row._systemId,
                        price: 0
                    }));

                if (mappingsToSave.length > 0) {
                    if (confirm(`Se vincularán ${mappingsToSave.length} productos existentes. ¿Desea continuar?`)) {
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

                const newProducts = uploadedData
                    .filter(row => !row._systemId)
                    .map(row => ({
                        Producto: (row.Descripción || row.Producto || '').toUpperCase().trim(),
                        Codigo: (row.Codigo || row.CodigoBarras || '').toString().toUpperCase().trim(), 
                        Precio: 0,
                        IdTipoProducto: 0, 
                        CantidadCompra: row['CANTIDAD COMPRA'] || row.Cantidad || row.CantidadCompra || 1
                    }));

                if (newProducts.length > 0) {
                    if (!confirm(`Se van a registrar ${newProducts.length} productos nuevos en el catálogo. ¿Desea continuar?`)) {
                        setIsProcessing(false);
                        return;
                    }
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
                        setUploadResults(uploadedData);
                        setUploadedData([]);
                    } else {
                        alert('Error: ' + data.message);
                    }
                } else if (mappingsToSave.length > 0) {
                    setUploadResults(uploadedData);
                    setUploadedData([]);
                }
            } catch (error: any) {
                console.error('Error processing OCR upload:', error);
                alert('Ocurrió un error al procesar la carga: ' + error.message);
            } finally {
                setIsProcessing(false);
            }
            return;
        }

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
                setUploadResults(validProducts);
                setUploadedData([]);
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
        <div className="flex flex-col gap-3 min-h-screen bg-[#fcfdfe] p-2 md:p-4 font-sans text-slate-900">
            {!hideHeader && (
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-2">
                    <div>
                        <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-800 flex items-center gap-2">
                            <span className="bg-indigo-600 text-white p-1.5 rounded-lg shadow-indigo-100 shadow-lg">📦</span>
                            Carga Masiva de Productos
                        </h1>
                        <p className="text-xs text-slate-400 font-medium mt-0.5 pl-1.5">Gestiona tu inventario con OCR inteligente y carga de archivos</p>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden flex flex-col relative">
                {/* TABS (ESTILO CARPETA) */}
                {!onlyExcel && (
                    <div className="flex bg-slate-50 p-1.5 gap-1.5 border-b border-slate-100">
                        <button
                            onClick={() => setActiveTab('ocr')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black transition-all duration-500 overflow-hidden relative ${
                                activeTab === 'ocr' 
                                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-100' 
                                : 'text-slate-400 hover:bg-slate-100/50'
                            }`}
                        >
                            {activeTab === 'ocr' && <span className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600"></span>}
                            <span className="text-lg">🔍</span>
                            Carga por Imagen
                        </button>
                        <button
                            onClick={() => setActiveTab('excel')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black transition-all duration-500 overflow-hidden relative ${
                                activeTab === 'excel' 
                                ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-slate-100' 
                                : 'text-slate-400 hover:bg-slate-100/50'
                            }`}
                        >
                            {activeTab === 'excel' && <span className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-600"></span>}
                            <span className="text-lg">📊</span>
                            CARGA POR EXCEL
                        </button>
                    </div>
                )}

                <div className="p-6 relative min-h-[300px] flex flex-col">
                    {/* LOADING OVERLAY PARA OCR */}
                    {isProcessing && activeTab === 'ocr' && (
                        <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-[2px] flex flex-col items-center justify-center animate-in fade-in duration-300">
                            <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                            <p className="text-sm font-black text-slate-700 tracking-widest uppercase animate-pulse">Digitalizando Documento...</p>
                            <p className="text-[10px] text-slate-400 mt-2 font-medium">Esto puede tardar unos segundos dependiendo del motor IA</p>
                        </div>
                    )}

                    {/* CONTENIDO OCR */}
                    {activeTab === 'ocr' && (
                        <div className="animate-in slide-in-from-right-4 duration-500 flex flex-col flex-1">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 tracking-tight">Procesamiento Inteligente</h3>
                                    <p className="text-[11px] text-slate-400 font-medium">Digitaliza facturas físicas o capturas de pantalla usando IA de última generación.</p>
                                </div>
                                <div className="flex flex-col gap-1 items-end">
                                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Motor de Inteligencia</label>
                                    <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-1 border border-slate-100 shadow-inner">
                                        <button
                                            onClick={() => setSelectedModel('claude-sonnet-4-6')}
                                            className={`px-4 py-1.5 rounded-lg text-[9px] font-black tracking-tight transition-all ${
                                                selectedModel === 'claude-sonnet-4-6' 
                                                ? 'bg-white text-indigo-600 shadow-sm' 
                                                : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                        >
                                            CLAUDE 3.5
                                        </button>
                                        <button
                                            onClick={() => setSelectedModel('gpt-4o')}
                                            className={`px-4 py-1.5 rounded-lg text-[9px] font-black tracking-tight transition-all ${
                                                selectedModel === 'gpt-4o' 
                                                ? 'bg-white text-indigo-600 shadow-sm' 
                                                : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                        >
                                            GPT-4o
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <button
                                    onClick={() => setIsCameraOpen(true)}
                                    className="flex flex-col items-center justify-center p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group relative overflow-hidden"
                                >
                                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-sm group-hover:scale-110 transition-transform duration-500">📸</div>
                                    <span className="text-xs font-black text-slate-700 uppercase tracking-widest">Cámara Directa</span>
                                    <span className="text-[10px] text-slate-400 mt-1 font-medium">Usa la webcam de tu PC</span>
                                </button>
                                <button
                                    onClick={() => setShowQrModal(true)}
                                    className="flex flex-col items-center justify-center p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group"
                                >
                                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-sm group-hover:scale-110 transition-transform duration-500">📱</div>
                                    <span className="text-xs font-black text-slate-700 uppercase tracking-widest">Desde Celular</span>
                                    <span className="text-[10px] text-slate-400 mt-1 font-medium">Escanea un código QR</span>
                                </button>
                                <div className="relative group">
                                    <input type="file" ref={ocrFileInputRef} onChange={handleOcrFileChange} multiple accept="image/*" className="hidden" />
                                    <button
                                        onClick={() => ocrFileInputRef.current?.click()}
                                        className="w-full h-full border-2 border-dashed border-indigo-100 bg-indigo-50/10 rounded-3xl flex flex-col items-center justify-center p-8 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group"
                                    >
                                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-sm group-hover:scale-110 transition-transform duration-500">🖼️</div>
                                        <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Subir Imágenes</span>
                                        <span className="text-[10px] text-slate-400 mt-1 font-medium">JPG, PNG o PDF</span>
                                    </button>
                                </div>
                            </div>

                            {ocrFiles.length > 0 && (
                                <div className="mt-auto border-t border-slate-50 pt-6 animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                                            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Documentos Listos ({ocrFiles.length})</span>
                                        </div>
                                        <button onClick={() => {setOcrFiles([]); setOcrPreviews([]);}} className="text-[10px] font-black text-red-500 hover:bg-red-50 px-3 py-1 rounded-full transition-colors uppercase tracking-widest">Descartar Todo</button>
                                    </div>
                                    <div className="flex flex-wrap gap-4 items-center">
                                        <div className="flex -space-x-4 overflow-hidden py-2">
                                            {ocrPreviews.map((preview, index) => (
                                                <div key={index} className="relative group shrink-0 hover:z-10 transition-all duration-300 transform hover:-translate-y-1">
                                                    <div className="w-16 h-16 rounded-2xl border-4 border-white shadow-lg overflow-hidden bg-slate-100">
                                                        <img src={preview} alt="preview" className="w-full h-full object-cover" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <Button
                                            onClick={processOcr}
                                            disabled={isProcessing}
                                            className="ml-auto px-10 h-14 rounded-2xl bg-indigo-600 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3"
                                        >
                                            🚀 COMENZAR DIGITALIZACIÓN
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* CONTENIDO EXCEL */}
                    {activeTab === 'excel' && (
                        <div className="animate-in slide-in-from-left-4 duration-500 flex flex-col flex-1">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 tracking-tight">Importación Masiva Tradicional</h3>
                                    <p className="text-[11px] text-slate-400 font-medium">Sube archivos estructurados en Excel o CSV para cargas de alto volumen.</p>
                                </div>
                                <Button
                                    onClick={handleDownloadTemplate}
                                    variant="secondary"
                                    className="text-[10px] h-10 px-6 font-black uppercase tracking-widest bg-white border-slate-200 hover:border-emerald-200 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 transition-all shadow-sm rounded-xl"
                                    isLoading={isDownloading}
                                >
                                    📥 Descargar Plantilla Oficial
                                </Button>
                            </div>

                            <div
                                onDrop={onDrop}
                                onDragOver={onDragOver}
                                onDragLeave={onDragLeave}
                                className={`flex-1 group relative border-4 border-dashed rounded-[40px] flex flex-col items-center justify-center p-12 transition-all duration-500 min-h-[300px] ${
                                    isDragging ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-50 bg-slate-50/30 hover:border-emerald-100 hover:bg-white'
                                }`}
                            >
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx,.xls,.csv" className="hidden" />
                                <div className="w-24 h-24 bg-emerald-100/50 text-emerald-600 rounded-[30px] flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-sm border-4 border-white">
                                    <span className="text-4xl text-emerald-500">📊</span>
                                </div>
                                <h4 className="text-xl font-black text-slate-800 mb-2">Suelta tu archivo Excel aquí</h4>
                                <p className="text-xs text-slate-400 text-center mb-10 max-w-[300px] font-medium leading-relaxed">
                                    Asegúrate de que las columnas coincidan con nuestro formato para una importación perfecta.
                                </p>
                                <Button
                                    onClick={() => fileInputRef.current?.click()}
                                    variant="secondary"
                                    className="text-xs py-4 px-10 h-auto font-black uppercase tracking-[0.2em] ring-1 ring-slate-200 bg-white text-slate-600 shadow-lg hover:shadow-emerald-100/50 hover:ring-emerald-200 transition-all rounded-2xl"
                                >
                                    O BUSCAR EN TU DISPOSITIVO
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {uploadedData.length > 0 && (
                <div className="bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden flex flex-col flex-1 max-h-[70vh] animate-in slide-in-from-bottom-5 duration-500">
                    <div className="bg-white px-4 py-3 border-b border-slate-100 flex justify-between items-center sticky top-0 z-20 backdrop-blur-md bg-white/90">
                        <div className="flex items-center gap-3">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                            <h2 className="text-xs font-black text-slate-700 uppercase tracking-widest">Vista Previa de Carga</h2>
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">
                                {uploadedData.length} registros
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <Button 
                                onClick={() => {
                                    setUploadedData([]);
                                    setExistingProducts([]);
                                    setExistingCategories([]);
                                }} 
                                variant="secondary" 
                                className="text-[9px] h-7 px-3 font-black uppercase tracking-widest border-slate-200"
                            >
                                Cancelar
                            </Button>
                            <Button 
                                onClick={handleProcessUpload} 
                                isLoading={isProcessing} 
                                className="text-[9px] h-7 px-4 font-black uppercase tracking-widest shadow-indigo-100 shadow-md"
                            >
                                Confirmar y Subir
                            </Button>
                        </div>
                    </div>

                    <div className="overflow-auto flex-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-slate-50 text-slate-400 uppercase text-[9px] font-black z-10 border-b border-slate-100">
                                <tr>
                                    {Object.keys(uploadedData[0]).filter(k => !k.startsWith('_')).map((key) => (
                                        <th key={key} className="px-3 py-2.5 whitespace-nowrap tracking-[0.1em]">{key}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {uploadedData.map((row, idx) => {
                                    const isOcr = row._isOcr;
                                    const isLinked = row._isLinked;
                                    const systemName = row._systemName;

                                    const hasDuplicateCode = isDuplicateCode(row.Codigo || row.CodigoBarras);
                                    const hasDuplicateName = isDuplicateName(row.Descripción || row.Producto);
                                    const hasInvalidCategory = isInvalidCategory(row.Categoria);

                                    const hasIssues = hasDuplicateCode || hasDuplicateName || hasInvalidCategory;

                                    return (
                                        <tr key={idx} className={`group transition-colors ${hasIssues ? 'bg-amber-50/20' : 'hover:bg-slate-50/50'}`}>
                                            {Object.keys(uploadedData[0]).filter(k => !k.startsWith('_')).map((key, vIdx) => {
                                                const val = row[key];
                                                const isCodeIssue = (key === 'Codigo' || key === 'CodigoBarras') && hasDuplicateCode;
                                                const isNameIssue = (key === 'Producto' || key === 'Descripción') && hasDuplicateName;
                                                const isCatIssue = key === 'Categoria' && hasInvalidCategory;

                                                const isCritical = isCodeIssue || isNameIssue || isCatIssue;

                                                let title = "";
                                                if (isCodeIssue) title = "Este código ya existe";
                                                if (isNameIssue) title = "Este nombre de producto ya existe";
                                                if (isCatIssue) title = "Esta categoría no existe en el sistema";

                                                if (isOcr && (key === 'Producto' || key === 'Descripción')) {
                                                    return (
                                                        <td key={vIdx} className="px-3 py-1.5 align-top">
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-slate-800 font-bold text-[11px] leading-tight group-hover:text-indigo-700 transition-colors">{val}</span>
                                                                    {isCritical && (
                                                                        <span title={title} className="text-amber-500 text-[10px] cursor-help">
                                                                            ⚠️
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="mt-0.5">
                                                                    {isLinked ? (
                                                                        <div className="flex flex-col">
                                                                            <div className="flex items-center gap-1">
                                                                                <span className="text-[8px] font-black text-indigo-500 bg-indigo-50/50 px-1 rounded uppercase tracking-tighter">
                                                                                    LINKED
                                                                                </span>
                                                                                <span className="text-[9px] font-medium text-slate-400 italic">
                                                                                    {systemName || "..."}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    ) : row.suggestions?.length > 0 ? (
                                                                        <div className="flex flex-col gap-1">
                                                                            <span className="text-[8px] bg-amber-50 text-amber-600 px-1 rounded-full font-black w-fit uppercase tracking-tighter">Similar al {Math.round(row.suggestions[0].similarity * 100)}%</span>
                                                                            <select 
                                                                                className="text-[8px] text-slate-500 bg-slate-50 rounded border-slate-100 focus:ring-0 py-0.5 mt-0.5"
                                                                                onChange={(e) => {
                                                                                    const selected = row.suggestions.find((s: any) => s.id.toString() === e.target.value);
                                                                                    if (selected) {
                                                                                        const next = [...uploadedData];
                                                                                        next[idx] = {
                                                                                            ...next[idx],
                                                                                            Descripción: selected.name,
                                                                                            Producto: selected.name,
                                                                                            Codigo: selected.code,
                                                                                            _isLinked: true,
                                                                                            _systemId: selected.id,
                                                                                            _systemName: selected.name,
                                                                                            _systemCodigo: selected.code
                                                                                        };
                                                                                        setUploadedData(next);
                                                                                    }
                                                                                }}
                                                                            >
                                                                                <option value="">¿Vincular?</option>
                                                                                {row.suggestions.map((s: any) => (
                                                                                    <option key={s.id} value={s.id}>{s.name} ({Math.round(s.similarity * 100)}%)</option>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                    ) : hasIssues ? (
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="text-[8px] text-amber-600 font-black bg-amber-50 px-1 rounded uppercase tracking-tighter">EXISTENTE</span>
                                                                            <p className="text-[8px] text-amber-500 font-medium">Duplicado</p>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-[8px] text-emerald-500 font-black bg-emerald-50 px-1 rounded uppercase tracking-tighter">NEW</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    );
                                                }

                                                return (
                                                    <td key={vIdx} className="px-3 py-1.5 align-top">
                                                        <div className="relative group/cell">
                                                            <span className={`text-[11px] block truncate max-w-[200px] ${
                                                                isCritical ? 'text-amber-600 font-black' : 'text-slate-500 font-medium'
                                                            }`}>
                                                                {val || '---'}
                                                            </span>
                                                            {isCritical && (
                                                                <div className="absolute left-0 -bottom-4 bg-slate-800 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover/cell:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-none">
                                                                    {title}
                                                                </div>
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
                </div>
            )}

            {uploadResults && (
                <div className="bg-white rounded-xl shadow-md p-8 border border-emerald-100/50 animate-in zoom-in-95 duration-300">
                    <div className="flex flex-col items-center text-center mb-8">
                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 text-4xl mb-4 shadow-inner">
                            ✅
                        </div>
                        <h2 className="text-2xl font-black text-gray-800 tracking-tight">¡Carga Completada con Éxito!</h2>
                        <p className="text-gray-500 mt-2">Se han procesado {uploadResults.length} productos correctamente.</p>
                    </div>

                    <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm mb-8 bg-white/50 backdrop-blur-sm">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#f8fafc] text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-5">Código</th>
                                    <th className="px-6 py-5">Descripción</th>
                                    <th className="px-6 py-5">Cant. Compra</th>
                                    <th className="px-6 py-5 text-center">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {uploadResults.map((p, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50/80 transition-colors border-l-4 border-l-transparent hover:border-l-indigo-400">
                                        <td className="px-6 py-4 font-mono text-xs text-gray-400 bg-gray-50/30 font-bold">{p.Codigo || p.CodigoBarras || '---'}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-800 text-sm">{p.Producto || p.Descripción || p.description}</span>
                                                {p._systemName && (
                                                    <span className="text-[10px] text-gray-400 font-medium italic">Sist: {p._systemName}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-gray-700 font-black text-xs min-w-[32px] inline-block text-center border border-gray-200">
                                                {p['CANTIDAD COMPRA'] || p.Cantidad || p.CantidadCompra || 0}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center">
                                                {p._isLinked ? (
                                                    <span className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md font-black border border-indigo-200 uppercase tracking-tight shadow-sm flex items-center gap-1">
                                                        <span className="w-1 h-1 bg-indigo-500 rounded-full"></span>
                                                        Actualizado
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md font-black border border-emerald-200 uppercase tracking-tight shadow-sm flex items-center gap-1">
                                                        <span className="w-1 h-1 bg-emerald-500 rounded-full"></span>
                                                        Nuevo
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-center">
                        <Button
                            onClick={() => {
                                setUploadResults(null);
                                setOcrFiles([]);
                                setOcrPreviews([]);
                            }}
                            variant="secondary"
                            className="px-12 py-3 font-black uppercase tracking-widest text-xs"
                        >
                            Finalizar y Volver
                        </Button>
                    </div>
                </div>
            )}

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
        </div>
    );
}
