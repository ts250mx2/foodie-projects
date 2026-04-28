'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import Button from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import MobileBatchModal, { BatchSelectedPhoto } from '@/components/MobileBatchModal';
import CostingModal, { Product } from '@/components/CostingModal';

interface PurchaseImageCaptureModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: number;
    selectedBranchId: string;
    selectedPaymentChannelId?: string;
    selectedMonth: number; // 0-indexed
    selectedYear: number;
    onSuccess?: () => void;
    /** Pre-loaded images from MobileBatchModal */
    preloadedItems?: BatchSelectedPhoto[];
    /** Called after successful registration with the new IdCompra and processed detail IDs */
    onProcessed?: (idCompra: number, detailIds: number[]) => void;
}

type Step = 'capture' | 'preview' | 'register';

export default function PurchaseImageCaptureModal({ 
    isOpen, 
    onClose, 
    projectId, 
    selectedBranchId, 
    selectedPaymentChannelId,
    selectedMonth,
    selectedYear,
    onSuccess,
    preloadedItems,
    onProcessed
}: PurchaseImageCaptureModalProps) {
    const tNav = useTranslations('Navigation');
    const tOcr = useTranslations('OCRDocuments');
    const tCommon = useTranslations('Common');
    const params = useParams();
    const locale = params?.locale || 'es';
    const { colors } = useTheme();

    // State
    const [step, setStep] = useState<Step>('capture');
    interface OcrItem {
        id: string;
        file: File;
        preview: string;
        selected: boolean;
    }
    const [ocrItems, setOcrItems] = useState<OcrItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedModel, setSelectedModel] = useState<'gpt-4o' | 'claude-sonnet-4-6'>('gpt-4o');
    
    // Camera state
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Mobile Batch Modal
    const [showMobileBatchModal, setShowMobileBatchModal] = useState(false);
    const [batchDetailIds, setBatchDetailIds] = useState<number[]>([]);

    // Registration state
    const [ocrResult, setOcrResult] = useState<any>(null);
    const [providers, setProviders] = useState<any[]>([]);
    const [paymentChannels, setPaymentChannels] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [allProducts, setAllProducts] = useState<any[]>([]);
    const [ocrRelationships, setOcrRelationships] = useState<{providers: any[], products: any[]}>({ providers: [], products: [] });

    // Selected values in registration
    const [regProviderId, setRegProviderId] = useState<string>('');
    const [regPaymentChannelId, setRegPaymentChannelId] = useState<string>(selectedPaymentChannelId || '');
    const [regBranchId, setRegBranchId] = useState<string>(selectedBranchId);
    const [regTicketNumber, setRegTicketNumber] = useState<string>('');
    const [regDate, setRegDate] = useState<string>('');

    // Linking state
    const [isLinkProductModalOpen, setIsLinkProductModalOpen] = useState(false);
    const [linkingConceptIndex, setLinkingConceptIndex] = useState<number | null>(null);
    const [isCostingModalOpen, setIsCostingModalOpen] = useState(false);
    const [selectedProductForCosting, setSelectedProductForCosting] = useState<any | null>(null);
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [isLinkingProvider, setIsLinkingProvider] = useState(false);
    const [isNewProviderModalOpen, setIsNewProviderModalOpen] = useState(false);
    const [newProviderName, setNewProviderName] = useState('');
    const [esProveedorGasto, setEsProveedorGasto] = useState(false);

    const ocrFileInputRef = useRef<HTMLInputElement>(null);

    // Load necessary data when modal opens
    useEffect(() => {
        if (isOpen) {
            fetchProviders();
            fetchPaymentChannels();
            fetchBranches();
            fetchProducts();
            fetchRelationships();
            
            setRegBranchId(selectedBranchId);
            setRegPaymentChannelId(selectedPaymentChannelId || '');

            if (preloadedItems && preloadedItems.length > 0) {
                const converted: OcrItem[] = preloadedItems.map(p => ({
                    id: p.idDetalleDocumentoOCR.toString(),
                    file: new File([Uint8Array.from(atob(p.base64), c => c.charCodeAt(0))], p.filename, { type: 'image/jpeg' }),
                    preview: `data:image/jpeg;base64,${p.base64}`,
                    selected: true
                }));
                setBatchDetailIds(preloadedItems.map(p => p.idDetalleDocumentoOCR));
                setOcrItems(converted);
                setStep('preview');
            }
        }
    }, [isOpen, selectedBranchId, selectedPaymentChannelId, preloadedItems]);

    const fetchProviders = async () => {
        try {
            const response = await fetch(`/api/suppliers?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) setProviders(data.data);
        } catch (error) { console.error('Error fetching providers:', error); }
    };

    const fetchPaymentChannels = async () => {
        try {
            const response = await fetch(`/api/payment-channels?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) setPaymentChannels(data.data);
        } catch (error) { console.error('Error fetching payment channels:', error); }
    };

    const fetchBranches = async () => {
        try {
            const response = await fetch(`/api/branches?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) setBranches(data.data);
        } catch (error) { console.error('Error fetching branches:', error); }
    };

    const fetchProducts = async () => {
        try {
            const response = await fetch(`/api/products?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) setAllProducts(data.data);
        } catch (error) { console.error('Error fetching products:', error); }
    };

    const fetchRelationships = async () => {
        try {
            const response = await fetch(`/api/ocr/relationships?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) setOcrRelationships(data.data);
        } catch (error) { console.error('Error fetching relationships:', error); }
    };

    // Camera logic
    const startCamera = async () => {
        setIsCameraOpen(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (error) {
            alert('No se pudo acceder a la cámara');
            setIsCameraOpen(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current?.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
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

    // Batch photos from MobileBatchModal
    const handleBatchPurchasePhotos = (photos: BatchSelectedPhoto[]) => {
        const converted: OcrItem[] = photos.map(p => ({
            id: p.idDetalleDocumentoOCR.toString(),
            file: new File([Uint8Array.from(atob(p.base64), c => c.charCodeAt(0))], p.filename, { type: 'image/jpeg' }),
            preview: `data:image/jpeg;base64,${p.base64}`,
            selected: true
        }));
        setBatchDetailIds(photos.map(p => p.idDetalleDocumentoOCR));
        setOcrItems(converted);
        setStep('preview');
    };

    // File Upload logic
    const handleOcrFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            const newItems: OcrItem[] = newFiles.map(file => {
                let preview = '📄 Documento';
                if (file.type.startsWith('image/')) preview = URL.createObjectURL(file);
                else if (file.type === 'application/pdf') preview = 'PDF_ICON';
                return { id: uuidv4(), file, preview, selected: true };
            });
            setOcrItems(prev => [...prev, ...newItems]);
            setStep('preview');
        }
    };

    const processOcr = async () => {
        const selectedItems = ocrItems.filter(item => item.selected);
        if (selectedItems.length === 0) {
            alert('Por favor selecciona al menos un documento para procesar.');
            return;
        }

        setIsProcessing(true);
        try {
            // 1. Save to tblDocumentosOCR first
            const base64Files = await Promise.all(selectedItems.map(item => {
                return new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.readAsDataURL(item.file);
                });
            }));

            const now = new Date();
            const timestamp = now.getFullYear() + 
                String(now.getMonth() + 1).padStart(2, '0') + 
                String(now.getDate()).padStart(2, '0') + 
                String(now.getHours()).padStart(2, '0') + 
                String(now.getMinutes()).padStart(2, '0') + 
                String(now.getSeconds()).padStart(2, '0');

            const saveRes = await fetch('/api/ocr/documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    description: `Captura OCR ${timestamp}`,
                    documents: base64Files
                })
            });
            const saveData = await saveRes.json();
            if (!saveData.success) throw new Error(saveData.message);

            const batchId = saveData.id;

            // 2. Run OCR
            const formData = new FormData();
            formData.append('model', selectedModel);
            selectedItems.forEach(item => formData.append('image', item.file));

            const ocrRes = await fetch('/api/expenses/process-receipt', {
                method: 'POST',
                body: formData
            });
            const ocrData = await ocrRes.json();
            if (ocrData.success) {
                const extracted = ocrData.data;
                // Auto-link provider
                if (extracted.provider) {
                    const matchedProvider = ocrRelationships.providers.find(
                        (p: any) => p.ProveedorOCR.toLowerCase() === extracted.provider.toLowerCase()
                    );
                    if (matchedProvider) setRegProviderId(matchedProvider.IdProveedor.toString());
                }

                // Auto-link products
                const conceptsWithAudit = extracted.concepts.map((c: any) => {
                    // 1. Try to find in manual relationships
                    const matchedRelationship = ocrRelationships.products.find(
                        (p: any) => p.ProductoOCR.toLowerCase() === c.description.toLowerCase()
                    );
                    
                    let productId = null;
                    let productName = '';

                    if (matchedRelationship) {
                        productId = matchedRelationship.IdProducto;
                        const productInfo = allProducts.find(p => p.IdProducto === productId);
                        productName = productInfo ? productInfo.Producto : 'Vinculado';
                    } else {
                        // 2. Try direct match by Product Name (Producto)
                        const directMatch = allProducts.find(
                            p => p.Producto.toLowerCase() === c.description.toLowerCase()
                        );
                        if (directMatch) {
                            productId = directMatch.IdProducto;
                            productName = directMatch.Producto;
                        } else {
                            // 3. Try match by Code (Codigo)
                            const codeMatch = allProducts.find(
                                p => p.Codigo && p.Codigo.toLowerCase() === c.description.toLowerCase()
                            );
                            if (codeMatch) {
                                productId = codeMatch.IdProducto;
                                productName = codeMatch.Producto;
                            }
                        }
                    }
                    return { ...c, originalQuantity: c.quantity, originalPrice: c.price, productId, productName };
                });

                setOcrResult({ ...extracted, concepts: conceptsWithAudit, batchId });
                setRegTicketNumber(extracted.ticketNumber || '');
                setRegDate(extracted.date || '');
                setStep('register');
            } else {
                alert('Error al procesar: ' + ocrData.message);
            }
        } catch (error: any) {
            alert('Error: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRegister = async () => {
        const missingFields = [];
        if (!regProviderId) missingFields.push('Proveedor');
        if (!regTicketNumber) missingFields.push('Número de Ticket/Recibo');
        if (!regDate) missingFields.push('Fecha de Recibo');
        if (!regPaymentChannelId) missingFields.push('Canal de Pago');
        if (!regBranchId) missingFields.push('Sucursal');

        if (missingFields.length > 0) {
            alert(`Por favor complete los siguientes campos obligatorios:\n- ${missingFields.join('\n- ')}`);
            return;
        }

        // Validate Date against screen Month/Year
        const purchaseDate = new Date(regDate + 'T00:00:00');
        if (purchaseDate.getMonth() !== selectedMonth || purchaseDate.getFullYear() !== selectedYear) {
            const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const confirmed = window.confirm(
                `¡Advertencia! La fecha del recibo (${regDate}) no corresponde al mes de ${months[selectedMonth]} ${selectedYear} seleccionado en pantalla.\n\n¿Deseas continuar con el registro para el día ${purchaseDate.getDate()} de ${months[purchaseDate.getMonth()]}?`
            );
            if (!confirmed) return;
        }

        const unlinked = ocrResult.concepts.filter((c: any) => !c.productId);
        if (unlinked.length > 0) {
            alert(`Faltan ${unlinked.length} productos por vincular. Todos los conceptos deben estar vinculados a un producto del catálogo.`);
            return;
        }

        setIsSaving(true);
        try {
            const response = await fetch('/api/ocr/register-transaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    ocrType: 'compra',
                    batchId: ocrResult.batchId,
                    selectedProviderId: regProviderId,
                    selectedPaymentChannelId: regPaymentChannelId,
                    selectedBranchId: regBranchId,
                    ocrResult: { ...ocrResult, ticketNumber: regTicketNumber, date: regDate },
                    providerName: providers.find(p => p.IdProveedor.toString() === regProviderId)?.Proveedor
                })
            });
            const data = await response.json();
            if (data.success) {
                alert(`✅ ¡Compra registrada exitosamente!\n\nSe ha insertado en la fecha: ${regDate}`);

                // PATCH batch detail rows with the new IdCompra
                if (batchDetailIds.length > 0 && data.idCompra) {
                    await Promise.all(batchDetailIds.map(id =>
                        fetch('/api/ocr/mobile-batches', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ projectId, idDetalleDocumentoOCR: id, idCompra: data.idCompra })
                        })
                    ));
                    onProcessed?.(data.idCompra, batchDetailIds);
                    setBatchDetailIds([]);
                }

                const remainingItems = ocrItems.filter(item => !item.selected);
                setOcrItems(remainingItems);
                
                if (remainingItems.length > 0) {
                    setStep('preview');
                    setOcrResult(null);
                    setRegProviderId('');
                    setRegTicketNumber('');
                    setRegDate('');
                } else {
                    resetModal();
                    onClose();
                }
                
                onSuccess?.();
            } else {
                alert('Error: ' + data.message);
            }
        } catch (error) {
            alert('Error de conexión');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateConcept = (index: number, field: string, value: any) => {
        setOcrResult(prev => {
            if (!prev) return prev;
            const newConcepts = [...prev.concepts];
            newConcepts[index] = { ...newConcepts[index], [field]: value };
            return { ...prev, concepts: newConcepts };
        });
    };

    const handleLinkProduct = async (product: any) => {
        if (linkingConceptIndex === null || !ocrResult) return;
        
        const concept = ocrResult.concepts[linkingConceptIndex];
        
        // 1. Update UI state
        const newConcepts = [...ocrResult.concepts];
        newConcepts[linkingConceptIndex] = { 
            ...newConcepts[linkingConceptIndex], 
            productId: product.IdProducto,
            productName: product.Producto,
            code: product.Codigo // Update code too if we have it
        };
        setOcrResult(prev => ({ ...prev, concepts: newConcepts }));
        
        // 2. Save relationship for future use
        try {
            await fetch('/api/ocr/relationships', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    type: 'product',
                    ocrName: concept.description,
                    systemId: product.IdProducto
                })
            });
            fetchRelationships();
        } catch (error) { console.error('Error linking product:', error); }

        setIsLinkProductModalOpen(false);
        setLinkingConceptIndex(null);
    };

    const handleManualLinkProvider = async () => {
        if (!regProviderId || !ocrResult?.provider) return;
        setIsLinkingProvider(true);
        try {
            const response = await fetch('/api/ocr/relationships', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    type: 'provider',
                    ocrName: ocrResult.provider,
                    systemId: regProviderId
                })
            });
            const data = await response.json();
            if (data.success) {
                alert('Proveedor vinculado exitosamente');
                fetchRelationships();
            }
        } catch (error) { alert('Error al vincular'); }
        finally { setIsLinkingProvider(false); }
    };

    const handleSaveNewProvider = async () => {
        if (!newProviderName) return;
        setIsSaving(true);
        const uppercaseName = newProviderName.toUpperCase();
        try {
            const response = await fetch('/api/suppliers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    proveedor: uppercaseName,
                    esProveedorGasto: esProveedorGasto,
                    status: 0
                })
            });
            const data = await response.json();
            if (data.success) {
                await fetchProviders();
                setRegProviderId(data.id.toString());
                setIsNewProviderModalOpen(false);
                // After creating, automatically link to the OCR name
                if (ocrResult?.provider) {
                    await fetch('/api/ocr/relationships', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            projectId,
                            type: 'provider',
                            ocrName: ocrResult.provider,
                            systemId: data.id
                        })
                    });
                }
                alert('Proveedor creado y vinculado exitosamente');
            } else {
                alert('Error al crear proveedor: ' + data.message);
            }
        } catch (error) { alert('Error de conexión al crear proveedor'); }
        finally { setIsSaving(false); }
    };

    const resetModal = () => {
        setStep('capture');
        setOcrItems([]);
        setOcrResult(null);
        setRegProviderId('');
        setRegTicketNumber('');
        setRegDate('');
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 ${!isOpen ? 'hidden' : ''}`}>
            <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
                
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                            <span className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg">📸</span>
                            {step === 'register' ? 'Confirmar compra por imagen' : 'Captura por Imagen'}
                        </h2>
                        <p className="text-xs text-slate-400 font-medium mt-1">Digitaliza facturas con IA de última generación</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex flex-col gap-1 items-end">
                            <label className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Motor de Inteligencia</label>
                            <div className="flex items-center gap-2 bg-white rounded-xl p-1 border border-slate-100 shadow-sm">
                                <button
                                    onClick={() => setSelectedModel('claude-sonnet-4-6')}
                                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black tracking-tight transition-all ${
                                        selectedModel === 'claude-sonnet-4-6' 
                                        ? 'bg-slate-50 text-indigo-600 shadow-inner' 
                                        : 'text-slate-400 hover:text-slate-600'
                                    }`}
                                >
                                    CLAUDE 3.5
                                </button>
                                <button
                                    onClick={() => setSelectedModel('gpt-4o')}
                                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black tracking-tight transition-all ${
                                        selectedModel === 'gpt-4o' 
                                        ? 'bg-slate-50 text-indigo-600 shadow-inner' 
                                        : 'text-slate-400 hover:text-slate-600'
                                    }`}
                                >
                                    GPT-4o
                                </button>
                            </div>
                        </div>
                        <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">✕</button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-8 relative">
                    {isProcessing && (
                        <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-[2px] flex flex-col items-center justify-center animate-in fade-in duration-300">
                            <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                            <p className="text-sm font-black text-slate-700 tracking-widest uppercase animate-pulse">Analizando Documentos...</p>
                        </div>
                    )}

                    {step === 'capture' && (
                        <div className="animate-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <button onClick={startCamera} className="flex flex-col items-center justify-center p-10 rounded-[2.5rem] bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group">
                                    <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-4xl mb-4 shadow-sm group-hover:scale-110 transition-transform">📸</div>
                                    <span className="text-sm font-black text-slate-700 uppercase tracking-widest">Cámara Directa</span>
                                </button>
                                <button onClick={() => setShowMobileBatchModal(true)} className="flex flex-col items-center justify-center p-10 rounded-[2.5rem] bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group">
                                    <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-4xl mb-4 shadow-sm group-hover:scale-110 transition-transform">📱</div>
                                    <span className="text-sm font-black text-slate-700 uppercase tracking-widest">Lotes de Celular</span>
                                </button>
                                <div className="relative">
                                    <input type="file" ref={ocrFileInputRef} onChange={handleOcrFileChange} multiple accept="image/*,.pdf" className="hidden" />
                                    <button
                                        onClick={() => ocrFileInputRef.current?.click()}
                                        className="w-full h-full border-4 border-dashed border-slate-100 bg-slate-50/30 rounded-[3rem] flex flex-col items-center justify-center p-12 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group"
                                    >
                                        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-4xl mb-4 shadow-sm group-hover:scale-110 transition-transform">🖼️</div>
                                        <span className="text-sm font-black text-indigo-600 uppercase tracking-widest">Subir Imagen o PDF</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="animate-in slide-in-from-right-4 duration-500 flex flex-col gap-8 h-full">
                            <div className="flex justify-between items-center px-4">
                                <h3 className="text-lg font-black text-slate-800 tracking-tight">Imágenes Capturadas</h3>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setOcrItems(prev => prev.map(item => ({ ...item, selected: true })))}
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                                    >
                                        Seleccionar Todo
                                    </button>
                                    <button 
                                        onClick={() => setOcrItems(prev => prev.map(item => ({ ...item, selected: false })))}
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                                    >
                                        Deseleccionar Todo
                                    </button>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-4 justify-center">
                                {ocrItems.map((item) => (
                                    <div 
                                        key={item.id} 
                                        onClick={() => setOcrItems(prev => prev.map(it => it.id === item.id ? { ...it, selected: !it.selected } : it))}
                                        className={`relative w-40 h-40 rounded-3xl overflow-hidden shadow-lg border-4 transition-all cursor-pointer ${item.selected ? 'border-indigo-500 scale-105' : 'border-white opacity-70 hover:opacity-100'}`}
                                    >
                                        {/* Selection indicator */}
                                        <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center z-10 transition-colors ${item.selected ? 'bg-indigo-500 text-white' : 'bg-black/30 text-transparent border-2 border-white'}`}>
                                            ✓
                                        </div>
                                        
                                        {item.preview === 'PDF_ICON' ? (
                                            <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center gap-2">
                                                <span className="text-4xl">📄</span>
                                                <span className="text-[10px] font-black text-red-500 uppercase">Archivo PDF</span>
                                                <span className="text-[8px] text-slate-400 font-medium px-2 text-center truncate w-full">{item.file.name}</span>
                                            </div>
                                        ) : (
                                            <img src={item.preview} alt="preview" className="w-full h-full object-cover" />
                                        )}
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
                            <div className="mt-auto flex justify-center">
                                <Button onClick={processOcr} className="px-12 py-6 rounded-2xl bg-indigo-600 text-white font-black tracking-widest uppercase shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all">
                                    🚀 INICIAR PROCESAMIENTO
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 'register' && ocrResult && (
                        <div className="animate-in slide-in-from-bottom-4 duration-500 flex flex-col gap-8">
                            {/* Main fields */}
                            <div className="flex flex-col gap-6 p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 shadow-inner">
                                {/* Row 1: Provider */}
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-end px-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Proveedor Detectado</label>
                                        {ocrResult.provider && !regProviderId && (
                                            <span className="text-[9px] font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-lg animate-pulse border border-amber-100">
                                                IA Detectó: "{ocrResult.provider}" (Sin Vincular)
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <select 
                                            value={regProviderId} 
                                            onChange={(e) => setRegProviderId(e.target.value)}
                                            className="flex-1 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                        >
                                            <option value="">-- Seleccionar Proveedor --</option>
                                            {providers.sort((a, b) => a.Proveedor.localeCompare(b.Proveedor)).map(p => (
                                                <option key={p.IdProveedor} value={p.IdProveedor}>{p.Proveedor}</option>
                                            ))}
                                        </select>
                                        <button 
                                            onClick={handleManualLinkProvider}
                                            disabled={!regProviderId || isLinkingProvider}
                                            className="px-6 rounded-2xl bg-indigo-50 text-indigo-600 font-black text-[10px] uppercase tracking-widest border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-50"
                                            title="Vincular nombre detectado a este proveedor"
                                        >
                                            {isLinkingProvider ? '⏳' : '🔗 Vincular'}
                                        </button>
                                        <button 
                                            onClick={() => { setNewProviderName(ocrResult.provider || ''); setIsNewProviderModalOpen(true); }}
                                            className="px-6 rounded-2xl bg-emerald-50 text-emerald-600 font-black text-[10px] uppercase tracking-widest border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all"
                                        >
                                            ➕ Nuevo
                                        </button>
                                    </div>
                                </div>

                                {/* Row 2: Ticket, Date, Payment Channel */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Ticket / Recibo</label>
                                        <input 
                                            type="text" 
                                            value={regTicketNumber} 
                                            onChange={(e) => setRegTicketNumber(e.target.value)}
                                            placeholder="N° de Documento"
                                            className="px-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Fecha Recibo</label>
                                        <input 
                                            type="date" 
                                            value={regDate} 
                                            onChange={(e) => setRegDate(e.target.value)}
                                            className="px-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Canal de Pago</label>
                                        <select 
                                            value={regPaymentChannelId} 
                                            onChange={(e) => setRegPaymentChannelId(e.target.value)}
                                            className="px-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                        >
                                            <option value="">-- Seleccionar --</option>
                                            {paymentChannels.map(pc => <option key={pc.IdCanalPago} value={pc.IdCanalPago}>{pc.CanalPago}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Concepts table */}
                            <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                        <tr>
                                            <th className="px-8 py-5">Concepto OCR</th>
                                            <th className="px-8 py-5 text-center">Cant.</th>
                                            <th className="px-8 py-5 text-center">Costo</th>
                                            <th className="px-8 py-5 text-right">Vinculación</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {ocrResult.concepts.map((c: any, i: number) => (
                                            <tr key={i} className="hover:bg-slate-50/30 transition-colors group">
                                                <td className="px-8 py-5">
                                                    <input 
                                                        type="text" 
                                                        value={c.description} 
                                                        onChange={(e) => handleUpdateConcept(i, 'description', e.target.value)}
                                                        className="w-full bg-transparent border-none text-[11px] font-black text-slate-700 outline-none focus:ring-0"
                                                    />
                                                </td>
                                                <td className="px-8 py-5 text-center">
                                                    <input 
                                                        type="number" 
                                                        value={c.quantity} 
                                                        onChange={(e) => handleUpdateConcept(i, 'quantity', parseFloat(e.target.value))}
                                                        className="w-16 bg-transparent border-none text-[11px] font-black text-slate-700 outline-none focus:ring-0 text-center"
                                                    />
                                                </td>
                                                <td className="px-8 py-5 text-center">
                                                    <input 
                                                        type="number" 
                                                        value={c.price} 
                                                        onChange={(e) => handleUpdateConcept(i, 'price', parseFloat(e.target.value))}
                                                        className="w-24 bg-transparent border-none text-[11px] font-black text-slate-700 outline-none focus:ring-0 text-center"
                                                    />
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <div className="flex items-center justify-end gap-3">
                                                        {c.productId ? (
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">VINCULADO</span>
                                                                <span className="text-[8px] text-slate-400 font-bold truncate max-w-[150px] uppercase mt-0.5">{c.productName}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[9px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100 uppercase tracking-tighter">SIN VINCULAR</span>
                                                        )}
                                                        {c.productId && (
                                                            <button 
                                                                onClick={() => {
                                                                    const fullProduct = allProducts.find(p => p.IdProducto === c.productId);
                                                                    if (fullProduct) {
                                                                        setSelectedProductForCosting(fullProduct);
                                                                        setIsCostingModalOpen(true);
                                                                    }
                                                                }}
                                                                className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-sm hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100 group-hover:scale-110"
                                                                title="Editar producto"
                                                            >✏️</button>
                                                        )}
                                                        <button 
                                                            onClick={() => { 
                                                                if (c.productId) {
                                                                    const confirmed = window.confirm(
                                                                        `Este concepto ya está vinculado a: "${c.productName}".\n\n¿Deseas cambiar la vinculación por otro producto?`
                                                                    );
                                                                    if (!confirmed) return;
                                                                }
                                                                setLinkingConceptIndex(i); 
                                                                setProductSearchTerm(c.description.toUpperCase()); 
                                                                setIsLinkProductModalOpen(true); 
                                                            }}
                                                            className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-sm hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-slate-100 group-hover:scale-110"
                                                            title="Vincular producto"
                                                        >🔗</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex items-center justify-center gap-6 pb-6">
                                <Button 
                                    onClick={() => setStep('preview')} 
                                    variant="secondary"
                                    className="px-10 py-5 rounded-2xl font-black tracking-widest uppercase border-2 border-slate-100 hover:bg-slate-50 transition-all text-xs"
                                >
                                    🔙 Volver a Capturar
                                </Button>
                                <Button 
                                    onClick={handleRegister} 
                                    isLoading={isSaving}
                                    disabled={ocrResult.concepts.some((c: any) => !c.productId)}
                                    className="px-16 py-6 rounded-2xl bg-emerald-600 text-white font-black tracking-[0.2em] uppercase shadow-xl shadow-emerald-100 hover:scale-105 active:scale-95 transition-all text-xs disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                                >
                                    ✅ Confirmar compra por imagen
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Sub-modals (Product Linker) */}
            {isLinkProductModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl p-8 border border-slate-100">
                        <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                            <span className="text-2xl">🔍</span> Vincular Producto
                        </h3>
                        <div className="flex flex-col gap-4">
                            <input 
                                type="text" 
                                placeholder="Buscar en catálogo..." 
                                value={productSearchTerm}
                                onChange={(e) => setProductSearchTerm(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <div className="max-h-60 overflow-auto divide-y divide-slate-50 border border-slate-50 rounded-xl bg-slate-50/30">
                                {allProducts.filter(p => p.Producto.toLowerCase().includes(productSearchTerm.toLowerCase()) || p.Codigo.toLowerCase().includes(productSearchTerm.toLowerCase())).map(p => (
                                    <button key={p.IdProducto} onClick={() => handleLinkProduct(p)} className="w-full text-left px-4 py-3 hover:bg-white hover:text-indigo-600 transition-colors text-xs font-bold text-slate-600">
                                        {p.Codigo} - {p.Producto}
                                    </button>
                                ))}
                                <button 
                                    onClick={() => {
                                        const upperName = productSearchTerm.toUpperCase();
                                        const currentConcept = linkingConceptIndex !== null ? ocrResult.concepts[linkingConceptIndex] : null;
                                        setSelectedProductForCosting({ 
                                            IdProducto: 0, 
                                            Producto: upperName, 
                                            Codigo: currentConcept?.code || '', 
                                            Precio: currentConcept?.price || 0, 
                                            IVA: 0, 
                                            IdTipoProducto: 0, 
                                            Status: 0 
                                        });
                                        setIsLinkProductModalOpen(false);
                                        setIsCostingModalOpen(true);
                                    }}
                                    className="w-full text-center px-4 py-4 text-xs font-black text-indigo-600 uppercase tracking-widest hover:bg-white transition-colors"
                                >
                                    ➕ Crear Nuevo Producto
                                </button>
                            </div>
                            <Button onClick={() => setIsLinkProductModalOpen(false)} variant="secondary" className="mt-4 rounded-xl font-black uppercase tracking-widest py-3">Cerrar</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Camera Overlay */}
            {isCameraOpen && (
                <div className="fixed inset-0 z-[70] bg-black flex flex-col">
                    <video ref={videoRef} autoPlay playsInline className="flex-1 object-contain" />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="p-8 flex justify-between items-center bg-black/50 backdrop-blur-md">
                        <button onClick={stopCamera} className="text-white text-3xl">✕</button>
                        <button onClick={capturePhoto} className="w-20 h-20 bg-white rounded-full border-4 border-slate-200 active:scale-90 transition-transform shadow-lg shadow-white/20"></button>
                        <div className="w-8"></div>
                    </div>
                </div>
            )}


            {/* Mobile Batch Modal */}
            <MobileBatchModal
                isOpen={showMobileBatchModal}
                onClose={() => setShowMobileBatchModal(false)}
                projectId={projectId}
                onProcessAsExpense={() => {
                    // Not applicable in purchase modal
                    setShowMobileBatchModal(false);
                }}
                onProcessAsPurchase={(photos) => {
                    setShowMobileBatchModal(false);
                    handleBatchPurchasePhotos(photos);
                }}
            />

            {isCostingModalOpen && (
                <CostingModal 
                    isOpen={isCostingModalOpen} 
                    onClose={() => setIsCostingModalOpen(false)} 
                    product={selectedProductForCosting} 
                    projectId={projectId} 
                    productType={0}
                    onProductUpdate={(updated) => {
                        fetchProducts();
                        if (updated) handleLinkProduct(updated);
                        setIsCostingModalOpen(false);
                    }}
                />
            )}

            {/* New Provider Modal */}
            {isNewProviderModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 border border-slate-100 animate-in zoom-in-95 duration-300">
                        <h3 className="text-2xl font-black text-slate-800 mb-2 flex items-center gap-3">
                            <span className="bg-emerald-100 text-emerald-600 p-2 rounded-xl">➕</span> Nuevo Proveedor
                        </h3>
                        <p className="text-xs text-slate-400 font-medium mb-8">El nombre se vinculará automáticamente a la detección actual.</p>
                        
                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre del Proveedor</label>
                                <input 
                                    type="text" 
                                    value={newProviderName}
                                    onChange={(e) => setNewProviderName(e.target.value)}
                                    placeholder="Ej. SAMS CLUB MEXICO"
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                                />
                            </div>

                            <div className="flex items-center justify-between px-2 bg-slate-50 p-5 rounded-2xl border border-slate-100 cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => setEsProveedorGasto(!esProveedorGasto)}>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">¿Es Proveedor de Gasto?</span>
                                    <span className={`text-[10px] font-black tracking-widest transition-colors ${esProveedorGasto ? 'text-emerald-600' : 'text-slate-400'}`}>
                                        {esProveedorGasto ? 'SÍ, ES GASTO' : 'NO ES GASTO'}
                                    </span>
                                </div>
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all border-2 ${esProveedorGasto ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-white border-slate-200 text-transparent'}`}>
                                    <span className="text-lg font-black leading-none">✓</span>
                                </div>
                            </div>
                            
                            <div className="flex gap-4 mt-4">
                                <Button onClick={() => setIsNewProviderModalOpen(false)} variant="secondary" className="flex-1 rounded-2xl font-black uppercase tracking-widest py-4 border-2 border-slate-100">Cancelar</Button>
                                <Button onClick={handleSaveNewProvider} isLoading={isSaving} className="flex-1 rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-widest py-4 shadow-lg shadow-emerald-100">Guardar</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
