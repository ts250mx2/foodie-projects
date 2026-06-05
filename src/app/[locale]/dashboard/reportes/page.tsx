'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Plus, RefreshCw, Trash2, FileBarChart, FolderPlus, Pencil, Folder } from 'lucide-react';
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

const VIZ_EMOJI: Record<string, string> = { bar: '📊', line: '📈', pie: '🥧', table: '📋', kpi: '🔢' };
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

    const sinCarpeta = reports.filter(r => r.idCarpeta == null).length;
    const visible = filter === null ? reports
        : filter === 'none' ? reports.filter(r => r.idCarpeta == null)
            : reports.filter(r => r.idCarpeta === filter);

    const chip = (active: boolean) =>
        `inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold border transition-all ${active
            ? 'bg-orange-50 border-orange-300 text-orange-700'
            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`;

    return (
        <PageShell
            title="Mis Reportes"
            subtitle="Reportes creados con el Agente Avanzado · organízalos en carpetas"
            icon="📁"
            actions={
                <>
                    <button onClick={() => projectId && load(projectId)} title="Recargar"
                        className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors">
                        <RefreshCw size={16} />
                    </button>
                    <Link href={`/${locale}/dashboard/reportes/nuevo`}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold transition-all active:scale-[0.98] shadow-sm"
                        style={{ backgroundColor: 'var(--color-brand-orange, #f4481e)' }}>
                        <Plus size={16} /> Crear reporte
                    </Link>
                </>
            }
        >
            {/* Filtro por carpetas */}
            {!loading && projectId && (
                <div className="flex flex-wrap items-center gap-2 mb-5">
                    <button onClick={() => setFilter(null)} className={chip(filter === null)}>
                        Todos <span className="text-gray-400 font-semibold">({reports.length})</span>
                    </button>
                    {folders.map(f => {
                        const active = filter === f.idCarpeta;
                        return (
                            <div key={f.idCarpeta} className={chip(active)}>
                                <button onClick={() => setFilter(f.idCarpeta)} className="inline-flex items-center gap-1.5">
                                    <Folder size={14} /> {f.nombre} <span className="text-gray-400 font-semibold">({f.total})</span>
                                </button>
                                {active && (
                                    <span className="flex items-center gap-0.5 ml-1 pl-1.5 border-l border-orange-200">
                                        <button onClick={() => renameFolder(f)} title="Renombrar" className="p-0.5 text-orange-500 hover:text-orange-700"><Pencil size={13} /></button>
                                        <button onClick={() => deleteFolder(f)} title="Eliminar carpeta" className="p-0.5 text-orange-500 hover:text-red-600"><Trash2 size={13} /></button>
                                    </span>
                                )}
                            </div>
                        );
                    })}
                    <button onClick={() => setFilter('none')} className={chip(filter === 'none')}>
                        Sin carpeta <span className="text-gray-400 font-semibold">({sinCarpeta})</span>
                    </button>
                    <button onClick={createFolder} title="Nueva carpeta"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold text-gray-500 border border-dashed border-gray-300 hover:border-orange-300 hover:text-orange-600 transition-all">
                        <FolderPlus size={15} /> Carpeta
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
                    <FileBarChart className="w-12 h-12 text-gray-300 mb-4" />
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
                        <div key={r.idReporte} className="group bg-white rounded-3xl border border-gray-100 hover:border-orange-300 hover:shadow-xl transition-all overflow-hidden flex flex-col">
                            <Link href={`/${locale}/dashboard/reportes/${r.idReporte}`} className="flex-1 p-5">
                                <span className="text-2xl">{VIZ_EMOJI[r.visualization || 'table'] || '📋'}</span>
                                <h3 className="font-black text-gray-800 mt-3 leading-tight group-hover:text-orange-700">{r.titulo}</h3>
                                {r.descripcion && <p className="text-sm text-gray-500 mt-1.5 line-clamp-2">{r.descripcion}</p>}
                                <div className="flex items-center flex-wrap gap-2 mt-3">
                                    <p className="text-[11px] text-gray-400">{fmtFecha(r.fechaCreacion)}</p>
                                    {r.modelo && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-100 rounded-full px-2 py-0.5">
                                            🧠 {MODEL_LABELS[r.modelo] || r.modelo}
                                        </span>
                                    )}
                                </div>
                            </Link>
                            <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between gap-2">
                                <select
                                    value={r.idCarpeta ?? ''}
                                    onChange={e => moveReport(r.idReporte, e.target.value === '' ? null : Number(e.target.value))}
                                    title="Mover a carpeta"
                                    className="text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-orange-300 cursor-pointer max-w-[55%]">
                                    <option value="">📂 Sin carpeta</option>
                                    {folders.map(f => <option key={f.idCarpeta} value={f.idCarpeta}>📁 {f.nombre}</option>)}
                                </select>
                                <div className="flex items-center gap-1">
                                    <Link href={`/${locale}/dashboard/reportes/${r.idReporte}`} className="text-sm font-bold text-orange-600 hover:text-orange-700 px-1">Abrir →</Link>
                                    <button onClick={() => handleDelete(r.idReporte)} disabled={busy === r.idReporte}
                                        className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50" title="Eliminar">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </PageShell>
    );
}
