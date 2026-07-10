'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, AlertTriangle, FileText, X, CheckCircle2, Clock, BookOpen, UtensilsCrossed, Tag, LayoutGrid, ShoppingCart, Eye, BookMarked, Save } from 'lucide-react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import BaseModal from '@/components/BaseModal';
import PageShell from '@/components/PageShell';
import ThemedGridHeader, { ThemedGridHeaderCell, TableBody, TableRow, TableCell, RowActionButton } from '@/components/ThemedGridHeader';
import { computeQuoteTotals, computeDishLineTotals } from '@/lib/quotes';

interface Dish {
    idPlatillo: number;
    platillo: string;
    codigo: string;
    tipo: number;   // 0=insumo, 1=platillo, 2=sub-receta
    unidad: string; // UnidadMedidaInventario del producto
    categoria: string;       // categoría del producto (solo relevante en tipo 0)
    categoriaIcono: string;  // emoji de la categoría (tblCategorias.ImagenCategoria)
    costo: number;
    precio: number; // platillos: precio de venta; productos/sub-recetas: = costo
}

interface Quote {
    IdCotizacion: number;
    NombreEvento: string;
    FechaEvento: string | null;
    HoraEvento: string | null;
    EstatusEvento: string | null;
    CantidadPlatillos: number;
    GastosOperativos: number;
    Recaudacion: number;
    CostoPlatillos: number;
    IngresoEstimado: number;
    CostoTotal: number;
    UtilidadEstimada: number;
    UtilidadReal: number;
    Notas: string | null;
}

interface GastoRow { concepto: string; monto: string }
interface DishRow { idPlatillo: string; platillo: string; tipo: string; unidad: string; cantidad: string; costoUnitario: string; precioUnitario: string }

interface QuoteTemplate {
    IdPlantilla: number;
    Nombre: string;
    datos: { platillos?: DishRow[]; gastos?: GastoRow[]; notas?: string } | null;
}

const EMPTY_FORM = { nombreEvento: '', fechaEvento: '', horaEvento: '', estatus: 'pendiente', recaudacion: '', notas: '' };
const EMPTY_DISH: DishRow = { idPlatillo: '', platillo: '', tipo: '', unidad: '', cantidad: '', costoUnitario: '', precioUnitario: '' };

type CatalogFilter = 'all' | '1' | '2' | '0';

// "Productos" no es chip: es un selector de categorías (con su icono) aparte.
const CATALOG_FILTERS: { id: CatalogFilter; label: string; icon: React.ElementType }[] = [
    { id: 'all', label: 'Todos', icon: LayoutGrid },
    { id: '1', label: 'Platillos', icon: UtensilsCrossed },
    { id: '2', label: 'Sub-recetas', icon: BookOpen },
];

const TIPO_META: Record<string, { icon: React.ElementType; cls: string }> = {
    '1': { icon: UtensilsCrossed, cls: 'bg-blue-100 text-blue-700' },
    '2': { icon: BookOpen, cls: 'bg-green-100 text-green-700' },
    '0': { icon: Tag, cls: 'bg-amber-100 text-amber-700' },
    '': { icon: Pencil, cls: 'bg-gray-100 text-gray-600' },
};

const money = (v: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number.isFinite(v) ? v : 0);

export default function QuotesPage() {
    const [project, setProject] = useState<any>(null);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [dishes, setDishes] = useState<Dish[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editing, setEditing] = useState<Quote | null>(null);

    const [formData, setFormData] = useState({ ...EMPTY_FORM });
    const [platillos, setPlatillos] = useState<DishRow[]>([]);
    const [gastos, setGastos] = useState<GastoRow[]>([]);

    // Catálogo dentro del editor (tipo carrito, como explosión de materiales)
    const [catalogSearch, setCatalogSearch] = useState('');
    const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>('all');
    // Filtro de productos por categoría ('' = todas las categorías)
    const [selectedCategory, setSelectedCategory] = useState('');

    // Overlays internos del editor
    const [showSummary, setShowSummary] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);

    // Plantillas
    const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
    const [templateName, setTemplateName] = useState('');
    const [savingTemplate, setSavingTemplate] = useState(false);
    // Qué guarda la plantilla: todo, solo conceptos o solo gastos operativos.
    const [templateScope, setTemplateScope] = useState<'all' | 'conceptos' | 'gastos'>('all');
    // Plantilla en edición: al guardar se ACTUALIZA en vez de crear una nueva.
    const [editingTemplate, setEditingTemplate] = useState<QuoteTemplate | null>(null);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) setProject(JSON.parse(storedProject));
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchQuotes();
            fetchDishes();
            fetchTemplates();
        }
    }, [project]);

    const fetchQuotes = async () => {
        try {
            const res = await fetch(`/api/sales/quotes?projectId=${project.idProyecto}`);
            const data = await res.json();
            if (data.success) setQuotes(data.data);
        } catch (e) {
            console.error('Error fetching quotes:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchDishes = async () => {
        try {
            const res = await fetch(`/api/sales/quotes/dishes?projectId=${project.idProyecto}`);
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) setDishes(data.data);
        } catch (e) {
            console.error('Error fetching dishes:', e);
        }
    };

    const fetchTemplates = async () => {
        try {
            const res = await fetch(`/api/sales/quotes/templates?projectId=${project.idProyecto}`);
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) setTemplates(data.data);
        } catch (e) {
            console.error('Error fetching templates:', e);
        }
    };

    // ----- carrito de conceptos -----
    // Clic en una card del catálogo: si ya está, suma 1 a la cantidad; si no, la agrega.
    const addFromCatalog = (d: Dish) => {
        setPlatillos((prev) => {
            const idx = prev.findIndex((p) => p.idPlatillo === String(d.idPlatillo));
            if (idx >= 0) {
                return prev.map((p, i) => i === idx ? { ...p, cantidad: String((Number(p.cantidad) || 0) + 1) } : p);
            }
            return [...prev, {
                idPlatillo: String(d.idPlatillo),
                platillo: d.platillo,
                tipo: String(d.tipo),
                unidad: d.unidad,
                cantidad: '1',
                costoUnitario: String(d.costo),
                precioUnitario: String(d.precio),
            }];
        });
    };

    const addManual = () => setPlatillos((prev) => [...prev, { ...EMPTY_DISH }]);
    const removeDish = (i: number) => setPlatillos((prev) => prev.filter((_, idx) => idx !== i));
    const updateDish = (i: number, field: keyof DishRow, value: string) =>
        setPlatillos((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));

    // ----- gastos operativos -----
    const addGasto = () => setGastos((prev) => [...prev, { concepto: '', monto: '' }]);
    const removeGasto = (i: number) => setGastos((prev) => prev.filter((_, idx) => idx !== i));
    const updateGasto = (i: number, field: keyof GastoRow, value: string) =>
        setGastos((prev) => prev.map((g, idx) => (idx === i ? { ...g, [field]: value } : g)));

    const resetEditorUi = () => {
        setCatalogSearch('');
        setCatalogFilter('all');
        setSelectedCategory('');
        setShowSummary(false);
        setShowTemplates(false);
        setTemplateName('');
        setEditingTemplate(null);
        setTemplateScope('all');
    };

    const openNew = () => {
        setEditing(null);
        setFormData({ ...EMPTY_FORM });
        setPlatillos([]);
        setGastos([]);
        resetEditorUi();
        setIsModalOpen(true);
    };

    const openEdit = async (q: Quote) => {
        setEditing(q);
        setFormData({
            nombreEvento: q.NombreEvento || '',
            fechaEvento: q.FechaEvento ? String(q.FechaEvento).substring(0, 10) : '',
            horaEvento: q.HoraEvento ? String(q.HoraEvento).substring(0, 5) : '',
            estatus: q.EstatusEvento === 'confirmada' ? 'confirmada' : 'pendiente',
            recaudacion: String(q.Recaudacion ?? ''),
            notas: q.Notas || '',
        });
        setPlatillos([]);
        setGastos([]);
        resetEditorUi();
        setIsModalOpen(true);
        try {
            const res = await fetch(`/api/sales/quotes/${q.IdCotizacion}?projectId=${project.idProyecto}`);
            const data = await res.json();
            if (data.success) {
                if (Array.isArray(data.data.platillos)) {
                    setPlatillos(data.data.platillos.map((p: any) => {
                        // Recalcula el costo unitario desde el costeo ACTUAL del concepto.
                        const cur = dishes.find((d) => d.idPlatillo === Number(p.IdPlatillo));
                        return {
                            idPlatillo: p.IdPlatillo != null ? String(p.IdPlatillo) : '',
                            platillo: p.Platillo || '',
                            tipo: p.Tipo != null ? String(p.Tipo) : (cur ? String(cur.tipo) : ''),
                            unidad: p.Unidad || (cur ? cur.unidad : ''),
                            cantidad: String(p.Cantidad ?? ''),
                            costoUnitario: cur ? String(cur.costo) : String(p.CostoUnitario ?? ''),
                            precioUnitario: String(p.PrecioUnitario ?? ''),
                        };
                    }));
                }
                if (Array.isArray(data.data.gastos)) {
                    setGastos(data.data.gastos.map((g: any) => ({ concepto: g.Concepto || '', monto: String(g.Monto ?? '') })));
                }
            }
        } catch (e) {
            console.error('Error fetching quote detail:', e);
        }
    };

    // Totales en vivo (mismas fórmulas que el servidor).
    const totals = computeQuoteTotals({
        platillos: platillos.map((p) => ({
            idPlatillo: p.idPlatillo ? Number(p.idPlatillo) : null,
            platillo: p.platillo,
            tipo: p.tipo !== '' ? Number(p.tipo) : null,
            cantidad: Number(p.cantidad) || 0,
            costoUnitario: Number(p.costoUnitario) || 0,
            precioUnitario: Number(p.precioUnitario) || 0,
        })),
        recaudacion: Number(formData.recaudacion) || 0,
        gastos: gastos.map((g) => ({ concepto: g.concepto, monto: Number(g.monto) || 0 })),
    });

    const handleSubmit = async () => {
        if (!formData.nombreEvento.trim()) return;
        setIsSaving(true);
        try {
            const payload = {
                projectId: project.idProyecto,
                nombreEvento: formData.nombreEvento.trim(),
                fechaEvento: formData.fechaEvento || null,
                horaEvento: formData.horaEvento || null,
                estatus: formData.estatus,
                recaudacion: Number(formData.recaudacion) || 0,
                notas: formData.notas || null,
                platillos: platillos
                    .filter((p) => p.idPlatillo || p.platillo.trim() || p.cantidad)
                    .map((p) => ({
                        idPlatillo: p.idPlatillo ? Number(p.idPlatillo) : null,
                        platillo: p.platillo.trim(),
                        tipo: p.tipo !== '' ? Number(p.tipo) : null,
                        unidad: p.unidad.trim(),
                        cantidad: Number(p.cantidad) || 0,
                        costoUnitario: Number(p.costoUnitario) || 0,
                        precioUnitario: Number(p.precioUnitario) || 0,
                    })),
                gastos: gastos
                    .filter((g) => g.concepto.trim() || g.monto)
                    .map((g) => ({ concepto: g.concepto.trim(), monto: Number(g.monto) || 0 })),
            };
            const url = editing ? `/api/sales/quotes/${editing.IdCotizacion}` : '/api/sales/quotes';
            const res = await fetch(url, {
                method: editing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                await fetchQuotes();
                setIsModalOpen(false);
            }
        } catch (e) {
            console.error('Error saving quote:', e);
        } finally {
            setIsSaving(false);
        }
    };

    // ----- plantillas -----
    // Aplica SOLO las secciones que la plantilla trae con contenido: una plantilla
    // de solo gastos no borra los conceptos del carrito, y viceversa.
    const applyTemplate = (t: QuoteTemplate) => {
        if (!t.datos) return;
        if (t.datos.platillos?.length) {
            setPlatillos(t.datos.platillos.map((p) => ({ ...EMPTY_DISH, ...p })));
        }
        if (t.datos.gastos?.length) {
            setGastos(t.datos.gastos.map((g) => ({ concepto: g.concepto || '', monto: g.monto || '' })));
        }
        if (t.datos.notas) setFormData((f) => ({ ...f, notas: t.datos!.notas || '' }));
        setShowTemplates(false);
    };

    const canSaveTemplate =
        templateScope === 'conceptos' ? platillos.length > 0 :
        templateScope === 'gastos' ? gastos.length > 0 :
        (platillos.length > 0 || gastos.length > 0);

    const saveTemplate = async () => {
        if (!templateName.trim() || !project?.idProyecto || !canSaveTemplate) return;
        setSavingTemplate(true);
        try {
            const datos: { platillos?: DishRow[]; gastos?: GastoRow[]; notas?: string } = { notas: formData.notas };
            if (templateScope !== 'gastos') datos.platillos = platillos;
            if (templateScope !== 'conceptos') datos.gastos = gastos;
            const body: any = {
                projectId: project.idProyecto,
                nombre: templateName.trim(),
                datos,
            };
            if (editingTemplate) body.id = editingTemplate.IdPlantilla;
            const res = await fetch('/api/sales/quotes/templates', {
                method: editingTemplate ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                setTemplateName('');
                setEditingTemplate(null);
                await fetchTemplates();
            }
        } catch (e) {
            console.error('Error saving template:', e);
        } finally {
            setSavingTemplate(false);
        }
    };

    // Editar plantilla: carga su contenido al carrito, precarga nombre y alcance,
    // y cierra el overlay para que puedas modificar los conceptos/gastos. Al volver
    // a "Plantillas", el botón dirá "Actualizar".
    const startEditTemplate = (t: QuoteTemplate) => {
        applyTemplate(t);
        setEditingTemplate(t);
        setTemplateName(t.Nombre);
        const hasConceptos = (t.datos?.platillos?.length || 0) > 0;
        const hasGastos = (t.datos?.gastos?.length || 0) > 0;
        setTemplateScope(hasConceptos && hasGastos ? 'all' : hasGastos ? 'gastos' : 'conceptos');
    };

    const cancelEditTemplate = () => {
        setEditingTemplate(null);
        setTemplateName('');
        setTemplateScope('all');
    };

    const deleteTemplate = async (t: QuoteTemplate) => {
        try {
            const res = await fetch(`/api/sales/quotes/templates?projectId=${project.idProyecto}&id=${t.IdPlantilla}`, { method: 'DELETE' });
            if (res.ok) await fetchTemplates();
        } catch (e) {
            console.error('Error deleting template:', e);
        }
    };

    // Cambia el estatus de una cotización directamente desde la tabla.
    const changeStatus = async (q: Quote, estatus: string) => {
        setQuotes((prev) => prev.map((x) => x.IdCotizacion === q.IdCotizacion ? { ...x, EstatusEvento: estatus } : x));
        try {
            await fetch(`/api/sales/quotes/${q.IdCotizacion}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: project.idProyecto, estatus }),
            });
        } catch (e) {
            console.error('Error updating status:', e);
            fetchQuotes();
        }
    };

    const handleDelete = async () => {
        if (!editing) return;
        try {
            const res = await fetch(`/api/sales/quotes/${editing.IdCotizacion}?projectId=${project.idProyecto}`, { method: 'DELETE' });
            if (res.ok) {
                await fetchQuotes();
                setIsDeleteModalOpen(false);
                setEditing(null);
            }
        } catch (e) {
            console.error('Error deleting quote:', e);
        }
    };

    const filtered = quotes.filter((q) => q.NombreEvento.toLowerCase().includes(searchTerm.toLowerCase()));

    const catalogItems = dishes.filter((d) =>
        (catalogFilter === 'all' || String(d.tipo) === catalogFilter) &&
        (catalogFilter !== '0' || selectedCategory === '' || d.categoria === selectedCategory) &&
        (d.platillo.toLowerCase().includes(catalogSearch.toLowerCase()) ||
            d.codigo.toLowerCase().includes(catalogSearch.toLowerCase()))
    );

    // Categorías de productos (tipo 0) con su icono, para el selector.
    const productCategories = Array.from(
        dishes.filter((d) => d.tipo === 0).reduce((map, d) => {
            const nombre = d.categoria || 'SIN CATEGORÍA';
            if (!map.has(nombre)) map.set(nombre, d.categoriaIcono || '📦');
            return map;
        }, new Map<string, string>())
    ).sort((a, b) => a[0].localeCompare(b[0]));

    const inCartQty = (id: number) => {
        const row = platillos.find((p) => p.idPlatillo === String(id));
        return row ? Number(row.cantidad) || 0 : 0;
    };

    return (
        <PageShell
            title="Cotizaciones de Eventos"
            subtitle={`${quotes.length} cotizaciones registradas`}
            icon={FileText}
            actions={
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative w-full sm:w-64">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar evento…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none transition-all placeholder:text-gray-400 text-gray-700"
                        />
                    </div>
                    <Button variant="solid" leftIcon={Plus} iconBox onClick={openNew} size="sm">
                        Nueva cotización
                    </Button>
                </div>
            }
        >
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 290px)' }}>
                    <table className="min-w-full border-collapse">
                        <ThemedGridHeader className="sticky top-0 z-10 shadow-sm">
                            <ThemedGridHeaderCell>Evento</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell>Fecha y hora</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell>Estatus</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell align="right">Platillos</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell align="right">Costo total</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell align="right">Recaudación</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell align="right">Utilidad</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell align="right">Acciones</ThemedGridHeaderCell>
                        </ThemedGridHeader>
                        <TableBody
                            loading={isLoading}
                            empty={filtered.length === 0}
                            emptyMessage={searchTerm ? 'Sin resultados para tu búsqueda' : 'Aún no hay cotizaciones. Crea la primera.'}
                            colSpan={8}
                        >
                            {filtered.map((q) => (
                                <TableRow key={q.IdCotizacion}>
                                    <TableCell>
                                        <span className="font-medium text-gray-900">{q.NombreEvento}</span>
                                    </TableCell>
                                    <TableCell muted>
                                        {q.FechaEvento ? new Date(q.FechaEvento).toLocaleDateString('es-MX') : '—'}
                                        {q.HoraEvento ? <span className="text-gray-400"> · {String(q.HoraEvento).substring(0, 5)}</span> : null}
                                    </TableCell>
                                    <TableCell>
                                        <StatusSelect
                                            value={q.EstatusEvento === 'confirmada' ? 'confirmada' : 'pendiente'}
                                            onChange={(v) => changeStatus(q, v)}
                                        />
                                    </TableCell>
                                    <TableCell align="right">{q.CantidadPlatillos}</TableCell>
                                    <TableCell align="right">{money(Number(q.CostoTotal))}</TableCell>
                                    <TableCell align="right">{money(Number(q.Recaudacion))}</TableCell>
                                    <TableCell align="right">
                                        <span className={`font-semibold ${Number(q.UtilidadReal) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {money(Number(q.UtilidadReal))}
                                        </span>
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex items-center justify-end gap-1">
                                            <RowActionButton icon={Pencil} label="Editar" variant="edit" onClick={() => openEdit(q)} />
                                            <RowActionButton icon={Trash2} label="Eliminar" variant="delete" onClick={() => { setEditing(q); setIsDeleteModalOpen(true); }} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </table>
                </div>
                {!isLoading && filtered.length > 0 && (
                    <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50">
                        <span className="text-xs text-gray-600 font-medium">{filtered.length} de {quotes.length} cotizaciones</span>
                    </div>
                )}
            </div>

            {/* Create / Edit Modal — layout tipo carrito */}
            <BaseModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editing ? 'Editar cotización' : 'Nueva cotización'}
                subtitle={editing ? editing.NombreEvento : 'Elige conceptos del catálogo y ajusta cantidades en el carrito'}
                size="full"
                footer={
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                            <Button variant="secondary" size="sm" leftIcon={BookMarked} onClick={() => setShowTemplates(true)}>
                                Plantillas
                            </Button>
                            <Button variant="secondary" size="sm" leftIcon={Eye} onClick={() => setShowSummary(true)}>
                                Ver resumen
                            </Button>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <Button variant="secondary" size="md" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
                                Cancelar
                            </Button>
                            <Button variant="solid" size="md" onClick={handleSubmit} isLoading={isSaving}>
                                Guardar
                            </Button>
                        </div>
                    </div>
                }
            >
                <div className="space-y-4">
                    {/* Datos del evento */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <div className="lg:col-span-2">
                            <Input
                                label="Nombre del evento"
                                value={formData.nombreEvento}
                                onChange={(e) => setFormData({ ...formData, nombreEvento: e.target.value })}
                                placeholder="Ej. Boda Martínez"
                                required
                            />
                        </div>
                        <Input
                            label="Fecha"
                            type="date"
                            value={formData.fechaEvento}
                            onChange={(e) => setFormData({ ...formData, fechaEvento: e.target.value })}
                        />
                        <Input
                            label="Hora"
                            type="time"
                            value={formData.horaEvento}
                            onChange={(e) => setFormData({ ...formData, horaEvento: e.target.value })}
                        />
                        <div className="w-full flex flex-col gap-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Estatus</label>
                            <select
                                value={formData.estatus}
                                onChange={(e) => setFormData({ ...formData, estatus: e.target.value })}
                                className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2 bg-white focus:outline-none focus:border-blue-500 text-gray-800"
                            >
                                <option value="pendiente">Pendiente</option>
                                <option value="confirmada">Confirmada</option>
                            </select>
                        </div>
                    </div>
                    {formData.estatus === 'confirmada' && (
                        <p className="text-[11px] text-emerald-600 flex items-center gap-1 -mt-2">
                            <CheckCircle2 size={12} /> Al confirmarla aparecerá en el Calendario de Eventos.
                        </p>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                        {/* ── Catálogo (clic para agregar) ─────────────────── */}
                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                            <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-100 space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Buscar en el catálogo…"
                                            value={catalogSearch}
                                            onChange={(e) => setCatalogSearch(e.target.value)}
                                            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-blue-500 text-gray-700"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 flex-wrap">
                                    {CATALOG_FILTERS.map((f) => {
                                        const Icon = f.icon;
                                        return (
                                            <button
                                                key={f.id}
                                                onClick={() => setCatalogFilter(f.id)}
                                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all ${catalogFilter === f.id ? 'bg-gray-900 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200 hover:text-gray-800'}`}
                                            >
                                                <Icon size={12} />
                                                {f.label}
                                            </button>
                                        );
                                    })}
                                    {/* Productos: selector por categoría (con icono de la categoría) */}
                                    <select
                                        value={catalogFilter === '0' ? selectedCategory : '__none'}
                                        onChange={(e) => {
                                            setCatalogFilter('0');
                                            setSelectedCategory(e.target.value === '__none' ? '' : e.target.value);
                                        }}
                                        className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer focus:outline-none ${catalogFilter === '0' ? 'bg-gray-900 text-white shadow-sm border border-gray-900' : 'bg-white text-gray-500 border border-gray-200 hover:text-gray-800'}`}
                                    >
                                        <option value="__none" disabled hidden>🏷️ Productos…</option>
                                        <option value="">🏷️ Productos: todas las categorías</option>
                                        {productCategories.map(([nombre, icono]) => (
                                            <option key={nombre} value={nombre}>{icono} {nombre}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="max-h-[46vh] overflow-y-auto divide-y divide-gray-50">
                                {catalogItems.length === 0 && (
                                    <p className="p-6 text-xs text-gray-400 text-center">Sin resultados en el catálogo.</p>
                                )}
                                {catalogItems.map((d) => {
                                    const meta = TIPO_META[String(d.tipo)] || TIPO_META[''];
                                    const Icon = meta.icon;
                                    const qty = inCartQty(d.idPlatillo);
                                    const isProduct = d.tipo === 0;
                                    // Productos: icono y nombre de su categoría; platillos/sub-recetas: su tipo.
                                    const tipoLabel = isProduct
                                        ? (d.categoria || 'Sin categoría')
                                        : d.tipo === 1 ? 'Platillo' : 'Sub-receta';
                                    return (
                                        <button
                                            key={d.idPlatillo}
                                            onClick={() => addFromCatalog(d)}
                                            className={`w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-blue-50/60 transition-colors group ${qty > 0 ? 'bg-emerald-50/60' : ''}`}
                                        >
                                            <span className={`shrink-0 w-7 h-7 rounded-lg grid place-items-center ${meta.cls}`}>
                                                {isProduct
                                                    ? <span className="text-sm leading-none select-none">{d.categoriaIcono || '📦'}</span>
                                                    : <Icon size={14} />}
                                            </span>
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-xs font-bold text-gray-800 truncate uppercase">{d.platillo}</span>
                                                <span className="block text-[10px] text-gray-400 truncate">
                                                    <span className="font-semibold text-gray-500">{tipoLabel}</span>
                                                    {' · '}{d.unidad || 'pza'} · C: {money(d.costo)}
                                                    {d.tipo === 1 && <span className="text-emerald-600 font-semibold"> · P: {money(d.precio)}</span>}
                                                </span>
                                            </span>
                                            {qty > 0 ? (
                                                <span className="shrink-0 flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                                    <ShoppingCart size={10} /> {qty}
                                                </span>
                                            ) : (
                                                <Plus size={15} className="shrink-0 text-gray-300 group-hover:text-blue-500" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── Carrito (líneas editables) ───────────────────── */}
                        <div className="space-y-4">
                            <div className="rounded-xl border border-gray-200 overflow-hidden">
                                <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                                        <ShoppingCart size={13} />
                                        Carrito ({platillos.length})
                                    </span>
                                    <button onClick={addManual} className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
                                        <Plus size={13} /> Concepto manual
                                    </button>
                                </div>
                                <div className="max-h-[46vh] overflow-y-auto p-2 space-y-2">
                                    {platillos.length === 0 && (
                                        <p className="p-4 text-xs text-gray-400 text-center">
                                            El carrito está vacío. Haz clic en un concepto del catálogo o agrega uno manual.
                                        </p>
                                    )}
                                    {platillos.map((p, i) => {
                                        const isManual = p.idPlatillo === '';
                                        const meta = TIPO_META[p.tipo] || TIPO_META[''];
                                        const Icon = meta.icon;
                                        const line = computeDishLineTotals({
                                            cantidad: Number(p.cantidad) || 0,
                                            costoUnitario: Number(p.costoUnitario) || 0,
                                            precioUnitario: Number(p.precioUnitario) || 0,
                                        });
                                        return (
                                            <div key={i} className="rounded-xl border border-gray-200 bg-gray-50/40 p-2.5 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`shrink-0 w-6 h-6 rounded-md grid place-items-center ${meta.cls}`}>
                                                        <Icon size={12} />
                                                    </span>
                                                    {isManual ? (
                                                        <input
                                                            type="text"
                                                            value={p.platillo}
                                                            onChange={(e) => updateDish(i, 'platillo', e.target.value)}
                                                            placeholder="Nombre del concepto (ej. Servicio de barra libre)"
                                                            className="flex-1 min-w-0 text-xs font-bold rounded-lg border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-blue-500 uppercase"
                                                        />
                                                    ) : (
                                                        <span className="flex-1 min-w-0 text-xs font-bold text-gray-800 truncate uppercase">{p.platillo}</span>
                                                    )}
                                                    <button onClick={() => removeDish(i)} className="shrink-0 p-1.5 text-gray-300 hover:text-rose-500 rounded-lg hover:bg-rose-50" aria-label="Quitar concepto">
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                                                    <LabeledField label="Cantidad">
                                                        <input
                                                            type="number" min="0" placeholder="0"
                                                            value={p.cantidad}
                                                            onChange={(e) => updateDish(i, 'cantidad', e.target.value)}
                                                            className="w-full text-xs text-right rounded-lg border border-gray-200 px-1.5 py-1.5 bg-white focus:outline-none focus:border-blue-500"
                                                        />
                                                    </LabeledField>
                                                    <LabeledField label="Unidad">
                                                        <input
                                                            type="text" placeholder="pza"
                                                            value={p.unidad}
                                                            onChange={(e) => updateDish(i, 'unidad', e.target.value)}
                                                            className="w-full text-xs rounded-lg border border-gray-200 px-1.5 py-1.5 bg-white focus:outline-none focus:border-blue-500"
                                                        />
                                                    </LabeledField>
                                                    <LabeledField label="Costo">
                                                        <input
                                                            type="number" min="0" step="0.01" placeholder="0.00"
                                                            value={p.costoUnitario}
                                                            onChange={(e) => updateDish(i, 'costoUnitario', e.target.value)}
                                                            className="w-full text-xs text-right rounded-lg border border-gray-200 px-1.5 py-1.5 bg-white focus:outline-none focus:border-blue-500"
                                                        />
                                                    </LabeledField>
                                                    <LabeledField label="Precio">
                                                        <input
                                                            type="number" min="0" step="0.01" placeholder="0.00"
                                                            value={p.precioUnitario}
                                                            onChange={(e) => updateDish(i, 'precioUnitario', e.target.value)}
                                                            className="w-full text-xs text-right rounded-lg border border-gray-200 px-1.5 py-1.5 bg-white focus:outline-none focus:border-blue-500"
                                                        />
                                                    </LabeledField>
                                                    <LabeledField label="Total">
                                                        <div className="text-xs text-right font-semibold text-gray-800 px-1.5 py-1.5 tabular-nums">{money(line.total)}</div>
                                                    </LabeledField>
                                                    <LabeledField label="Recaud.">
                                                        <div className={`text-xs text-right font-semibold px-1.5 py-1.5 tabular-nums ${line.recaudacion >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{money(line.recaudacion)}</div>
                                                    </LabeledField>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* Totales siempre visibles al pie del carrito */}
                                <div className="px-3 py-3 border-t border-gray-100 bg-gray-50 grid grid-cols-3 gap-2">
                                    <div className="rounded-xl px-2 py-2.5 text-center shadow-sm" style={{ backgroundColor: '#111827' }}>
                                        <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: '#9ca3af' }}>Costo total</p>
                                        <p className="text-sm sm:text-base font-black tabular-nums leading-tight" style={{ color: '#ffffff' }}>{money(totals.costoTotal)}</p>
                                    </div>
                                    <div className="rounded-xl px-2 py-2.5 text-center shadow-sm" style={{ backgroundColor: '#2563eb' }}>
                                        <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: '#bfdbfe' }}>Recaudación total</p>
                                        <p className="text-sm sm:text-base font-black tabular-nums leading-tight" style={{ color: '#ffffff' }}>{money(totals.ingresoEstimado - totals.costoPlatillos)}</p>
                                    </div>
                                    <div className="rounded-xl px-2 py-2.5 text-center shadow-sm" style={{ backgroundColor: totals.utilidadEstimada >= 0 ? '#059669' : '#e11d48' }}>
                                        <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.75)' }}>Utilidad est.</p>
                                        <p className="text-sm sm:text-base font-black tabular-nums leading-tight" style={{ color: '#ffffff' }}>{money(totals.utilidadEstimada)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Gastos operativos */}
                            <div className="rounded-xl border border-gray-200 overflow-hidden">
                                <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Gastos operativos</span>
                                    <button onClick={addGasto} className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
                                        <Plus size={13} /> Agregar gasto
                                    </button>
                                </div>
                                <div className="p-2 space-y-2">
                                    {gastos.length === 0 && (
                                        <p className="p-2 text-xs text-gray-400 text-center">Sin gastos. Agrega meseros, mobiliario, transporte…</p>
                                    )}
                                    {gastos.map((g, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={g.concepto}
                                                onChange={(e) => updateGasto(i, 'concepto', e.target.value)}
                                                placeholder="Concepto"
                                                className="flex-1 text-xs rounded-lg border border-gray-200 px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                                            />
                                            <input
                                                type="number" min="0" step="0.01"
                                                value={g.monto}
                                                onChange={(e) => updateGasto(i, 'monto', e.target.value)}
                                                placeholder="0.00"
                                                className="w-28 text-xs text-right rounded-lg border border-gray-200 px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                                            />
                                            <button onClick={() => removeGasto(i)} className="p-1.5 text-gray-300 hover:text-rose-500 rounded-lg hover:bg-rose-50" aria-label="Quitar gasto">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Recaudación y notas */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Input
                                    label="Recaudación del evento"
                                    type="number" min="0" step="0.01"
                                    value={formData.recaudacion}
                                    onChange={(e) => setFormData({ ...formData, recaudacion: e.target.value })}
                                    placeholder="0.00"
                                    hint="Lo realmente recaudado tras el evento."
                                />
                                <div className="w-full flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notas</label>
                                    <textarea
                                        value={formData.notas}
                                        onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                                        rows={2}
                                        placeholder="Observaciones (opcional)"
                                        className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:border-blue-500 text-gray-800"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Overlay: Resumen ─────────────────────────────────────── */}
                {showSummary && (
                    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4" onClick={() => setShowSummary(false)}>
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
                            <div className="px-5 py-3 bg-gray-900 flex items-center justify-between">
                                <h4 className="text-sm font-bold" style={{ color: '#ffffff' }}>Resumen de la cotización</h4>
                                <button onClick={() => setShowSummary(false)} className="p-1 rounded-lg hover:bg-white/15" style={{ color: '#ffffff' }}>
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="p-5 space-y-3">
                                <SummaryRow label="Total de platillos" value={String(totals.cantidadPlatillos)} />
                                <SummaryRow label="Costo de platillos" value={money(totals.costoPlatillos)} hint="Σ cantidad × costo unitario" />
                                <SummaryRow label="Ingreso estimado" value={money(totals.ingresoEstimado)} hint="Σ cantidad × precio unitario" />
                                <SummaryRow label="Recaudación de platillos" value={money(totals.ingresoEstimado - totals.costoPlatillos)} hint="Σ (cant × precio) − (cant × costo)" positive={(totals.ingresoEstimado - totals.costoPlatillos) >= 0} />
                                <SummaryRow label="Gastos operativos" value={money(totals.gastosOperativos)} />
                                <div className="border-t border-gray-200 my-1" />
                                <SummaryRow label="Costo total" value={money(totals.costoTotal)} strong />
                                <SummaryRow label="Utilidad estimada" value={money(totals.utilidadEstimada)} positive={totals.utilidadEstimada >= 0} />
                                <div className="border-t border-gray-200 my-1" />
                                <SummaryRow label="Recaudación" value={money(Number(formData.recaudacion) || 0)} />
                                <SummaryRow label="Utilidad real" value={money(totals.utilidadReal)} positive={totals.utilidadReal >= 0} strong />
                                <SummaryRow label="Margen real" value={`${totals.margenReal.toFixed(1)}%`} positive={totals.margenReal >= 0} />
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Overlay: Plantillas ──────────────────────────────────── */}
                {showTemplates && (
                    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4" onClick={() => setShowTemplates(false)}>
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
                            <div className="px-5 py-3 bg-gray-900 flex items-center justify-between">
                                <h4 className="text-sm font-bold flex items-center gap-2" style={{ color: '#ffffff' }}>
                                    <BookMarked size={15} /> Plantillas de cotización
                                </h4>
                                <button onClick={() => setShowTemplates(false)} className="p-1 rounded-lg hover:bg-white/15" style={{ color: '#ffffff' }}>
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="p-4 space-y-4">
                                {/* Guardar la cotización actual como plantilla */}
                                <div className={`rounded-xl border p-3 space-y-2 ${editingTemplate ? 'border-blue-300 bg-blue-50/50' : 'border-gray-200 bg-gray-50/60'}`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                                            {editingTemplate ? `Actualizar plantilla “${editingTemplate.Nombre}”` : 'Guardar como plantilla'}
                                        </p>
                                        {editingTemplate && (
                                            <button onClick={cancelEditTemplate} className="text-[11px] font-bold text-gray-400 hover:text-gray-700">
                                                Cancelar edición
                                            </button>
                                        )}
                                    </div>
                                    {/* Alcance: qué secciones guarda la plantilla */}
                                    <div className="flex items-center gap-1 flex-wrap">
                                        {([
                                            { id: 'all', label: 'Conceptos + Gastos' },
                                            { id: 'conceptos', label: 'Solo conceptos' },
                                            { id: 'gastos', label: 'Solo gastos operativos' },
                                        ] as const).map((s) => (
                                            <button
                                                key={s.id}
                                                onClick={() => setTemplateScope(s.id)}
                                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${templateScope === s.id ? 'bg-gray-900 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200 hover:text-gray-800'}`}
                                            >
                                                {s.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={templateName}
                                            onChange={(e) => setTemplateName(e.target.value)}
                                            placeholder="Nombre de la plantilla (ej. Taquiza 50 pax)"
                                            className="flex-1 text-xs rounded-lg border border-gray-200 px-2.5 py-2 bg-white focus:outline-none focus:border-blue-500"
                                        />
                                        <Button
                                            variant="solid" size="sm" leftIcon={Save}
                                            onClick={saveTemplate}
                                            isLoading={savingTemplate}
                                            disabled={!templateName.trim() || !canSaveTemplate}
                                        >
                                            {editingTemplate ? 'Actualizar' : 'Guardar'}
                                        </Button>
                                    </div>
                                    {!canSaveTemplate && (
                                        <p className="text-[10px] text-amber-600">
                                            {templateScope === 'gastos'
                                                ? 'Agrega gastos operativos para poder guardarla.'
                                                : templateScope === 'conceptos'
                                                    ? 'Agrega conceptos al carrito para poder guardarla.'
                                                    : 'Agrega conceptos o gastos para poder guardarla.'}
                                        </p>
                                    )}
                                </div>

                                {/* Plantillas guardadas */}
                                <div className="space-y-1 max-h-60 overflow-y-auto">
                                    {templates.length === 0 && (
                                        <p className="text-xs text-gray-400 text-center py-4">Aún no hay plantillas guardadas.</p>
                                    )}
                                    {templates.map((t) => (
                                        <div key={t.IdPlantilla} className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50">
                                            <BookMarked size={14} className="shrink-0 text-gray-400" />
                                            <span className="flex-1 min-w-0 text-xs font-semibold text-gray-800 truncate">{t.Nombre}</span>
                                            <span className="shrink-0 text-[10px] text-gray-400">
                                                {(t.datos?.platillos?.length || 0) > 0 && `${t.datos!.platillos!.length} conceptos`}
                                                {(t.datos?.platillos?.length || 0) > 0 && (t.datos?.gastos?.length || 0) > 0 && ' · '}
                                                {(t.datos?.gastos?.length || 0) > 0 && `${t.datos!.gastos!.length} gastos`}
                                            </span>
                                            <button
                                                onClick={() => applyTemplate(t)}
                                                className="shrink-0 text-[11px] font-bold text-blue-600 hover:text-blue-800 px-2 py-1 rounded-md hover:bg-blue-50"
                                            >
                                                Aplicar
                                            </button>
                                            <button
                                                onClick={() => startEditTemplate(t)}
                                                className="shrink-0 p-1.5 text-gray-300 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                                                aria-label="Editar plantilla"
                                                title="Editar: carga su contenido al carrito para modificarlo"
                                            >
                                                <Pencil size={13} />
                                            </button>
                                            <button
                                                onClick={() => deleteTemplate(t)}
                                                className="shrink-0 p-1.5 text-gray-300 hover:text-rose-500 rounded-lg hover:bg-rose-50"
                                                aria-label="Eliminar plantilla"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] text-gray-400">Al aplicar una plantilla se reemplazan los conceptos y gastos del carrito actual.</p>
                            </div>
                        </div>
                    </div>
                )}
            </BaseModal>

            {/* Delete Modal */}
            <BaseModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Eliminar cotización"
                size="sm"
                onConfirm={handleDelete}
                confirmVariant="danger"
                confirmLabel="Sí, eliminar"
            >
                <div className="flex flex-col items-center gap-4 py-2 text-center">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                        <AlertTriangle size={24} className="text-red-500" />
                    </div>
                    <div>
                        <p className="font-semibold text-gray-800">¿Eliminar “{editing?.NombreEvento}”?</p>
                        <p className="text-sm text-gray-500 mt-1">Esta acción no se puede deshacer.</p>
                    </div>
                </div>
            </BaseModal>
        </PageShell>
    );
}

function LabeledField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide leading-tight">{label}</span>
            {children}
            {hint && <span className="text-[9px] text-gray-400 leading-none px-2">{hint}</span>}
        </div>
    );
}

function StatusSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const confirmed = value === 'confirmada';
    return (
        <div className="relative inline-flex">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={`appearance-none cursor-pointer text-xs font-semibold rounded-full pl-6 pr-6 py-1 border focus:outline-none transition-colors ${
                    confirmed
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
            >
                <option value="pendiente">Pendiente</option>
                <option value="confirmada">Confirmada</option>
            </select>
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2">
                {confirmed ? <CheckCircle2 size={12} className="text-emerald-600" /> : <Clock size={12} className="text-amber-600" />}
            </span>
        </div>
    );
}

function SummaryRow({ label, value, hint, strong, positive }: { label: string; value: string; hint?: string; strong?: boolean; positive?: boolean }) {
    return (
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <p className={`text-xs ${strong ? 'font-bold text-gray-900' : 'font-medium text-gray-600'}`}>{label}</p>
                {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
            </div>
            <span className={`text-sm tabular-nums ${strong ? 'font-bold' : 'font-semibold'} ${positive === undefined ? 'text-gray-900' : positive ? 'text-emerald-600' : 'text-rose-600'}`}>
                {value}
            </span>
        </div>
    );
}
