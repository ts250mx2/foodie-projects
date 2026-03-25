'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';
import { useTheme } from '@/contexts/ThemeContext';

interface Branch {
    IdSucursal: number;
    Sucursal: string;
}

interface Provider {
    IdProveedor: number;
    Proveedor: string;
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
            setSelectedProvider(provider);
            setProviderSearch(provider.Proveedor);
        }

        const paymentChannel = paymentChannels.find(pc => pc.IdCanalPago === purchase.IdCanalPago);
        if (paymentChannel) {
            setSelectedPaymentChannel(paymentChannel);
            setPaymentChannelSearch(paymentChannel.CanalPago);
        }
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

            const body = editingPurchase ? {
                projectId: project.idProyecto,
                purchaseId: editingPurchase.IdCompra,
                providerId: parseInt(formData.providerId),
                invoiceNumber: formData.invoiceNumber,
                paymentChannelId: parseInt(formData.paymentChannelId),
                reference: formData.reference,
                payTo: formData.payTo,
                total: totalNum
            } : {
                projectId: project.idProyecto,
                branchId: parseInt(selectedBranch),
                day: selectedDate.getDate(),
                month: selectedDate.getMonth(),
                year: selectedDate.getFullYear(),
                providerId: parseInt(formData.providerId),
                invoiceNumber: formData.invoiceNumber,
                paymentChannelId: parseInt(formData.paymentChannelId),
                reference: formData.reference,
                payTo: formData.payTo,
                total: totalNum
            };

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
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
        <div className="flex flex-col min-h-screen p-6 gap-4">
            {/* Standardized Header */}
            <div className="sticky top-16 z-30 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-sm">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    🛒 {t('title')}
                </h1>

                <div className="flex items-center gap-4">
                    {/* Branch Selector */}
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1">{t('selectBranch')}</label>
                        <select
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {branches.length === 0 && <option>{t('noBranches')}</option>}
                            {branches.map(branch => (
                                <option key={branch.IdSucursal} value={branch.IdSucursal}>
                                    {branch.Sucursal}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Month Selector */}
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1">{t('month')}</label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i} value={i}>{t(`months.${i}`)}</option>
                            ))}
                        </select>
                    </div>

                    {/* Year Selector */}
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1">{t('year')}</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {years.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 flex flex-col">
                {/* Continuous Header */}
                <div
                    className="grid grid-cols-7"
                    style={{
                        background: `linear-gradient(to right, ${colors.colorFondo1}, ${colors.colorFondo2})`,
                        color: colors.colorLetra
                    }}
                >
                    {weekDays.map(day => (
                        <div
                            key={day}
                            className="text-center font-bold py-4 text-[10px] uppercase tracking-[0.2em]"
                        >
                            {t(`days.${day}`)}
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-gray-50/30">
                    <div className="grid grid-cols-7 gap-3">
                        {calendarDays.map((date, index) => {
                            if (!date) {
                                return <div key={`empty-${index}`} className="aspect-square" />;
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
                                    aspect-square rounded-xl p-3 cursor-pointer transition-all duration-300
                                    flex flex-col justify-between group relative overflow-hidden
                                    ${isToday
                                            ? 'bg-white border-2 border-blue-400 shadow-blue-100'
                                            : 'bg-white border border-slate-200/60 hover:border-blue-400 hover:shadow-blue-100'
                                        }
                                    hover:scale-[1.02] hover:shadow-xl shadow-sm
                                `}
                                >
                                    <div className="flex justify-between items-start z-10">
                                        <span className={`text-xl font-black ${isToday ? 'text-blue-600' : hasPurchases ? 'text-slate-800' : 'text-slate-400 group-hover:text-blue-600'}`}>
                                            {dayNum}
                                        </span>
                                        {isToday && (
                                            <span className="text-[9px] font-extrabold bg-blue-500 text-white px-2 py-0.5 rounded-full shadow-sm animate-pulse tracking-tighter">
                                                {t('today') || 'HOY'}
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl transition-all">
                        {/* Header */}
                        <div className="px-6 pt-4 pb-0" style={{ backgroundColor: colors.colorFondo1, color: colors.colorLetra }}>
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-0">
                                        <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                            Compra
                                        </span>
                                        <span className="bg-blue-400 text-blue-900 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                            {selectedDate.toLocaleDateString()}
                                        </span>
                                    </div>
                                    <h1 className="text-3xl font-black mb-0 leading-tight">
                                        {tModal('title')}
                                    </h1>
                                </div>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="text-white hover:bg-white/20 rounded-full p-2 flex-shrink-0"
                                >
                                    ✕
                                </button>
                            </div>
                            {/* Decorative spacer to match dashboard tabs height if needed, but here we just need spacing */}
                            <div className="h-4"></div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block tracking-wider">💰 Compras Totales</label>
                                    <div className="text-xl font-black text-blue-600">
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalPurchases)}
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block tracking-wider">📄 Facturas Registradas</label>
                                    <div className="text-xl font-black text-gray-800">
                                        {dailyPurchases.length}
                                    </div>
                                </div>
                            </div>

                            {!isFormOpen && (
                                <button
                                    onClick={handleNewPurchase}
                                    className="bg-blue-500 text-white px-6 py-2.5 rounded-lg hover:bg-blue-600 font-bold transition-all shadow-md active:scale-95 self-start flex items-center gap-2"
                                >
                                    ✨ {tModal('new')}
                                </button>
                            )}

                            {/* Purchase Form */}
                            {isFormOpen && (
                                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-blue-50 p-6 rounded-xl border border-blue-100 items-end shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
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

                                    <div className="flex gap-2">
                                        <button 
                                            type="submit" 
                                            disabled={isSubmitting}
                                            className={`flex-1 ${isSubmitting ? 'bg-blue-300' : 'bg-blue-500 hover:bg-blue-600'} text-white p-2.5 rounded-lg font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2`}
                                        >
                                            {isSubmitting ? <span className="animate-spin text-lg">⏳</span> : '💾'} {tModal('save')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsFormOpen(false);
                                                setEditingPurchase(null);
                                            }}
                                            className="px-4 bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 font-bold transition-all"
                                        >
                                            {tCommon('cancel')}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* Purchase Table */}
                            <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col">
                                <div className="overflow-y-auto max-h-[400px] scrollbar-thin scrollbar-thumb-gray-200">
                                    <table className="min-w-full divide-y divide-gray-100">
                                        <ThemedGridHeader>
                                            <ThemedGridHeaderCell className="text-[10px] tracking-widest">ID</ThemedGridHeaderCell>
                                            <ThemedGridHeaderCell className="text-[10px] tracking-widest">{tModal('provider')}</ThemedGridHeaderCell>
                                            <ThemedGridHeaderCell className="text-[10px] tracking-widest">{tModal('invoiceNumber')}</ThemedGridHeaderCell>
                                            <ThemedGridHeaderCell className="text-[10px] tracking-widest">Canal</ThemedGridHeaderCell>
                                            <ThemedGridHeaderCell className="text-[10px] tracking-widest text-right">{tModal('total')}</ThemedGridHeaderCell>
                                            <ThemedGridHeaderCell className="text-[10px] tracking-widest text-center">Acciones</ThemedGridHeaderCell>
                                        </ThemedGridHeader>
                                        <tbody className="bg-white divide-y divide-gray-50">
                                            {dailyPurchases.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400 italic">{tModal('noRecords')}</td>
                                                </tr>
                                            ) : (
                                                dailyPurchases.map((purchase) => (
                                                    <tr
                                                        key={purchase.IdCompra}
                                                        className={`hover:bg-blue-50/30 transition-colors group ${purchase.Status === 2 ? 'bg-red-50 opacity-40 grayscale' : ''}`}
                                                    >
                                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400 font-mono">#{purchase.IdCompra}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">{purchase.Proveedor}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-500">{purchase.NumeroFactura}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{purchase.CanalPago}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 text-right font-black">
                                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(purchase.Total)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                                            <div className="flex items-center justify-center gap-2">
                                                                {purchase.Status === 0 && (
                                                                    <button
                                                                        onClick={() => handleOpenDetailsModal(purchase)}
                                                                        className="text-gray-300 hover:text-green-600 transition-colors p-1"
                                                                        title="Productos"
                                                                    >
                                                                        📦
                                                                    </button>
                                                                )}
                                                                {purchase.Status !== 2 && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleEditPurchase(purchase)}
                                                                            className="text-gray-300 hover:text-blue-600 transition-colors p-1"
                                                                            title={tModal('edit')}
                                                                        >
                                                                            ✏️
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeletePurchase(purchase)}
                                                                            className="text-gray-300 hover:text-red-500 transition-colors p-1"
                                                                            title={tModal('delete')}
                                                                        >
                                                                            🗑️
                                                                        </button>
                                                                    </>
                                                                )}
                                                                {purchase.Status === 2 && (
                                                                    <span className="text-[10px] font-black text-red-600 uppercase tracking-wider">Anulada</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button onClick={() => setIsModalOpen(false)} className="px-8 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-bold transition-all">
                                {tModal('close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Purchase Details Modal (Standardized Nested) */}
            {isDetailsModalOpen && selectedPurchaseForDetails && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-6 pt-4 pb-0" style={{ backgroundColor: colors.colorFondo1, color: colors.colorLetra }}>
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-0">
                                        <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                            Productos
                                        </span>
                                        <span className="bg-green-400 text-green-900 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                            {selectedPurchaseForDetails.NumeroFactura} — {selectedPurchaseForDetails.Proveedor}
                                        </span>
                                    </div>
                                    <h1 className="text-3xl font-black mb-0 leading-tight">
                                        {tDetails('title')}
                                    </h1>
                                </div>
                                <button
                                    onClick={() => setIsDetailsModalOpen(false)}
                                    className="text-white hover:bg-white/20 rounded-full p-2 flex-shrink-0"
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="h-4"></div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
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
                                        <div className="absolute z-60 w-full top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
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
                                                        className="w-full bg-green-100 text-green-700 p-2 rounded-lg font-bold text-xs hover:bg-green-200 transition-colors"
                                                    >
                                                        ✨ {tDetails('createProductButton')}
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

                                <button type="submit" className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 font-bold transition-all shadow-md active:scale-95 md:col-span-1 py-2.5">
                                    ➕
                                </button>
                            </form>

                            {/* Details Table */}
                            <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm flex flex-col flex-1 min-h-[300px]">
                                <div className="overflow-y-auto max-h-[400px] scrollbar-thin scrollbar-thumb-gray-200">
                                    <table className="min-w-full divide-y divide-gray-100">
                                        <ThemedGridHeader>
                                            <ThemedGridHeaderCell className="text-[10px] tracking-widest">Cant.</ThemedGridHeaderCell>
                                            <ThemedGridHeaderCell className="text-[10px] tracking-widest">Producto</ThemedGridHeaderCell>
                                            <ThemedGridHeaderCell className="text-[10px] tracking-widest text-right">Costo</ThemedGridHeaderCell>
                                            <ThemedGridHeaderCell className="text-[10px] tracking-widest text-right">Total</ThemedGridHeaderCell>
                                            <ThemedGridHeaderCell className="text-[10px] tracking-widest text-center">Acciones</ThemedGridHeaderCell>
                                        </ThemedGridHeader>
                                    <tbody className="bg-white divide-y divide-gray-50">
                                        {purchaseDetails.map((detail) => (
                                            <tr key={detail.IdDetalleCompra} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 text-sm font-bold text-gray-700">
                                                    {editingDetailId === detail.IdDetalleCompra ? (
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            className="w-20 p-1 border rounded text-sm"
                                                            value={editQuantity}
                                                            onChange={(e) => setEditQuantity(e.target.value)}
                                                        />
                                                    ) : (
                                                        <>
                                                            {detail.Cantidad} <span className="text-[10px] font-normal text-gray-400">{detail.UnidadMedidaCompra}</span>
                                                        </>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="text-sm font-bold text-gray-800">{detail.Producto}</div>
                                                    <div className="text-[10px] text-gray-400 font-mono">#{detail.Codigo}</div>
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm">
                                                    {editingDetailId === detail.IdDetalleCompra ? (
                                                        <input
                                                            type="text"
                                                            className="w-24 p-1 border rounded text-right text-sm font-bold text-green-600"
                                                            value={editCost}
                                                            onChange={(e) => setEditCost(e.target.value.replace(/[^0-9.]/g, ''))}
                                                        />
                                                    ) : (
                                                        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(detail.Costo)
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm font-black text-green-600">
                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(detail.Total)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {editingDetailId === detail.IdDetalleCompra ? (
                                                            <>
                                                                <button onClick={() => handleEditDetailSave(detail.IdDetalleCompra)} className="text-green-600 hover:scale-125 transition-all">✅</button>
                                                                <button onClick={handleEditDetailCancel} className="text-red-500 hover:scale-125 transition-all">✕</button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button onClick={() => handleEditDetailStart(detail)} className="text-gray-300 hover:text-blue-500 transition-colors">✏️</button>
                                                                <button onClick={() => handleDeleteDetail(detail.IdDetalleCompra)} className="text-gray-300 hover:text-red-500 transition-colors">🗑️</button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button onClick={() => setIsDetailsModalOpen(false)} className="px-8 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-bold transition-all">
                                {tDetails('close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Creation Modal (Standardized Nested) */}
            {isProductModalOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4 backdrop-blur-md">
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
                                    ✕
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
                                <button type="submit" className="flex-1 bg-green-600 text-white p-3 rounded-xl font-black shadow-lg hover:bg-green-700 active:scale-95 transition-all">Crear Producto</button>
                                <button type="button" onClick={() => setIsProductModalOpen(false)} className="px-6 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all">Cancelar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
