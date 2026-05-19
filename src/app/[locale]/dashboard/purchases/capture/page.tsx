'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import ThemedGridHeader, { ThemedGridHeaderCell, TableBody, TableRow, TableCell, RowActionButton } from '@/components/ThemedGridHeader';
import { useTheme } from '@/contexts/ThemeContext';
import PurchaseImageCaptureModal from '@/components/PurchaseImageCaptureModal';
import PageShell from '@/components/PageShell';
import { ShoppingBag, Camera, X, Save, Plus, FileText, Search, ShoppingCart, Edit2, Trash2, Download, Package, Check, Eye, Sparkles } from 'lucide-react';
import Button from '@/components/Button';


interface Branch {
    IdSucursal: number;
    Sucursal: string;
}

interface Provider {
    IdProveedor: number;
    Proveedor: string;
    EsProveedorGasto?: number;
}

interface PaymentChannel {
    IdCanalPago: number;
    CanalPago: string;
}

interface Purchase {
    IdCompra: number;
    FechaCompra: string;
    Proveedor: string;
    NumeroFactura: string;
    CanalPago: string;
    Total: number;
    Status: number;
    Referencia: string;
    PagarA: string;
    IdProveedor: number;
    IdCanalPago: number;
    ArchivoDocumento?: string;
    NombreArchivo?: string;
}

interface Product {
    IdProducto: number;
    Producto: string;
    Codigo: string;
    UnidadMedidaCompra: string;
    Precio?: number;
    Costo?: number;
}

interface Category {
    IdCategoria: number;
    Categoria: string;
}

interface PurchaseDetail {
    IdDetalleCompra: number;
    IdProducto: number;
    Cantidad: number;
    Costo: number;
    Status: number;
    Codigo: string;
    Producto: string;
    UnidadMedidaCompra: string;
    Total: number;
}

export default function PurchasesCapturePage() {
    const t = useTranslations('PurchasesCapture');
    const tModal = useTranslations('PurchasesModal');
    const tDetails = useTranslations('PurchaseDetailsModal');
    const tCommon = useTranslations('Common');
    const { colors } = useTheme();

    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [project, setProject] = useState<any>(null);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [dailyPurchases, setDailyPurchases] = useState<Purchase[]>([]);
    const [monthlyPurchasesDetails, setMonthlyPurchasesDetails] = useState<Record<number, Array<{ provider: string, total: number, itemCount: number }>>>({});

    // Form state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
    const [providers, setProviders] = useState<Provider[]>([]);
    const [paymentChannels, setPaymentChannels] = useState<PaymentChannel[]>([]);

    const [formData, setFormData] = useState({
        providerId: '',
        invoiceNumber: '',
        paymentChannelId: '',
        reference: '',
        payTo: '',
        total: ''
    });

    const [providerSearch, setProviderSearch] = useState('');
    const [showProviderDropdown, setShowProviderDropdown] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
    const [isNewProviderModalOpen, setIsNewProviderModalOpen] = useState(false);
    const [isEditingProvider, setIsEditingProvider] = useState(false);
    const [newProviderName, setNewProviderName] = useState('');
    const [esProveedorGasto, setEsProveedorGasto] = useState(false);
    const [isSavingProvider, setIsSavingProvider] = useState(false);

    const [paymentChannelSearch, setPaymentChannelSearch] = useState('');
    const [showPaymentChannelDropdown, setShowPaymentChannelDropdown] = useState(false);
    const [selectedPaymentChannel, setSelectedPaymentChannel] = useState<PaymentChannel | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Purchase details modal state
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedPurchaseForDetails, setSelectedPurchaseForDetails] = useState<Purchase | null>(null);
    const [purchaseDetails, setPurchaseDetails] = useState<PurchaseDetail[]>([]);
    const [products, setProducts] = useState<Product[]>([]);

    const [detailFormData, setDetailFormData] = useState({
        productId: '',
        quantity: '',
        cost: ''
    });

    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    // Product creation modal state
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [productFormData, setProductFormData] = useState({
        producto: '',
        codigo: '',
        idCategoria: '',
        unidadMedidaCompra: '',
        precio: '',
        iva: ''
    });

    // Inline editing state for purchase details
    const [editingDetailId, setEditingDetailId] = useState<number | null>(null);
    const [editQuantity, setEditQuantity] = useState('');
    const [editCost, setEditCost] = useState('');

    // OCR Modal state
    const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);

    // File Preview & Upload state
    const [previewFile, setPreviewFile] = useState<{ content: string, name: string, type: string } | null>(null);
    const [uploadingPurchaseKey, setUploadingPurchaseKey] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);


    // Generate years
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 7 }, (_, i) => currentYear - 5 + i);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchBranches();
            fetchProviders();
            fetchPaymentChannels();

            // Load persisted filters - Standardized to dashboardSelectedBranch
            const savedBranch = localStorage.getItem('dashboardSelectedBranch');
            const savedMonth = localStorage.getItem('lastSelectedMonth');
            const savedYear = localStorage.getItem('lastSelectedYear');

            if (savedBranch) setSelectedBranch(savedBranch);
            if (savedMonth) setSelectedMonth(parseInt(savedMonth));
            if (savedYear) setSelectedYear(parseInt(savedYear));
        }
    }, [project]);

    // Listen for global branch changes
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'dashboardSelectedBranch' && e.newValue) {
                setSelectedBranch(e.newValue);
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    useEffect(() => {
        if (selectedBranch) localStorage.setItem('dashboardSelectedBranch', selectedBranch);
    }, [selectedBranch]);

    useEffect(() => {
        localStorage.setItem('lastSelectedMonth', (selectedMonth ?? 0).toString());
    }, [selectedMonth]);

    useEffect(() => {
        localStorage.setItem('lastSelectedYear', (selectedYear ?? 0).toString());
    }, [selectedYear]);

    useEffect(() => {
        if (project?.idProyecto && selectedBranch) {
            fetchMonthlyPurchases();
        }
    }, [project, selectedBranch, selectedMonth, selectedYear]);

    const fetchBranches = async () => {
        try {
            const response = await fetch(`/api/branches?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success && data.data.length > 0) {
                setBranches(data.data);

                const savedBranch = localStorage.getItem('dashboardSelectedBranch');
                if (!savedBranch && !selectedBranch) {
                    setSelectedBranch(data.data[0].IdSucursal?.toString() || '');
                }
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        }
    };

    const fetchProviders = async () => {
        try {
            const response = await fetch(`/api/providers?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setProviders(data.data);
            }
        } catch (error) {
            console.error('Error fetching providers:', error);
        }
    };

    const fetchPaymentChannels = async () => {
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

    const fetchProducts = async () => {
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

    const handleOpenDetailsModal = async (purchase: Purchase) => {
        setSelectedPurchaseForDetails(purchase);
        await fetchPurchaseDetails(purchase.IdCompra);
        await fetchProducts();
        await fetchCategories();
        setIsDetailsModalOpen(true);
    };

    const fetchPurchaseDetails = async (purchaseId: number) => {
        if (!project) return;
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                purchaseId: purchaseId?.toString() || ''
            });
            const response = await fetch(`/api/purchases/details?${params}`);
            const data = await response.json();
            if (data.success) {
                setPurchaseDetails(data.data);
            }
        } catch (error) {
            console.error('Error fetching purchase details:', error);
        }
    };

    const handleAddDetail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!project || !selectedPurchaseForDetails || !detailFormData.productId || !detailFormData.quantity || !detailFormData.cost) return;

        try {
            const response = await fetch('/api/purchases/details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    purchaseId: selectedPurchaseForDetails.IdCompra,
                    productId: parseInt(detailFormData.productId),
                    quantity: parseFloat(detailFormData.quantity),
                    cost: parseFloat(detailFormData.cost.replace(/[^0-9.]/g, ''))
                })
            });

            if (response.ok) {
                await fetchPurchaseDetails(selectedPurchaseForDetails.IdCompra);
                setDetailFormData({
                    productId: '',
                    quantity: '',
                    cost: ''
                });
                setProductSearch('');
                setSelectedProduct(null);
            }
        } catch (error) {
            console.error('Error adding purchase detail:', error);
        }
    };

    const handleDeleteDetail = async (detailId: number) => {
        if (!window.confirm(tDetails('confirmDelete'))) return;
        if (!project || !selectedPurchaseForDetails) return;

        try {
            const response = await fetch(`/api/purchases/details?projectId=${project.idProyecto}&detailId=${detailId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await fetchPurchaseDetails(selectedPurchaseForDetails.IdCompra);
            }
        } catch (error) {
            console.error('Error deleting purchase detail:', error);
        }
    };

    const handleEditDetailStart = (detail: PurchaseDetail) => {
        setEditingDetailId(detail.IdDetalleCompra);
        setEditQuantity(detail.Cantidad.toString());
        setEditCost(detail.Costo.toString());
    };

    const handleEditDetailCancel = () => {
        setEditingDetailId(null);
        setEditQuantity('');
        setEditCost('');
    };

    const handleEditDetailSave = async (detailId: number) => {
        if (!project || !selectedPurchaseForDetails) return;

        try {
            const response = await fetch('/api/purchases/details', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    detailId,
                    quantity: parseFloat(editQuantity),
                    cost: parseFloat(editCost.replace(/[^0-9.]/g, ''))
                })
            });

            if (response.ok) {
                await fetchPurchaseDetails(selectedPurchaseForDetails.IdCompra);
                setEditingDetailId(null);
                setEditQuantity('');
                setEditCost('');
            }
        } catch (error) {
            console.error('Error updating purchase detail:', error);
        }
    };

    const handleCreateProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!project) return;

        try {
            const response = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    producto: productFormData.producto,
                    codigo: productFormData.codigo,
                    idCategoria: parseInt(productFormData.idCategoria),
                    unidadMedidaCompra: productFormData.unidadMedidaCompra,
                    precio: parseFloat(productFormData.precio.replace(/[^0-9.]/g, '')),
                    iva: parseFloat(productFormData.iva.replace(/[^0-9.]/g, ''))
                })
            });

            const data = await response.json();

            if (response.ok) {
                await fetchProducts();

                const parsedPrice = productFormData.precio ? parseFloat(productFormData.precio.replace(/[^0-9.]/g, '')) : 0;
                const newProduct = products.find(p => p.IdProducto === data.productId) ||
                    { IdProducto: data.productId, Producto: productFormData.producto, Codigo: productFormData.codigo, UnidadMedidaCompra: productFormData.unidadMedidaCompra, Precio: parsedPrice };

                setSelectedProduct(newProduct as Product);
                const formattedPrice = parsedPrice > 0 ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parsedPrice) : '';

                setDetailFormData({
                    ...detailFormData,
                    productId: data.productId?.toString() || '',
                    cost: formattedPrice
                });
                setProductSearch(`${productFormData.codigo} - ${productFormData.producto}`);

                setProductFormData({
                    producto: '',
                    codigo: '',
                    idCategoria: '',
                    unidadMedidaCompra: '',
                    precio: '',
                    iva: ''
                });
                setIsProductModalOpen(false);
                setShowProductDropdown(false);
            } else {
                if (data.error) {
                    alert(data.error);
                } else if (data.message) {
                    alert(data.message);
                } else {
                    alert(tDetails('errorCreatingProduct') || 'Error al crear el producto');
                }
            }
        } catch (error) {
            console.error('Error creating product:', error);
            alert(tDetails('errorCreatingProduct') || 'Error al crear el producto');
        }
    };

    const openProductModal = () => {
        setProductFormData({
            producto: productSearch,
            codigo: '',
            idCategoria: '',
            unidadMedidaCompra: '',
            precio: '',
            iva: ''
        });
        setIsProductModalOpen(true);
    };

    const fetchMonthlyPurchases = async () => {
        if (!project || !selectedBranch) return;
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                month: selectedMonth.toString(),
                year: selectedYear.toString()
            });
            const response = await fetch(`/api/purchases/monthly?${params}`);
            const data = await response.json();
            if (data.success) {
                const detailsMap: Record<number, Array<{ provider: string, total: number, itemCount: number }>> = {};
                data.data.forEach((item: any) => {
                    if (!detailsMap[item.day]) {
                        detailsMap[item.day] = [];
                    }
                    detailsMap[item.day].push({
                        provider: item.Proveedor,
                        total: item.total,
                        itemCount: item.itemCount
                    });
                });
                setMonthlyPurchasesDetails(detailsMap);
            }
        } catch (error) {
            console.error('Error fetching monthly purchases:', error);
        }
    };

    const handleDayClick = async (date: Date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (date > today) {
            alert(tCommon('errorFutureDate'));
            return;
        }

        setSelectedDate(date);
        await fetchDailyPurchases(date);
        setIsModalOpen(true);
        setIsFormOpen(false);
        setEditingPurchase(null);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadingPurchaseKey || !project) return;

        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const formData = new FormData();
                formData.append('projectId', project.idProyecto);
                formData.append('purchaseId', uploadingPurchaseKey);
                formData.append('file', file);

                const response = await fetch('/api/purchases/daily', {
                    method: 'PUT',
                    body: formData
                });

                const data = await response.json();
                if (data.success) {
                    if (selectedDate) fetchDailyPurchases(selectedDate);
                } else {
                    alert('Error al subir archivo');
                }
            } catch (error) {
                console.error('Error uploading file:', error);
            }
        };
        reader.readAsDataURL(file);
    };

    const fetchDailyPurchases = async (date: Date) => {
        if (!project || !selectedBranch) return;
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                day: date.getDate().toString(),
                month: date.getMonth().toString(),
                year: date.getFullYear().toString()
            });
            const response = await fetch(`/api/purchases/daily?${params}`);
            const data = await response.json();
            if (data.success) {
                setDailyPurchases(data.data);
            }
        } catch (error) {
            console.error('Error fetching daily purchases:', error);
        }
    };

    const handleNewPurchase = () => {
        setIsFormOpen(true);
        setEditingPurchase(null);
        setFormData({
            providerId: '',
            invoiceNumber: '',
            paymentChannelId: '',
            reference: '',
            payTo: '',
            total: ''
        });
        setProviderSearch('');
        setEsProveedorGasto(false);
        setSelectedProvider(null);
        setPaymentChannelSearch('');
        setSelectedPaymentChannel(null);
    };

    const handleEditPurchase = (purchase: Purchase) => {
        setEditingPurchase(purchase);
        setIsFormOpen(true);
        setFormData({
            providerId: purchase.IdProveedor?.toString() || '',
            invoiceNumber: purchase.NumeroFactura,
            paymentChannelId: purchase.IdCanalPago?.toString() || '',
            reference: purchase.Referencia || '',
            payTo: purchase.PagarA || '',
            total: purchase.Total?.toString() || ''
        });

        const provider = providers.find(p => p.IdProveedor === purchase.IdProveedor);
        if (provider) {
            setEsProveedorGasto(provider.EsProveedorGasto === 1);
            setSelectedProvider(provider);
            setProviderSearch(provider.Proveedor);
        }

        const paymentChannel = paymentChannels.find(pc => pc.IdCanalPago === purchase.IdCanalPago);
        if (paymentChannel) {
            setSelectedPaymentChannel(paymentChannel);
            setPaymentChannelSearch(paymentChannel.CanalPago);
        }
    };

    const handleSaveProvider = async () => {
        if (!newProviderName || !project) return;
        setIsSavingProvider(true);
        const uppercaseName = newProviderName.toUpperCase();
        try {
            const url = isEditingProvider ? `/api/suppliers/${selectedProvider?.IdProveedor}` : '/api/suppliers';
            const method = isEditingProvider ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    proveedor: uppercaseName,
                    esProveedorGasto: esProveedorGasto,
                    status: 0
                })
            });
            const data = await response.json();
            if (data.success) {
                await fetchProviders();
                const providerId = isEditingProvider ? selectedProvider?.IdProveedor : data.id;
                const newProv = { IdProveedor: providerId, Proveedor: uppercaseName };
                
                setSelectedProvider(newProv as Provider);
                setFormData(prev => ({ ...prev, providerId: providerId.toString() }));
                setProviderSearch(uppercaseName);
                
                setIsNewProviderModalOpen(false);
                setIsEditingProvider(false);
                setNewProviderName('');
            } else {
                alert('Error: ' + data.message);
            }
        } catch (error) { alert('Error de conexión'); }
        finally { setIsSavingProvider(false); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Comprehensive Validation
        if (!selectedDate) {
            alert(tCommon('errorNoDate'));
            return;
        }
        if (!project || !selectedBranch) {
            alert(tCommon('errorMissingContext'));
            return;
        }
        if (!formData.providerId) {
            alert(tModal('errorSelectProvider') || 'Debe seleccionar un proveedor de la lista');
            return;
        }
        if (!formData.invoiceNumber) {
            alert(tModal('errorMissingInvoice') || 'Número de factura requerido');
            return;
        }
        if (!formData.paymentChannelId) {
            alert(tModal('errorSelectPaymentChannel') || 'Debe seleccionar un canal de pago de la lista');
            return;
        }
        if (!formData.total) {
            alert(tModal('errorMissingTotal') || 'Ingrese el total de la compra');
            return;
        }

        setIsSubmitting(true);
        try {
            const url = '/api/purchases/daily';
            const method = editingPurchase ? 'PUT' : 'POST';

            const totalNum = parseFloat(formData.total.replace(/[^0-9.]/g, ''));
            if (isNaN(totalNum)) {
                alert(tModal('errorInvalidTotal') || 'Total no válido');
                setIsSubmitting(false);
                return;
            }

            const submitData = new FormData();
            submitData.append('projectId', project.idProyecto);
            submitData.append('providerId', formData.providerId);
            submitData.append('invoiceNumber', formData.invoiceNumber);
            submitData.append('paymentChannelId', formData.paymentChannelId);
            submitData.append('reference', formData.reference);
            submitData.append('payTo', formData.payTo);
            submitData.append('total', totalNum.toString());

            if (editingPurchase) {
                submitData.append('purchaseId', editingPurchase.IdCompra.toString());
            } else {
                submitData.append('branchId', selectedBranch);
                submitData.append('day', selectedDate.getDate().toString());
                submitData.append('month', selectedDate.getMonth().toString());
                submitData.append('year', selectedDate.getFullYear().toString());
            }

            const response = await fetch(url, {
                method,
                body: submitData
            });

            const data = await response.json();

            if (response.ok) {
                await fetchDailyPurchases(selectedDate);
                await fetchMonthlyPurchases();
                setIsFormOpen(false);
                setEditingPurchase(null);
                setFormData({
                    providerId: '',
                    invoiceNumber: '',
                    paymentChannelId: '',
                    reference: '',
                    payTo: '',
                    total: ''
                });
                setProviderSearch('');
                setSelectedProvider(null);
                setPaymentChannelSearch('');
                setSelectedPaymentChannel(null);
            } else {
                alert(data.message || tCommon('errorSaving'));
            }
        } catch (error) {
            console.error('Error saving purchase:', error);
            alert(tCommon('errorConnection'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeletePurchase = async (purchase: Purchase) => {
        if (!window.confirm(tModal('confirmDelete'))) return;

        try {
            const response = await fetch(`/api/purchases/daily?projectId=${project.idProyecto}&purchaseId=${purchase.IdCompra}`, {
                method: 'DELETE'
            });

            if (response.ok && selectedDate) {
                await fetchDailyPurchases(selectedDate);
                await fetchMonthlyPurchases();
            }
        } catch (error) {
            console.error('Error deleting purchase:', error);
        }
    };

    // Calendar logic
    const getDaysInMonth = (month: number, year: number) => {
        const date = new Date(year, month, 1);
        const days = [];
        const firstDayOfWeek = (date.getDay() + 6) % 7; // Monday = 0
        for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
        while (date.getMonth() === month) {
            days.push(new Date(date));
            date.setDate(date.getDate() + 1);
        }
        return days;
    };

    const calendarDays = getDaysInMonth(selectedMonth, selectedYear);
    const weekDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

    const totalPurchases = dailyPurchases
        .filter(p => p.Status !== 2)
        .reduce((sum, p) => sum + (p.Total || 0), 0);

    return (
        <PageShell title="Captura de Compras" icon={ShoppingBag} actions={<div className="flex items-center gap-3 flex-wrap">
                    <Button
                        onClick={() => setIsOcrModalOpen(true)}
                        variant="secondary"
                        size="sm"
                        leftIcon={Camera}
                    >
                        Captura por Imagen
                    </Button>

                    <select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-700 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {branches.length === 0 && <option>{t('noBranches')}</option>}
                        {branches.map(branch => (
                            <option key={branch.IdSucursal} value={branch.IdSucursal}>
                                {branch.Sucursal}
                            </option>
                        ))}
                    </select>

                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-700 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i} value={i}>{t(`months.${i}`)}</option>
                        ))}
                    </select>

                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-700 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {years.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>}>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col h-[calc(100vh-200px)] overflow-y-auto">
                {/* Header sticky */}
                <div
                    className="sticky top-0 z-10 grid grid-cols-7 gap-0 px-4 py-4 shadow-sm flex-shrink-0"
                    style={{
                        backgroundColor: colors.colorFondo1,
                        color: colors.colorLetra
                    }}
                >
                    {weekDays.map(day => (
                        <div
                            key={day}
                            className="text-center font-bold text-sm uppercase tracking-wider"
                        >
                            {t(`days.${day}`)}
                        </div>
                    ))}
                </div>

                {/* Calendario expandido */}
                <div className="p-4 bg-white">
                    <div className="grid grid-cols-7 gap-3">
                        {calendarDays.map((date, index) => {
                            if (!date) {
                                return <div key={`empty-${index}`} />;
                            }

                            const dayNum = date.getDate();
                            const details = monthlyPurchasesDetails[dayNum];
                            const hasPurchases = details && details.length > 0;
                            const isToday = new Date().toDateString() === date.toDateString();

                            return (
                                <div
                                    key={index}
                                    onClick={() => handleDayClick(date)}
                                    className={`
                                    aspect-square rounded-xl p-3 cursor-pointer transition-all duration-200
                                    flex flex-col justify-between group relative overflow-hidden
                                    ${isToday
                                            ? 'bg-blue-50 border-2 border-blue-400 shadow-md hover:shadow-lg'
                                            : hasPurchases
                                            ? 'bg-blue-50 border-2 border-blue-300 shadow-sm hover:shadow-md'
                                            : 'bg-white border-2 border-gray-200 shadow-sm hover:shadow-md'
                                        }
                                    hover:scale-105 hover:-translate-y-1
                                `}
                                >
                                    <div className="flex justify-between items-start z-10">
                                        <span className={`text-xl font-black ${isToday ? 'text-blue-600' : hasPurchases ? 'text-blue-700' : 'text-gray-400'}`}>
                                            {dayNum}
                                        </span>
                                        {isToday && (
                                            <span className="text-[7px] font-bold bg-blue-500 text-white px-1 py-0.5 rounded-full animate-pulse">
                                                HOY
                                            </span>
                                        )}
                                    </div>
                                    {hasPurchases && (
                                        <div className="space-y-0.5 z-10">
                                            <div className="text-sm font-black text-blue-600 leading-tight">
                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(details.reduce((sum, d) => sum + d.total, 0))}
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                {details.length} {details.length === 1 ? 'Factura' : 'Facturas'}
                                            </div>
                                        </div>
                                    )}
                                    {/* Decorative background element for hover */}
                                    <div className={`
                                    absolute -right-4 -bottom-4 w-12 h-12 rounded-full opacity-0 group-hover:opacity-10 transition-opacity duration-300
                                    ${isToday ? 'bg-blue-600' : 'bg-blue-600'}
                                `} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Main Day Modal */}
            {isModalOpen && selectedDate && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-4" aria-modal="true" role="dialog">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
                        onClick={() => setIsModalOpen(false)}
                    />

                    {/* Panel */}
                    <div
                        className="relative w-full bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-w-5xl animate-in zoom-in-95 fade-in duration-200"
                        style={{ maxHeight: '90vh' }}
                    >
                        {/* Header */}
                        <div
                            className="shrink-0 flex items-start justify-between px-5 py-4 gap-4 border-b border-black/5"
                            style={{ backgroundColor: colors.colorFondo1 }}
                        >
                            <div className="flex flex-col gap-0.5 min-w-0">
                                <h2
                                    className="text-[15px] font-semibold leading-tight"
                                    style={{ color: colors.colorLetra }}
                                >
                                    {tModal('title')}
                                </h2>
                                <p
                                    className="text-[12px] leading-tight"
                                    style={{ color: colors.colorLetra, opacity: 0.8 }}
                                >
                                    {selectedDate.toLocaleDateString()}
                                </p>
                            </div>

                            <button
                                onClick={() => setIsModalOpen(false)}
                                aria-label="Cerrar"
                                className="shrink-0 mt-0.5 p-1.5 rounded-lg active:scale-95 transition-all duration-100 hover:bg-white/10"
                                style={{ color: colors.colorLetra }}
                            >
                                <X size={16} strokeWidth={2} />
                            </button>
                        </div>

                        {/* Summary Cards */}
                        <div className="shrink-0 px-6 py-5 bg-gray-50/50 border-b border-gray-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Total Compras */}
                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ShoppingCart size={14} className="text-gray-400" />
                                        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Compras Totales</label>
                                    </div>
                                    <div className="text-lg font-bold text-blue-600">
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalPurchases)}
                                    </div>
                                </div>

                                {/* Facturas Registradas */}
                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                                    <div className="flex items-center gap-2 mb-2">
                                        <FileText size={14} className="text-gray-400" />
                                        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Facturas Registradas</label>
                                    </div>
                                    <div className="text-lg font-bold text-gray-800">
                                        {dailyPurchases.length}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* New Purchase Button */}
                        {!isFormOpen && (
                            <div className="shrink-0 px-6 py-3 bg-gray-50/50 border-b border-gray-100">
                                <Button
                                    onClick={handleNewPurchase}
                                    variant="secondary"
                                    size="sm"
                                    leftIcon={Plus}
                                    iconBox
                                >
                                    {tModal('new')}
                                </Button>
                            </div>
                        )}

                        {/* Content: Form + Table */}
                        <div className="flex-1 overflow-y-auto">
                            {/* Purchase Form */}
                            {isFormOpen && (
                                <form onSubmit={handleSubmit} className="shrink-0 px-6 py-5 bg-gray-50/50 border-b border-gray-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end animate-in fade-in slide-in-from-top-4 duration-300">
                                    <div className="flex flex-col relative">
                                        <label className="text-xs font-bold text-blue-900/60 uppercase tracking-wider mb-2 ml-1">{tModal('provider')} *</label>
                                        <input
                                            type="text"
                                            className="w-full p-2.5 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            value={providerSearch}
                                            onChange={(e) => {
                                                setProviderSearch(e.target.value);
                                                setShowProviderDropdown(true);
                                            }}
                                            onFocus={() => setShowProviderDropdown(true)}
                                            onBlur={() => setTimeout(() => setShowProviderDropdown(false), 200)}
                                            placeholder={tModal('searchProvider')}
                                            required
                                        />
                                        {showProviderDropdown && (
                                            <div className="absolute z-50 w-full top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                                {providers.filter(p => !providerSearch || p.Proveedor.toLowerCase().includes(providerSearch.toLowerCase())).map(p => (
                                                    <div
                                                        key={p.IdProveedor}
                                                        onClick={() => {
                                                            setSelectedProvider(p);
                                                            setFormData(prev => ({ ...prev, providerId: p.IdProveedor.toString() }));
                                                            setProviderSearch(p.Proveedor);
                                                            setShowProviderDropdown(false);
                                                        }}
                                                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-0 border-gray-50 font-bold text-sm text-gray-800"
                                                    >
                                                        {p.Proveedor}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col text-sm">
                                        <label className="text-xs font-bold text-blue-900/60 uppercase tracking-wider mb-2 ml-1">{tModal('invoiceNumber')} *</label>
                                        <input
                                            type="text"
                                            className="w-full p-2.5 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all uppercase"
                                            value={formData.invoiceNumber}
                                            onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value.toUpperCase() })}
                                            required
                                        />
                                    </div>

                                    <div className="flex flex-col relative text-sm">
                                        <label className="text-xs font-bold text-blue-900/60 uppercase tracking-wider mb-2 ml-1">{tModal('paymentChannel')} *</label>
                                        <input
                                            type="text"
                                            className="w-full p-2.5 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            value={paymentChannelSearch}
                                            onChange={(e) => {
                                                setPaymentChannelSearch(e.target.value);
                                                setShowPaymentChannelDropdown(true);
                                            }}
                                            onFocus={() => setShowPaymentChannelDropdown(true)}
                                            onBlur={() => setTimeout(() => setShowPaymentChannelDropdown(false), 200)}
                                            placeholder="Buscar canal..."
                                            required
                                        />
                                        {showPaymentChannelDropdown && (
                                            <div className="absolute z-50 w-full top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                                {paymentChannels.filter(pc => !paymentChannelSearch || pc.CanalPago.toLowerCase().includes(paymentChannelSearch.toLowerCase())).map(pc => (
                                                    <div
                                                        key={pc.IdCanalPago}
                                                        onClick={() => {
                                                            setSelectedPaymentChannel(pc);
                                                            setFormData(prev => ({ ...prev, paymentChannelId: pc.IdCanalPago.toString() }));
                                                            setPaymentChannelSearch(pc.CanalPago);
                                                            setShowPaymentChannelDropdown(false);
                                                        }}
                                                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-0 border-gray-50 font-bold text-sm text-gray-800"
                                                    >
                                                        {pc.CanalPago}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col text-sm">
                                        <label className="text-xs font-bold text-blue-900/60 uppercase tracking-wider mb-2 ml-1">{tModal('total')} *</label>
                                        <input
                                            type="text"
                                            className="w-full p-2.5 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-blue-600"
                                            value={formData.total}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                                if ((val.match(/\./g) || []).length > 1) return;
                                                setFormData({ ...formData, total: val });
                                            }}
                                            onBlur={(e) => {
                                                const val = parseFloat(e.target.value.replace(/[^0-9.]/g, '') || '0');
                                                setFormData(prev => ({ ...prev, total: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val) }));
                                            }}
                                            onFocus={(e) => {
                                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                                setFormData(prev => ({ ...prev, total: val === '0.00' || val === '0' ? '' : val }));
                                            }}
                                            required
                                            placeholder="0.00"
                                        />
                                    </div>

                                    <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex flex-col text-sm">
                                            <label className="text-xs font-bold text-blue-900/60 uppercase tracking-wider mb-2 ml-1">{tModal('reference')}</label>
                                            <input
                                                type="text"
                                                className="w-full p-2.5 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                value={formData.reference}
                                                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                                            />
                                        </div>
                                        <div className="flex flex-col text-sm">
                                            <label className="text-xs font-bold text-blue-900/60 uppercase tracking-wider mb-2 ml-1">{tModal('payTo')}</label>
                                            <input
                                                type="text"
                                                className="w-full p-2.5 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                value={formData.payTo}
                                                onChange={(e) => setFormData({ ...formData, payTo: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="lg:col-span-4 flex gap-2 justify-end">
                                        <Button
                                            type="button"
                                            onClick={() => {
                                                setIsFormOpen(false);
                                                setEditingPurchase(null);
                                            }}
                                            variant="secondary"
                                            size="sm"
                                        >
                                            {tCommon('cancel')}
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={isSubmitting}
                                            variant="solid"
                                            size="sm"
                                            leftIcon={Save}
                                            iconBox
                                            isLoading={isSubmitting}
                                        >
                                            {tModal('save')}
                                        </Button>
                                    </div>
                                </form>
                            )}

                            {/* Purchase Table */}
                            <div className="flex-1 overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm">
                                <table className="w-full border-collapse">
                                    <ThemedGridHeader className="sticky top-0 z-10 shadow-sm">
                                        <ThemedGridHeaderCell>
                                            ID
                                        </ThemedGridHeaderCell>
                                        <ThemedGridHeaderCell>
                                            {tModal('provider')}
                                        </ThemedGridHeaderCell>
                                        <ThemedGridHeaderCell>
                                            {tModal('invoiceNumber')}
                                        </ThemedGridHeaderCell>
                                        <ThemedGridHeaderCell>
                                            Canal
                                        </ThemedGridHeaderCell>
                                        <ThemedGridHeaderCell align="right">
                                            {tModal('total')}
                                        </ThemedGridHeaderCell>
                                        <ThemedGridHeaderCell align="center">
                                            Archivo
                                        </ThemedGridHeaderCell>
                                        <ThemedGridHeaderCell align="right">
                                            Acciones
                                        </ThemedGridHeaderCell>
                                    </ThemedGridHeader>
                                    <TableBody
                                        loading={false}
                                        empty={dailyPurchases.length === 0}
                                        emptyMessage={tModal('noRecords')}
                                        colSpan={7}
                                    >
                                        {dailyPurchases.map((purchase) => (
                                            <TableRow key={purchase.IdCompra} className={purchase.Status === 2 ? 'opacity-60' : ''}>
                                                <TableCell>
                                                    <span className="text-xs font-mono text-gray-500">#{purchase.IdCompra}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-medium text-gray-900">{purchase.Proveedor}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-gray-600">{purchase.NumeroFactura}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-gray-600">{purchase.CanalPago}</span>
                                                </TableCell>
                                                <TableCell align="right">
                                                    <span className="font-bold text-blue-600">
                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(purchase.Total)}
                                                    </span>
                                                </TableCell>
                                                <TableCell align="center">
                                                    {purchase.ArchivoDocumento ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    setPreviewFile({
                                                                        content: purchase.ArchivoDocumento,
                                                                        name: purchase.NombreArchivo || 'documento',
                                                                        type: purchase.NombreArchivo?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/*'
                                                                    });
                                                                }}
                                                                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                                                title="Descargar"
                                                            >
                                                                <Download size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setUploadingPurchaseKey(purchase.IdCompra.toString());
                                                                    fileInputRef.current?.click();
                                                                }}
                                                                className="p-1 text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded transition-colors"
                                                                title="Cambiar"
                                                            >
                                                                <FileText size={16} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => {
                                                                setUploadingPurchaseKey(purchase.IdCompra.toString());
                                                                fileInputRef.current?.click();
                                                            }}
                                                            className="px-3 py-1.5 text-blue-600 border border-blue-300 bg-blue-50 hover:bg-blue-100 rounded transition-colors text-xs font-bold flex items-center gap-1 mx-auto"
                                                        >
                                                            <Plus size={14} /> {tModal('upload')}
                                                        </button>
                                                    )}
                                                </TableCell>
                                                <TableCell align="right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {purchase.Status === 0 && (
                                                            <RowActionButton
                                                                icon={Package}
                                                                label="Productos"
                                                                onClick={() => handleOpenDetailsModal(purchase)}
                                                            />
                                                        )}
                                                        {purchase.Status !== 2 && (
                                                            <>
                                                                <RowActionButton
                                                                    icon={Edit2}
                                                                    label="Editar"
                                                                    onClick={() => handleEditPurchase(purchase)}
                                                                />
                                                                <RowActionButton
                                                                    icon={Trash2}
                                                                    label="Eliminar"
                                                                    variant="delete"
                                                                    onClick={() => handleDeletePurchase(purchase)}
                                                                />
                                                            </>
                                                        )}
                                                        {purchase.Status === 2 && (
                                                            <span className="text-[10px] font-bold text-red-600 uppercase">Anulada</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </table>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-2.5">
                            <Button
                                onClick={() => setIsModalOpen(false)}
                                variant="secondary"
                                size="md"
                                leftIcon={X}
                            >
                                {tModal('close')}
                            </Button>
                            <Button
                                variant="solid"
                                size="md"
                                leftIcon={Save}
                                iconBox
                            >
                                {tModal('save')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Purchase Details Modal (Standardized Nested) */}
            {isDetailsModalOpen && selectedPurchaseForDetails && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[520] p-4 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-blue-200 animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-5 py-3 bg-gradient-to-r from-blue-50 to-blue-50/50 border-b border-blue-100 flex justify-between items-center">
                            <div>
                                <h2 className="text-base font-bold text-gray-900">Productos de Compra</h2>
                                <p className="text-[11px] font-medium mt-0.5 text-blue-600">{selectedPurchaseForDetails.NumeroFactura} • {selectedPurchaseForDetails.Proveedor}</p>
                            </div>
                            <button
                                onClick={() => setIsDetailsModalOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-100 text-blue-400 hover:text-blue-600 transition-all"
                            >
                                <X size={16} strokeWidth={2.5} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-h-0 overflow-hidden p-6 flex flex-col gap-6">
                            {/* Summary Card */}
                            <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex items-center justify-between">
                                <div>
                                    <label className="text-[10px] font-black text-green-700 uppercase tracking-widest block mb-0.5">Total Productos</label>
                                    <div className="text-2xl font-black text-green-700">
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(purchaseDetails.reduce((sum, d) => sum + d.Total, 0))}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <label className="text-[10px] font-black text-green-700 uppercase tracking-widest block mb-0.5">Partidas</label>
                                    <div className="text-2xl font-black text-gray-800">{purchaseDetails.length}</div>
                                </div>
                            </div>

                            {/* Add Item Form */}
                            <form onSubmit={handleAddDetail} className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100 items-end shadow-inner">
                                <div className="flex flex-col relative md:col-span-4 lg:col-span-5">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">{tDetails('product')} *</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none transition-all"
                                        value={productSearch}
                                        onChange={(e) => {
                                            setProductSearch(e.target.value);
                                            setShowProductDropdown(true);
                                        }}
                                        onFocus={() => setShowProductDropdown(true)}
                                        placeholder={tDetails('searchProduct')}
                                        required
                                    />
                                    {showProductDropdown && (
                                        <div className="absolute z-[610] w-full top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                            {products.filter(p => !productSearch || p.Producto.toLowerCase().includes(productSearch.toLowerCase()) || p.Codigo.toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                                                <div
                                                    key={p.IdProducto}
                                                    onClick={() => {
                                                        setSelectedProduct(p);
                                                        const rawCost = p.Costo || p.Precio || 0;
                                                        setDetailFormData({
                                                            ...detailFormData,
                                                            productId: p.IdProducto.toString(),
                                                            cost: rawCost > 0 ? rawCost.toString() : ''
                                                        });
                                                        setProductSearch(`${p.Codigo} - ${p.Producto}`);
                                                        setShowProductDropdown(false);
                                                    }}
                                                    className="px-4 py-2 hover:bg-green-50 cursor-pointer border-b last:border-0 border-gray-50"
                                                >
                                                    <div className="font-bold text-sm text-gray-800">{p.Codigo} — {p.Producto}</div>
                                                    <div className="text-[10px] uppercase font-bold text-gray-400">{p.UnidadMedidaCompra}</div>
                                                </div>
                                            ))}
                                            {productSearch && products.filter(p => p.Producto.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                                                <div className="p-3">
                                                    <button
                                                        type="button"
                                                        onClick={openProductModal}
                                                        className="w-full bg-green-100 text-green-700 p-2 rounded-lg font-bold text-xs hover:bg-green-200 transition-colors flex items-center justify-center gap-2"
                                                    >
                                                        <Sparkles size={14} /> {tDetails('createProductButton')}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col md:col-span-2">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">{tDetails('quantity')} *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                        value={detailFormData.quantity}
                                        onChange={(e) => setDetailFormData({ ...detailFormData, quantity: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="flex flex-col md:col-span-2">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">{tDetails('cost')} *</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none text-right font-bold text-green-600"
                                        value={detailFormData.cost}
                                        onChange={(e) => setDetailFormData({ ...detailFormData, cost: e.target.value.replace(/[^0-9.]/g, '') })}
                                        onBlur={(e) => {
                                            const val = parseFloat(e.target.value || '0');
                                            setDetailFormData({ ...detailFormData, cost: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val) });
                                        }}
                                        required
                                    />
                                </div>

                                <div className="flex flex-col md:col-span-2">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">{tDetails('total')}</label>
                                    <div className="w-full p-2 bg-gray-100 border border-gray-200 rounded-lg text-sm font-black text-gray-600 text-right">
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((parseFloat(detailFormData.quantity) || 0) * (parseFloat(detailFormData.cost.replace(/[^0-9.]/g, '')) || 0))}
                                    </div>
                                </div>

                                <button type="submit" className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 font-bold transition-all shadow-md active:scale-95 md:col-span-1 py-2.5 flex items-center justify-center" title="Agregar">
                                    <Plus size={18} />
                                </button>
                            </form>

                            {/* Details Table */}
                            <div className="flex-1 min-h-0 overflow-y-auto bg-white rounded-xl border border-gray-200 shadow-sm">
                                <table className="w-full border-collapse">
                                    <ThemedGridHeader className="sticky top-0 z-10 shadow-sm">
                                        <ThemedGridHeaderCell>
                                            Cantidad
                                        </ThemedGridHeaderCell>
                                        <ThemedGridHeaderCell>
                                            Producto
                                        </ThemedGridHeaderCell>
                                        <ThemedGridHeaderCell align="right">
                                            Costo
                                        </ThemedGridHeaderCell>
                                        <ThemedGridHeaderCell align="right">
                                            Total
                                        </ThemedGridHeaderCell>
                                        <ThemedGridHeaderCell align="right">
                                            Acciones
                                        </ThemedGridHeaderCell>
                                    </ThemedGridHeader>
                                    <TableBody
                                        loading={false}
                                        empty={purchaseDetails.length === 0}
                                        emptyMessage="No hay productos"
                                        colSpan={5}
                                    >
                                        {purchaseDetails.map((detail) => (
                                            <TableRow key={detail.IdDetalleCompra}>
                                                <TableCell>
                                                    {editingDetailId === detail.IdDetalleCompra ? (
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            className="w-20 p-1 border rounded text-sm"
                                                            value={editQuantity}
                                                            onChange={(e) => setEditQuantity(e.target.value)}
                                                        />
                                                    ) : (
                                                        <span className="font-medium text-gray-900">{detail.Cantidad} <span className="text-[10px] font-normal text-gray-500">{detail.UnidadMedidaCompra}</span></span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium text-gray-900">{detail.Producto}</div>
                                                    <div className="text-[10px] text-gray-500 font-mono">#{detail.Codigo}</div>
                                                </TableCell>
                                                <TableCell align="right">
                                                    {editingDetailId === detail.IdDetalleCompra ? (
                                                        <input
                                                            type="text"
                                                            className="w-24 p-1 border rounded text-right text-sm font-bold text-blue-600"
                                                            value={editCost}
                                                            onChange={(e) => setEditCost(e.target.value.replace(/[^0-9.]/g, ''))}
                                                        />
                                                    ) : (
                                                        <span className="text-gray-900 font-medium">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(detail.Costo)}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell align="right">
                                                    <span className="font-bold text-blue-600">
                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(detail.Total)}
                                                    </span>
                                                </TableCell>
                                                <TableCell align="right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {editingDetailId === detail.IdDetalleCompra ? (
                                                            <>
                                                                <button onClick={() => handleEditDetailSave(detail.IdDetalleCompra)} className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-colors" title="Guardar">
                                                                    <Check size={16} />
                                                                </button>
                                                                <button onClick={handleEditDetailCancel} className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors" title="Cancelar">
                                                                    <X size={16} />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <RowActionButton
                                                                    icon={Edit2}
                                                                    label="Editar"
                                                                    onClick={() => handleEditDetailStart(detail)}
                                                                />
                                                                <RowActionButton
                                                                    icon={Trash2}
                                                                    label="Eliminar"
                                                                    variant="delete"
                                                                    onClick={() => handleDeleteDetail(detail.IdDetalleCompra)}
                                                                />
                                                            </>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </table>
                            </div>
                        </div>
                        <div className="shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-2.5">
                            <Button
                                onClick={() => setIsDetailsModalOpen(false)}
                                variant="secondary"
                                size="md"
                                leftIcon={X}
                            >
                                {tDetails('close')}
                            </Button>
                            <Button
                                variant="solid"
                                size="md"
                                leftIcon={Save}
                                iconBox
                            >
                                {tCommon('save')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Creation Modal (Standardized Nested) */}
            {isProductModalOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[600] p-4 backdrop-blur-md">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-3xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 pt-4 pb-0" style={{ backgroundColor: colors.colorFondo1, color: colors.colorLetra }}>
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-0">
                                        <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                            Producto
                                        </span>
                                        <span className="bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                            NUEVO
                                        </span>
                                    </div>
                                    <h1 className="text-2xl font-black mb-0 leading-tight">
                                        {tDetails('createProduct')}
                                    </h1>
                                </div>
                                <button
                                    onClick={() => setIsProductModalOpen(false)}
                                    className="text-white hover:bg-white/20 rounded-full p-2 flex-shrink-0"
                                >
                                    <X size={20} strokeWidth={2} />
                                </button>
                            </div>
                            <div className="h-4"></div>
                        </div>
                        <form onSubmit={handleCreateProduct} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Nombre del Producto *</label>
                                    <input
                                        type="text"
                                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none font-bold"
                                        value={productFormData.producto}
                                        onChange={(e) => setProductFormData({ ...productFormData, producto: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Código *</label>
                                    <input
                                        type="text"
                                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none uppercase font-mono"
                                        value={productFormData.codigo}
                                        onChange={(e) => setProductFormData({ ...productFormData, codigo: e.target.value.toUpperCase() })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Categoría *</label>
                                    <select
                                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none font-bold"
                                        value={productFormData.idCategoria}
                                        onChange={(e) => setProductFormData({ ...productFormData, idCategoria: e.target.value })}
                                        required
                                    >
                                        <option value="">Seleccionar...</option>
                                        {categories.map((c) => <option key={c.IdCategoria} value={c.IdCategoria}>{c.Categoria}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">U.M. Compra *</label>
                                    <input
                                        type="text"
                                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                        value={productFormData.unidadMedidaCompra}
                                        onChange={(e) => setProductFormData({ ...productFormData, unidadMedidaCompra: e.target.value })}
                                        placeholder="Kg, Litro, etc."
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Costo Base *</label>
                                    <input
                                        type="text"
                                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none text-right font-black text-green-600"
                                        value={productFormData.precio}
                                        onChange={(e) => setProductFormData({ ...productFormData, precio: e.target.value.replace(/[^0-9.]/g, '') })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 pt-4">
                                <Button type="submit" variant="solid" size="md" leftIcon={Save} iconBox className="flex-1">
                                    Crear Producto
                                </Button>
                                <Button type="button" onClick={() => setIsProductModalOpen(false)} variant="secondary" size="md" leftIcon={X}>
                                    Cancelar
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <PurchaseImageCaptureModal
                isOpen={isOcrModalOpen}
                onClose={() => setIsOcrModalOpen(false)}
                projectId={project?.idProyecto}
                selectedBranchId={selectedBranch}
                selectedPaymentChannelId=""
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                onSuccess={() => {
                    fetchMonthlyPurchases();
                    if (selectedDate) fetchDailyPurchases(selectedDate);
                }}
            />
        
            {/* Modal for New/Edit Provider */}
            {isNewProviderModalOpen && (
                <div className="fixed inset-0 z-[510] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 transform animate-in zoom-in-95 duration-300">
                        <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
                            <h3 className="text-xl font-black tracking-tight">{isEditingProvider ? 'EDITAR PROVEEDOR' : 'NUEVO PROVEEDOR'}</h3>
                            <button onClick={() => setIsNewProviderModalOpen(false)} className="text-white/80 hover:text-white text-2xl font-bold transition-colors">×</button>
                        </div>
                        <div className="p-8">
                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Nombre del Proveedor</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-lg focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold uppercase placeholder:text-slate-300"
                                            value={newProviderName}
                                            onChange={(e) => setNewProviderName(e.target.value.toUpperCase())}
                                            placeholder="EJ: ABARROTES EL CENTRO"
                                            autoFocus
                                        />
                                        {/* Suggestions list */}
                                        {newProviderName.length >= 2 && providers.filter(p => p.Proveedor.toUpperCase().includes(newProviderName.toUpperCase())).length > 0 && (
                                            <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl z-[610] max-h-40 overflow-auto overflow-x-hidden p-2 animate-in fade-in slide-in-from-top-2 duration-200 text-slate-800">
                                                {providers
                                                    .filter(p => p.Proveedor.toUpperCase().includes(newProviderName.toUpperCase()))
                                                    .slice(0, 5)
                                                    .map(p => (
                                                        <button
                                                            key={p.IdProveedor}
                                                            onClick={() => setNewProviderName(p.Proveedor)}
                                                            className="w-full text-left px-4 py-3 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition-colors flex items-center justify-between"
                                                        >
                                                            <span>{p.Proveedor}</span>
                                                            <span className="text-[9px] text-slate-400 font-medium">EXISTENTE</span>
                                                        </button>
                                                    ))
                                                }
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2 italic">* El nombre se guardará automáticamente en MAYÚSCULAS</p>
                                </div>
                                <div className="flex items-center justify-between px-2 bg-slate-50 p-5 rounded-2xl border-2 border-slate-100 cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => setEsProveedorGasto(!esProveedorGasto)}>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">¿Es Proveedor de Gasto?</span>
                                        <span className={`text-[10px] font-black tracking-widest transition-colors ${esProveedorGasto ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            {esProveedorGasto ? 'SÍ, ES GASTO' : 'NO ES GASTO'}
                                        </span>
                                    </div>
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all border-2 ${esProveedorGasto ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-white border-slate-200'}`}>
                                        {esProveedorGasto && <span className="text-lg font-black leading-none">✓</span>}
                                    </div>
                                </div>
                                
                                <div className="flex gap-3 pt-2">
                                    <button 
                                        onClick={handleSaveProvider}
                                        disabled={isSavingProvider || !newProviderName}
                                        className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        {isSavingProvider ? 'GUARDANDO...' : 'GUARDAR'}
                                    </button>
                                    <button 
                                        onClick={() => setIsNewProviderModalOpen(false)}
                                        className="px-6 bg-slate-100 text-slate-500 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                                    >
                                        CANCELAR
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden File Input for Grid Uploads */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,.pdf"
            />

            {/* File Preview Modal */}
            {previewFile && (
                <div className="fixed inset-0 z-[530] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-xl font-black text-gray-800 flex items-center gap-3">
                                <span className="bg-blue-600 text-white p-2 rounded-xl flex items-center justify-center">
                                    <Eye size={16} />
                                </span>
                                {previewFile.name}
                            </h3>
                            <div className="flex items-center gap-2">
                                <a
                                    href={`data:${previewFile.type};base64,${previewFile.content}`}
                                    download={previewFile.name}
                                    className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-600 hover:text-white transition-all text-sm"
                                >
                                    Descargar
                                </a>
                                <button
                                    onClick={() => setPreviewFile(null)}
                                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
                                >
                                    <X size={20} strokeWidth={2} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 bg-gray-900 overflow-auto flex items-center justify-center p-4">
                            {previewFile.type === 'application/pdf' ? (
                                <iframe
                                    src={`data:application/pdf;base64,${previewFile.content}#toolbar=0`}
                                    className="w-full h-full rounded-lg"
                                    title="PDF Preview"
                                />
                            ) : (
                                <img
                                    src={`data:image/*;base64,${previewFile.content}`}
                                    className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                                    alt="Preview"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </PageShell>
    );
}
