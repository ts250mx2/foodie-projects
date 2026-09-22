'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Check, ChevronRight, Link2, Loader2, Search, Unlink, X } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

type Report = {
    IdReporte: number; FechaInicio: string; FechaFin: string; SucursalReporte: string;
    NumeroArticulos: number; ArticulosRelacionados: number; CantidadTotal: number; SubtotalTotal: number;
};
type Detail = {
    IdDetalle: number; ClaveReporte: string; NombreReporte: string; GrupoReporte: string | null;
    Cantidad: number; Subtotal: number; Porcentaje: number; IdProducto: number | null;
    TipoRelacion: string; Confianza: number; PlatilloSistema: string | null; CodigoSistema: string | null;
};
type Dish = { IdProducto: number; Producto: string; Codigo: string | null };
type Props = { projectId: number; onClose: () => void };

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });
const number = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

function normalize(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function similarity(left: string, right: string) {
    const a = normalize(left); const b = normalize(right);
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;
    const pairs = new Map<string, number>();
    for (let index = 0; index < a.length - 1; index += 1) {
        const pair = a.slice(index, index + 2); pairs.set(pair, (pairs.get(pair) || 0) + 1);
    }
    let matches = 0;
    for (let index = 0; index < b.length - 1; index += 1) {
        const pair = b.slice(index, index + 2); const count = pairs.get(pair) || 0;
        if (count) { matches += 1; pairs.set(pair, count - 1); }
    }
    return (2 * matches) / (a.length + b.length - 2);
}

export default function DishSalesStatsViewer({ projectId, onClose }: Props) {
    const toast = useToast();
    const [reports, setReports] = useState<Report[]>([]);
    const [reportId, setReportId] = useState<number | null>(null);
    const [details, setDetails] = useState<Detail[]>([]);
    const [dishes, setDishes] = useState<Dish[]>([]);
    const [selected, setSelected] = useState<Detail | null>(null);
    const [search, setSearch] = useState('');
    const [dishSearch, setDishSearch] = useState('');
    const [onlyUnlinked, setOnlyUnlinked] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const loadReports = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/sales/dish-stats?projectId=${projectId}`, { cache: 'no-store' });
            const payload = await response.json();
            if (!response.ok || !payload.success) throw new Error(payload.message);
            const nextReports = payload.data.reports as Report[];
            setReports(nextReports);
            setReportId(current => {
                const currentStillExists = current && nextReports.some(report => Number(report.IdReporte) === current);
                return currentStillExists ? current : nextReports[0]?.IdReporte ?? null;
            });
        } catch (reason) {
            toast.error(reason instanceof Error ? reason.message : 'No se pudieron cargar los periodos.');
        } finally {
            setLoading(false);
        }
    }, [projectId, toast]);

    const loadDetails = useCallback(async (id: number) => {
        setLoading(true); setSelected(null);
        try {
            const response = await fetch(`/api/sales/dish-stats?projectId=${projectId}&reportId=${id}`, { cache: 'no-store' });
            const payload = await response.json();
            if (!response.ok || !payload.success) throw new Error(payload.message);
            setReports(payload.data.reports); setDetails(payload.data.details); setDishes(payload.data.dishes);
        } catch (reason) {
            toast.error(reason instanceof Error ? reason.message : 'No se pudo cargar el periodo.');
        } finally { setLoading(false); }
    }, [projectId, toast]);

    useEffect(() => { void loadReports(); }, [loadReports]);
    useEffect(() => { if (reportId) void loadDetails(reportId); }, [reportId, loadDetails]);
    useEffect(() => {
        const close = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            if (selected) setSelected(null);
            else onClose();
        };
        document.body.style.overflow = 'hidden'; window.addEventListener('keydown', close);
        return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', close); };
    }, [onClose, selected]);

    const activeReport = reports.find(report => Number(report.IdReporte) === reportId);
    const filtered = useMemo(() => {
        const term = normalize(search.trim());
        return details.filter(item => {
            if (onlyUnlinked && item.IdProducto) return false;
            return !term || normalize(`${item.ClaveReporte} ${item.NombreReporte} ${item.GrupoReporte || ''} ${item.PlatilloSistema || ''}`).includes(term);
        });
    }, [details, onlyUnlinked, search]);
    const dishOptions = useMemo(() => {
        const term = normalize(dishSearch.trim());
        if (term) return dishes.filter(dish => normalize(`${dish.Codigo || ''} ${dish.Producto}`).includes(term)).slice(0, 80);
        if (!selected) return dishes.slice(0, 80);
        return [...dishes]
            .sort((left, right) => similarity(selected.NombreReporte, right.Producto) - similarity(selected.NombreReporte, left.Producto))
            .slice(0, 20);
    }, [dishes, dishSearch, selected]);

    const saveRelation = async (productId: number | null) => {
        if (!selected) return;
        setSaving(true);
        try {
            const response = await fetch('/api/sales/dish-stats', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, code: selected.ClaveReporte, productId }),
            });
            const payload = await response.json();
            if (!response.ok || !payload.success) throw new Error(payload.message);
            const dish = dishes.find(item => item.IdProducto === productId);
            setDetails(items => items.map(item => item.ClaveReporte === selected.ClaveReporte ? {
                ...item, IdProducto: productId, PlatilloSistema: dish?.Producto ?? null,
                CodigoSistema: dish?.Codigo ?? null, TipoRelacion: productId ? 'manual' : 'sin_relacion', Confianza: productId ? 100 : 0,
            } : item));
            setReports(items => items.map(item => item.IdReporte === reportId ? {
                ...item,
                ArticulosRelacionados: Number(item.ArticulosRelacionados) + (selected.IdProducto ? -1 : 0) + (productId ? 1 : 0),
            } : item));
            toast.success(payload.message); setSelected(null); setDishSearch('');
        } catch (reason) {
            toast.error(reason instanceof Error ? reason.message : 'No se pudo guardar la relación.');
        } finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-[100] flex bg-slate-950/70 p-2 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label="Ventas por platillo">
            <div className="relative mx-auto flex h-full w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <header className="flex shrink-0 items-center justify-between gap-4 bg-emerald-950 px-5 py-4 text-white">
                    <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300"><BarChart3 size={21} /></span><div><h2 className="font-bold">Ventas por platillo</h2><p className="text-xs text-emerald-100/60">Estadística por periodo y relación con el recetario</p></div></div>
                    <button onClick={onClose} className="rounded-lg p-2 text-emerald-100 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2" aria-label="Cerrar"><X size={20} /></button>
                </header>

                {reports.length === 0 && !loading ? <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><BarChart3 size={36} className="text-slate-300" /><h3 className="mt-3 font-bold text-slate-800">No hay periodos estadísticos</h3><p className="mt-1 max-w-md text-sm text-slate-500">Importa un archivo que contenga las hojas “Resumen” y “Resumen de Ventas”.</p></div> : <>
                    <div className="grid shrink-0 gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 lg:grid-cols-[minmax(260px,1fr)_minmax(260px,1fr)_auto]">
                        <select value={reportId ?? ''} onChange={event => setReportId(Number(event.target.value))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500">
                            {reports.map(report => <option key={report.IdReporte} value={report.IdReporte}>{date.format(new Date(report.FechaInicio))} – {date.format(new Date(report.FechaFin))} · {report.SucursalReporte}</option>)}
                        </select>
                        <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3"><Search size={16} className="text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar clave, artículo o platillo" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
                        <button onClick={() => setOnlyUnlinked(value => !value)} className={`h-10 rounded-lg border px-4 text-sm font-semibold transition ${onlyUnlinked ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`}>Sólo pendientes</button>
                    </div>

                    {activeReport && <div className="grid shrink-0 grid-cols-2 border-b border-slate-200 bg-white sm:grid-cols-4"><div className="px-5 py-3"><span className="block text-[11px] uppercase tracking-wide text-slate-400">Artículos</span><strong className="text-slate-800">{activeReport.NumeroArticulos}</strong></div><div className="px-5 py-3"><span className="block text-[11px] uppercase tracking-wide text-slate-400">Relacionados</span><strong className="text-emerald-700">{activeReport.ArticulosRelacionados} de {activeReport.NumeroArticulos}</strong></div><div className="px-5 py-3"><span className="block text-[11px] uppercase tracking-wide text-slate-400">Unidades</span><strong className="text-slate-800">{number.format(activeReport.CantidadTotal)}</strong></div><div className="px-5 py-3"><span className="block text-[11px] uppercase tracking-wide text-slate-400">Subtotal</span><strong className="text-slate-800">{money.format(activeReport.SubtotalTotal)}</strong></div></div>}

                    <div className="min-h-0 flex-1 overflow-auto">
                        {loading ? <div className="flex h-full min-h-56 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" /> Cargando estadística</div> : <table className="w-full min-w-[900px] text-sm"><thead className="sticky top-0 z-10 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Artículo del reporte</th><th className="px-4 py-3">Grupo</th><th className="px-4 py-3 text-right">Cantidad</th><th className="px-4 py-3 text-right">Subtotal</th><th className="px-4 py-3">Platillo relacionado</th><th className="w-12 px-2 py-3"></th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(item => <tr key={item.IdDetalle} className="hover:bg-emerald-50/40"><td className="px-4 py-3"><span className="block font-semibold text-slate-900">{item.NombreReporte}</span><span className="text-xs font-mono text-slate-400">{item.ClaveReporte}</span></td><td className="px-4 py-3 text-slate-500">{item.GrupoReporte || '—'}</td><td className="px-4 py-3 text-right font-medium text-slate-700">{number.format(item.Cantidad)}</td><td className="px-4 py-3 text-right font-semibold text-slate-900">{money.format(item.Subtotal)}</td><td className="px-4 py-3">{item.IdProducto ? <div className="flex items-center gap-2"><span className={`flex h-6 w-6 items-center justify-center rounded-full ${item.TipoRelacion === 'manual' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}><Check size={13} /></span><div><span className="block font-medium text-slate-800">{item.PlatilloSistema}</span><span className="text-xs text-slate-400">{item.TipoRelacion === 'manual' ? 'Confirmado manualmente' : `Sugerido · ${number.format(item.Confianza)}%`}</span></div></div> : <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"><Unlink size={12} /> Sin relacionar</span>}</td><td className="px-2 py-3"><button onClick={() => { setSelected(item); setDishSearch(''); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-emerald-700" aria-label={`Relacionar ${item.NombreReporte}`}><ChevronRight size={17} /></button></td></tr>)}</tbody></table>}
                    </div>
                </>}

                {selected && <div className="absolute inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-200 p-5"><div><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Relacionar artículo</p><h3 className="mt-1 font-bold text-slate-900">{selected.NombreReporte}</h3><p className="text-xs font-mono text-slate-400">{selected.ClaveReporte}</p></div><button onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Cerrar relación"><X size={18} /></button></div><div className="border-b border-slate-100 p-4"><label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search size={16} className="text-slate-400" /><input autoFocus value={dishSearch} onChange={event => setDishSearch(event.target.value)} placeholder="Buscar en platillos" className="min-w-0 flex-1 text-sm outline-none" /></label>{!dishSearch && <p className="mt-2 text-xs text-slate-400">Ordenados por similitud con el artículo del reporte.</p>}</div><div className="min-h-0 flex-1 overflow-y-auto p-3"><button disabled={saving} onClick={() => saveRelation(null)} className="mb-2 flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-300 px-3 py-3 text-left text-sm text-slate-500 hover:bg-slate-50"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100"><Unlink size={15} /></span>Dejar sin relación</button>{dishOptions.map(dish => <button disabled={saving} key={dish.IdProducto} onClick={() => saveRelation(dish.IdProducto)} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-emerald-50 ${selected.IdProducto === dish.IdProducto ? 'bg-emerald-50 ring-1 ring-emerald-200' : ''}`}><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><Link2 size={15} /></span><span className="min-w-0"><strong className="block truncate text-sm text-slate-800">{dish.Producto}</strong><span className="text-xs font-mono text-slate-400">{dish.Codigo || 'Sin código'} · {number.format(similarity(selected.NombreReporte, dish.Producto) * 100)}% similar</span></span>{saving && selected.IdProducto === dish.IdProducto && <Loader2 size={15} className="ml-auto animate-spin" />}</button>)}</div></div>}
            </div>
        </div>
    );
}
