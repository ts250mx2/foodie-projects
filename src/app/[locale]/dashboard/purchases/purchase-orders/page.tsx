'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type Product = {
    IdProducto: number;
    Producto: string;
    Codigo: string;
    Precio?: number;
    Costo?: number;
    IVA?: number;
    Categoria?: string;
};

type Provider = {
    IdProveedor: number;
    Proveedor: string;
};

type Branch = {
    IdSucursal: number;
    Sucursal: string;
};

type OrderItem = {
    idProducto: number;
    producto: string;
    cantidad: number;
    precioUnitario: number;
    total: number;
};

type PurchaseOrder = {
    IdOrdenCompra: number;
    IdProveedor: number;
    Proveedor: string;
    IdSucursal: number;
    Sucursal: string;
    FechaOrden: string;
    FechaEntrega: string | null;
    FechaProgramadaEntrega: string | null;
    Status: number;
    Notas?: string;
};

export default function PurchaseOrdersPage() {
    const t = useTranslations('PurchaseOrders');
    const { colors } = useTheme();
    const params = useParams();
    const projectId = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('project') || '{}').idProyecto : null;

    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [providers, setProviders] = useState<Provider[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);

    // Form state
    const [selectedProvider, setSelectedProvider] = useState<number | ''>('');
    const [providerSearch, setProviderSearch] = useState('');
    const [isProviderListOpen, setIsProviderListOpen] = useState(false);
    
    const [selectedBranch, setSelectedBranch] = useState<number | ''>('');
    const [esInterna, setEsInterna] = useState(false);
    const [fechaEntrega, setFechaEntrega] = useState('');
    const [fechaProgramada, setFechaProgramada] = useState('');
    const [notas, setNotas] = useState('');
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [projectLogo, setProjectLogo] = useState<string | null>(null);

    // Product search in modal
    const [productSearch, setProductSearch] = useState('');
    const [isProductListOpen, setIsProductListOpen] = useState(false);

    // Refs for outside clicks
    const productListRef = useRef<HTMLDivElement>(null);
    const providerListRef = useRef<HTMLDivElement>(null);

    const fetchOrders = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await fetch(`/api/purchases/purchase-orders?projectId=${projectId}`);
            const data = await res.json();
            if (data.success) setOrders(data.data);
        } catch (error) {
            console.error('Error fetching orders:', error);
        }
    }, [projectId]);

    const fetchProjectData = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await fetch(`/api/project-header?projectId=${projectId}`);
            const data = await res.json();
            if (data.success) {
                setProjectLogo(data.logo64);
            }
        } catch (error) {
            console.error('Error fetching project data:', error);
        }
    }, [projectId]);

    const fetchProviders = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await fetch(`/api/providers?projectId=${projectId}`);
            const data = await res.json();
            if (data.success) setProviders(data.data);
        } catch (error) {
            console.error('Error fetching providers:', error);
        }
    }, [projectId]);

    const fetchBranches = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await fetch(`/api/branches?projectId=${projectId}`);
            const data = await res.json();
            if (data.success) {
                setBranches(data.data);
                // Default branch if only one exists
                if (data.data.length === 1) {
                    setSelectedBranch(data.data[0].IdSucursal);
                }
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        }
    }, [projectId]);

    const fetchProducts = useCallback(async () => {
        if (!projectId) return;
        try {
            // Fetch products where IdTipoProducto = 0 (Productos base / Insumos)
            const res = await fetch(`/api/products?projectId=${projectId}&tipoProducto=0`);
            const data = await res.json();
            if (data.success) setProducts(data.data);
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    }, [projectId]);

    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            await Promise.all([fetchOrders(), fetchProviders(), fetchBranches(), fetchProducts(), fetchProjectData()]);
            setIsLoading(false);
        };
        init();
    }, [fetchOrders, fetchProviders, fetchBranches, fetchProducts, fetchProjectData]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (productListRef.current && !productListRef.current.contains(event.target as Node)) {
                setIsProductListOpen(false);
            }
            if (providerListRef.current && !providerListRef.current.contains(event.target as Node)) {
                setIsProviderListOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectProvider = (provider: Provider) => {
        setSelectedProvider(provider.IdProveedor);
        setProviderSearch(provider.Proveedor);
        setIsProviderListOpen(false);
    };

    const getCategoryEmoji = (category?: string) => {
        if (!category) return '📦';
        const cat = category.toLowerCase();
        if (cat.includes('carne') || cat.includes('res') || cat.includes('cerdo')) return '🥩';
        if (cat.includes('ave') || cat.includes('pollo')) return '🍗';
        if (cat.includes('pescado') || cat.includes('marisco')) return '🐟';
        if (cat.includes('lacteo') || cat.includes('queso') || cat.includes('leche')) return '🧀';
        if (cat.includes('fruta') || cat.includes('verdura')) return '🥦';
        if (cat.includes('abarrote') || cat.includes('especia') || cat.includes('grano')) return '🧂';
        if (cat.includes('bebida')) return '🥤';
        if (cat.includes('alcohol') || cat.includes('vino') || cat.includes('cerveza')) return '🍺';
        if (cat.includes('desechable') || cat.includes('empaque')) return '🥡';
        if (cat.includes('limpieza')) return '🧼';
        return '📦';
    };

    const handleAddProduct = (product: Product) => {
        const existing = orderItems.find(item => item.idProducto === product.IdProducto);
        if (existing) {
            setOrderItems(orderItems.map(item => 
                item.idProducto === product.IdProducto 
                ? { ...item, cantidad: item.cantidad + 1, total: (item.cantidad + 1) * item.precioUnitario }
                : item
            ));
        } else {
            setOrderItems([...orderItems, {
                idProducto: product.IdProducto,
                producto: product.Producto,
                cantidad: 1,
                precioUnitario: product.Costo || 0,
                total: product.Costo || 0
            }]);
        }
        setIsProductListOpen(false);
        setProductSearch('');
    };

    const handleUpdateItem = (index: number, field: keyof OrderItem, value: any) => {
        const newItems = [...orderItems];
        const item = { ...newItems[index], [field]: value };
        if (field === 'cantidad' || field === 'precioUnitario') {
            item.total = item.cantidad * item.precioUnitario;
        }
        newItems[index] = item;
        setOrderItems(newItems);
    };

    const handleRemoveItem = (index: number) => {
        setOrderItems(orderItems.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if ((!selectedProvider && !esInterna) || !selectedBranch || orderItems.length === 0) {
            alert('Por favor selecciona un proveedor (o marca como interna), una sucursal y agrega al menos un producto.');
            return;
        }

        try {
            const url = '/api/purchases/purchase-orders';
            const method = editingOrder ? 'PUT' : 'POST';
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    idOrdenCompra: editingOrder?.IdOrdenCompra,
                    idProveedor: esInterna ? null : selectedProvider,
                    idSucursal: selectedBranch,
                    esInterna,
                    fechaEntrega: fechaEntrega || null,
                    fechaProgramadaEntrega: fechaProgramada || null,
                    notas,
                    items: orderItems
                })
            });

            const data = await res.json();
            if (data.success) {
                alert(editingOrder ? 'Orden actualizada con éxito' : t('successAdd'));
                closeModal();
                fetchOrders();
            } else {
                alert(t('errorAdd'));
            }
        } catch (error) {
            console.error('Error saving order:', error);
            alert(t('errorAdd'));
        }
    };

    const handleEdit = async (order: PurchaseOrder) => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/purchases/purchase-orders/${order.IdOrdenCompra}?projectId=${projectId}`);
            const data = await res.json();
            
            if (data.success) {
                const { header, items } = data.data;
                setEditingOrder(order);
                setEsInterna(header.EsInterna === 1);
                setSelectedProvider(header.IdProveedor);
                setProviderSearch(header.Proveedor);
                setSelectedBranch(header.IdSucursal);
                setFechaProgramada(header.FechaProgramadaEntrega ? header.FechaProgramadaEntrega.split('T')[0] : '');
                setNotas(header.Notas || '');
                setOrderItems(items.map((it: any) => ({
                    idProducto: it.IdProducto,
                    producto: it.Producto,
                    cantidad: it.Cantidad,
                    precioUnitario: it.PrecioUnitario,
                    total: it.Total
                })));
                setIsModalOpen(true);
            } else {
                alert('Error al cargar detalles de la orden');
            }
        } catch (error) {
            console.error('Error fetching details for edit:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (order: PurchaseOrder) => {
        if (!confirm('¿Estás seguro de que deseas borrar esta orden de compra?')) return;
        
        try {
            const res = await fetch(`/api/purchases/purchase-orders?projectId=${projectId}&id=${order.IdOrdenCompra}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                fetchOrders();
            } else {
                alert('Error al borrar la orden');
            }
        } catch (error) {
            console.error('Error deleting order:', error);
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingOrder(null);
        setOrderItems([]);
        setSelectedProvider('');
        setProviderSearch('');
        setEsInterna(false);
        setNotas('');
        setFechaProgramada('');
        if (branches.length !== 1) {
            setSelectedBranch('');
        }
    };

    const exportOrderToPDF = async (order: PurchaseOrder) => {
        try {
            const res = await fetch(`/api/purchases/purchase-orders/${order.IdOrdenCompra}?projectId=${projectId}`);
            const data = await res.json();
            
            if (!data.success) {
                alert('Error al obtener los detalles de la orden');
                return;
            }

            const { header, items } = data.data;
            const doc = new jsPDF();
            
            // Logo
            if (projectLogo) {
                try {
                    const imgType = projectLogo.startsWith('data:image/png') ? 'PNG' : 'JPEG';
                    doc.addImage(projectLogo, imgType, 20, 10, 30, 30);
                } catch (e) {
                    console.error('Error adding logo to PDF:', e);
                }
            }

            // Header Section
            doc.setFontSize(22);
            doc.setTextColor(0, 0, 0);
            doc.text(header.EsInterna ? 'ORDEN DE COMPRA INTERNA' : 'ORDEN DE COMPRA', 105, 25, { align: 'center' });
            
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Folio: OC-${header.IdOrdenCompra}`, 190, 35, { align: 'right' });
            doc.text(`Fecha de Emisión: ${new Date(header.FechaOrden).toLocaleString()}`, 190, 40, { align: 'right' });
            
            // Info Boxes
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.text('INFORMACIÓN DEL PROVEEDOR', 20, 55);
            doc.line(20, 57, 95, 57);
            doc.setFontSize(10);
            doc.text(header.Proveedor, 20, 63);

            doc.setFontSize(12);
            doc.text('DATOS DE ENTREGA', 115, 55);
            doc.line(115, 57, 190, 57);
            doc.setFontSize(10);
            doc.text(`Sucursal: ${header.Sucursal}`, 115, 63);
            doc.text(`Programada: ${header.FechaProgramadaEntrega ? new Date(header.FechaProgramadaEntrega).toLocaleDateString() : 'N/A'}`, 115, 68);

            // Grouping logic if internal
            let tableData = [];
            if (header.EsInterna) {
                const groups: { [key: string]: any[] } = {};
                items.forEach((item: any) => {
                    const cat = item.Categoria || 'Sin Categoría';
                    if (!groups[cat]) groups[cat] = [];
                    groups[cat].push(item);
                });

                Object.keys(groups).sort().forEach(cat => {
                    tableData.push([{ content: cat, colSpan: 5, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } }]);
                    groups[cat].forEach((item: any) => {
                        tableData.push([
                            item.Codigo,
                            item.Producto,
                            item.Cantidad,
                            `$${Number(item.PrecioUnitario).toFixed(2)}`,
                            `$${Number(item.Total).toFixed(2)}`
                        ]);
                    });
                });
            } else {
                tableData = items.map((item: any) => [
                    item.Codigo,
                    item.Producto,
                    item.Cantidad,
                    `$${Number(item.PrecioUnitario).toFixed(2)}`,
                    `$${Number(item.Total).toFixed(2)}`
                ]);
            }

            // Items Table
            autoTable(doc, {
                startY: 80,
                head: [['Código', 'Producto', 'Cantidad', 'Precio Unit.', 'Total']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [0, 51, 153] },
                columnStyles: {
                    2: { halign: 'center' },
                    3: { halign: 'right' },
                    4: { halign: 'right', fontStyle: 'bold' }
                }
            });

            const finalY = (doc as any).lastAutoTable.finalY || 150;

            // Totals
            const total = items.reduce((acc: number, item: any) => acc + Number(item.Total), 0);
            doc.setFontSize(12);
            doc.text(`TOTAL: $${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, finalY + 10, { align: 'right' });

            // Notes
            if (header.Notas) {
                doc.setFontSize(11);
                doc.text('Notas / Observaciones:', 20, finalY + 20);
                doc.setFontSize(9);
                doc.setTextColor(100, 100, 100);
                doc.text(header.Notas, 20, finalY + 26, { maxWidth: 170 });
            }

            // Footer
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text('Foodie Guru - Sistema de Gestión Administrativa', 105, 285, { align: 'center' });

            doc.save(`OrdenCompra_OC${header.IdOrdenCompra}_${header.Sucursal}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error al generar el PDF');
        }
    };

    const getStatusLabel = (status: number) => {
        switch (status) {
            case 0: return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-semibold">Borrador</span>;
            case 1: return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-semibold">Pendiente</span>;
            case 2: return <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-semibold">Entregado</span>;
            case 3: return <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-semibold">Cancelado</span>;
            default: return null;
        }
    };

    if (isLoading) return <div className="p-8 text-center text-black font-medium">Cargando...</div>;

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold text-black">{t('title')}</h1>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95"
                >
                    + {t('addOrder')}
                </button>
            </div>

            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-5 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('orderDate')}</th>
                                <th className="px-6 py-5 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('provider')}</th>
                                <th className="px-6 py-5 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('branch')}</th>
                                <th className="px-6 py-5 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('status')}</th>
                                <th className="px-6 py-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {orders.map((order) => (
                                <tr key={order.IdOrdenCompra} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {new Date(order.FechaOrden).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-bold text-gray-900">{order.Proveedor}</div>
                                        <div className="text-xs text-gray-400">OC-{order.IdOrdenCompra}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-700">{order.Sucursal}</td>
                                    <td className="px-6 py-4 text-sm">
                                        {getStatusLabel(order.Status)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            <button 
                                                onClick={() => exportOrderToPDF(order)}
                                                className="text-blue-600 hover:text-blue-800 transition-colors p-1"
                                                title="Imprimir PDF"
                                            >
                                                🖨️
                                            </button>
                                            <button 
                                                onClick={() => handleEdit(order)}
                                                className="text-amber-600 hover:text-amber-800 transition-colors p-1"
                                                title="Editar"
                                            >
                                                ✏️
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(order)}
                                                className="text-red-600 hover:text-red-800 transition-colors p-1"
                                                title="Borrar"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {orders.length === 0 && (
                    <div className="p-20 text-center">
                        <div className="text-4xl mb-4">📦</div>
                        <div className="text-gray-500 italic font-medium">No hay ordenes de compra registradas</div>
                    </div>
                )}
            </div>

            {/* Modal for new Order */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl p-10 relative border border-white/20">
                        <button 
                            onClick={closeModal}
                            className="absolute top-8 right-8 text-gray-400 hover:text-gray-600 transition-colors text-2xl p-2"
                        >
                            ✕
                        </button>
                        
                        <h2 className="text-3xl font-black mb-10 text-black border-b pb-4 inline-block">
                            {editingOrder ? 'Editar Orden de Compra' : t('addOrder')}
                        </h2>
                        
                        <div className="flex items-center gap-3 mb-10 bg-blue-50/50 p-6 rounded-3xl border border-blue-100 w-fit">
                            <input 
                                type="checkbox" 
                                id="esInterna"
                                checked={esInterna}
                                onChange={(e) => {
                                    setEsInterna(e.target.checked);
                                    if (e.target.checked) {
                                        setSelectedProvider('');
                                        setProviderSearch('ORDEN DE COMPRA INTERNA');
                                    } else {
                                        setProviderSearch('');
                                    }
                                }}
                                className="w-6 h-6 rounded-lg text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                            <label htmlFor="esInterna" className="text-lg font-bold text-blue-900 cursor-pointer select-none">
                                {t('internalOrder')}
                            </label>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-10">
                            <div className={`relative ${esInterna ? 'opacity-50 pointer-events-none' : ''}`} ref={providerListRef}>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t('provider')}</label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        value={providerSearch}
                                        onChange={(e) => {
                                            setProviderSearch(e.target.value);
                                            setIsProviderListOpen(true);
                                            setSelectedProvider(''); // Reset selection if typing
                                        }}
                                        onFocus={() => setIsProviderListOpen(true)}
                                        placeholder="Buscar proveedor..."
                                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 pl-12 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-black font-semibold transition-all"
                                    />
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">🏢</span>
                                </div>
                                {isProviderListOpen && (
                                    <div className="absolute z-[70] w-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl max-h-60 overflow-y-auto">
                                        {providers
                                            .filter(p => p.Proveedor.toLowerCase().includes(providerSearch.toLowerCase()))
                                            .map(p => (
                                                <button
                                                    key={p.IdProveedor}
                                                    onClick={() => handleSelectProvider(p)}
                                                    className="w-full text-left px-6 py-4 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-none font-bold text-black"
                                                >
                                                    {p.Proveedor}
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t('branch')}</label>
                                <select 
                                    value={selectedBranch}
                                    onChange={(e) => setSelectedBranch(Number(e.target.value))}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-black font-semibold transition-all"
                                >
                                    <option value="">Selecciona una sucursal...</option>
                                    {branches.map(b => (
                                        <option key={b.IdSucursal} value={b.IdSucursal}>{b.Sucursal}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t('scheduledDeliveryDate')}</label>
                                <input 
                                    type="date" 
                                    value={fechaProgramada}
                                    onChange={(e) => setFechaProgramada(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-black font-semibold transition-all"
                                />
                            </div>
                        </div>

                        {/* Product Search */}
                        <div className="mb-10 relative" ref={productListRef}>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t('addProduct')}</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={productSearch}
                                    onChange={(e) => {
                                        setProductSearch(e.target.value);
                                        setIsProductListOpen(true);
                                    }}
                                    onFocus={() => setIsProductListOpen(true)}
                                    placeholder="Buscar producto / insumo..."
                                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 pl-12 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-black font-bold transition-all text-lg"
                                />
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl">🔍</span>
                            </div>

                            {isProductListOpen && (
                                <div className="absolute z-[60] w-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl max-h-72 overflow-y-auto backdrop-blur-xl">
                                    {products
                                        .filter(p => p.Producto.toLowerCase().includes(productSearch.toLowerCase()))
                                        .map(product => (
                                            <button
                                                key={product.IdProducto}
                                                onClick={() => handleAddProduct(product)}
                                                className="w-full text-left px-6 py-4 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-none flex justify-between items-center group"
                                            >
                                                <div>
                                                    <div className="font-bold text-black group-hover:text-blue-700">{product.Producto}</div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs text-gray-400 font-medium">{product.Codigo}</span>
                                                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                            {getCategoryEmoji(product.Categoria)} {product.Categoria || 'S/C'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg font-bold text-sm">
                                                    ${product.Costo?.toFixed(2) || '0.00'}
                                                </span>
                                            </button>
                                        ))}
                                </div>
                            )}
                        </div>

                        {/* Items Table */}
                        <div className="border border-gray-100 rounded-[1.5rem] overflow-hidden mb-10 shadow-inner bg-gray-50/50">
                            <table className="w-full text-left">
                                <thead className="bg-gray-100/50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">{t('product')}</th>
                                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider w-32 text-center">{t('quantity')}</th>
                                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider w-40 text-right">{t('price')}</th>
                                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider w-40 text-right">{t('total')}</th>
                                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {orderItems.map((item, index) => (
                                        <tr key={index} className="bg-white/40">
                                            <td className="px-6 py-5 text-sm text-black font-bold">{item.producto}</td>
                                            <td className="px-6 py-5">
                                                <input 
                                                    type="number" 
                                                    value={item.cantidad}
                                                    onChange={(e) => handleUpdateItem(index, 'cantidad', Number(e.target.value))}
                                                    className="w-full text-center bg-transparent border-b-2 border-transparent focus:border-blue-500 outline-none text-black font-bold text-lg transition-all"
                                                />
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <input 
                                                    type="number" 
                                                    value={item.precioUnitario}
                                                    onChange={(e) => handleUpdateItem(index, 'precioUnitario', Number(e.target.value))}
                                                    className="w-full text-right bg-transparent border-b-2 border-transparent focus:border-blue-500 outline-none text-black font-bold text-lg transition-all"
                                                />
                                            </td>
                                            <td className="px-6 py-5 text-right text-lg font-black text-blue-700">
                                                ${item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <button 
                                                    onClick={() => handleRemoveItem(index)}
                                                    className="text-red-400 hover:text-red-600 transition-colors text-xl p-2 hover:bg-red-50 rounded-full"
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {orderItems.length > 0 && (
                                        <tr className="bg-blue-50/50">
                                            <td colSpan={3} className="px-6 py-6 text-right font-black text-gray-500 text-xl uppercase tracking-widest">Total:</td>
                                            <td className="px-6 py-6 text-right font-black text-blue-900 text-2xl">
                                                ${orderItems.reduce((acc, item) => acc + item.total, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td></td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="mb-10">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t('notes')}</label>
                            <textarea 
                                value={notas}
                                onChange={(e) => setNotas(e.target.value)}
                                placeholder="Escribe aquí cualquier observación o nota especial para esta orden..."
                                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-black font-medium transition-all min-h-[100px]"
                            />
                        </div>

                        <div className="flex flex-col md:flex-row justify-end gap-6 pt-4 border-t border-gray-100">
                            <button 
                                onClick={closeModal}
                                className="px-10 py-4 rounded-2xl border-2 border-gray-200 font-black hover:bg-gray-50 transition-all text-gray-400 uppercase tracking-widest text-sm"
                            >
                                {t('cancel')}
                            </button>
                            <button 
                                onClick={handleSubmit}
                                className="px-12 py-4 rounded-2xl bg-blue-600 text-white font-black hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all transform hover:-translate-y-1 active:translate-y-0 uppercase tracking-widest text-sm"
                            >
                                {editingOrder ? 'Actualizar Orden' : t('save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
