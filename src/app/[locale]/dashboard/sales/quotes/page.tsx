'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, AlertTriangle, FileText, X } from 'lucide-react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import BaseModal from '@/components/BaseModal';
import PageShell from '@/components/PageShell';
import ThemedGridHeader, { ThemedGridHeaderCell, TableBody, TableRow, TableCell, RowActionButton } from '@/components/ThemedGridHeader';
import { computeQuoteTotals } from '@/lib/quotes';

interface Dish {
    idPlatillo: number;
    platillo: string;
    codigo: string;
    costo: number;
}

interface Quote {
    IdCotizacion: number;
    NombreEvento: string;
    FechaEvento: string | null;
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
interface DishRow { idPlatillo: string; platillo: string; cantidad: string; costoUnitario: string; precioUnitario: string }

const EMPTY_FORM = { nombreEvento: '', fechaEvento: '', recaudacion: '', notas: '' };
const EMPTY_DISH: DishRow = { idPlatillo: '', platillo: '', cantidad: '', costoUnitario: '', precioUnitario: '' };

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

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) setProject(JSON.parse(storedProject));
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchQuotes();
            fetchDishes();
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

    // ----- líneas de platillo -----
    const addDish = () => setPlatillos((prev) => [...prev, { ...EMPTY_DISH }]);
    const removeDish = (i: number) => setPlatillos((prev) => prev.filter((_, idx) => idx !== i));
    const updateDish = (i: number, field: keyof DishRow, value: string) =>
        setPlatillos((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));

    // Al elegir un platillo en una línea, autollena su costo unitario desde el costeo.
    const selectDish = (i: number, idStr: string) => {
        const dish = dishes.find((d) => String(d.idPlatillo) === idStr);
        setPlatillos((prev) => prev.map((p, idx) => idx === i ? {
            ...p,
            idPlatillo: idStr,
            platillo: dish?.platillo || '',
            costoUnitario: dish ? String(dish.costo) : p.costoUnitario,
        } : p));
    };

    // ----- gastos operativos -----
    const addGasto = () => setGastos((prev) => [...prev, { concepto: '', monto: '' }]);
    const removeGasto = (i: number) => setGastos((prev) => prev.filter((_, idx) => idx !== i));
    const updateGasto = (i: number, field: keyof GastoRow, value: string) =>
        setGastos((prev) => prev.map((g, idx) => (idx === i ? { ...g, [field]: value } : g)));

    const openNew = () => {
        setEditing(null);
        setFormData({ ...EMPTY_FORM });
        setPlatillos([{ ...EMPTY_DISH }]);
        setGastos([]);
        setIsModalOpen(true);
    };

    const openEdit = async (q: Quote) => {
        setEditing(q);
        setFormData({
            nombreEvento: q.NombreEvento || '',
            fechaEvento: q.FechaEvento ? String(q.FechaEvento).substring(0, 10) : '',
            recaudacion: String(q.Recaudacion ?? ''),
            notas: q.Notas || '',
        });
        setPlatillos([]);
        setGastos([]);
        setIsModalOpen(true);
        try {
            const res = await fetch(`/api/sales/quotes/${q.IdCotizacion}?projectId=${project.idProyecto}`);
            const data = await res.json();
            if (data.success) {
                if (Array.isArray(data.data.platillos)) {
                    setPlatillos(data.data.platillos.map((p: any) => {
                        // Recalcula el costo unitario desde el costeo ACTUAL del platillo.
                        const cur = dishes.find((d) => d.idPlatillo === Number(p.IdPlatillo));
                        return {
                            idPlatillo: p.IdPlatillo != null ? String(p.IdPlatillo) : '',
                            platillo: p.Platillo || '',
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
                recaudacion: Number(formData.recaudacion) || 0,
                notas: formData.notas || null,
                platillos: platillos
                    .filter((p) => p.idPlatillo || p.platillo.trim() || p.cantidad)
                    .map((p) => ({
                        idPlatillo: p.idPlatillo ? Number(p.idPlatillo) : null,
                        platillo: p.platillo.trim(),
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
                            <ThemedGridHeaderCell>Fecha</ThemedGridHeaderCell>
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
                            colSpan={7}
                        >
                            {filtered.map((q) => (
                                <TableRow key={q.IdCotizacion}>
                                    <TableCell>
                                        <span className="font-medium text-gray-900">{q.NombreEvento}</span>
                                    </TableCell>
                                    <TableCell muted>{q.FechaEvento ? new Date(q.FechaEvento).toLocaleDateString('es-MX') : '—'}</TableCell>
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

            {/* Create / Edit Modal */}
            <BaseModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editing ? 'Editar cotización' : 'Nueva cotización'}
                subtitle={editing ? editing.NombreEvento : 'Cotiza un evento con varios platillos y calcula costo y utilidad'}
                size="xl"
                onConfirm={handleSubmit}
                confirmLabel="Guardar"
                confirmLoading={isSaving}
            >
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Inputs */}
                    <div className="lg:col-span-3 space-y-4">
                        <Input
                            label="Nombre del evento"
                            value={formData.nombreEvento}
                            onChange={(e) => setFormData({ ...formData, nombreEvento: e.target.value })}
                            placeholder="Ej. Boda Martínez"
                            required
                        />
                        <Input
                            label="Fecha del evento"
                            type="date"
                            value={formData.fechaEvento}
                            onChange={(e) => setFormData({ ...formData, fechaEvento: e.target.value })}
                        />

                        {/* Platillos (varias líneas) */}
                        <div className="space-y-2 pt-2 border-t border-gray-100">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Platillos</label>
                                <button onClick={addDish} className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
                                    <Plus size={13} /> Agregar platillo
                                </button>
                            </div>
                            {platillos.length === 0 && (
                                <p className="text-xs text-gray-400">Agrega uno o varios platillos. El costo se toma del costeo de cada platillo.</p>
                            )}
                            {/* Encabezados (solo en pantallas medianas+) */}
                            {platillos.length > 0 && (
                                <div className="hidden sm:grid grid-cols-12 gap-2 px-1">
                                    <span className="col-span-5 text-[10px] font-bold text-gray-400 uppercase">Platillo</span>
                                    <span className="col-span-2 text-[10px] font-bold text-gray-400 uppercase text-right">Cantidad</span>
                                    <span className="col-span-2 text-[10px] font-bold text-gray-400 uppercase text-right">Costo</span>
                                    <span className="col-span-2 text-[10px] font-bold text-gray-400 uppercase text-right">Precio</span>
                                    <span className="col-span-1" />
                                </div>
                            )}
                            <div className="space-y-2">
                                {platillos.map((p, i) => (
                                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                                        <select
                                            value={p.idPlatillo}
                                            onChange={(e) => selectDish(i, e.target.value)}
                                            className="col-span-12 sm:col-span-5 text-sm rounded-lg border border-gray-200 px-2 py-2 bg-white focus:outline-none focus:border-blue-500"
                                        >
                                            <option value="">Platillo manual…</option>
                                            {dishes.map((d) => (
                                                <option key={d.idPlatillo} value={d.idPlatillo}>{d.platillo} — {money(d.costo)}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="number" min="0" placeholder="Cant."
                                            value={p.cantidad}
                                            onChange={(e) => updateDish(i, 'cantidad', e.target.value)}
                                            className="col-span-4 sm:col-span-2 text-sm text-right rounded-lg border border-gray-200 px-2 py-2 focus:outline-none focus:border-blue-500"
                                        />
                                        <input
                                            type="number" min="0" step="0.01" placeholder="Costo"
                                            value={p.costoUnitario}
                                            onChange={(e) => updateDish(i, 'costoUnitario', e.target.value)}
                                            className="col-span-4 sm:col-span-2 text-sm text-right rounded-lg border border-gray-200 px-2 py-2 focus:outline-none focus:border-blue-500"
                                        />
                                        <input
                                            type="number" min="0" step="0.01" placeholder="Precio"
                                            value={p.precioUnitario}
                                            onChange={(e) => updateDish(i, 'precioUnitario', e.target.value)}
                                            className="col-span-3 sm:col-span-2 text-sm text-right rounded-lg border border-gray-200 px-2 py-2 focus:outline-none focus:border-blue-500"
                                        />
                                        <button onClick={() => removeDish(i)} className="col-span-1 flex justify-center p-2 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-50" aria-label="Quitar platillo">
                                            <X size={15} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Gastos operativos itemizados */}
                        <div className="space-y-2 pt-2 border-t border-gray-100">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Gastos operativos</label>
                                <button onClick={addGasto} className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
                                    <Plus size={13} /> Agregar gasto
                                </button>
                            </div>
                            {gastos.length === 0 && (
                                <p className="text-xs text-gray-400">Sin gastos operativos. Agrega conceptos como meseros, mobiliario, transporte…</p>
                            )}
                            <div className="space-y-2">
                                {gastos.map((g, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={g.concepto}
                                            onChange={(e) => updateGasto(i, 'concepto', e.target.value)}
                                            placeholder="Concepto"
                                            className="flex-1 text-sm rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:border-blue-500"
                                        />
                                        <input
                                            type="number" min="0" step="0.01"
                                            value={g.monto}
                                            onChange={(e) => updateGasto(i, 'monto', e.target.value)}
                                            placeholder="0.00"
                                            className="w-32 text-sm text-right rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:border-blue-500"
                                        />
                                        <button onClick={() => removeGasto(i)} className="p-2 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-50" aria-label="Quitar gasto">
                                            <X size={15} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Input
                            label="Recaudación del evento"
                            type="number" min="0" step="0.01"
                            value={formData.recaudacion}
                            onChange={(e) => setFormData({ ...formData, recaudacion: e.target.value })}
                            placeholder="0.00"
                            hint="Captura lo realmente recaudado tras el evento."
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

                    {/* Resumen calculado */}
                    <div className="lg:col-span-2">
                        <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5 space-y-3 sticky top-0">
                            <h4 className="text-sm font-bold text-gray-900">Resumen</h4>
                            <SummaryRow label="Total de platillos" value={String(totals.cantidadPlatillos)} />
                            <SummaryRow label="Costo de platillos" value={money(totals.costoPlatillos)} hint="Σ cantidad × costo unitario" />
                            <SummaryRow label="Ingreso estimado" value={money(totals.ingresoEstimado)} hint="Σ cantidad × precio unitario" />
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
