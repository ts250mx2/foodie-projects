'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import PageShell from '@/components/PageShell';
import Button from '@/components/Button';
import Input, { Select } from '@/components/Input';
import BaseModal from '@/components/BaseModal';
import ThemedGridHeader, {
    ThemedGridHeaderCell,
    TableBody,
    TableRow,
    TableCell,
    RowActionButton,
} from '@/components/ThemedGridHeader';
import { useToast } from '@/contexts/ToastContext';
import RequisitionLinkModal from '@/components/requisitions/RequisitionLinkModal';
import { useModuleColor } from '@/lib/use-module-color';
import { TabletSmartphone } from 'lucide-react';
import {
    PackageMinus,
    Plus,
    Pencil,
    Trash2,
    Printer,
    Search,
    Package,
    Check,
    PackageCheck,
    Ban,
    RotateCcw,
    Warehouse,
    Ghost,
} from 'lucide-react';

type Product = {
    IdProducto: number;
    Producto: string;
    Codigo: string;
    Categoria?: string;
    IdCategoria?: number;
    UnidadMedidaCompra?: string;
    UnidadMedidaInventario?: string;
};

type Branch = {
    IdSucursal: number;
    Sucursal: string;
};

type OrderItem = {
    idProducto: number;
    producto: string;
    cantidad: number;
    unidadMedida: string;
    categoria?: string;
};

type OutboundOrder = {
    IdOrdenCompra: number;
    IdSucursal: number;
    Sucursal: string;
    FechaOrden: string;
    FechaProgramadaEntrega: string | null;
    Status: number;
    EsSalida?: number;
    FechaAplicacion?: string | null;
    Renglones?: number;
    Notas?: string;
};

/**
 * Estados (mismos que órdenes de compra):
 *  1 Aplicada · 4 Fantasma (pendiente) · 5 Descartada.
 * Una salida aplicada RESTÓ existencias del almacén.
 */
const ST_APPLIED = 1;
const ST_PHANTOM = 4;
const ST_DISCARDED = 5;

type StatusFilter = 'all' | 'pending' | 'applied' | 'discarded';

/** Unidades de medida disponibles para los renglones. */
const UNITS = ['KG', 'G', 'MG', 'L', 'ML', 'PZA', 'CAJA', 'BOLSA', 'PAQUETE', 'LATA', 'BOTELLA', 'COSTAL', 'TARRO', 'BOTE', 'LITRO', 'ONZA', 'LIBRA', 'TON', 'M', 'CM', 'DOCENA', 'UNIDAD'];

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

export default function OutboundOrdersPage() {
    const { success, error: toastError } = useToast();
    const params = useParams();
    const router = useRouter();
    const locale = params.locale as string;
    const projectId = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('project') || '{}').idProyecto : null;
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    // Mismo color que PageShell pinta en el encabezado de esta página.
    const moduleColor = useModuleColor() ?? '#0369a1';

    const [orders, setOrders] = useState<OutboundOrder[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<OutboundOrder | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
    });

    // Form state
    const [selectedBranch, setSelectedBranch] = useState<number | ''>('');
    const [fechaProgramada, setFechaProgramada] = useState('');
    const [notas, setNotas] = useState('');
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [productSearch, setProductSearch] = useState('');
    const [isProductListOpen, setIsProductListOpen] = useState(false);
    const productListRef = useRef<HTMLDivElement>(null);

    const fetchOrders = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await fetch(`/api/purchases/purchase-orders?projectId=${projectId}&tipo=salidas&startDate=${startDate}&endDate=${endDate}`);
            const data = await res.json();
            if (data.success) setOrders(data.data);
        } catch (error) {
            console.error('Error fetching outbound orders:', error);
        }
    }, [projectId, startDate, endDate]);

    const fetchBranches = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await fetch(`/api/branches?projectId=${projectId}`);
            const data = await res.json();
            if (data.success) {
                setBranches(data.data);
                if (data.data.length === 1) setSelectedBranch(data.data[0].IdSucursal);
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        }
    }, [projectId]);

    const fetchProducts = useCallback(async () => {
        if (!projectId) return;
        try {
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
            await Promise.all([fetchOrders(), fetchBranches(), fetchProducts()]);
            setIsLoading(false);
        };
        init();
    }, [fetchOrders, fetchBranches, fetchProducts]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (productListRef.current && !productListRef.current.contains(event.target as Node)) {
                setIsProductListOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAddProduct = (product: Product) => {
        const existing = orderItems.find(item => item.idProducto === product.IdProducto);
        if (existing) {
            setOrderItems(orderItems.map(item =>
                item.idProducto === product.IdProducto
                    ? { ...item, cantidad: item.cantidad + 1 }
                    : item
            ));
        } else {
            setOrderItems([...orderItems, {
                idProducto: product.IdProducto,
                producto: product.Producto,
                cantidad: 1,
                unidadMedida: product.UnidadMedidaInventario || '',
                categoria: product.Categoria || '',
            }]);
        }
        setIsProductListOpen(false);
        setProductSearch('');
    };

    const handleUpdateItem = (index: number, field: keyof OrderItem, value: any) => {
        const newItems = [...orderItems];
        const val = field === 'cantidad' ? (isNaN(Number(value)) ? 0 : Number(value)) : value;
        newItems[index] = { ...newItems[index], [field]: val };
        setOrderItems(newItems);
    };

    const handleRemoveItem = (index: number) => {
        setOrderItems(orderItems.filter((_, i) => i !== index));
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingOrder(null);
        setOrderItems([]);
        setNotas('');
        setFechaProgramada('');
        setProductSearch('');
        if (branches.length !== 1) setSelectedBranch('');
    };

    const handleSubmit = async () => {
        if (!selectedBranch || orderItems.length === 0) {
            toastError('Selecciona una sucursal y agrega al menos un producto.');
            return;
        }
        const missingUnit = orderItems.find(item => !item.unidadMedida);
        if (missingUnit) {
            toastError(`El producto "${missingUnit.producto}" no tiene unidad de medida.`);
            return;
        }
        const invalidQty = orderItems.find(item => !item.cantidad || item.cantidad <= 0);
        if (invalidQty) {
            toastError(`El producto "${invalidQty.producto}" necesita una cantidad mayor a cero.`);
            return;
        }

        // Las salidas nuevas se aplican al almacén automáticamente al guardarse.
        if (!editingOrder && !confirm('Al guardar, la salida se APLICARÁ automáticamente y restará las existencias del almacén. ¿Continuar?')) {
            return;
        }

        try {
            const res = await fetch('/api/purchases/purchase-orders', {
                method: editingOrder ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    idOrdenCompra: editingOrder?.IdOrdenCompra,
                    idProveedor: null,
                    idSucursal: selectedBranch,
                    esInterna: false,
                    esSalida: true,
                    fechaProgramadaEntrega: fechaProgramada || null,
                    notas,
                    items: orderItems.map(item => ({
                        idProducto: item.idProducto,
                        cantidad: item.cantidad,
                        precioUnitario: 0,
                        unidadMedida: item.unidadMedida || null,
                    })),
                }),
            });
            const data = await res.json();
            if (data.success) {
                success(editingOrder ? 'Salida actualizada' : 'Salida aplicada al almacén — existencias restadas');
                closeModal();
                fetchOrders();
            } else {
                toastError(data.message || 'Error al guardar la salida');
            }
        } catch (error) {
            console.error('Error saving outbound order:', error);
            toastError('Error al guardar la salida');
        }
    };

    const handleEdit = async (order: OutboundOrder) => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/purchases/purchase-orders/${order.IdOrdenCompra}?projectId=${projectId}`);
            const data = await res.json();
            if (data.success) {
                const { header, items } = data.data;
                setEditingOrder(order);
                setSelectedBranch(header.IdSucursal);
                setFechaProgramada(header.FechaProgramadaEntrega ? header.FechaProgramadaEntrega.split('T')[0] : '');
                setNotas(header.Notas || '');
                setOrderItems(items.map((it: any) => ({
                    idProducto: it.IdProducto,
                    producto: it.Producto,
                    cantidad: Number(it.Cantidad),
                    unidadMedida: it.UnidadMedidaPedido || it.UnidadMedidaInventario || '',
                    categoria: it.Categoria || '',
                })));
                setIsModalOpen(true);
            } else {
                toastError('Error al cargar la salida');
            }
        } catch (error) {
            console.error('Error fetching outbound order details:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (order: OutboundOrder) => {
        if (!confirm('¿Eliminar esta orden de salida?')) return;
        try {
            const res = await fetch(`/api/purchases/purchase-orders?projectId=${projectId}&id=${order.IdOrdenCompra}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) fetchOrders();
            else toastError(data.message || 'Error al eliminar la salida');
        } catch (error) {
            console.error('Error deleting outbound order:', error);
        }
    };

    const handleOrderAction = async (order: OutboundOrder, action: 'apply' | 'discard' | 'restore') => {
        if (!projectId) return;
        const confirmations: Record<string, string> = {
            apply: `¿Aplicar la salida OC-${order.IdOrdenCompra}? Se RESTARÁN las cantidades del almacén de ${order.Sucursal}.`,
            discard: `¿Descartar la salida OC-${order.IdOrdenCompra}? No afectará el inventario (podrás restaurarla después).`,
            restore: `¿Restaurar la salida OC-${order.IdOrdenCompra}? Volverá a estado Fantasma.`,
        };
        if (!confirm(confirmations[action])) return;

        try {
            const res = await fetch(`/api/purchases/purchase-orders?projectId=${projectId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idOrdenCompra: order.IdOrdenCompra, action, projectId }),
            });
            const data = await res.json();
            if (data.success) {
                success(data.message || 'Salida actualizada');
                fetchOrders();
            } else {
                toastError(data.message || 'Error al actualizar la salida');
            }
        } catch {
            toastError('Error al actualizar la salida');
        }
    };

    const exportOrderToPDF = async (order: OutboundOrder) => {
        try {
            const res = await fetch(`/api/purchases/purchase-orders/${order.IdOrdenCompra}?projectId=${projectId}`);
            const data = await res.json();
            if (!data.success) {
                toastError('Error al obtener los detalles de la salida');
                return;
            }
            const { header, items } = data.data;
            const doc = new jsPDF();

            doc.setFontSize(22);
            doc.setTextColor(0, 0, 0);
            doc.text('SALIDA INTERNA DE ALMACÉN', 105, 25, { align: 'center' });

            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Folio: OC-${header.IdOrdenCompra}`, 190, 35, { align: 'right' });
            doc.text(`Fecha: ${new Date(header.FechaOrden).toLocaleString()}`, 190, 40, { align: 'right' });
            doc.text(`Sucursal: ${header.Sucursal}`, 20, 40);
            if (header.FechaAplicacion) {
                doc.text(`Aplicada al almacén: ${new Date(header.FechaAplicacion).toLocaleString()}`, 20, 45);
            }

            // Agrupado por categoría (sin costos).
            const tableData: any[] = [];
            const groups: { [key: string]: any[] } = {};
            items.forEach((item: any) => {
                const cat = item.Categoria || 'Sin Categoría';
                if (!groups[cat]) groups[cat] = [];
                groups[cat].push(item);
            });
            Object.keys(groups).sort().forEach(cat => {
                tableData.push([{
                    content: cat,
                    colSpan: 3,
                    styles: { fillColor: [254, 242, 242], fontStyle: 'bold', textColor: [153, 27, 27] },
                }]);
                groups[cat].forEach((item: any) => {
                    const unit = item.UnidadMedidaPedido || item.UnidadMedidaInventario || '—';
                    tableData.push([item.Producto, item.Cantidad, unit]);
                });
            });

            autoTable(doc, {
                startY: 55,
                head: [['Producto', 'Cantidad', 'Unidad']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [153, 27, 27] },
                columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
            });

            const finalY = (doc as any).lastAutoTable.finalY || 150;
            if (header.Notas) {
                doc.setFontSize(11);
                doc.setTextColor(0, 0, 0);
                doc.text('Motivo / Notas:', 20, finalY + 12);
                doc.setFontSize(9);
                doc.setTextColor(100, 100, 100);
                doc.text(header.Notas, 20, finalY + 18, { maxWidth: 170 });
            }

            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text('Foodie Guru - Control de Almacén', 105, 285, { align: 'center' });

            doc.save(`SalidaAlmacen_OC${header.IdOrdenCompra}_${header.Sucursal}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
            toastError('Error al generar el PDF');
        }
    };

    const getStatusLabel = (order: OutboundOrder) => {
        switch (order.Status) {
            case ST_APPLIED:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-600 border border-green-100 text-[9px] font-black uppercase tracking-widest shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        Aplicada
                    </span>
                );
            case ST_PHANTOM:
            case 0:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-50 text-violet-600 border border-violet-100 text-[9px] font-black uppercase tracking-widest shadow-sm">
                        <Ghost size={10} className="animate-pulse" />
                        Fantasma
                    </span>
                );
            case ST_DISCARDED:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200 text-[9px] font-black uppercase tracking-widest shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                        Descartada
                    </span>
                );
            default: return null;
        }
    };

    const isPendingApplication = (order: OutboundOrder) =>
        !order.FechaAplicacion && order.Status !== 3 && order.Status !== ST_DISCARDED;

    const matchesStatusFilter = (order: OutboundOrder) => {
        switch (statusFilter) {
            case 'pending': return isPendingApplication(order);
            case 'applied': return Boolean(order.FechaAplicacion);
            case 'discarded': return order.Status === ST_DISCARDED;
            default: return true;
        }
    };

    const filteredOrders = orders.filter(order =>
        matchesStatusFilter(order) && (
            (order.Sucursal || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (order.Notas || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            `OC-${order.IdOrdenCompra}`.toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    const pendingCount = orders.filter(isPendingApplication).length;

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-600 mb-4"></div>
            <p className="text-gray-500 font-bold text-xl animate-pulse">Cargando salidas...</p>
        </div>
    );

    return (
        <PageShell
            title="Requisiciones"
            subtitle="Material que sale del almacén — resta existencias al aplicarse"
            icon={PackageMinus}
            className="!mt-3"
            actions={
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 flex-wrap">
                    {/* Liga/QR de la tablet de cocina: las requisiciones que
                        levanta el personal caen en esta pantalla. */}
                    <Button
                        leftIcon={TabletSmartphone}
                        onClick={() => setIsLinkModalOpen(true)}
                        size="sm"
                        variant="secondary"
                    >
                        Liga para tablet
                    </Button>

                    {/* Search */}
                    <div className="relative flex-1 lg:flex-none min-w-[220px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar folio, sucursal, motivo…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 pl-9 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-800 font-medium text-xs transition-all shadow-sm"
                        />
                    </div>

                    {/* Period Filter */}
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent outline-none text-xs font-semibold text-gray-700" />
                        <span className="text-gray-300 text-xs">→</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent outline-none text-xs font-semibold text-gray-700" />
                    </div>

                    <Button
                        leftIcon={Warehouse}
                        onClick={() => router.push(`/${locale}/dashboard/purchases/warehouse`)}
                        size="sm"
                        variant="secondary"
                    >
                        Almacén
                    </Button>

                    <Button
                        leftIcon={Plus}
                        iconBox
                        onClick={() => {
                            setEditingOrder(null);
                            setSelectedBranch(branches.length === 1 ? branches[0].IdSucursal : '');
                            setFechaProgramada(new Date().toISOString().split('T')[0]);
                            setNotas('');
                            setOrderItems([]);
                            setIsModalOpen(true);
                        }}
                        size="sm"
                        variant="solid"
                    >
                        Nueva Salida
                    </Button>
                </div>
            }
        >
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-2">
                    <PackageMinus size={14} className="text-gray-400" />
                    <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Salidas</p>
                        <p className="text-sm font-bold text-gray-900">{filteredOrders.length}</p>
                    </div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-2">
                    <Ghost size={14} className="text-violet-400" />
                    <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Por Aplicar</p>
                        <p className="text-sm font-bold text-gray-900">{pendingCount}</p>
                    </div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-2">
                    <PackageCheck size={14} className="text-green-500" />
                    <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Aplicadas</p>
                        <p className="text-sm font-bold text-gray-900">{orders.filter(o => Boolean(o.FechaAplicacion)).length}</p>
                    </div>
                </div>
            </div>

            {/* Status Filter Chips */}

            {/* Data Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                    <table className="min-w-full border-collapse">
                        <ThemedGridHeader className="sticky top-0 z-10 shadow-sm" accentColor={moduleColor}>
                            <ThemedGridHeaderCell>Fecha</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell>Folio</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell>Sucursal</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell align="center">Estado</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell align="center">Productos</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell>Motivo / Notas</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell align="right">Acciones</ThemedGridHeaderCell>
                        </ThemedGridHeader>

                        <TableBody
                            loading={isLoading}
                            empty={!isLoading && filteredOrders.length === 0}
                            emptyMessage={searchTerm ? 'Sin resultados para tu búsqueda' : 'Sin salidas para el periodo seleccionado'}
                            colSpan={7}
                        >
                            {filteredOrders.map((order) => (
                                <TableRow key={order.IdOrdenCompra}>
                                    <TableCell>
                                        {new Date(order.FechaOrden).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })}
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-semibold text-gray-900">OC-{String(order.IdOrdenCompra).padStart(4, '0')}</span>
                                    </TableCell>
                                    <TableCell muted>{order.Sucursal}</TableCell>
                                    <TableCell align="center">{getStatusLabel(order)}</TableCell>
                                    <TableCell align="center">
                                        <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">
                                            {order.Renglones ?? '—'}
                                        </span>
                                    </TableCell>
                                    <TableCell muted>{order.Notas || '—'}</TableCell>
                                    <TableCell align="right">
                                        <div className="flex items-center justify-end gap-1">
                                            {isPendingApplication(order) && (
                                                <>
                                                    <RowActionButton
                                                        icon={PackageCheck}
                                                        label="Aplicar salida (restar del almacén)"
                                                        variant="default"
                                                        onClick={() => handleOrderAction(order, 'apply')}
                                                    />
                                                    <RowActionButton
                                                        icon={Ban}
                                                        label="Descartar salida"
                                                        variant="default"
                                                        onClick={() => handleOrderAction(order, 'discard')}
                                                    />
                                                </>
                                            )}
                                            {order.Status === ST_DISCARDED && (
                                                <RowActionButton
                                                    icon={RotateCcw}
                                                    label="Restaurar salida"
                                                    variant="default"
                                                    onClick={() => handleOrderAction(order, 'restore')}
                                                />
                                            )}
                                            {!order.FechaAplicacion && (
                                                <RowActionButton
                                                    icon={Pencil}
                                                    label="Editar"
                                                    variant="edit"
                                                    onClick={() => handleEdit(order)}
                                                />
                                            )}
                                            <RowActionButton
                                                icon={Printer}
                                                label="Imprimir"
                                                variant="default"
                                                onClick={() => exportOrderToPDF(order)}
                                            />
                                            {!order.FechaAplicacion && (
                                                <RowActionButton
                                                    icon={Trash2}
                                                    label="Eliminar"
                                                    variant="delete"
                                                    onClick={() => handleDelete(order)}
                                                />
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </table>
                </div>

                {!isLoading && filteredOrders.length > 0 && (
                    <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
                        <span className="text-xs text-gray-400">
                            {filteredOrders.length} de {orders.length} salidas
                        </span>
                    </div>
                )}
            </div>

            {/* Modal nueva/editar salida */}
            <BaseModal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={editingOrder ? 'Editar Requisición' : 'Nueva Requisición'}
                subtitle={editingOrder ? `Folio: OC-${editingOrder.IdOrdenCompra}` : 'Se aplica automáticamente al guardarse: resta existencias del almacén'}
                accentColor={moduleColor}
                size="full"
                headerVariant="primary"
                footer={
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                            {editingOrder && (
                                <Button variant="secondary" size="md" leftIcon={Printer} onClick={() => exportOrderToPDF(editingOrder)}>
                                    Imprimir PDF
                                </Button>
                            )}
                        </div>
                        <div className="flex items-center gap-2.5">
                            <Button variant="secondary" size="md" onClick={closeModal}>
                                Cancelar
                            </Button>
                            <Button variant="solid" size="md" leftIcon={Check} iconBox onClick={handleSubmit}>
                                {editingOrder ? 'Actualizar Salida' : 'Guardar Salida'}
                            </Button>
                        </div>
                    </div>
                }
            >
                <div className="space-y-5">
                    {/* ── Datos de la salida ─────────────────────────────────── */}
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-4 py-2.5 bg-red-50 border-b border-red-100">
                            <span className="text-xs font-bold text-red-700 uppercase tracking-wide">
                                Salida de almacén — al GUARDARSE se aplica automáticamente y RESTA existencias al costo promedio vigente
                            </span>
                        </div>
                        <div className="p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <Select
                                    label="Sucursal"
                                    value={selectedBranch}
                                    onChange={(e) => setSelectedBranch(Number(e.target.value))}
                                >
                                    <option value="">Sucursal…</option>
                                    {branches.map(b => (
                                        <option key={b.IdSucursal} value={b.IdSucursal}>{b.Sucursal}</option>
                                    ))}
                                </Select>

                                <Input
                                    label="Fecha"
                                    type="date"
                                    value={fechaProgramada}
                                    onChange={(e) => setFechaProgramada(e.target.value)}
                                />

                                <Input
                                    label="Motivo / Notas"
                                    type="text"
                                    value={notas}
                                    onChange={(e) => setNotas(e.target.value)}
                                    placeholder="Ej. Traspaso, evento, consumo interno…"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Productos de la salida ─────────────────────────────── */}
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                                <Package size={13} />
                                Productos ({orderItems.length})
                            </span>
                        </div>

                        {/* Buscador de productos */}
                        <div className="p-3 border-b border-gray-100 bg-white">
                            <div className="relative" ref={productListRef}>
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                                <input
                                    type="text"
                                    value={productSearch}
                                    onChange={(e) => {
                                        setProductSearch(e.target.value);
                                        setIsProductListOpen(true);
                                    }}
                                    onFocus={() => setIsProductListOpen(true)}
                                    placeholder="Añadir producto a la salida…"
                                    className="w-full text-sm rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2.5 text-gray-800 focus:outline-none focus:border-blue-500 transition-all"
                                />

                                {isProductListOpen && products.length > 0 && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-72 overflow-y-auto">
                                        {products
                                            .filter(p => p.Producto.toLowerCase().includes(productSearch.toLowerCase()))
                                            .slice(0, 60)
                                            .map(product => (
                                                <button
                                                    key={product.IdProducto}
                                                    onClick={() => handleAddProduct(product)}
                                                    className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-none flex items-center gap-2.5 group"
                                                >
                                                    <span className="shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-base">
                                                        {getCategoryEmoji(product.Categoria)}
                                                    </span>
                                                    <span className="min-w-0">
                                                        <span className="block text-sm font-semibold text-gray-800 truncate group-hover:text-blue-700">{product.Producto}</span>
                                                        <span className="block text-[11px] text-gray-400 truncate">
                                                            {product.Codigo} · {product.Categoria || 'General'}
                                                            {product.UnidadMedidaInventario ? ` · ${product.UnidadMedidaInventario}` : ''}
                                                        </span>
                                                    </span>
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Renglones */}
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[560px] text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="px-4 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wide min-w-[220px]">Producto</th>
                                        <th className="px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wide w-44">Categoría</th>
                                        <th className="px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wide w-28 text-center">Cantidad</th>
                                        <th className="px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wide w-32 text-center">Unidad</th>
                                        <th className="px-3 py-2.5 w-14"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {orderItems.map((item, index) => (
                                        <tr key={item.idProducto} className="hover:bg-gray-50/60 transition-colors">
                                            <td className="px-4 py-2">
                                                <span className="text-sm font-medium text-gray-800">{item.producto}</span>
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-md truncate max-w-full">
                                                    {getCategoryEmoji(item.categoria)} {item.categoria || '—'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.001"
                                                    value={item.cantidad}
                                                    onChange={(e) => handleUpdateItem(index, 'cantidad', e.target.value)}
                                                    className="w-full text-sm text-center rounded-lg border border-gray-200 bg-white focus:border-blue-500 px-2 py-1.5 outline-none text-gray-800 font-semibold transition-all"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <select
                                                    value={item.unidadMedida || ''}
                                                    onChange={(e) => handleUpdateItem(index, 'unidadMedida', e.target.value)}
                                                    className={`w-full text-sm text-center rounded-lg border px-2 py-1.5 outline-none font-semibold transition-all ${
                                                        !item.unidadMedida
                                                            ? 'bg-red-50 border-red-300 text-red-600 focus:border-red-500'
                                                            : 'bg-white border-gray-200 text-gray-800 focus:border-blue-500'
                                                    }`}
                                                >
                                                    <option value="">⚠ Requerida</option>
                                                    {item.unidadMedida && !UNITS.includes(item.unidadMedida) && (
                                                        <option value={item.unidadMedida}>{item.unidadMedida}</option>
                                                    )}
                                                    {UNITS.map(u => (
                                                        <option key={u} value={u}>{u}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <RowActionButton
                                                    icon={Trash2}
                                                    label="Quitar producto"
                                                    variant="delete"
                                                    onClick={() => handleRemoveItem(index)}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                    {orderItems.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-12 text-center">
                                                <Package size={28} className="mx-auto text-gray-200 mb-2" />
                                                <p className="text-sm text-gray-400">Agrega productos usando el buscador de arriba.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </BaseModal>
            <RequisitionLinkModal
                isOpen={isLinkModalOpen}
                onClose={() => setIsLinkModalOpen(false)}
                projectId={projectId}
                accentColor={moduleColor}
            />
            {/* Filtros de estado al pie: arriba desplazaban la tabla y
                descuadraban el encabezado de la página. */}
            <div className="flex items-center gap-3 flex-wrap">
                {([
                    { key: 'all', label: 'Todas' },
                    { key: 'pending', label: `Por aplicar (${pendingCount})` },
                    { key: 'applied', label: 'Aplicadas' },
                    { key: 'discarded', label: 'Descartadas' },
                ] as { key: StatusFilter; label: string }[]).map(chip => {
                    const isActive = statusFilter === chip.key;
                    return (
                        <button
                            key={chip.key}
                            onClick={() => setStatusFilter(chip.key)}
                            className="px-4 py-2 rounded-md text-[11px] font-bold uppercase tracking-wide border-2 transition-all"
                            style={{
                                backgroundColor: isActive ? moduleColor : '#ffffff',
                                borderColor: isActive ? moduleColor : '#e5e7eb',
                                color: isActive ? '#ffffff' : '#6b7280',
                            }}
                        >
                            {chip.label}
                        </button>
                    );
                })}
            </div>

        </PageShell>
    );
}
