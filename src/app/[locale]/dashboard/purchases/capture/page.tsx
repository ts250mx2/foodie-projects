'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

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
    Presentacion: string;
    IdPresentacion: number;
}

interface Category {
    IdCategoria: number;
    Categoria: string;
}

interface Presentation {
    IdPresentacion: number;
    Presentacion: string;
}

interface PurchaseDetail {
    IdDetalleCompra: number;
    IdProducto: number;
    Cantidad: number;
    Costo: number;
    Status: number;
    Codigo: string;
    Producto: string;
    Presentacion: string;
    Total: number;
}

export default function PurchasesCapturePage() {
    const t = useTranslations('PurchasesCapture');
    const tModal = useTranslations('PurchasesModal');
    const tDetails = useTranslations('PurchaseDetailsModal');

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
    const [presentations, setPresentations] = useState<Presentation[]>([]);
    const [productFormData, setProductFormData] = useState({
        producto: '',
        codigo: '',
        idCategoria: '',
        idPresentacion: '',
        precio: '',
        iva: ''
    });

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

            // Load persisted filters
            const savedBranch = localStorage.getItem('lastSelectedBranchPurchases');
            const savedMonth = localStorage.getItem('lastSelectedMonthPurchases');
            const savedYear = localStorage.getItem('lastSelectedYearPurchases');

            if (savedBranch) setSelectedBranch(savedBranch);
            if (savedMonth) setSelectedMonth(parseInt(savedMonth));
            if (savedYear) setSelectedYear(parseInt(savedYear));
        }
    }, [project]);

    useEffect(() => {
        if (selectedBranch) localStorage.setItem('lastSelectedBranchPurchases', selectedBranch);
    }, [selectedBranch]);

    useEffect(() => {
        localStorage.setItem('lastSelectedMonthPurchases', selectedMonth.toString());
    }, [selectedMonth]);

    useEffect(() => {
        localStorage.setItem('lastSelectedYearPurchases', selectedYear.toString());
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

                const savedBranch = localStorage.getItem('lastSelectedBranchPurchases');
                if (!savedBranch && !selectedBranch) {
                    setSelectedBranch(data.data[0].IdSucursal.toString());
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

    const fetchPresentations = async () => {
        try {
            const response = await fetch(`/api/presentations?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setPresentations(data.data);
            }
        } catch (error) {
            console.error('Error fetching presentations:', error);
        }
    };

    const handleOpenDetailsModal = async (purchase: Purchase) => {
        setSelectedPurchaseForDetails(purchase);
        await fetchPurchaseDetails(purchase.IdCompra);
        await fetchProducts();
        await fetchCategories();
        await fetchPresentations();
        setIsDetailsModalOpen(true);
    };

    const fetchPurchaseDetails = async (purchaseId: number) => {
        if (!project) return;
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                purchaseId: purchaseId.toString()
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
                    cost: parseFloat(detailFormData.cost)
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
                    idPresentacion: parseInt(productFormData.idPresentacion),
                    precio: parseFloat(productFormData.precio),
                    iva: parseFloat(productFormData.iva)
                })
            });

            const data = await response.json();

            if (response.ok) {
                await fetchProducts();

                // Auto-select the newly created product
                const newProduct = products.find(p => p.IdProducto === data.productId) ||
                    { IdProducto: data.productId, Producto: productFormData.producto, Codigo: productFormData.codigo, Presentacion: '', IdPresentacion: parseInt(productFormData.idPresentacion) };

                setSelectedProduct(newProduct);
                setDetailFormData({ ...detailFormData, productId: data.productId.toString() });
                setProductSearch(`${productFormData.codigo} - ${productFormData.producto}`);

                // Reset and close modal
                setProductFormData({
                    producto: '',
                    codigo: '',
                    idCategoria: '',
                    idPresentacion: '',
                    precio: '',
                    iva: ''
                });
                setIsProductModalOpen(false);
                setShowProductDropdown(false);
            } else {
                // Show error message
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
            idPresentacion: '',
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
            providerId: purchase.IdProveedor.toString(),
            invoiceNumber: purchase.NumeroFactura,
            paymentChannelId: purchase.IdCanalPago.toString(),
            reference: purchase.Referencia || '',
            payTo: purchase.PagarA || '',
            total: purchase.Total.toString()
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
        if (!selectedDate || !project || !selectedBranch || !formData.providerId || !formData.invoiceNumber || !formData.paymentChannelId || !formData.total) return;

        try {
            const url = editingPurchase ? '/api/purchases/daily' : '/api/purchases/daily';
            const method = editingPurchase ? 'PUT' : 'POST';

            const body = editingPurchase ? {
                projectId: project.idProyecto,
                purchaseId: editingPurchase.IdCompra,
                providerId: parseInt(formData.providerId),
                invoiceNumber: formData.invoiceNumber,
                paymentChannelId: parseInt(formData.paymentChannelId),
                reference: formData.reference,
                payTo: formData.payTo,
                total: parseFloat(formData.total)
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
                total: parseFloat(formData.total)
            };

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

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
            }
        } catch (error) {
            console.error('Error saving purchase:', error);
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

        for (let i = 0; i < firstDayOfWeek; i++) {
            days.push(null);
        }

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

            {/* Calendar */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col">
                <div className="grid grid-cols-7 bg-blue-500 border-b border-blue-600">
                    {weekDays.map(day => (
                        <div key={day} className="py-3 text-center text-sm font-semibold text-white uppercase tracking-wider">
                            {t(`days.${day}`)}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 flex-1 auto-rows-[1fr]">
                    {calendarDays.map((date, index) => {
                        if (!date) {
                            return <div key={`empty-${index}`} className="bg-gray-50/50 border-b border-r border-gray-300" />;
                        }

                        const isToday = new Date().toDateString() === date.toDateString();
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        const dayDetails = monthlyPurchasesDetails[date.getDate()];
                        const dayTotal = dayDetails ? dayDetails.reduce((sum, d) => sum + d.total, 0) : 0;

                        return (
                            <div
                                key={date.toISOString()}
                                onClick={() => handleDayClick(date)}
                                className={`
                                    relative border-b border-r border-gray-300 p-2 transition-all hover:bg-blue-50 cursor-pointer group min-h-[120px] flex flex-col
                                    ${isToday ? 'bg-blue-50/30' : ''}
                                `}
                            >
                                <span className={`
                                    text-sm font-medium
                                    ${isToday ? 'bg-blue-500 text-white px-2 py-1 rounded-full' : isWeekend ? 'text-gray-400' : 'text-gray-700'}
                                `}>
                                    {date.getDate()}
                                </span>
                                {dayDetails && (
                                    <div className="mt-2 space-y-1 flex-1">
                                        <div className="text-xs font-bold text-blue-800 border-b border-blue-200 pb-1 mb-1">
                                            Total: ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(dayTotal)}
                                        </div>
                                        {dayDetails.map((detail, idx) => (
                                            <div key={idx} className="text-xs">
                                                <div className="font-medium text-gray-700">{detail.provider}</div>
                                                <div className="font-semibold text-blue-600">
                                                    ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(detail.total)} ({detail.itemCount} {detail.itemCount === 1 ? 'producto' : 'productos'})
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && selectedDate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto flex flex-col gap-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">
                                {tModal('title')} - {selectedDate.toLocaleDateString()}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700 text-xl font-bold">✕</button>
                        </div>

                        {/* New Purchase Button */}
                        {!isFormOpen && (
                            <button
                                onClick={handleNewPurchase}
                                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 font-medium shadow-sm transition-colors self-start"
                            >
                                {tModal('new')}
                            </button>
                        )}

                        {/* Form */}
                        {isFormOpen && (
                            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg">
                                {/* Provider */}
                                <div className="flex flex-col relative">
                                    <label className="text-xs font-semibold text-gray-600 mb-1">{tModal('provider')} *</label>
                                    <input
                                        type="text"
                                        value={providerSearch}
                                        onChange={(e) => {
                                            setProviderSearch(e.target.value);
                                            setShowProviderDropdown(true);
                                            setFormData({ ...formData, providerId: '' });
                                            setSelectedProvider(null);
                                        }}
                                        onFocus={() => setShowProviderDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowProviderDropdown(false), 200)}
                                        placeholder={tModal('searchProvider')}
                                        className="p-2 border rounded text-sm w-full"
                                        required
                                    />
                                    {showProviderDropdown && (
                                        <div className="absolute z-10 w-full mt-1 top-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                            {providers
                                                .filter(p => providerSearch ? p.Proveedor.toLowerCase().includes(providerSearch.toLowerCase()) : true)
                                                .map(p => (
                                                    <div
                                                        key={p.IdProveedor}
                                                        onClick={() => {
                                                            setSelectedProvider(p);
                                                            setFormData({ ...formData, providerId: p.IdProveedor.toString() });
                                                            setProviderSearch(p.Proveedor);
                                                            setShowProviderDropdown(false);
                                                        }}
                                                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer"
                                                    >
                                                        <div className="font-medium text-sm">{p.Proveedor}</div>
                                                    </div>
                                                ))}
                                            {providers.filter(p => providerSearch ? p.Proveedor.toLowerCase().includes(providerSearch.toLowerCase()) : true).length === 0 && (
                                                <div className="px-3 py-2 text-sm text-gray-400 italic">
                                                    {tModal('noResults')}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Invoice Number */}
                                <div className="flex flex-col">
                                    <label className="text-xs font-semibold text-gray-600 mb-1">{tModal('invoiceNumber')} *</label>
                                    <input
                                        type="text"
                                        className="p-2 border rounded text-sm uppercase"
                                        value={formData.invoiceNumber}
                                        onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value.toUpperCase() })}
                                        required
                                    />
                                </div>

                                {/* Payment Channel */}
                                <div className="flex flex-col relative">
                                    <label className="text-xs font-semibold text-gray-600 mb-1">{tModal('paymentChannel')} *</label>
                                    <input
                                        type="text"
                                        value={paymentChannelSearch}
                                        onChange={(e) => {
                                            setPaymentChannelSearch(e.target.value);
                                            setShowPaymentChannelDropdown(true);
                                            setFormData({ ...formData, paymentChannelId: '' });
                                            setSelectedPaymentChannel(null);
                                        }}
                                        onFocus={() => setShowPaymentChannelDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowPaymentChannelDropdown(false), 200)}
                                        placeholder="Buscar canal de pago..."
                                        className="p-2 border rounded text-sm w-full"
                                        required
                                    />
                                    {showPaymentChannelDropdown && (
                                        <div className="absolute z-10 w-full mt-1 top-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                            {paymentChannels
                                                .filter(pc => paymentChannelSearch ? pc.CanalPago.toLowerCase().includes(paymentChannelSearch.toLowerCase()) : true)
                                                .map(pc => (
                                                    <div
                                                        key={pc.IdCanalPago}
                                                        onClick={() => {
                                                            setSelectedPaymentChannel(pc);
                                                            setFormData({ ...formData, paymentChannelId: pc.IdCanalPago.toString() });
                                                            setPaymentChannelSearch(pc.CanalPago);
                                                            setShowPaymentChannelDropdown(false);
                                                        }}
                                                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer"
                                                    >
                                                        <div className="font-medium text-sm">{pc.CanalPago}</div>
                                                    </div>
                                                ))}
                                            {paymentChannels.filter(pc => paymentChannelSearch ? pc.CanalPago.toLowerCase().includes(paymentChannelSearch.toLowerCase()) : true).length === 0 && (
                                                <div className="px-3 py-2 text-sm text-gray-400 italic">
                                                    {tModal('noResults')}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Reference */}
                                <div className="flex flex-col">
                                    <label className="text-xs font-semibold text-gray-600 mb-1">{tModal('reference')}</label>
                                    <input
                                        type="text"
                                        className="p-2 border rounded text-sm"
                                        value={formData.reference}
                                        onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                                    />
                                </div>

                                {/* Pay To */}
                                <div className="flex flex-col">
                                    <label className="text-xs font-semibold text-gray-600 mb-1">{tModal('payTo')}</label>
                                    <input
                                        type="text"
                                        className="p-2 border rounded text-sm"
                                        value={formData.payTo}
                                        onChange={(e) => setFormData({ ...formData, payTo: e.target.value })}
                                    />
                                </div>

                                {/* Total */}
                                <div className="flex flex-col">
                                    <label className="text-xs font-semibold text-gray-600 mb-1">{tModal('total')} *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="p-2 border rounded text-sm"
                                        value={formData.total}
                                        onChange={(e) => setFormData({ ...formData, total: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="md:col-span-3 flex gap-2">
                                    <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 font-medium shadow-sm transition-colors">
                                        {tModal('save')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsFormOpen(false);
                                            setEditingPurchase(null);
                                        }}
                                        className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 font-medium shadow-sm transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Grid */}
                        <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{tModal('date')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{tModal('provider')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{tModal('invoiceNumber')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{tModal('paymentChannel')}</th>
                                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{tModal('total')}</th>
                                        <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">{tModal('actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {dailyPurchases.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-400 italic">{tModal('noRecords')}</td>
                                        </tr>
                                    ) : (
                                        dailyPurchases.map((purchase) => (
                                            <tr
                                                key={purchase.IdCompra}
                                                className={`hover:bg-gray-50 transition-colors ${purchase.Status === 2 ? 'line-through text-gray-400' : ''}`}
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{purchase.IdCompra}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {new Date(purchase.FechaCompra).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{purchase.Proveedor}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{purchase.NumeroFactura}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{purchase.CanalPago}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                                                    ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(purchase.Total.toString()))}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                                    {purchase.Status === 0 && (
                                                        <button
                                                            onClick={() => handleOpenDetailsModal(purchase)}
                                                            className="text-green-600 hover:text-green-800 mr-3"
                                                            title="Productos"
                                                        >
                                                            📦
                                                        </button>
                                                    )}
                                                    {purchase.Status !== 2 && (
                                                        <>
                                                            <button
                                                                onClick={() => handleEditPurchase(purchase)}
                                                                className="text-blue-600 hover:text-blue-800 mr-3"
                                                                title={tModal('edit')}
                                                            >
                                                                ✏️
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeletePurchase(purchase)}
                                                                className="text-red-600 hover:text-red-800"
                                                                title={tModal('delete')}
                                                            >
                                                                🗑️
                                                            </button>
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                <tfoot className="bg-gray-50 font-bold border-t border-gray-200">
                                    <tr>
                                        <td colSpan={5} className="px-6 py-4 text-right text-gray-700 uppercase text-xs tracking-wider">{tModal('total')}</td>
                                        <td className="px-6 py-4 text-right text-blue-600 text-lg">${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalPurchases)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-100">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                            >
                                {tModal('close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Purchase Details Modal */}
            {isDetailsModalOpen && selectedPurchaseForDetails && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto flex flex-col gap-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">
                                {tDetails('title')} - {selectedPurchaseForDetails.NumeroFactura}
                            </h2>
                            <button onClick={() => setIsDetailsModalOpen(false)} className="text-gray-500 hover:text-gray-700 text-xl font-bold">✕</button>
                        </div>

                        {/* Add Product Form */}
                        <form onSubmit={handleAddDetail} className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg items-end">
                            {/* Product Drilldown */}
                            <div className="flex flex-col relative">
                                <label className="text-xs font-semibold text-gray-600 mb-1">{tDetails('product')} *</label>
                                <input
                                    type="text"
                                    value={productSearch}
                                    onChange={(e) => {
                                        setProductSearch(e.target.value);
                                        setShowProductDropdown(true);
                                        setDetailFormData({ ...detailFormData, productId: '' });
                                        setSelectedProduct(null);
                                    }}
                                    onFocus={() => setShowProductDropdown(true)}
                                    placeholder={tDetails('searchProduct')}
                                    className="p-2 border rounded text-sm w-full"
                                    required
                                />
                                {showProductDropdown && (
                                    <div className="absolute z-10 w-full mt-1 top-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                        {products
                                            .filter(p => productSearch ?
                                                p.Producto.toLowerCase().includes(productSearch.toLowerCase()) ||
                                                p.Codigo.toLowerCase().includes(productSearch.toLowerCase())
                                                : true)
                                            .map(p => (
                                                <div
                                                    key={p.IdProducto}
                                                    onClick={() => {
                                                        setSelectedProduct(p);
                                                        setDetailFormData({ ...detailFormData, productId: p.IdProducto.toString() });
                                                        setProductSearch(`${p.Codigo} - ${p.Producto}`);
                                                        setShowProductDropdown(false);
                                                    }}
                                                    className="px-3 py-2 hover:bg-green-50 cursor-pointer"
                                                >
                                                    <div className="font-medium text-sm">{p.Codigo} - {p.Producto}</div>
                                                    <div className="text-xs text-gray-500">{p.Presentacion}</div>
                                                </div>
                                            ))}
                                        {products.filter(p => productSearch ?
                                            p.Producto.toLowerCase().includes(productSearch.toLowerCase()) ||
                                            p.Codigo.toLowerCase().includes(productSearch.toLowerCase())
                                            : true).length === 0 && productSearch && (
                                                <div className="px-3 py-2">
                                                    <div className="text-sm text-gray-400 italic mb-2">
                                                        {tDetails('noResults')}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={openProductModal}
                                                        className="w-full px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 font-medium text-sm transition-colors flex items-center justify-center gap-2"
                                                    >
                                                        {tDetails('createProductButton')}
                                                    </button>
                                                </div>
                                            )}
                                    </div>
                                )}
                            </div>

                            {/* Quantity */}
                            <div className="flex flex-col">
                                <label className="text-xs font-semibold text-gray-600 mb-1">{tDetails('quantity')} *</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="p-2 border rounded text-sm flex-1"
                                        value={detailFormData.quantity}
                                        onChange={(e) => setDetailFormData({ ...detailFormData, quantity: e.target.value })}
                                        required
                                    />
                                    {selectedProduct && (
                                        <span className="text-xs text-gray-600 whitespace-nowrap">{selectedProduct.Presentacion}</span>
                                    )}
                                </div>
                            </div>

                            {/* Cost */}
                            <div className="flex flex-col">
                                <label className="text-xs font-semibold text-gray-600 mb-1">{tDetails('cost')} *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="p-2 border rounded text-sm"
                                    value={detailFormData.cost}
                                    onChange={(e) => setDetailFormData({ ...detailFormData, cost: e.target.value })}
                                    required
                                />
                            </div>

                            {/* Total (calculated) */}
                            <div className="flex flex-col">
                                <label className="text-xs font-semibold text-gray-600 mb-1">{tDetails('total')}</label>
                                <input
                                    type="text"
                                    className="p-2 border rounded text-sm bg-gray-100"
                                    value={detailFormData.quantity && detailFormData.cost ?
                                        `$${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(detailFormData.quantity) * parseFloat(detailFormData.cost))}`
                                        : '$0.00'}
                                    disabled
                                />
                            </div>

                            {/* Add Button */}
                            <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 font-medium shadow-sm transition-colors md:col-span-4">
                                {tDetails('add')}
                            </button>
                        </form>

                        {/* Details Grid */}
                        <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{tDetails('quantity')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{tDetails('presentation')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{tDetails('code')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{tDetails('product')}</th>
                                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{tDetails('cost')}</th>
                                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{tDetails('total')}</th>
                                        <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {purchaseDetails.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-400 italic">{tDetails('noDetails')}</td>
                                        </tr>
                                    ) : (
                                        purchaseDetails.map((detail) => (
                                            <tr key={detail.IdDetalleCompra} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{detail.Cantidad}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{detail.Presentacion}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{detail.Codigo}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{detail.Producto}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(detail.Costo.toString()))}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(detail.Total)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                                    <button
                                                        onClick={() => handleDeleteDetail(detail.IdDetalleCompra)}
                                                        className="text-red-600 hover:text-red-800"
                                                        title={tDetails('delete')}
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                <tfoot className="bg-gray-50 font-bold border-t border-gray-200">
                                    <tr>
                                        <td colSpan={5} className="px-6 py-4 text-right text-gray-700 uppercase text-xs tracking-wider">{tDetails('total')}</td>
                                        <td className="px-6 py-4 text-right text-green-600 text-lg">
                                            ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(purchaseDetails.reduce((sum, d) => sum + d.Total, 0))}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-100">
                            <button
                                onClick={() => setIsDetailsModalOpen(false)}
                                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                            >
                                {tDetails('close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Creation Modal */}
            {isProductModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">
                            {tDetails('createProduct')}
                        </h2>
                        <form onSubmit={handleCreateProduct} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {tDetails('product')} *
                                </label>
                                <input
                                    type="text"
                                    value={productFormData.producto}
                                    onChange={(e) => setProductFormData({ ...productFormData, producto: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {tDetails('code')} *
                                </label>
                                <input
                                    type="text"
                                    value={productFormData.codigo}
                                    onChange={(e) => setProductFormData({ ...productFormData, codigo: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Categoría *
                                </label>
                                <select
                                    value={productFormData.idCategoria}
                                    onChange={(e) => setProductFormData({ ...productFormData, idCategoria: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                    required
                                >
                                    <option value="">Seleccionar...</option>
                                    {categories.map((category) => (
                                        <option key={category.IdCategoria} value={category.IdCategoria}>
                                            {category.Categoria}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {tDetails('presentation')} *
                                </label>
                                <select
                                    value={productFormData.idPresentacion}
                                    onChange={(e) => setProductFormData({ ...productFormData, idPresentacion: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                    required
                                >
                                    <option value="">Seleccionar...</option>
                                    {presentations.map((presentation) => (
                                        <option key={presentation.IdPresentacion} value={presentation.IdPresentacion}>
                                            {presentation.Presentacion}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Precio *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={productFormData.precio}
                                    onChange={(e) => setProductFormData({ ...productFormData, precio: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    IVA (%) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={productFormData.iva}
                                    onChange={(e) => setProductFormData({ ...productFormData, iva: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsProductModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                                >
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
