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
    IdCategoria?: number;
    UnidadMedidaCompra?: string;
    UnidadMedidaInventario?: string;
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
    unidadMedida: string;
    categoria?: string;
    idCategoria?: number;
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
    EsInterna: number;
    Total?: number;
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
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<any | null>(null);
    const [multiSelectedIds, setMultiSelectedIds] = useState<number[]>([]);
    const [categorySearch, setCategorySearch] = useState('');
    const [categoryProductSearch, setCategoryProductSearch] = useState('');
    const [categoryProductsCapture, setCategoryProductsCapture] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
    });

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
            const res = await fetch(`/api/purchases/purchase-orders?projectId=${projectId}&startDate=${startDate}&endDate=${endDate}`);
            const data = await res.json();
            if (data.success) setOrders(data.data);
        } catch (error) {
            console.error('Error fetching orders:', error);
        }
    }, [projectId, startDate, endDate]);

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

    const fetchCategories = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await fetch(`/api/categories?projectId=${projectId}`, { cache: 'no-store' });
            const data = await res.json();
            if (data.success) setCategories(data.data);
        } catch (error) {
            console.error('Error fetching categories:', error);
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
            await Promise.all([fetchOrders(), fetchProviders(), fetchBranches(), fetchProducts(), fetchProjectData(), fetchCategories()]);
            setIsLoading(false);
        };
        init();
    }, [fetchOrders, fetchProviders, fetchBranches, fetchProducts, fetchProjectData, fetchCategories]);

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

    const formatCurrency = (value?: number | string) => {
        if (value === undefined || value === null) return '$0.00';
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value));
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
        const defaultUnit = esInterna
            ? (product.UnidadMedidaInventario || '')
            : (product.UnidadMedidaCompra || '');
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
                total: product.Costo || 0,
                unidadMedida: defaultUnit,
                categoria: product.Categoria || '',
                idCategoria: product.IdCategoria,
            }]);
        }
        setIsProductListOpen(false);
        setProductSearch('');
    };

    const handleUpdateItem = (index: number, field: keyof OrderItem, value: any) => {
        const newItems = [...orderItems];
        let val = value;
        if (field === 'cantidad' || field === 'precioUnitario') {
            val = isNaN(Number(value)) ? 0 : Number(value);
        }
        const item = { ...newItems[index], [field]: val };
        if (field === 'cantidad' || field === 'precioUnitario') {
            item.total = (item.cantidad || 0) * (item.precioUnitario || 0);
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

        const missingUnit = orderItems.find(item => !item.unidadMedida);
        if (missingUnit) {
            alert(`El producto "${missingUnit.producto}" no tiene unidad de medida. Por favor selecciónala antes de guardar.`);
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
                setOrderItems(items.map((it: any) => {
                    const prod = products.find((p: Product) => p.IdProducto === it.IdProducto);
                    const isInt = header.EsInterna === 1;
                    // Priority: saved DB value (UnidadMedidaPedido) → product default → empty
                    const defaultUnit = it.UnidadMedidaPedido ||
                        (isInt
                            ? (prod?.UnidadMedidaInventario || '')
                            : (prod?.UnidadMedidaCompra || ''));
                    return {
                        idProducto: it.IdProducto,
                        producto: it.Producto,
                        cantidad: it.Cantidad,
                        precioUnitario: it.PrecioUnitario,
                        total: it.Total,
                        unidadMedida: defaultUnit,
                        categoria: it.Categoria || prod?.Categoria || '',
                        idCategoria: prod?.IdCategoria,
                    };
                }));
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

    const handleOpenCategoryModal = async () => {
        setIsCategoryModalOpen(true);
        setSelectedCategory(null);
        // Load ALL products across all categories
        try {
            const res = await fetch(`/api/products?projectId=${projectId}&tipoProducto=0`);
            const data = await res.json();
            if (data.success) {
                const allItems = data.data
                    .map((p: any) => ({
                        idProducto: p.IdProducto,
                        idCategoria: p.IdCategoria,
                        producto: p.Producto || '',
                        codigo: p.Codigo || '',
                        cantidad: 0,
                        precioUnitario: p.Costo || 0,
                        unidadMedida: p.UnidadMedidaInventario || '',
                        total: 0
                    }))
                    .sort((a: any, b: any) => (a.producto || '').localeCompare((b.producto || ''), 'es', { sensitivity: 'base' }));
                setCategoryProductsCapture(allItems);
            }
        } catch (error) {
            console.error('Error fetching all category products:', error);
        }
    };

    const handleSelectCategory = (category: any) => {
        // Just navigate — quantities are already in global state
        setSelectedCategory(category);
    };

    const handleUpdateCategoryProduct = (index: number, field: string, value: any) => {
        const next = [...categoryProductsCapture];
        const numericFields = ['cantidad', 'precioUnitario', 'total'];
        const val = numericFields.includes(field)
            ? (isNaN(Number(value)) ? 0 : Number(value))
            : value;
        next[index] = { ...next[index], [field]: val };
        next[index].total = (next[index].cantidad || 0) * (next[index].precioUnitario || 0);
        setCategoryProductsCapture(next);
    };

    const handleSaveCategoryOrder = async () => {
        const itemsToOrder = categoryProductsCapture.filter(p => p.cantidad > 0);
        if (itemsToOrder.length === 0) {
            alert('Por favor captura al menos una cantidad mayor a cero en alguna categoría.');
            return;
        }

        const effectiveBranch = selectedBranch || (branches.length === 1 ? branches[0].IdSucursal : null);
        if (!effectiveBranch) {
            alert('Por favor selecciona una sucursal.');
            return;
        }

        // Build a description of which categories are included
        const catNames = [...new Set(
            itemsToOrder.map(it => {
                const cat = categories.find((c: any) => c.IdCategoria === it.idCategoria);
                return cat ? cat.Categoria : 'General';
            })
        )].join(', ');

        try {
            const res = await fetch('/api/purchases/purchase-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    idProveedor: null,
                    idSucursal: effectiveBranch,
                    esInterna: true,
                    providerName: 'OC Interna',
                    notas: `Pedido Interno: ${catNames}`,
                    fechaProgramadaEntrega: new Date().toISOString().split('T')[0],
                    items: itemsToOrder.map(it => ({
                        idProducto: it.idProducto,
                        producto: it.producto,
                        cantidad: it.cantidad,
                        precioUnitario: it.precioUnitario,
                        unidadMedida: it.unidadMedida || null
                    }))
                })
            });

            const data = await res.json();
            if (data.success) {
                alert(`Orden generada con éxito — ${itemsToOrder.length} producto(s) de ${catNames}`);
                setIsCategoryModalOpen(false);
                setSelectedCategory(null);
                setCategoryProductsCapture([]);
                fetchOrders();
            } else {
                alert('Error al generar la orden');
            }
        } catch (error) {
            console.error('Error saving category order:', error);
        }
    };

    const handleToggleCategorySelection = (id: number) => {
        setMultiSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handlePrintMultiCategories = async () => {
        if (multiSelectedIds.length === 0) return;

        const doc = new jsPDF();
        let currentY = 20;

        setIsLoading(true);
        try {
            // Fetch all products once to filter locally
            const res = await fetch(`/api/products?projectId=${projectId}&tipoProducto=0`);
            const allProductsData = await res.json();
            
            if (!allProductsData.success) throw new Error('Error fetching products');

            for (let i = 0; i < multiSelectedIds.length; i++) {
                const catId = multiSelectedIds[i];
                const category = categories.find(c => c.IdCategoria === catId);
                if (!category) continue;

                if (i > 0) {
                    doc.addPage();
                    currentY = 20;
                }

                // Header for each category
                doc.setFontSize(20);
                doc.setTextColor(44, 62, 80);
                doc.text(`HOJA DE PEDIDO: ${category.Categoria.toUpperCase()}`, 105, currentY, { align: 'center' });
                
                const catProducts = allProductsData.data.filter((p: any) => p.IdCategoria === catId);
                const tableData = catProducts.map((p: any) => [
                    p.Producto,
                    '',
                    ''
                ]);

                autoTable(doc, {
                    startY: currentY + 10,
                    head: [['PRODUCTO', 'CANTIDAD', 'NOTAS']],
                    body: tableData,
                    theme: 'grid',
                    headStyles: { fillColor: [44, 62, 80], halign: 'center' },
                    columnStyles: {
                        0: { cellWidth: 'auto' },
                        1: { cellWidth: 28, halign: 'center', minCellHeight: 10 },
                        2: { cellWidth: 35 }
                    },
                    styles: { fontSize: 8, cellPadding: 1.5, valign: 'middle' }
                });

                currentY = (doc as any).lastAutoTable.finalY + 20;
            }

            // Footer (Total Pages)
            const pageCount = (doc as any).internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text(`Página ${i} de ${pageCount}`, 190, 285, { align: 'right' });
            }

            doc.save(`Pedido_Multi_Categorias.pdf`);
        } catch (error) {
            console.error('Error printing multi-categories:', error);
            alert('Error al generar el PDF');
        } finally {
            setIsLoading(false);
        }
    };
    const handlePrintCategoryCapture = () => {
        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(22);
        doc.setTextColor(0, 0, 0);
        doc.text(`HOJA DE PEDIDO: ${selectedCategory.Categoria.toUpperCase()}`, 105, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Fecha de impresión: ${new Date().toLocaleString()}`, 20, 30);
        doc.text('Instrucciones: Escriba la cantidad necesaria en el recuadro de "CANTIDAD".', 20, 35);

        const catProducts = categoryProductsCapture.filter(p => p.idCategoria === selectedCategory.IdCategoria);
        const tableData = catProducts.map(p => [
            p.producto,
            p.unidadMedida || '',
            '',
            ''
        ]);

        autoTable(doc, {
            startY: 45,
            head: [['PRODUCTO', 'UNIDAD', 'CANTIDAD', 'NOTAS']],
            body: tableData,
            theme: 'grid',
            headStyles: { 
                fillColor: [44, 62, 80], 
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center'
            },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 22, halign: 'center' },
                2: { cellWidth: 25, halign: 'center', minCellHeight: 10 },
                3: { cellWidth: 30 }
            },
            styles: {
                fontSize: 8,
                cellPadding: 1.5,
                valign: 'middle'
            }
        });

        // Footer
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Página ${i} de ${pageCount}`, 190, 285, { align: 'right' });
            doc.text('Foodie Guru - Gestión de Insumos', 105, 285, { align: 'center' });
        }

        doc.save(`Hoja_Pedido_${selectedCategory.Categoria}.pdf`);
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

            // Build table data based on order type
            let tableData: any[] = [];
            let tableHead: string[][];

            if (header.EsInterna) {
                // INTERNAL ORDER: group by category, show Categoria + Producto + Cantidad + Unidad. No cost/total.
                tableHead = [['Categoría', 'Producto', 'Cantidad', 'Unidad']];
                const groups: { [key: string]: any[] } = {};
                items.forEach((item: any) => {
                    const cat = item.Categoria || 'Sin Categoría';
                    if (!groups[cat]) groups[cat] = [];
                    groups[cat].push(item);
                });
                Object.keys(groups).sort().forEach(cat => {
                    tableData.push([{
                        content: cat,
                        colSpan: 4,
                        styles: { fillColor: [240, 245, 255], fontStyle: 'bold', textColor: [30, 64, 175] }
                    }]);
                    groups[cat].forEach((item: any) => {
                        const unit = item.UnidadMedidaInventario || '—';
                        tableData.push(['', item.Producto, item.Cantidad, unit]);
                    });
                });
            } else {
                // EXTERNAL ORDER: Producto + Cantidad + Unidad + Precio + Total. No category.
                tableHead = [['Producto', 'Cantidad', 'Unidad', 'Precio Unit.', 'Total']];
                tableData = items.map((item: any) => {
                    const unit = item.UnidadMedidaCompra || '—';
                    return [
                        item.Producto,
                        item.Cantidad,
                        unit,
                        `$${Number(item.PrecioUnitario).toFixed(2)}`,
                        `$${Number(item.Total).toFixed(2)}`
                    ];
                });
            }

            // Items Table
            autoTable(doc, {
                startY: 80,
                head: tableHead,
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: header.EsInterna ? [30, 64, 175] : [0, 51, 153] },
                columnStyles: header.EsInterna
                    ? { 2: { halign: 'center' }, 3: { halign: 'center' } }
                    : { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } }
            });

            const finalY = (doc as any).lastAutoTable.finalY || 150;

            // Total (only for external orders)
            if (!header.EsInterna) {
                const total = items.reduce((acc: number, item: any) => acc + Number(item.Total), 0);
                doc.setFontSize(11);
                doc.setTextColor(0, 0, 0);
                doc.text(`TOTAL: $${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, finalY + 10, { align: 'right' });
            }

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
            case 0:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100 text-[9px] font-black uppercase tracking-widest shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                        En Tránsito
                    </span>
                );
            case 1:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-600 border border-green-100 text-[9px] font-black uppercase tracking-widest shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        Surtido
                    </span>
                );
            case 3:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-600 border border-red-100 text-[9px] font-black uppercase tracking-widest shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                        Cancelado
                    </span>
                );
            default: return null;
        }
    };

    const handleStatusChange = async (order: PurchaseOrder, newStatus: number) => {
        if (!projectId) return;
        try {
            const res = await fetch(`/api/purchases/purchase-orders?projectId=${projectId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idOrdenCompra: order.IdOrdenCompra, status: newStatus, projectId }),
            });
            const data = await res.json();
            if (data.success) {
                setOrders(prev => prev.map(o =>
                    o.IdOrdenCompra === order.IdOrdenCompra ? { ...o, Status: newStatus } : o
                ));
            } else {
                alert('Error al actualizar el estado');
            }
        } catch {
            alert('Error al actualizar el estado');
        }
    };

    const filteredOrders = orders.filter(order => 
        order.Proveedor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.Sucursal.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `OC-${order.IdOrdenCompra}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mb-4"></div>
            <p className="text-gray-500 font-bold text-xl animate-pulse">Cargando órdenes...</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 space-y-6 relative">

            {/* Page Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none">{t('title')}</h1>
                    <p className="text-slate-400 text-xs font-semibold mt-1 uppercase tracking-widest">{t('subtitle')}</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handleOpenCategoryModal}
                        className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-sm"
                    >
                        <span>📂</span> Pedido por Categorías
                    </button>
                    <button 
                        onClick={() => {
                            const today = new Date().toISOString().split('T')[0];
                            setEditingOrder(null);
                            setSelectedProvider('');
                            setProviderSearch('');
                            setSelectedBranch(branches.length === 1 ? branches[0].IdSucursal : '');
                            setEsInterna(false);
                            setFechaEntrega('');
                            setFechaProgramada(today);
                            setNotas('');
                            setOrderItems([]);
                            setIsModalOpen(true);
                        }}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-md shadow-blue-500/20"
                    >
                        <span className="text-base leading-none">+</span> {t('newOrder')}
                    </button>
                </div>
            </div>

            {/* Stats + Search Row */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Stats */}
                <div className="bg-white border border-slate-100 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg flex-shrink-0">📦</div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Órdenes</p>
                        <p className="text-xl font-black text-slate-900 leading-none mt-0.5">{filteredOrders.length}</p>
                    </div>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-lg flex-shrink-0">💰</div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inversión Total</p>
                        <p className="text-xl font-black text-slate-900 leading-none mt-0.5">{formatCurrency(filteredOrders.reduce((sum, o) => sum + (isNaN(Number(o.Total)) ? 0 : Number(o.Total) || 0), 0))}</p>
                    </div>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg flex-shrink-0">🏢</div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proveedores</p>
                        <p className="text-xl font-black text-slate-900 leading-none mt-0.5">{new Set(filteredOrders.map(o => o.IdProveedor)).size}</p>
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Buscar proveedor, sucursal, folio..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-full bg-white border border-slate-200 rounded-2xl px-4 py-3 pl-10 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none text-slate-800 font-medium text-xs transition-all shadow-sm"
                    />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base">🔍</span>
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 transition-colors text-xs">✕</button>
                    )}
                </div>
            </div>

            {/* Period Filter */}
            <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Periodo:</span>
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                        className="bg-transparent outline-none text-xs font-semibold text-slate-700" />
                    <span className="text-slate-300 text-xs">→</span>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                        className="bg-transparent outline-none text-xs font-semibold text-slate-700" />
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">{filteredOrders.length} resultado{filteredOrders.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-[90px_1fr_110px_135px_120px_100px_100px_80px] px-4 py-3 bg-slate-50 border-b border-slate-100">
                    {['Fecha', 'Proveedor', 'Sucursal', 'Estado', 'Entrega Prog.', 'Notas', 'Total', ''].map((h, i) => (
                        <div key={i} className={`text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] ${i === 6 ? 'text-right' : ''}`}>
                            {h}
                        </div>
                    ))}
                </div>

                {/* Rows */}
                <div className="divide-y divide-slate-50">
                    {filteredOrders.map((order) => (
                        <div
                            key={order.IdOrdenCompra}
                            onClick={() => handleEdit(order)}
                            className="grid grid-cols-[90px_1fr_110px_135px_120px_100px_100px_80px] px-4 py-3 items-center hover:bg-blue-50/20 transition-colors group cursor-pointer"
                        >
                            {/* Fecha */}
                            <div className="text-xs font-semibold text-slate-700">
                                {new Date(order.FechaOrden).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })}
                            </div>

                            {/* Proveedor */}
                            <div className="min-w-0 pr-3">
                                <div className="text-xs font-semibold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                                    {order.Proveedor}
                                </div>
                                <div className="text-[9px] text-slate-400 font-medium mt-0.5">
                                    # {String(order.IdOrdenCompra).padStart(4, '0')}
                                </div>
                            </div>

                            {/* Sucursal */}
                            <div>
                                <span className="inline-block bg-slate-100 text-slate-500 text-[9px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wide truncate max-w-full">
                                    {order.Sucursal}
                                </span>
                            </div>

                            {/* Estado — clickable toggle */}
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (order.Status === 0) handleStatusChange(order, 1);
                                    else if (order.Status === 1) handleStatusChange(order, 0);
                                }}
                                className={`cursor-pointer transition-opacity ${order.Status === 0 || order.Status === 1 ? 'hover:opacity-70' : ''}`}
                                title={order.Status === 0 ? 'Clic para marcar como Surtido' : order.Status === 1 ? 'Clic para regresar a En Tránsito' : ''}
                            >
                                {getStatusLabel(order.Status)}
                            </div>

                            {/* Entrega Programada + días en tránsito */}
                            <div className="min-w-0">
                                {order.FechaProgramadaEntrega ? (
                                    <div>
                                        <span className="text-[10px] font-semibold text-slate-600">
                                            {new Date(order.FechaProgramadaEntrega).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                        </span>
                                        {order.Status === 0 && (() => {
                                            const days = Math.floor((Date.now() - new Date(order.FechaOrden).getTime()) / 86400000);
                                            return days > 0 ? (
                                                <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100 text-[8px] font-black">
                                                    {days}d
                                                </span>
                                            ) : null;
                                        })()}
                                    </div>
                                ) : (
                                    order.Status === 0 ? (() => {
                                        const days = Math.floor((Date.now() - new Date(order.FechaOrden).getTime()) / 86400000);
                                        return days > 0 ? (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100 text-[8px] font-black">
                                                {days}d en tránsito
                                            </span>
                                        ) : <span className="text-[9px] text-slate-200">—</span>;
                                    })() : <span className="text-[9px] text-slate-200">—</span>
                                )}
                            </div>

                            {/* Notas */}
                            <div className="min-w-0 pr-2">
                                {order.Notas ? (
                                    <span className="text-[10px] text-slate-400 truncate block" title={order.Notas}>{order.Notas}</span>
                                ) : (
                                    <span className="text-[9px] text-slate-200">—</span>
                                )}
                            </div>

                            {/* Total */}
                            <div className="text-right">
                                <span className="text-xs font-bold text-slate-800">
                                    {order.EsInterna ? <span className="text-slate-300 text-[9px]">Interna</span> : formatCurrency(order.Total)}
                                </span>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                    onClick={() => exportOrderToPDF(order)}
                                    className="w-7 h-7 rounded-lg text-slate-300 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center text-xs"
                                    title="PDF"
                                >🖨️</button>
                                <button
                                    onClick={() => handleDelete(order)}
                                    className="w-7 h-7 rounded-lg text-slate-300 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center text-xs"
                                    title="Eliminar"
                                >🗑️</button>
                            </div>
                        </div>
                    ))}
                </div>

                {filteredOrders.length === 0 && (
                    <div className="py-20 text-center">
                        <div className="text-4xl mb-3 grayscale opacity-20">📦</div>
                        <p className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Sin resultados para el periodo seleccionado</p>
                    </div>
                )}

                {filteredOrders.length > 0 && (
                    <div className="flex justify-between items-center px-6 py-3 bg-slate-50 border-t border-slate-100">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                            {filteredOrders.length} {filteredOrders.length === 1 ? 'orden' : 'órdenes'}
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Total período:</span>
                            <span className="text-sm font-black text-slate-800">
                                {formatCurrency(filteredOrders.reduce((s, o) => s + (isNaN(Number(o.Total)) ? 0 : Number(o.Total || 0)), 0))}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal for new Order */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] w-full max-w-6xl max-h-[95vh] overflow-hidden shadow-2xl relative border border-white/20 flex flex-col">
                        
                        {/* Modal Header */}
                        <div className="px-10 py-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
                            <div>
                                <h2 className="text-3xl font-black text-black tracking-tight leading-none mb-2">
                                    {editingOrder ? 'Editar Orden' : 'Nueva Orden de Compra'}
                                </h2>
                                <div className="flex items-center gap-3">
                                    <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest">
                                        {editingOrder ? `Folio: OC-${editingOrder.IdOrdenCompra}` : 'En Tránsito'}
                                    </span>
                                    <span className="text-gray-300 text-xs">|</span>
                                    <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Configuración de Suministros</p>
                                </div>
                            </div>
                            <button 
                                onClick={closeModal}
                                className="w-12 h-12 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 transition-all shadow-sm hover:shadow-md"
                            >
                                <span className="text-xl leading-none">✕</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-6">

                            {/* Header Fields - top row */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-6 border-b border-gray-100">

                                {/* Internal Order toggle */}
                                <div className="md:col-span-4 flex items-center gap-3">
                                    <input 
                                        type="checkbox" 
                                        id="esInterna"
                                        checked={esInterna}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            setEsInterna(checked);
                                            if (checked) {
                                                setSelectedProvider('');
                                                setProviderSearch('ORDEN DE COMPRA INTERNA');
                                                // Auto-set today as scheduled delivery for internal orders
                                                setFechaProgramada(new Date().toISOString().split('T')[0]);
                                            } else {
                                                setProviderSearch('');
                                            }
                                        }}
                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                                    />
                                    <label htmlFor="esInterna" className="text-xs font-bold text-blue-800 cursor-pointer select-none">
                                        {t('internalOrder')} <span className="text-blue-400 font-medium">— Uso administrativo interno</span>
                                    </label>
                                </div>

                                {/* Provider */}
                                <div className={`relative ${esInterna ? 'opacity-40 pointer-events-none' : ''}`} ref={providerListRef}>
                                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">{t('provider')}</label>
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            value={providerSearch}
                                            onChange={(e) => {
                                                setProviderSearch(e.target.value);
                                                setIsProviderListOpen(true);
                                                setSelectedProvider('');
                                            }}
                                            onFocus={() => setIsProviderListOpen(true)}
                                            placeholder="Buscar proveedor..."
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pl-9 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none text-slate-800 font-semibold text-xs transition-all"
                                        />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">🏢</span>
                                    </div>
                                    {isProviderListOpen && providers.length > 0 && (
                                        <div className="absolute z-[70] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-52 overflow-y-auto">
                                            {providers
                                                .filter(p => p.Proveedor.toLowerCase().includes(providerSearch.toLowerCase()))
                                                .map(p => (
                                                    <button
                                                        key={p.IdProveedor}
                                                        onClick={() => handleSelectProvider(p)}
                                                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-none font-semibold text-slate-800 text-xs"
                                                    >
                                                        {p.Proveedor}
                                                    </button>
                                                ))}
                                        </div>
                                    )}
                                </div>

                                {/* Branch */}
                                <div>
                                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">{t('branch')}</label>
                                    <select 
                                        value={selectedBranch}
                                        onChange={(e) => setSelectedBranch(Number(e.target.value))}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none text-slate-800 font-semibold text-xs transition-all"
                                    >
                                        <option value="">Sucursal...</option>
                                        {branches.map(b => (
                                            <option key={b.IdSucursal} value={b.IdSucursal}>{b.Sucursal}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Scheduled Date */}
                                <div>
                                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">{t('scheduledDeliveryDate')}</label>
                                    <input 
                                        type="date" 
                                        value={fechaProgramada}
                                        onChange={(e) => setFechaProgramada(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none text-slate-800 font-semibold text-xs transition-all"
                                    />
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">{t('notes')}</label>
                                    <input 
                                        type="text"
                                        value={notas}
                                        onChange={(e) => setNotas(e.target.value)}
                                        placeholder="Notas internas..."
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none text-slate-800 font-semibold text-xs transition-all"
                                    />
                                </div>
                            </div>

                            {/* Items Section */}
                            <div className="space-y-4">
                                <div className="relative" ref={productListRef}>
                                        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                            <span className="text-xl">🔍</span>
                                        </div>
                                        <input 
                                            type="text" 
                                            value={productSearch}
                                            onChange={(e) => {
                                                setProductSearch(e.target.value);
                                                setIsProductListOpen(true);
                                            }}
                                            onFocus={() => setIsProductListOpen(true)}
                                            placeholder="Añadir producto a la orden..."
                                            className="w-full bg-white border-2 border-blue-50 rounded-2xl px-6 py-5 pl-14 focus:border-blue-400 outline-none text-black font-black text-lg shadow-sm focus:shadow-md transition-all placeholder:text-gray-300 placeholder:font-bold"
                                        />

                                        {isProductListOpen && products.length > 0 && (
                                            <div className="absolute z-[60] w-full mt-2 bg-white border border-gray-100 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] max-h-80 overflow-y-auto animate-in slide-in-from-top-4 duration-300">
                                                {products
                                                    .filter(p => p.Producto.toLowerCase().includes(productSearch.toLowerCase()))
                                                    .map(product => (
                                                        <button
                                                            key={product.IdProducto}
                                                            onClick={() => handleAddProduct(product)}
                                                            className="w-full text-left px-8 py-5 hover:bg-blue-50/50 transition-all border-b border-gray-50 last:border-none flex justify-between items-center group"
                                                        >
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                                                                    {getCategoryEmoji(product.Categoria)}
                                                                </div>
                                                                <div>
                                                                    <div className="font-black text-black text-sm group-hover:text-blue-700">{product.Producto}</div>
                                                                    <div className="flex items-center gap-2 mt-0.5">
                                                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{product.Codigo}</span>
                                                                        <span className="text-[9px] bg-gray-50 text-gray-400 px-2 py-0.5 rounded-md font-black uppercase">
                                                                            {product.Categoria || 'General'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className="text-blue-600 font-black text-base">{formatCurrency(product.Costo)}</span>
                                                                <div className="text-[9px] text-gray-300 font-bold uppercase">Costo Base</div>
                                                            </div>
                                                        </button>
                                                    ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-100">
                                                    <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('product')}</th>
                                                    {esInterna && (
                                                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest w-36">Categoría</th>
                                                    )}
                                                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest w-28 text-center">{t('quantity')}</th>
                                                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest w-28 text-center">Unidad</th>
                                                    {!esInterna && (
                                                        <>
                                                            <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest w-28 text-right">{t('price')}</th>
                                                            <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest w-28 text-right">{t('total')}</th>
                                                        </>
                                                    )}
                                                    <th className="px-3 py-3 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {orderItems.map((item, index) => (
                                                    <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                                                        {/* Product name */}
                                                        <td className="px-5 py-2.5">
                                                            <input 
                                                                type="text" 
                                                                value={item.producto}
                                                                onChange={(e) => handleUpdateItem(index, 'producto', e.target.value)}
                                                                className="w-full bg-transparent border-b border-transparent focus:border-blue-400 outline-none text-slate-800 font-semibold text-xs transition-all"
                                                            />
                                                        </td>
                                                        {/* Categoria (only internal) */}
                                                        {esInterna && (
                                                            <td className="px-4 py-2.5">
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md">
                                                                    {getCategoryEmoji(item.categoria)} {item.categoria || '—'}
                                                                </span>
                                                            </td>
                                                        )}
                                                        {/* Quantity */}
                                                        <td className="px-4 py-2.5">
                                                            <input 
                                                                type="number" 
                                                                value={item.cantidad}
                                                                onChange={(e) => handleUpdateItem(index, 'cantidad', e.target.value)}
                                                                className="w-full text-center bg-slate-50 border border-slate-100 focus:border-blue-400 focus:bg-white rounded-lg py-1 outline-none text-slate-800 font-bold text-xs transition-all"
                                                            />
                                                        </td>
                                                        {/* Unit of measure — required */}
                                                        <td className="px-4 py-2.5">
                                                            <select
                                                                value={item.unidadMedida || ''}
                                                                onChange={(e) => handleUpdateItem(index, 'unidadMedida', e.target.value)}
                                                                className={`w-full text-center border rounded-lg py-1 outline-none font-semibold text-xs transition-all ${
                                                                    !item.unidadMedida
                                                                        ? 'bg-red-50 border-red-300 text-red-500 focus:border-red-500'
                                                                        : 'bg-slate-50 border-slate-100 focus:border-blue-400 focus:bg-white text-slate-700'
                                                                }`}
                                                            >
                                                                <option value="">⚠ Requerida</option>
                                                                {['KG','G','MG','L','ML','PZA','CAJA','BOLSA','PAQUETE','LATA','BOTELLA','COSTAL','TARRO','BOTE','LITRO','ONZA','LIBRA','TON','M','CM','DOCENA','UNIDAD'].map(u => (
                                                                    <option key={u} value={u}>{u}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        {/* Price + Total (only external) */}
                                                        {!esInterna && (
                                                            <>
                                                                <td className="px-4 py-2.5 text-right">
                                                                    <input 
                                                                        type="number" 
                                                                        value={item.precioUnitario}
                                                                        onChange={(e) => handleUpdateItem(index, 'precioUnitario', e.target.value)}
                                                                        className="w-full text-right bg-slate-50 border border-slate-100 focus:border-blue-400 focus:bg-white rounded-lg py-1 px-2 outline-none text-slate-800 font-bold text-xs transition-all"
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-2.5 text-right text-xs font-bold text-blue-600">
                                                                    {formatCurrency(item.total)}
                                                                </td>
                                                            </>
                                                        )}
                                                        <td className="px-3 py-2.5 text-center">
                                                            <button 
                                                                onClick={() => handleRemoveItem(index)}
                                                                className="text-slate-200 hover:text-red-400 transition-colors"
                                                            >🗑️</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {orderItems.length === 0 && (
                                                    <tr>
                                                        <td colSpan={esInterna ? 5 : 6} className="px-5 py-12 text-center">
                                                            <p className="text-slate-300 font-semibold text-xs uppercase tracking-widest">Agrega productos usando el buscador</p>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                            {orderItems.length > 0 && (
                                                <tfoot>
                                                    <tr className="bg-slate-50 border-t border-slate-100">
                                                        <td className="px-5 py-3" colSpan={esInterna ? 3 : 3}>
                                                            <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
                                                                {orderItems.length} {orderItems.length === 1 ? 'producto' : 'productos'}
                                                            </span>
                                                        </td>
                                                        {!esInterna && (
                                                            <>
                                                                <td className="px-4 py-3 text-right">
                                                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Total</span>
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <span className="text-sm font-black text-slate-800">
                                                                        {formatCurrency(orderItems.reduce((acc, item) => acc + (isNaN(Number(item.total)) ? 0 : Number(item.total)), 0))}
                                                                    </span>
                                                                </td>
                                                            </>
                                                        )}
                                                        <td className="px-3 py-3"></td>
                                                    </tr>
                                                </tfoot>
                                            )}
                                        </table>
                                    </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-8 py-5 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center gap-4">
                            <div>
                                {editingOrder && (
                                    <button 
                                        onClick={() => exportOrderToPDF(editingOrder)}
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 font-semibold text-xs transition-all shadow-sm"
                                    >
                                        🖨️ Imprimir PDF
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-3">
                            <button 
                                onClick={closeModal}
                                className="px-6 py-2.5 rounded-xl border border-gray-200 font-semibold hover:bg-white hover:shadow-sm transition-all text-gray-400 text-xs"
                            >
                                {t('cancel')}
                            </button>
                            <button 
                                onClick={handleSubmit}
                                className="px-8 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all shadow-md shadow-blue-500/20"
                            >
                                {editingOrder ? 'Actualizar Orden' : 'Confirmar y Guardar'}
                            </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Category Selection / Capture Modal */}
            {isCategoryModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl relative border border-white/20 flex flex-col">
                        <button 
                            onClick={() => {
                                setIsCategoryModalOpen(false);
                                setSelectedCategory(null);
                            }}
                            className="absolute top-8 right-8 text-gray-400 hover:text-gray-600 transition-colors text-2xl p-2 z-10"
                        >
                            ✕
                        </button>

                        <div className="p-10 flex-1 overflow-y-auto">
                            {!selectedCategory ? (
                                <>
                                    <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                                        <h2 className="text-2xl font-black text-black border-b pb-3 inline-block">Pedido por Categorías</h2>
                                        <div className="flex gap-4">
                                            {(() => {
                                                const count = categoryProductsCapture.filter(p => p.cantidad > 0).length;
                                                return (
                                                    <button
                                                        onClick={handleSaveCategoryOrder}
                                                        disabled={count === 0}
                                                        className={`px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center gap-2 transition-all ${
                                                            count > 0
                                                                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/20'
                                                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                        }`}
                                                    >
                                                        ✓ Generar OC{count > 0 ? ` (${count} productos)` : ''}
                                                    </button>
                                                );
                                            })()}
                                            {multiSelectedIds.length > 0 && (
                                                <button 
                                                    onClick={handlePrintMultiCategories}
                                                    className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-2xl font-black shadow-xl shadow-red-500/20 transition-all uppercase tracking-widest text-sm flex items-center gap-2 animate-in zoom-in duration-200"
                                                >
                                                    <span>🖨️</span> Imprimir {multiSelectedIds.length} Seleccionadas
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mb-10 relative">
                                        <input 
                                            type="text" 
                                            placeholder="Buscar categoría..."
                                            value={categorySearch}
                                            onChange={(e) => setCategorySearch(e.target.value)}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 pl-14 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-black font-bold text-lg transition-all"
                                        />
                                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl">📂</span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                        {categories
                                            .filter(cat => cat.Categoria.toLowerCase().includes(categorySearch.toLowerCase()))
                                            .map(cat => {
                                                const catCount = categoryProductsCapture.filter(p => p.idCategoria === cat.IdCategoria && p.cantidad > 0).length;
                                                return (
                                                    <button
                                                        key={cat.IdCategoria}
                                                        onClick={() => handleSelectCategory(cat)}
                                                        className={`group relative p-8 rounded-[2rem] border transition-all duration-300 text-left overflow-hidden ${
                                                            multiSelectedIds.includes(cat.IdCategoria)
                                                                ? 'bg-blue-600 border-blue-400 shadow-xl shadow-blue-500/30'
                                                                : catCount > 0
                                                                    ? 'bg-green-50 border-green-200 hover:border-green-400 hover:shadow-lg'
                                                                    : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-lg'
                                                        }`}
                                                    >
                                                        <div className={`text-4xl mb-4 group-hover:scale-110 transition-transform ${multiSelectedIds.includes(cat.IdCategoria) ? '' : 'grayscale-[0.5]'}`}>
                                                            {cat.ImagenCategoria || getCategoryEmoji(cat.Categoria)}
                                                        </div>
                                                        <div className={`text-sm font-black tracking-tight ${multiSelectedIds.includes(cat.IdCategoria) ? 'text-white' : 'text-slate-900'}`}>
                                                            {cat.Categoria}
                                                        </div>
                                                        {catCount > 0 && (
                                                            <div className="mt-2">
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-600 text-white text-[10px] font-black">
                                                                    ✓ {catCount} producto{catCount !== 1 ? 's' : ''}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <button
                                                            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all bg-white/10 border-white/20 text-white"
                                                            onClick={(e) => { e.stopPropagation(); handleToggleCategorySelection(cat.IdCategoria); }}
                                                        >
                                                            {multiSelectedIds.includes(cat.IdCategoria) ? '✓' : ''}
                                                        </button>
                                                    </button>
                                                );
                                            })}
                                    </div>
                                </>
                            ) : (
                                <div className="animate-in slide-in-from-right duration-300">
                                    <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                                        <div className="flex items-center gap-4">
                                            <button 
                                                onClick={() => setSelectedCategory(null)}
                                                className="bg-gray-100 hover:bg-gray-200 p-4 rounded-2xl text-gray-600 transition-all"
                                            >
                                                ⬅️
                                            </button>
                                            <h2 className="text-2xl font-black text-black">
                                                {selectedCategory.ImagenCategoria || getCategoryEmoji(selectedCategory.Categoria)} {selectedCategory.Categoria}
                                            </h2>
                                        </div>
                                        <div className="flex gap-4">
                                            <button 
                                                onClick={handlePrintCategoryCapture}
                                                className="bg-white border-2 border-red-600 text-red-600 hover:bg-red-50 px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2"
                                            >
                                                <span>🖨️</span> PDF
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mb-8 relative">
                                        <input 
                                            type="text" 
                                            placeholder={`Buscar en ${selectedCategory.Categoria}...`}
                                            value={categoryProductSearch}
                                            onChange={(e) => setCategoryProductSearch(e.target.value)}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-3xl px-8 py-4 pl-14 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-black font-bold text-lg transition-all"
                                        />
                                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl">🔍</span>
                                    </div>

                                    <div className="border border-gray-100 rounded-[2rem] overflow-hidden shadow-inner">
                                        <table className="w-full text-left">
                                            <thead className="bg-gray-100/80 border-b border-gray-200">
                                                <tr>
                                                    <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-wider">Producto</th>
                                                    <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-wider w-32 text-center">Cantidad</th>
                                                    <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-wider w-40 text-center">Unidad</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 bg-white">
                                                {(() => {
                                                    const filteredCatItems = categoryProductsCapture
                                                        .filter(p => p.idCategoria === selectedCategory.IdCategoria && (p.producto || '').toLowerCase().includes(categoryProductSearch.toLowerCase()));
                                                    return filteredCatItems.map((item, filteredIndex) => {
                                                        const realIndex = categoryProductsCapture.findIndex(p => p.idProducto === item.idProducto);
                                                        const cantidadId = `cat-qty-${item.idProducto}`;
                                                        const uomId = `cat-uom-${item.idProducto}`;
                                                        const nextItem = filteredCatItems[filteredIndex + 1];
                                                        return (
                                                            <tr key={item.idProducto} className="hover:bg-blue-50/20 transition-colors">
                                                                <td className="px-6 py-3">
                                                                    <div className="font-bold text-black text-sm">{item.producto}</div>
                                                                    {item.codigo && <div className="text-xs text-gray-400">{item.codigo}</div>}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <input
                                                                        id={cantidadId}
                                                                        type="number"
                                                                        value={item.cantidad || ''}
                                                                        onChange={(e) => handleUpdateCategoryProduct(realIndex, 'cantidad', e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                e.preventDefault();
                                                                                const nextEl = document.getElementById(nextItem ? `cat-qty-${nextItem.idProducto}` : cantidadId);
                                                                                nextEl?.focus();
                                                                            }
                                                                        }}
                                                                        placeholder="0"
                                                                        className="w-full text-center bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-xl py-2 outline-none text-black font-black text-lg transition-all"
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <select
                                                                        id={uomId}
                                                                        value={item.unidadMedida || ''}
                                                                        onChange={(e) => handleUpdateCategoryProduct(realIndex, 'unidadMedida', e.target.value)}
                                                                        className={`w-full text-center border rounded-xl py-2 outline-none font-semibold text-sm transition-all ${
                                                                            !item.unidadMedida
                                                                                ? 'bg-red-50 border-red-200 text-red-400'
                                                                                : 'bg-gray-50 border-transparent focus:border-blue-500 focus:bg-white text-black'
                                                                        }`}
                                                                    >
                                                                        <option value="">⚠ Unidad</option>
                                                                        {['KG','G','MG','L','ML','PZA','CAJA','BOLSA','PAQUETE','LATA','BOTELLA','COSTAL','TARRO','BOTE','LITRO','ONZA','LIBRA','TON','M','CM','DOCENA','UNIDAD'].map(u => (
                                                                            <option key={u} value={u}>{u}</option>
                                                                        ))}
                                                                    </select>
                                                                </td>
                                                            </tr>
                                                        );
                                                    });
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                    
                                    <div className="mt-6 bg-blue-900 text-white p-6 rounded-[2rem] flex justify-between items-center shadow-xl shadow-blue-900/20">
                                        <div>
                                            <div className="text-blue-200 text-[10px] font-black uppercase tracking-widest mb-1">Productos en Pedido</div>
                                            <div className="text-2xl font-black">
                                                {categoryProductsCapture.filter(p => p.cantidad > 0).length} / {categoryProductsCapture.length}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-blue-200 text-[10px] font-black uppercase tracking-widest mb-1">Sin Unidad</div>
                                            <div className={`text-2xl font-black ${categoryProductsCapture.filter(p => p.cantidad > 0 && !p.unidadMedida).length > 0 ? 'text-red-300' : 'text-green-300'}`}>
                                                {categoryProductsCapture.filter(p => p.cantidad > 0 && !p.unidadMedida).length === 0 ? '✓ OK' : categoryProductsCapture.filter(p => p.cantidad > 0 && !p.unidadMedida).length}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
