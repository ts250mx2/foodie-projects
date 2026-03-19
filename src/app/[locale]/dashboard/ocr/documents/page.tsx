'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import Button from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import QRCode from 'react-qr-code';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';
import CostingModal from '@/components/CostingModal';

function OCRDocumentsContent() {
    const t = useTranslations('OCRDocuments');
    const commonT = useTranslations('Common');
    const navT = useTranslations('Navigation');
    const router = useRouter();
    const params = useParams();
    const locale = params?.locale || 'es';
    const { colors } = useTheme();

    // State
    const [project, setProject] = useState<any>(null);
    const [documents, setDocuments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [editingDocId, setEditingDocId] = useState<number | null>(null);
    const [docToDelete, setDocToDelete] = useState<number | null>(null);
    const [description, setDescription] = useState('');
    const [newFiles, setNewFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'upload' | 'qr'>('upload');

    // Processing State
    const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
    const [processingDoc, setProcessingDoc] = useState<any>(null);
    const [ocrModel, setOcrModel] = useState<'claude-opus-4-6' | 'gpt-4o'>('gpt-4o');
    const [ocrType, setOcrType] = useState<'gasto' | 'compra'>('gasto');
    const [isProcessing, setIsProcessing] = useState(false);
    const [ocrResult, setOcrResult] = useState<any>(null);
    const [providers, setProviders] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedProviderId, setSelectedProviderId] = useState<string>('');
    const [isLinkProviderModalOpen, setIsLinkProviderModalOpen] = useState(false);
    const [isLinkProductModalOpen, setIsLinkProductModalOpen] = useState(false);
    const [linkingConceptIndex, setLinkingConceptIndex] = useState<number | null>(null);
    const [isNewProviderModalOpen, setIsNewProviderModalOpen] = useState(false);
    const [isCostingModalOpen, setIsCostingModalOpen] = useState(false);
    const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
    const [selectedProductForCosting, setSelectedProductForCosting] = useState<any | null>(null);
    const [providerSearchTerm, setProviderSearchTerm] = useState('');
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [paymentChannels, setPaymentChannels] = useState<any[]>([]);
    const [expenseConcepts, setExpenseConcepts] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedPaymentChannelId, setSelectedPaymentChannelId] = useState<string>('');
    const [selectedExpenseConceptId, setSelectedExpenseConceptId] = useState<string>('');
    const [selectedBranchId, setSelectedBranchId] = useState<string>('');
    const [isNewExpenseConceptModalOpen, setIsNewExpenseConceptModalOpen] = useState(false);
    const [ocrRelationships, setOcrRelationships] = useState<{providers: any[], products: any[]}>({ providers: [], products: [] });
    const [newExpenseConceptForm, setNewExpenseConceptForm] = useState({
        conceptoGasto: '',
        referenciaObligatoria: 0,
        idCanalPago: ''
    });
    const [newProviderForm, setNewProviderForm] = useState({
        proveedor: '',
        rfc: '',
        telefonos: '',
        correoElectronico: '',
        calle: '',
        contacto: ''
    });


    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const storedProject = localStorage.getItem('project') || localStorage.getItem('selectedProject');
        if (storedProject) {
            const parsedProject = JSON.parse(storedProject);
            setProject(parsedProject);
            fetchDocuments(parsedProject.idProyecto, startDate, endDate);
        }
    }, [startDate, endDate]);

    const fetchDocuments = async (projectId: number, start: string, end: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/ocr/documents?projectId=${projectId}&startDate=${start}&endDate=${end}`);
            const data = await response.json();
            if (data.success) {
                setDocuments(data.data);
            }
        } catch (error: any) {
            console.error('Error fetching documents:', error);
        } finally {
            setIsLoading(false);
        }
    };



    const handleAddClick = () => {
        setEditingDocId(null);
        setDescription('');
        setNewFiles([]);
        setPreviews([]);
        setIsModalOpen(true);
    };

    const handleEdit = async (docId: number) => {
        try {
            const response = await fetch(`/api/ocr/documents?projectId=${project.idProyecto}&docId=${docId}`);
            const data = await response.json();
            if (data.success) {
                setEditingDocId(docId);
                setDescription(data.data.DocumentoOCR);
                setNewFiles([]);
                const existingPreviews = data.data.details.map((d: any) => `data:image/jpeg;base64,${d.DocumentoOCR}`);
                setPreviews(existingPreviews);
                setIsModalOpen(true);
            } else {
                alert(t('error') + ': ' + data.message);
            }
        } catch (error: any) {
            console.error('Error fetching document detail:', error);
            alert(t('error') + ': ' + error.message);
        }
    };

    const handleProcessClick = async (doc: any) => {
        setIsLoading(true);
        setOcrResult(null);
        try {
            const response = await fetch(`/api/ocr/documents?projectId=${project.idProyecto}&docId=${doc.IdDocumentoOCR}`);
            const data = await response.json();
            if (data.success) {
                setProcessingDoc(data.data);
                setIsProcessModalOpen(true);
                fetchProviders();
                fetchProducts();
                fetchCategories();
                fetchPaymentChannels();
                fetchExpenseConcepts();
                fetchBranches();
                fetchRelationships();
            }
        } catch (error) {
            console.error('Error fetching doc for processing:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPaymentChannels = async () => {
        if (!project) return;
        try {
            const response = await fetch(`/api/payment-channels?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setPaymentChannels(data.data);
            }
        } catch (error) {
            console.error('Error fetching payment channels:', error);
        }
    };

    const fetchExpenseConcepts = async () => {
        if (!project) return;
        try {
            const response = await fetch(`/api/expense-concepts?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setExpenseConcepts(data.data);
            }
        } catch (error) {
            console.error('Error fetching expense concepts:', error);
        }
    };

    const fetchBranches = async () => {
        if (!project) return;
        try {
            const response = await fetch(`/api/branches?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setBranches(data.data);
                if (data.data.length === 1) {
                    setSelectedBranchId(data.data[0].IdSucursal.toString());
                }
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        }
    };

    const fetchRelationships = async () => {
        if (!project) return;
        try {
            const response = await fetch(`/api/ocr/relationships?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setOcrRelationships(data.data);
            }
        } catch (error) {
            console.error('Error fetching OCR relationships:', error);
        }
    };

    const handleRunOCR = async () => {
        if (!processingDoc || !project) return;
        setIsProcessing(true);
        setOcrResult(null);

        try {
            const formData = new FormData();
            formData.append('model', ocrModel);

            // Convert base64 details to Files
            for (const detail of processingDoc.details) {
                const res = await fetch(`data:image/jpeg;base64,${detail.DocumentoOCR}`);
                const blob = await res.blob();
                formData.append('image', blob, `image_${detail.IdDetalleDocumentoOCR}.jpg`);
            }

            const response = await fetch('/api/expenses/process-receipt', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                const extracted = data.data;

                // 💡 Learning-based Auto-Linkage
                // 1. Provider Linkage
                if (extracted.provider) {
                    const matchedProvider = ocrRelationships.providers.find(
                        (p: any) => p.ProveedorOCR.toLowerCase() === extracted.provider.toLowerCase()
                    );
                    if (matchedProvider) {
                        setSelectedProviderId(matchedProvider.IdProveedor.toString());
                    } else {
                        setSelectedProviderId('');
                    }
                }

                // 2. Product Linkage + Audit setup
                const conceptsWithAudit = extracted.concepts.map((c: any) => {
                    const matchedProduct = ocrRelationships.products.find(
                        (p: any) => p.ProductoOCR.toLowerCase() === c.description.toLowerCase()
                    );
                    
                    let productId = null;
                    let productName = '';
                    
                    if (matchedProduct) {
                        productId = matchedProduct.IdProducto;
                        const productInfo = products.find(p => p.IdProducto === productId);
                        productName = productInfo ? productInfo.Producto : 'Producto Vinculado';
                    }

                    return {
                        ...c,
                        originalQuantity: c.quantity,
                        originalPrice: c.price,
                        productId,
                        productName
                    };
                });

                setOcrResult({
                    ...extracted,
                    concepts: conceptsWithAudit
                });
                setIsProcessModalOpen(true);
            } else {
                alert('Error al procesar: ' + data.message);
            }
        } catch (error: any) {
            console.error('OCR Error:', error);
            alert('Error al procesar: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const openDeleteModal = (docId: number) => {
        setDocToDelete(docId);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!docToDelete || !project) return;
        setIsSaving(true);
        try {
            const response = await fetch(`/api/ocr/documents?projectId=${project.idProyecto}&docId=${docToDelete}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                setIsDeleteModalOpen(false);
                setDocToDelete(null);
                fetchDocuments(project.idProyecto, startDate, endDate);
            } else {
                alert(t('error') + ': ' + data.message);
            }
        } catch (error: any) {
            console.error('Error deleting document:', error);
            alert(t('error') + ': ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const fetchProviders = async () => {
        if (!project) return;
        try {
            const response = await fetch(`/api/suppliers?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setProviders(data.data);
            }
        } catch (error) {
            console.error('Error fetching providers:', error);
        }
    };

    const fetchProducts = async () => {
        if (!project) return;
        try {
            const response = await fetch(`/api/products?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setProducts(data.data);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };

    const fetchCategories = async () => {
        if (!project) return;
        try {
            const response = await fetch(`/api/categories?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setCategories(data.data);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const handleCreateExpenseConcept = async () => {
        if (!project || !newExpenseConceptForm.conceptoGasto) return;
        setIsSaving(true);
        try {
            const response = await fetch('/api/expense-concepts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    ...newExpenseConceptForm
                })
            });
            const data = await response.json();
            if (data.success) {
                await fetchExpenseConcepts();
                setSelectedExpenseConceptId(data.id.toString());
                setIsNewExpenseConceptModalOpen(false);
                setNewExpenseConceptForm({
                    conceptoGasto: '',
                    referenciaObligatoria: 0,
                    idCanalPago: ''
                });
            } else {
                alert('Error: ' + data.message);
            }
        } catch (error: any) {
            console.error('Error saving concept:', error);
            alert('Error: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreateProvider = async () => {
        if (!project || !newProviderForm.proveedor) return;
        setIsSaving(true);
        try {
            const url = editingProviderId ? `/api/suppliers/${editingProviderId}` : '/api/suppliers';
            const method = editingProviderId ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    ...newProviderForm
                })
            });
            const data = await response.json();
            if (data.success) {
                await fetchProviders();
                const providerId = editingProviderId || data.id.toString();
                setSelectedProviderId(providerId);
                setIsNewProviderModalOpen(false);
                if (!editingProviderId) {
                    setIsLinkProviderModalOpen(false);
                }
                setEditingProviderId(null);
            } else {
                alert('Error: ' + data.message);
            }
        } catch (error: any) {
            console.error('Error saving provider:', error);
            alert('Error: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRegisterDoc = async () => {
        if (!ocrResult || !project || !processingDoc) return;

        // 1. Mandatory Provider
        if (!selectedProviderId) {
            alert("Debe vincular un proveedor del catálogo.");
            return;
        }

        // 2. Mandatory Ticket #
        if (!ocrResult.ticketNumber || ocrResult.ticketNumber.trim() === '') {
            alert("El número de ticket/recibo es obligatorio.");
            return;
        }

        // 3. Valid Date
        if (!ocrResult.date || isNaN(new Date(ocrResult.date).getTime())) {
            alert("La fecha del recibo no es válida.");
            return;
        }

        // 4. Mandatory Payment Channel
        if (!selectedPaymentChannelId) {
            alert("El canal de pago es obligatorio.");
            return;
        }

        // 5. Mandatory Branch
        if (!selectedBranchId) {
            alert("La sucursal es obligatoria.");
            return;
        }

        // 6. Mandatory Expense Concept (if gasto)
        if (ocrType === 'gasto' && !selectedExpenseConceptId) {
            alert("El concepto de gasto es obligatorio.");
            return;
        }

        // 7. Product Linkage (if compra)
        if (ocrType === 'compra') {
            const unlinked = ocrResult.concepts.filter((c: any) => !c.productId);
            if (unlinked.length > 0) {
                alert(`Faltan ${unlinked.length} productos por vincular al catálogo.`);
                return;
            }
        }

        // 8. Date Age Warning
        const receiptDate = new Date(ocrResult.date);
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        if (receiptDate < oneMonthAgo) {
            if (!confirm("⚠️ La fecha tiene más de un mes de antigüedad. ¿Registrar de todos modos?")) return;
        }

        // Proceed to API
        setIsSaving(true);
        try {
            const response = await fetch('/api/ocr/register-transaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    ocrType,
                    batchId: processingDoc.IdDocumentoOCR,
                    selectedProviderId,
                    selectedPaymentChannelId,
                    selectedBranchId,
                    selectedExpenseConceptId,
                    ocrResult,
                    providerName: providers.find(p => p.IdProveedor.toString() === selectedProviderId)?.Proveedor
                })
            });

            const data = await response.json();
            if (data.success) {
                alert(`¡${ocrType === 'compra' ? 'Compra' : 'Gasto'} registrado exitosamente!`);
                setIsProcessModalOpen(false);
                setOcrResult(null);
                fetchDocuments(project.idProyecto, startDate, endDate);
            } else {
                alert("Error al registrar: " + data.message);
            }
        } catch (error: any) {
            console.error("Registration error:", error);
            alert("Error de conexión al registrar la transacción.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditProvider = (provider: any) => {
        setEditingProviderId(provider.IdProveedor.toString());
        setNewProviderForm({
            proveedor: provider.Proveedor,
            rfc: provider.RFC || '',
            telefonos: provider.Telefonos || '',
            correoElectronico: provider.CorreoElectronico || '',
            calle: provider.Calle || '',
            contacto: provider.Contacto || ''
        });
        setIsNewProviderModalOpen(true);
    };

    const handleRelateProvider = (p: any) => {
        setSelectedProviderId(p.IdProveedor.toString());
        setIsLinkProviderModalOpen(false);
    };

    const handleUpdateConcept = (index: number, field: string, value: any) => {
        const newConcepts = [...ocrResult.concepts];
        newConcepts[index] = { ...newConcepts[index], [field]: value };
        setOcrResult({ ...ocrResult, concepts: newConcepts });
    };

    const handleLinkProduct = (product: any) => {
        if (linkingConceptIndex === null) return;
        const newConcepts = [...ocrResult.concepts];
        newConcepts[linkingConceptIndex] = { 
            ...newConcepts[linkingConceptIndex], 
            productId: product.IdProducto,
            productName: product.Producto
        };
        setOcrResult({ ...ocrResult, concepts: newConcepts });
        setIsLinkProductModalOpen(false);
        setLinkingConceptIndex(null);
    };

    const handleEditProduct = (p: any) => {
        setSelectedProductForCosting(p);
        setIsCostingModalOpen(true);
    };

    const handleProductUpdate = (updatedProduct?: any, shouldClose = true) => {
        fetchProducts();
        if (shouldClose) {
            setIsCostingModalOpen(false);
            if (updatedProduct && !selectedProductForCosting?.IdProducto) {
                // It was a "New Product" creation (IdProducto was 0 or null)
                // Auto-link it
                handleLinkProduct(updatedProduct);
            }
            setSelectedProductForCosting(null);
        }
    };

    const openNewProviderModal = () => {
        setEditingProviderId(null);
        setNewProviderForm({
            proveedor: ocrResult?.provider || '',
            rfc: '',
            telefonos: '',
            correoElectronico: '',
            calle: '',
            contacto: ''
        });
        setIsNewProviderModalOpen(true);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setNewFiles(prev => [...prev, ...files]);
            const newPreviews = files.map(file => URL.createObjectURL(file));
            setPreviews(prev => [...prev, ...newPreviews]);
        }
    };

    const removeFile = (index: number) => {
        const previewToRemove = previews[index];
        setPreviews(prev => prev.filter((_, i) => i !== index));
        if (previewToRemove.startsWith('blob:')) {
            const blobIndex = previews.slice(0, index).filter(p => p.startsWith('blob:')).length;
            setNewFiles(prev => prev.filter((_, i) => i !== blobIndex));
        }
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
        if (!project) return;
        if (!description || previews.length === 0) {
            alert('Por favor ingrese una descripción y seleccione al menos un documento.');
            return;
        }

        setIsSaving(true);
        try {
            let blobCount = 0;
            const finalDocuments = await Promise.all(previews.map(async (p) => {
                if (p.startsWith('data:')) {
                    return p.split(',')[1];
                } else if (p.startsWith('blob:')) {
                    const file = newFiles[blobCount++];
                    return await fileToBase64(file);
                }
                return '';
            }));

            const url = '/api/ocr/documents';
            const method = editingDocId ? 'PUT' : 'POST';
            const body = {
                projectId: project.idProyecto,
                docId: editingDocId,
                description,
                documents: finalDocuments
            };

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();
            if (data.success) {
                setIsModalOpen(false);
                setDescription('');
                setNewFiles([]);
                setPreviews([]);
                fetchDocuments(project.idProyecto, startDate, endDate);
            } else {
                alert(t('error') + ': ' + (data.message || ''));
            }
        } catch (error: any) {
            console.error('Error saving documents:', error);
            alert(t('error') + ': ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const filteredDocuments = documents.filter(doc => 
        doc.DocumentoOCR.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const qrValue = typeof window !== 'undefined' && project
        ? `${window.location.origin}/${locale}/ocr/upload?projectId=${project.idProyecto}&projectName=${encodeURIComponent(project.Nombre)}`
        : '';

    return (
        <div className="p-6">
            {/* Minimalist Header matched with Products page */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">{t('title')}</h1>
                    <p className="text-sm text-gray-500 font-medium">{navT('ocrProcessing')}</p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                    <Button onClick={handleAddClick}>
                        ➕ {t('addDocument')}
                    </Button>
                    <div className="flex gap-2">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-tight">{t('startDate')}</span>
                            <input 
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-orange-500 outline-none"
                            />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-tight">{t('endDate')}</span>
                            <input 
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-orange-500 outline-none"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid matched with Products page */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <ThemedGridHeader>
                        <ThemedGridHeaderCell className="w-20">{t('id')}</ThemedGridHeaderCell>
                        <ThemedGridHeaderCell className="w-32 text-center">Documentos</ThemedGridHeaderCell>
                        <ThemedGridHeaderCell>
                            <div className="flex flex-col gap-1">
                                <span>{t('description')}</span>
                                <input
                                    type="text"
                                    placeholder="🔍 Buscar..."
                                    className="px-2 py-1 text-xs border border-white/30 rounded font-normal text-gray-700 bg-white/90 outline-none focus:ring-2 focus:ring-white/50"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell className="w-40">{t('creationDate')}</ThemedGridHeaderCell>
                        <ThemedGridHeaderCell className="text-right w-40">{t('actions')}</ThemedGridHeaderCell>
                    </ThemedGridHeader>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {isLoading ? (
                            Array(5).fill(0).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-8"></div></td>
                                    <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-full"></div></td>
                                    <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-24 ml-auto"></div></td>
                                </tr>
                            ))
                        ) : filteredDocuments.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-6 py-12 text-center text-gray-400 italic">
                                    No se encontraron documentos.
                                </td>
                            </tr>
                        ) : (
                            filteredDocuments.map((doc) => (
                                <tr key={doc.IdDocumentoOCR} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-gray-400">
                                        #{doc.IdDocumentoOCR}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        {doc.FirstImage ? (
                                            <div 
                                                className="relative w-14 h-14 mx-auto rounded-xl overflow-hidden cursor-zoom-in group shadow-sm border border-gray-100 active:scale-95 transition-all"
                                                onClick={() => setSelectedImage(`data:image/jpeg;base64,${doc.FirstImage}`)}
                                            >
                                                <img 
                                                    src={`data:image/jpeg;base64,${doc.FirstImage}`} 
                                                    alt="Preview" 
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" 
                                                />
                                                {doc.TotalCount > 1 && (
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-[10px] font-black tracking-tighter">
                                                        +{doc.TotalCount - 1}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-gray-300">🚫</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">
                                        {doc.DocumentoOCR}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                                        {doc.FechaAct ? new Date(doc.FechaAct).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button 
                                            onClick={() => handleProcessClick(doc)}
                                            className="text-xl mr-4 hover:scale-125 transition-transform"
                                            title={t('process')}
                                        >
                                            ⚙️
                                        </button>
                                        <button 
                                            onClick={() => handleEdit(doc.IdDocumentoOCR)}
                                            className="text-xl mr-4 hover:scale-125 transition-transform"
                                            title={t('edit')}
                                        >
                                            ✏️
                                        </button>
                                        <button 
                                            onClick={() => openDeleteModal(doc.IdDocumentoOCR)}
                                            className="text-xl hover:scale-125 transition-transform"
                                            title={t('deleteDocument')}
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal for Adding/Editing Documents */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50">
                            <h2 className="text-xl font-bold text-gray-800">{editingDocId ? 'Editar Lote de Documentos' : t('addDocument')}</h2>
                            <button onClick={() => { setIsModalOpen(false); if (activeTab === 'qr' && project) fetchDocuments(project.idProyecto, startDate, endDate); }} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors">✕</button>
                        </div>
                        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">{t('description')}</label>
                                <input 
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Ej: Facturas Proveedor X - Marzo 2024"
                                    className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 transition-all font-bold"
                                />
                            </div>
                            <div className="flex gap-4 border-b border-gray-100 text-sm font-bold">
                                <button onClick={() => setActiveTab('upload')} className={`pb-3 px-4 transition-all border-b-2 ${activeTab === 'upload' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-400'}`}>📥 Subir Archivos</button>
                                <button onClick={() => setActiveTab('qr')} className={`pb-3 px-4 transition-all border-b-2 ${activeTab === 'qr' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-400'}`}>📱 Código QR</button>
                            </div>
                            {activeTab === 'upload' ? (
                                <div className="space-y-6">
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-gray-200 rounded-3xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-all"
                                    >
                                        <span className="text-5xl">📄</span>
                                        <p className="font-bold text-gray-500 text-center">{t('dropFiles')}</p>
                                        <input type="file" ref={fileInputRef} multiple accept="image/*" onChange={handleFileChange} className="hidden" />
                                    </div>
                                    {previews.length > 0 && (
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {previews.map((src, idx) => (
                                                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group cursor-zoom-in">
                                                    <img 
                                                        src={src} 
                                                        alt="Preview" 
                                                        className="w-full h-full object-cover" 
                                                        onClick={() => setSelectedImage(src)}
                                                    />
                                                    <button onClick={() => removeFile(idx)} className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-4 py-6">
                                    <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                                        <QRCode value={qrValue} size={180} />
                                    </div>
                                    <p className="text-gray-500 text-sm text-center font-medium max-w-xs">Escanea el código para subir desde tu celular.</p>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
                            <Button onClick={() => { setIsModalOpen(false); if (activeTab === 'qr' && project) fetchDocuments(project.idProyecto, startDate, endDate); }} variant="secondary">{commonT('cancel')}</Button>
                            <Button onClick={handleSave} disabled={isSaving}>{isSaving ? commonT('loading') : commonT('save')}</Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Process Modal */}
            {isProcessModalOpen && processingDoc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200" style={{ maxHeight: '90vh' }}>
                        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Procesar Lote de Documentos</h2>
                                <p className="text-xs text-gray-500 font-bold uppercase">{processingDoc.DocumentoOCR}</p>
                            </div>
                            <button onClick={() => setIsProcessModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors">✕</button>
                        </div>
                        
                        <div className="flex-1 flex flex-col min-h-0 p-8 overflow-hidden">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 min-h-0">
                                {/* Left: Images & Options */}
                                <div className="lg:col-span-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Documentos en el Lote</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {processingDoc.details.map((detail: any, idx: number) => (
                                                <div 
                                                    key={idx} 
                                                    className="aspect-square rounded-lg overflow-hidden border border-gray-100 cursor-zoom-in hover:border-orange-400 transition-colors"
                                                    onClick={() => setSelectedImage(`data:image/jpeg;base64,${detail.DocumentoOCR}`)}
                                                >
                                                    <img src={`data:image/jpeg;base64,${detail.DocumentoOCR}`} alt="Doc" className="w-full h-full object-cover" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 space-y-6">
                                        <div className="space-y-3">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Modelo de IA</label>
                                            <div className="flex gap-2">
                                                {['gpt-4o', 'claude-opus-4-6'].map(m => (
                                                    <button
                                                        key={m}
                                                        onClick={() => setOcrModel(m as any)}
                                                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all border-2 ${
                                                            ocrModel === m 
                                                            ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-sm' 
                                                            : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                                                        }`}
                                                    >
                                                        {m === 'gpt-4o' ? '🤖 GPT-4o' : '🧠 Claude'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Tipo de Registro</label>
                                            <div className="flex gap-2">
                                                {[
                                                    { id: 'gasto', label: '💸 Gasto', color: 'red' },
                                                    { id: 'compra', label: '📦 Compra MP', color: 'blue' }
                                                ].map(t => (
                                                    <button
                                                        key={t.id}
                                                        onClick={() => setOcrType(t.id as any)}
                                                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all border-2 ${
                                                            ocrType === t.id 
                                                            ? `border-${t.color}-500 bg-${t.color}-50 text-${t.color}-700 shadow-sm` 
                                                            : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                                                        }`}
                                                    >
                                                        {t.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <Button 
                                            onClick={handleRunOCR} 
                                            disabled={isProcessing} 
                                            className="w-full py-4 text-base font-black shadow-xl"
                                        >
                                            {isProcessing ? (
                                                <span className="flex items-center justify-center gap-3">
                                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    PROCESANDO...
                                                </span>
                                            ) : '🚀 INICIAR PROCESAMIENTO'}
                                        </Button>
                                    </div>
                                </div>

                                {/* Right: Result Area */}
                                <div className="lg:col-span-2 bg-white rounded-3xl p-8 border-2 border-dashed border-gray-100 flex flex-col relative overflow-y-auto custom-scrollbar h-full min-h-0">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                        <span className="text-[120px] font-black text-gray-900 leading-none">OCR</span>
                                    </div>
                                    
                                    {!ocrResult && !isProcessing && (
                                        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                                            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center text-5xl shadow-inner italic border-4 border-white">✨</div>
                                            <div>
                                                <p className="text-gray-900 font-black text-2xl tracking-tighter">Listo para Extraer</p>
                                                <p className="max-w-[300px] text-sm font-medium text-gray-400 mt-2">Nuestra IA está lista para leer tus documentos y extraer proveedores, conceptos y totales automáticamente.</p>
                                            </div>
                                        </div>
                                    )}

                                    {isProcessing && (
                                        <div className="flex-1 flex flex-col items-center justify-center space-y-8">
                                            <div className="relative">
                                                <div className="w-32 h-32 border-8 border-orange-500/20 rounded-full animate-ping"></div>
                                                <div className="absolute inset-0 flex items-center justify-center text-6xl animate-bounce">🌩️</div>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-3xl font-black tracking-tighter text-gray-900 uppercase">Procesando Inteligencia AI</p>
                                                <p className="text-sm font-bold text-gray-400 mt-2 leading-relaxed">Identificando proveedor, analizando conceptos<br/>y validando importes totales...</p>
                                                <div className="flex justify-center gap-2 mt-6">
                                                    {[0, 1, 2].map(i => (
                                                        <div key={i} className="w-3 h-3 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}></div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {ocrResult && (
                                        <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-500 min-h-0">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-4">
                                                    <div>
                                                        <label className="text-[10px] font-black tracking-widest text-orange-600 uppercase">Proveedor Identificado por AI</label>
                                                        <div className="text-2xl font-black text-gray-900 mt-1 truncate group flex items-center gap-2">
                                                            <span>{ocrResult.provider || 'No detectado'}</span>
                                                            {!selectedProviderId && <span className="text-xs text-orange-400 animate-pulse">⚠️ No vinculado</span>}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="space-y-3 pt-2">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Vinculado a</label>
                                                            <button 
                                                                onClick={() => setIsLinkProviderModalOpen(true)}
                                                                className="text-[10px] font-black text-orange-600 hover:text-orange-700 underline uppercase tracking-widest"
                                                            >
                                                                {selectedProviderId ? 'Cambiar Vínculo' : 'Relacionar ahora'}
                                                            </button>
                                                        </div>

                                                        {selectedProviderId ? (
                                                            <div className="bg-orange-100/50 p-3 rounded-xl border border-orange-200 animate-in fade-in zoom-in-95 duration-200">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xl">✅</span>
                                                                    <div>
                                                                        <p className="text-[10px] font-black text-orange-800 uppercase leading-none">Relacionado a:</p>
                                                                        <p className="text-sm font-black text-gray-900 mt-1">
                                                                            {providers.find(p => p.IdProveedor.toString() === selectedProviderId)?.Proveedor || 'Proveedor seleccionado'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div 
                                                                onClick={() => setIsLinkProviderModalOpen(true)}
                                                                className="bg-gray-100 p-3 rounded-xl border border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors"
                                                            >
                                                                <span className="text-xs font-bold text-gray-400">Haga clic para vincular proveedor</span>
                                                            </div>
                                                        )}
                                                        
                                                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200/50">
                                                            <div>
                                                                <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase"># Ticket / Recibo</label>
                                                                <input 
                                                                    type="text"
                                                                    value={ocrResult.ticketNumber || ''}
                                                                    onChange={(e) => setOcrResult({ ...ocrResult, ticketNumber: e.target.value })}
                                                                    className="w-full mt-1 p-2 bg-white border border-gray-200 rounded-md text-sm font-bold text-gray-800 focus:ring-1 focus:ring-orange-500 outline-none"
                                                                    placeholder="Ej: 123456"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Fecha del Recibo</label>
                                                                <input 
                                                                    type="date"
                                                                    value={ocrResult.date || ''}
                                                                    onChange={(e) => setOcrResult({ ...ocrResult, date: e.target.value })}
                                                                    className="w-full mt-1 p-2 bg-white border border-gray-200 rounded-md text-sm font-bold text-gray-800 focus:ring-1 focus:ring-orange-500 outline-none"
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                                            <div>
                                                                <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Canal de Pago *</label>
                                                                <select 
                                                                    value={selectedPaymentChannelId}
                                                                    onChange={(e) => setSelectedPaymentChannelId(e.target.value)}
                                                                    className="w-full mt-1 p-2 bg-white border border-gray-200 rounded-md text-sm font-bold text-gray-800 focus:ring-1 focus:ring-orange-500 outline-none"
                                                                >
                                                                    <option value="">Seleccionar...</option>
                                                                    {paymentChannels.map(cp => (
                                                                        <option key={cp.IdCanalPago} value={cp.IdCanalPago}>{cp.CanalPago}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Sucursal *</label>
                                                                <select 
                                                                    value={selectedBranchId}
                                                                    onChange={(e) => setSelectedBranchId(e.target.value)}
                                                                    className="w-full mt-1 p-2 bg-white border border-gray-200 rounded-md text-sm font-bold text-gray-800 focus:ring-1 focus:ring-orange-500 outline-none"
                                                                >
                                                                    <option value="">Seleccionar...</option>
                                                                    {branches.map(s => (
                                                                        <option key={s.IdSucursal} value={s.IdSucursal}>{s.Sucursal}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>

                                                        {ocrType === 'gasto' && (
                                                            <div className="pt-2">
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Concepto de Gasto *</label>
                                                                    <button 
                                                                        onClick={() => setIsNewExpenseConceptModalOpen(true)}
                                                                        className="text-[10px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-tighter"
                                                                    >
                                                                        + Nuevo Concepto
                                                                    </button>
                                                                </div>
                                                                <select 
                                                                    value={selectedExpenseConceptId}
                                                                    onChange={(e) => setSelectedExpenseConceptId(e.target.value)}
                                                                    className="w-full p-2 bg-white border border-gray-200 rounded-md text-sm font-bold text-gray-800 focus:ring-1 focus:ring-orange-500 outline-none"
                                                                >
                                                                    <option value="">Seleccionar...</option>
                                                                    {expenseConcepts.map(c => (
                                                                        <option key={c.IdConceptoGasto} value={c.IdConceptoGasto}>{c.ConceptoGasto}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100 flex flex-col justify-center">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-xs font-black text-orange-800 uppercase tracking-widest">Total Extraído</span>
                                                        <div className="bg-orange-200 text-orange-800 px-2 py-0.5 rounded text-[10px] font-black uppercase">OCR Verificado</div>
                                                    </div>
                                                    <div className="relative group">
                                                        <div className="text-5xl font-black text-orange-600 tracking-tighter">
                                                            {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(ocrResult.total)}
                                                        </div>
                                                        <input 
                                                            type="number"
                                                            step="0.01"
                                                            value={ocrResult.total}
                                                            onChange={(e) => setOcrResult({ ...ocrResult, total: parseFloat(e.target.value) || 0 })}
                                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                                            title="Editar Total"
                                                        />
                                                        <div className="absolute right-0 top-0 text-[10px] font-bold text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity">Click para editar total</div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-6 pr-2">
                                                <table className="w-full text-left">
                                                    <thead className="sticky top-0 bg-white z-10">
                                                        <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                                            <th className="py-2">Concepto</th>
                                                            {ocrType === 'compra' && <th className="py-2">Producto Relacionado</th>}
                                                            <th className="py-2 text-center w-20">Cant</th>
                                                            <th className="py-2 text-right w-24">Precio</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50">
                                                        {ocrResult.concepts?.map((c: any, i: number) => {
                                                            const isQuantityChanged = c.quantity !== c.originalQuantity;
                                                            const isPriceChanged = Number(c.price) !== Number(c.originalPrice);
                                                            
                                                            return (
                                                                <tr key={i} className="text-sm hover:bg-gray-50/50 transition-colors">
                                                                    <td className="py-3 font-bold text-gray-700">
                                                                        <div className="flex flex-col">
                                                                            <span>{c.description}</span>
                                                                            {ocrType === 'compra' && !c.productId && (
                                                                                <span className="text-[10px] text-orange-400 font-black uppercase mt-1">⚠️ Sin vincular</span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    {ocrType === 'compra' && (
                                                                        <td className="py-3">
                                                                            <button 
                                                                                onClick={() => { setLinkingConceptIndex(i); setIsLinkProductModalOpen(true); }}
                                                                                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                                                                                    c.productName 
                                                                                    ? 'bg-blue-50 border-blue-200 text-blue-700' 
                                                                                    : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-blue-400 hover:text-blue-600'
                                                                                }`}
                                                                            >
                                                                                {c.productName || '🔗 Vincular Producto'}
                                                                            </button>
                                                                        </td>
                                                                    )}
                                                                    <td className="py-3 text-center">
                                                                        <div className="relative group inline-block">
                                                                            <input 
                                                                                type="number"
                                                                                step="0.01"
                                                                                value={c.quantity}
                                                                                onChange={(e) => handleUpdateConcept(i, 'quantity', parseFloat(e.target.value) || 0)}
                                                                                className={`w-16 p-1 text-center bg-white border rounded-md text-sm font-black transition-all outline-none ${
                                                                                    isQuantityChanged 
                                                                                    ? 'border-orange-500 text-orange-600 ring-1 ring-orange-500/20' 
                                                                                    : 'border-gray-200 text-gray-800 focus:border-orange-500'
                                                                                }`}
                                                                            />
                                                                            {isQuantityChanged && (
                                                                                <span className="absolute -top-2 -right-2 text-[10px] leading-none" title={`Original: ${c.originalQuantity}`}>⚠️</span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-3 text-right">
                                                                        <div className="relative group inline-block">
                                                                            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                                                            <input 
                                                                                type="number"
                                                                                step="0.01"
                                                                                value={c.price}
                                                                                onChange={(e) => handleUpdateConcept(i, 'price', parseFloat(e.target.value) || 0)}
                                                                                className={`w-20 pl-4 pr-1 py-1 text-right bg-white border rounded-md text-sm font-black transition-all outline-none ${
                                                                                    isPriceChanged 
                                                                                    ? 'border-orange-500 text-orange-600 ring-1 ring-orange-500/20' 
                                                                                    : 'border-gray-200 text-gray-800 focus:border-orange-500'
                                                                                }`}
                                                                            />
                                                                            {isPriceChanged && (
                                                                                <span className="absolute -top-2 -right-2 text-[10px] leading-none" title={`Original: ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(c.originalPrice)}`}>⚠️</span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div className="mt-6 flex gap-3">
                                                <Button 
                                                    variant="primary"
                                                    className="flex-1 py-4 flex items-center justify-center gap-3 font-black shadow-lg"
                                                    onClick={handleRegisterDoc}
                                                    disabled={isSaving}
                                                >
                                                    <span>{isSaving ? 'REGISTRANDO...' : `REGISTRAR ${ocrType.toUpperCase()}`}</span>
                                                    <span className="text-lg">➜</span>
                                                </Button>
                                                <button 
                                                    className="w-14 h-14 bg-gray-100 text-gray-400 rounded-xl flex items-center justify-center hover:bg-gray-200 transition-all active:scale-95"
                                                    onClick={() => setOcrResult(null)}
                                                    title="Limpiar"
                                                >
                                                    <span className="text-xl">🔄</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal matched with Products page */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-sm:w-[90%] max-w-sm shadow-xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{t('deleteDocument')}</h3>
                        <p className="text-gray-500 mb-6">{t('confirmDelete')}</p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors font-bold"
                            >
                                {commonT('cancel')}
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isSaving}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors shadow-sm font-bold flex items-center gap-2"
                            >
                                {isSaving ? '...' : t('deleteDocument')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Lightbox Modal */}
            {selectedImage && (
                <div 
                    className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300"
                    onClick={() => setSelectedImage(null)}
                >
                    <button 
                        className="absolute top-6 right-6 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl transition-all"
                        onClick={() => setSelectedImage(null)}
                    >
                        ✕
                    </button>
                    <div className="relative max-w-5xl max-h-[90vh] w-full h-full flex items-center justify-center animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <img 
                            src={selectedImage} 
                            alt="Full view" 
                            className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                        />
                    </div>
                </div>
            )}
            {/* Link Provider Modal */}
            {isLinkProviderModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" style={{ maxHeight: '85vh' }}>
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-black text-gray-900 tracking-tight">Buscar en Catálogo Oficial</h3>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Catálogo</p>
                            </div>
                            <button onClick={() => setIsLinkProviderModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors">✕</button>
                        </div>
                        
                        <div className="p-6 border-b border-gray-100 flex flex-wrap gap-4 items-center justify-between">
                            <div className="relative flex-1 min-w-[300px]">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                                <input 
                                    type="text"
                                    placeholder="Buscar por RFC, Proveedor, Teléfono o Correo..."
                                    value={providerSearchTerm}
                                    onChange={(e) => setProviderSearchTerm(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold text-gray-800 focus:bg-white focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                                />
                            </div>
                            <Button onClick={openNewProviderModal} className="bg-gray-900 hover:bg-black font-black flex items-center gap-2">
                                <span>➕</span> Nuevo Proveedor
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <table className="w-full text-left">
                                <thead className="sticky top-0 bg-white z-10">
                                    <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                        <th className="px-4 py-3">RFC</th>
                                        <th className="px-4 py-3">Proveedor</th>
                                        <th className="px-4 py-3">Teléfonos</th>
                                        <th className="px-4 py-3">Correo</th>
                                        <th className="px-4 py-3 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {providers.filter(p => 
                                        p.Proveedor.toLowerCase().includes(providerSearchTerm.toLowerCase()) ||
                                        (p.RFC || '').toLowerCase().includes(providerSearchTerm.toLowerCase()) ||
                                        (p.CorreoElectronico || '').toLowerCase().includes(providerSearchTerm.toLowerCase())
                                    ).map(p => (
                                        <tr key={p.IdProveedor} className="group hover:bg-orange-50 transition-colors">
                                            <td className="px-4 py-4 text-xs font-black text-gray-400">{p.RFC || '-'}</td>
                                            <td className="px-4 py-4 font-black text-gray-900">{p.Proveedor}</td>
                                            <td className="px-4 py-4 text-xs font-bold text-gray-500">{p.Telefonos || '-'}</td>
                                            <td className="px-4 py-4 text-[10px] font-bold text-gray-500">{p.CorreoElectronico || '-'}</td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="flex justify-end items-center gap-2">
                                                    <button 
                                                        onClick={() => handleEditProvider(p)}
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-400 hover:text-orange-500 transition-all font-bold"
                                                        title="Editar Proveedor"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button 
                                                        onClick={() => handleRelateProvider(p)}
                                                        className="px-3 py-1.5 bg-white border-2 border-orange-500 text-orange-600 rounded-lg text-xs font-black uppercase hover:bg-orange-500 hover:text-white transition-all transform group-hover:scale-105"
                                                    >
                                                        Relacionar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {providers.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-20 text-center font-black text-gray-400 italic">CARGANDO PROVEEDORES...</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Link Product Modal */}
            {isLinkProductModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-4xl max-h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">Vincular Producto</h3>
                                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Concepto: {linkingConceptIndex !== null ? ocrResult.concepts[linkingConceptIndex].description : ''}</p>
                            </div>
                            <button onClick={() => setIsLinkProductModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors">✕</button>
                        </div>

                        <div className="p-6 border-b border-gray-100 flex flex-wrap gap-4 items-center justify-between bg-white">
                            <div className="relative flex-1 min-w-[300px]">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                                <input 
                                    type="text"
                                    placeholder="Buscar por nombre o código de producto..."
                                    value={productSearchTerm}
                                    onChange={(e) => setProductSearchTerm(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                />
                            </div>
                            <Button onClick={() => {
                                setSelectedProductForCosting({
                                    IdProducto: 0,
                                    Producto: ocrResult.concepts[linkingConceptIndex || 0].description,
                                    Codigo: '',
                                    Precio: ocrResult.concepts[linkingConceptIndex || 0].price,
                                    IVA: 0,
                                    IdTipoProducto: 0, // Raw Material
                                    Status: 0,
                                    CantidadCompra: 1
                                });
                                setIsCostingModalOpen(true);
                            }} className="bg-gray-900 hover:bg-black font-black flex items-center gap-2">
                                <span>➕</span> Nuevo Producto
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <table className="w-full text-left">
                                <thead className="sticky top-0 bg-white z-10">
                                    <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                        <th className="px-4 py-3">Código</th>
                                        <th className="px-4 py-3">Producto</th>
                                        <th className="px-4 py-3">Categoría</th>
                                        <th className="px-4 py-3 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {products.filter(p => 
                                        p.Producto.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                                        (p.Codigo || '').toLowerCase().includes(productSearchTerm.toLowerCase())
                                    ).map(p => (
                                        <tr key={p.IdProducto} className="group hover:bg-blue-50 transition-colors">
                                            <td className="px-4 py-4 text-xs font-black text-gray-400">{p.Codigo || '-'}</td>
                                            <td className="px-4 py-4 font-black text-gray-900">{p.Producto}</td>
                                            <td className="px-4 py-4 text-xs font-bold text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <span>{p.ImagenCategoria}</span>
                                                    <span>{p.Categoria || '-'}</span>
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="flex justify-end items-center gap-2">
                                                    <button 
                                                        onClick={() => handleEditProduct(p)}
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-400 hover:text-blue-500 transition-all font-bold"
                                                        title="Editar Producto"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button 
                                                        onClick={() => handleLinkProduct(p)}
                                                        className="px-3 py-1.5 bg-white border-2 border-blue-500 text-blue-600 rounded-lg text-xs font-black uppercase hover:bg-blue-500 hover:text-white transition-all transform group-hover:scale-105"
                                                    >
                                                        Vincular
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {products.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="py-20 text-center font-black text-gray-400 italic">CARGANDO PRODUCTOS...</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Advanced Costing Modal */}
            {isCostingModalOpen && (
                <CostingModal
                    isOpen={isCostingModalOpen}
                    onClose={() => {
                        setIsCostingModalOpen(false);
                        setSelectedProductForCosting(null);
                    }}
                    onProductUpdate={handleProductUpdate}
                    productType={0}
                    projectId={project?.idProyecto}
                    product={selectedProductForCosting}
                    zIndexClass="z-[80]"
                />
            )}
            {/* New Provider Modal */}
            {isNewProviderModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-900 text-white">
                            <div>
                                <h3 className="text-xl font-black tracking-tight">{editingProviderId ? 'Editar Proveedor' : 'Nuevo Registro'}</h3>
                                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">{editingProviderId ? 'Actualizar Datos' : 'Crear Proveedor'}</p>
                            </div>
                            <button onClick={() => setIsNewProviderModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">✕</button>
                        </div>
                        
                        <div className="p-8 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nombre del Proveedor</label>
                                <input 
                                    type="text"
                                    value={newProviderForm.proveedor}
                                    onChange={(e) => setNewProviderForm({...newProviderForm, proveedor: e.target.value})}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-black text-gray-800 focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">RFC</label>
                                    <input 
                                        type="text"
                                        value={newProviderForm.rfc}
                                        onChange={(e) => setNewProviderForm({...newProviderForm, rfc: e.target.value})}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-orange-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Teléfono</label>
                                    <input 
                                        type="text"
                                        value={newProviderForm.telefonos}
                                        onChange={(e) => setNewProviderForm({...newProviderForm, telefonos: e.target.value})}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-orange-500 outline-none"
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cuerreo Electrónico</label>
                                <input 
                                    type="email"
                                    value={newProviderForm.correoElectronico}
                                    onChange={(e) => setNewProviderForm({...newProviderForm, correoElectronico: e.target.value})}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button 
                                    onClick={() => setIsNewProviderModalOpen(false)}
                                    className="flex-1 py-4 bg-gray-100 text-gray-400 rounded-xl font-black hover:bg-gray-200 transition-all uppercase tracking-widest text-xs"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleCreateProvider}
                                    disabled={isSaving}
                                    className="flex-[2] py-4 bg-orange-500 text-white rounded-xl font-black shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-all uppercase tracking-widest text-xs disabled:opacity-50"
                                >
                                    {isSaving ? 'Guardando...' : (editingProviderId ? 'Actualizar' : 'Guardar Proveedor')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* New Expense Concept Modal */}
            {isNewExpenseConceptModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-blue-900 text-white">
                            <div>
                                <h3 className="text-xl font-black tracking-tight">Nuevo Concepto</h3>
                                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Catálogo de Gastos</p>
                            </div>
                            <button onClick={() => setIsNewExpenseConceptModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">✕</button>
                        </div>
                        
                        <div className="p-8 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nombre del Concepto</label>
                                <input 
                                    type="text"
                                    value={newExpenseConceptForm.conceptoGasto}
                                    onChange={(e) => setNewExpenseConceptForm({...newExpenseConceptForm, conceptoGasto: e.target.value})}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-black text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Ej: Mantenimiento Local"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Canal de Pago Sugerido</label>
                                <select 
                                    value={newExpenseConceptForm.idCanalPago}
                                    onChange={(e) => setNewExpenseConceptForm({...newExpenseConceptForm, idCanalPago: e.target.value})}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">Ninguno</option>
                                    {paymentChannels.map(cp => (
                                        <option key={cp.IdCanalPago} value={cp.IdCanalPago}>{cp.CanalPago}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input 
                                    type="checkbox"
                                    id="refOblig"
                                    checked={newExpenseConceptForm.referenciaObligatoria === 1}
                                    onChange={(e) => setNewExpenseConceptForm({...newExpenseConceptForm, referenciaObligatoria: e.target.checked ? 1 : 0})}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                />
                                <label htmlFor="refOblig" className="text-xs font-bold text-gray-600 cursor-pointer italic">Referencia obligatoria al registrar</label>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button 
                                    onClick={() => setIsNewExpenseConceptModalOpen(false)}
                                    className="flex-1 py-4 bg-gray-100 text-gray-400 rounded-xl font-black hover:bg-gray-200 transition-all uppercase tracking-widest text-xs"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleCreateExpenseConcept}
                                    disabled={isSaving || !newExpenseConceptForm.conceptoGasto}
                                    className="flex-[2] py-4 bg-blue-600 text-white rounded-xl font-black shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all uppercase tracking-widest text-xs disabled:opacity-50"
                                >
                                    {isSaving ? 'Guardando...' : 'Guardar Concepto'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function OCRDocumentsPage() {
    return (
        <Suspense fallback={<div className="p-20 text-center font-black animate-pulse text-gray-400 italic">CARGANDO...</div>}>
            <OCRDocumentsContent />
        </Suspense>
    );
}
