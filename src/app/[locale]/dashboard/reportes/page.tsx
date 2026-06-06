'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Plus, Pencil, X, Save, GripVertical, Layers } from 'lucide-react';
import { FcBarChart, FcLineChart, FcPieChart, FcDataSheet, FcComboChart, FcFolder, FcOpenedFolder, FcFullTrash, FcRefresh, FcMindMap } from 'react-icons/fc';
import type { IconType } from 'react-icons';
import PageShell from '@/components/PageShell';

interface ReportItem {
    idReporte: number;
    titulo: string;
    descripcion: string | null;
    visualization: string | null;
    modelo: string | null;
    fechaCreacion: string;
    idCarpeta: number | null;
}
interface FolderItem { idCarpeta: number; nombre: string; total: number; fechaCreacion: string }

const VIZ_ICON: Record<string, IconType> = { bar: FcBarChart, line: FcLineChart, pie: FcPieChart, table: FcDataSheet, kpi: FcComboChart };
const VIZ_OPTS = [
    { id: 'kpi', label: '🔢 KPIs' },
    { id: 'table', label: '📋 Tabla' },
    { id: 'bar', label: '📊 Barras' },
    { id: 'line', label: '📈 Línea' },
    { id: 'pie', label: '🥧 Pastel' },
];
const MODEL_LABELS: Record<string, string> = {
    'claude-opus-4-8': 'Opus 4.8', 'claude-sonnet-4-6': 'Sonnet 4.6', 'claude-haiku-4-5-20251001': 'Haiku 4.5',
};
// null = Todos · 'none' = Sin carpeta · number = id de carpeta
type Filter = null | 'none' | number;

function getProjectId(): number | null {
    try { const p = JSON.parse(localStorage.getItem('project') || '{}'); return p.idProyecto || p.IdProyecto || null; }
    catch { return null; }
}
function fmtFecha(iso: string): string {
    try { return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; }
}

export default function MisReportesPage() {
    const params = useParams();
    const locale = (params?.locale as string) || 'es';
    const [reports, setReports] = useState<ReportItem[]>([]);
    const [folders, setFolders] = useState<FolderItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<number | null>(null);
    const [projectId, setProjectId] = useState<number | null>(null);
    const [filter, setFilter] = useState<Filter>(null);
    // Edición
    const [editing, setEditing] = useState<ReportItem | null>(null);
    const [savingEdit, setSavingEdit] = useState(false);
    // Drag & drop
    const [dragId, setDragId] = useState<number | null>(null);
    const [dropTarget, setDropTarget] = useState<Filter | undefined>(undefined);

    const load = useCallback(async (pid: number) => {
        setLoading(true);
        try {
            const [r, f] = await Promise.all([
                fetch(`/api/reports?projectId=${pid}`).then(x => x.json()),
                fetch(`/api/reports/folders?projectId=${pid}`).then(x => x.json()),
            ]);
            setReports(Array.isArray(r.reports) ? r.reports : []);
            setFolders(Array.isArray(f.folders) ? f.folders : []);
        } catch { setReports([]); setFolders([]); } finally { setLoading(false); }
    }, []);

    useEffect(() => {
        const pid = getProjectId();
        setProjectId(pid);
        if (pid) load(pid); else setLoading(false);
    }, [load]);

    const handleDelete = async (id: number) => {
        if (!projectId || !confirm('¿Eliminar este reporte?')) return;
        setBusy(id);
        try {
            await fetch(`/api/reports?projectId=${projectId}&id=${id}`, { method: 'DELETE' });
            setReports(prev => prev.filter(r => r.idReporte !== id));
            if (projectId) load(projectId);
        } catch { alert('No se pudo eliminar'); } finally { setBusy(null); }
    };

    const moveReport = async (id: number, idCarpeta: number | null) => {
        if (!projectId) return;
        setReports(prev => prev.map(r => r.idReporte === id ? { ...r, idCarpeta } : r));
        try {
            await fetch('/api/reports', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, id, idCarpeta }),
            });
            load(projectId);
        } catch { alert('No se pudo mover el reporte'); }
    };

    const saveEdit = async () => {
        if (!projectId || !editing) return;
        setSavingEdit(true);
        try {
            await fetch('/api/reports', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId, id: editing.idReporte,
                    titulo: editing.titulo, descripcion: editing.descripcion ?? '', visualization: editing.visualization,
                }),
            });
            setEditing(null);
            load(projectId);
        } catch { alert('No se pudo guardar'); } finally { setSavingEdit(false); }
    };

    const createFolder = async () => {
        if (!projectId) return;
        const nombre = prompt('Nombre de la nueva carpeta:')?.trim();
        if (!nombre) return;
        try {
            const res = await fetch('/api/reports/folders', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, nombre }),
            }).then(x => x.json());
            if (res.error) throw new Error(res.error);
            load(projectId);
        } catch { alert('No se pudo crear la carpeta'); }
    };

    const renameFolder = async (f: FolderItem) => {
        if (!projectId) return;
        const nombre = prompt('Nuevo nombre de la carpeta:', f.nombre)?.trim();
        if (!nombre || nombre === f.nombre) return;
        try {
            await fetch('/api/reports/folders', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, id: f.idCarpeta, nombre }),
            });
            load(projectId);
        } catch { alert('No se pudo renombrar'); }
    };

    const deleteFolder = async (f: FolderItem) => {
        if (!projectId || !confirm(`¿Eliminar la carpeta "${f.nombre}"? Sus reportes pasarán a "Sin carpeta" (no se borran).`)) return;
        try {
            await fetch(`/api/reports/folders?projectId=${projectId}&id=${f.idCarpeta}`, { method: 'DELETE' });
            if (filter === f.idCarpeta) setFilter(null);
            load(projectId);
        } catch { alert('No se pudo eliminar la carpeta'); }
    };

    // ── Drag & drop ──
    const onDropTo = (target: number | null) => {
        if (dragId == null) return;
        moveReport(dragId, target);
        setDragId(null);
        setDropTarget(undefined);
    };

    const sinCarpeta = reports.filter(r => r.idCarpeta == null).length;
    const visible = filter === null ? reports
        : filter === 'none' ? reports.filter(r => r.idCarpeta == null)
            : reports.filter(r => r.idCarpeta === filter);

    const chip = (active: boolean, isDrop: boolean) =>
        `inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold border transition-all ${isDrop
            ? 'bg-orange-100 border-orange-400 ring-2 ring-orange-200 scale-105'
            : active
                ? 'bg-orange-50 border-orange-300 text-orange-700'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`;

    const dropHandlers = (target: number | null, key: Filter) => ({
        onDragOver: (e: React.DragEvent) => { if (dragId != null) { e.preventDefault(); setDropTarget(key); } },
        onDragLeave: () => setDropTarget(t => (t === key ? undefined : t)),
        onDrop: (e: React.DragEvent) => { e.preventDefault(); onDropTo(target); },
    });

    return (
        <PageShell
            title="Mis Reportes"
            subtitle="Reportes creados con el Agente Avanzado · arrástralos a una carpeta para organizarlos"
            icon={Layers}
            actions={
                <>
                    <button onClick={() => projectId && load(projectId)} title="Recargar"
                        className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors">
                        <FcRefresh size={18} />
                    </button>
                    <Link href={`/${locale}/dashboard/reportes/nuevo`}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold transition-all active:scale-[0.98] shadow-sm"
                        style={{ backgroundColor: 'var(--color-brand-orange, #f4481e)' }}>
                        <Plus size={16} /> Crear reporte
                    </Link>
                </>
            }
        >
            {/* Filtro por carpetas (también son zonas para soltar al arrastrar) */}
            {!loading && projectId && (
                <div className="flex flex-wrap items-center gap-2 mb-5">
                    <button onClick={() => setFilter(null)} className={chip(filter === null, false)}>
                        Todos <span className="text-gray-400 font-semibold">({reports.length})</span>
                    </button>
                    {folders.map(f => {
                        const active = filter === f.idCarpeta;
                        const isDrop = dropTarget === f.idCarpeta && dragId != null;
                        return (
                            <div key={f.idCarpeta} className={chip(active, isDrop)} {...dropHandlers(f.idCarpeta, f.idCarpeta)}>
                                <button onClick={() => setFilter(f.idCarpeta)} className="inline-flex items-center gap-1.5">
                                    <FcFolder size={16} /> {f.nombre} <span className="text-gray-400 font-semibold">({f.total})</span>
                                </button>
                                {active && (
                                    <span className="flex items-center gap-0.5 ml-1 pl-1.5 border-l border-orange-200">
                                        <button onClick={() => renameFolder(f)} title="Renombrar" className="p-0.5 text-orange-500 hover:text-orange-700"><Pencil size={13} /></button>
                                        <button onClick={() => deleteFolder(f)} title="Eliminar carpeta" className="p-0.5 hover:opacity-80"><FcFullTrash size={15} /></button>
                                    </span>
                                )}
                            </div>
                        );
                    })}
                    <button {...dropHandlers(null, 'none')}
                        onClick={() => setFilter('none')}
                        className={chip(filter === 'none', dropTarget === 'none' && dragId != null)}>
                        Sin carpeta <span className="text-gray-400 font-semibold">({sinCarpeta})</span>
                    </button>
                    <button onClick={createFolder} title="Nueva carpeta"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold text-gray-500 border border-dashed border-gray-300 hover:border-orange-300 hover:text-orange-600 transition-all">
                        <FcOpenedFolder size={16} /> Carpeta
                    </button>
                </div>
            )}

            {loading && <div className="text-gray-400 font-medium py-16 text-center">Cargando reportes…</div>}

            {!loading && !projectId && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl p-4 font-medium">
                    No se detectó un proyecto activo. Selecciona tu proyecto para ver tus reportes.
                </div>
            )}

            {!loading && projectId && reports.length === 0 && (
                <div className="flex flex-col items-center justify-center text-center py-20 bg-white rounded-3xl border border-gray-100">
                    <FcComboChart className="w-14 h-14 mb-4 opacity-90" />
                    <h2 className="text-lg font-black text-gray-700">Aún no tienes reportes</h2>
                    <p className="text-gray-500 font-medium max-w-sm mt-1">Crea tu primer reporte describiéndolo en lenguaje natural con el Agente Avanzado.</p>
                    <Link href={`/${locale}/dashboard/reportes/nuevo`}
                        className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-xl text-white font-bold shadow-sm"
                        style={{ backgroundColor: 'var(--color-brand-orange, #f4481e)' }}>
                        <Plus size={16} /> Crear mi primer reporte
                    </Link>
                </div>
            )}

            {!loading && reports.length > 0 && visible.length === 0 && (
                <div className="text-center text-gray-400 font-medium py-16 bg-white rounded-3xl border border-gray-100">
                    No hay reportes en esta carpeta.
                </div>
            )}

            {!loading && visible.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {visible.map(r => (
                        <div key={r.idReporte}
                            draggable
                            onDragStart={() => setDragId(r.idReporte)}
                            onDragEnd={() => { setDragId(null); setDropTarget(undefined); }}
                            className={`group bg-white rounded-3xl border transition-all overflow-hidden flex flex-col cursor-grab active:cursor-grabbing ${dragId === r.idReporte ? 'opacity-50 border-orange-300' : 'border-gray-100 hover:border-orange-300 hover:shadow-xl'}`}>
                            <Link href={`/${locale}/dashboard/reportes/${r.idReporte}`} draggable={false} className="flex-1 p-5">
                                <div className="flex items-start justify-between">
                                    {(() => { const Ic = VIZ_ICON[r.visualization || 'table'] || FcDataSheet; return <Ic size={28} />; })()}
                                    <GripVertical size={16} className="text-gray-200 group-hover:text-gray-400 transition-colors" />
                                </div>
                                <h3 className="font-black text-gray-800 mt-3 leading-tight group-hover:text-orange-700">{r.titulo}</h3>
                                {r.descripcion && <p className="text-sm text-gray-500 mt-1.5 line-clamp-2">{r.descripcion}</p>}
                                <div className="flex items-center flex-wrap gap-2 mt-3">
                                    <p className="text-[11px] text-gray-400">{fmtFecha(r.fechaCreacion)}</p>
                                    {r.modelo && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-100 rounded-full px-2 py-0.5">
                                            <FcMindMap size={12} /> {MODEL_LABELS[r.modelo] || r.modelo}
                                        </span>
                                    )}
                                </div>
                            </Link>
                            <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between gap-2">
                                <select
                                    value={r.idCarpeta ?? ''}
                                    onChange={e => moveReport(r.idReporte, e.target.value === '' ? null : Number(e.target.value))}
                                    title="Mover a carpeta"
                                    className="text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-orange-300 cursor-pointer max-w-[48%]">
                                    <option value="">📂 Sin carpeta</option>
                                    {folders.map(f => <option key={f.idCarpeta} value={f.idCarpeta}>📁 {f.nombre}</option>)}
                                </select>
                                <div className="flex items-center gap-1">
                                    <Link href={`/${locale}/dashboard/reportes/${r.idReporte}`} draggable={false} className="text-sm font-bold text-orange-600 hover:text-orange-700 px-1">Abrir →</Link>
                                    <button onClick={() => setEditing(r)}
                                        className="p-2 rounded-lg text-gray-300 hover:text-orange-600 hover:bg-orange-50 transition-colors" title="Editar">
                                        <Pencil size={15} />
                                    </button>
                                    <button onClick={() => handleDelete(r.idReporte)} disabled={busy === r.idReporte}
                                        className="p-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50" title="Eliminar">
                                        <FcFullTrash size={17} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de edición */}
            {editing && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setEditing(null)}>
                    <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h3 className="font-black text-gray-800 text-lg">Editar reporte</h3>
                            <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Título</label>
                                <input
                                    value={editing.titulo}
                                    onChange={e => setEditing({ ...editing, titulo: e.target.value })}
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-orange-300"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Descripción</label>
                                <textarea
                                    value={editing.descripcion ?? ''}
                                    onChange={e => setEditing({ ...editing, descripcion: e.target.value })}
                                    rows={3}
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-orange-300 resize-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Visualización</label>
                                <select
                                    value={editing.visualization ?? 'table'}
                                    onChange={e => setEditing({ ...editing, visualization: e.target.value })}
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-orange-300 cursor-pointer">
                                    {VIZ_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
                            <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100">Cancelar</button>
                            <button onClick={saveEdit} disabled={savingEdit || !editing.titulo.trim()}
                                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-50 shadow-sm"
                                style={{ backgroundColor: 'var(--color-brand-orange, #f4481e)' }}>
                                <Save size={15} /> {savingEdit ? 'Guardando…' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PageShell>
    );
}
