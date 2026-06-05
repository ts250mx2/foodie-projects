'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Loader2, SlidersHorizontal } from 'lucide-react';
import PageShell from '@/components/PageShell';
import ReportViewer from '@/components/dashboard/ReportViewer';

interface ReportParam { key: string; label: string; type: 'month' | 'year'; default?: number }

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function getProjectId(): number | null {
    try { const p = JSON.parse(localStorage.getItem('project') || '{}'); return p.idProyecto || p.IdProyecto || null; }
    catch { return null; }
}
function defaultValue(p: ReportParam): number {
    if (typeof p.default === 'number') return p.default;
    const now = new Date();
    return p.type === 'year' ? now.getFullYear() : now.getMonth() + 1;
}

export default function ReporteVisorPage() {
    const params = useParams();
    const locale = (params?.locale as string) || 'es';
    const id = Number(params?.id);
    const [data, setData] = useState<{ definition: any; rows: any[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [paramValues, setParamValues] = useState<Record<string, number>>({});
    const initialized = useRef(false);

    const load = async (values?: Record<string, number>) => {
        const pid = getProjectId();
        if (!pid) { setError('No se detectó un proyecto activo.'); setLoading(false); return; }
        setLoading(true);
        setError(null);
        try {
            const qs = new URLSearchParams({ projectId: String(pid) });
            for (const [k, v] of Object.entries(values || {})) qs.set(k, String(v));
            const res = await fetch(`/api/reports/${id}/data?${qs.toString()}`);
            const j = await res.json();
            if (!res.ok || j.error) throw new Error(j.error || 'No se pudo cargar el reporte');
            setData({ definition: j.definition, rows: j.rows || [] });
            // Inicializa los controles de período con los defaults del reporte (una vez).
            if (!initialized.current) {
                const ps: ReportParam[] = Array.isArray(j.definition?.parameters) ? j.definition.parameters : [];
                if (ps.length) setParamValues(Object.fromEntries(ps.map(p => [p.key, defaultValue(p)])));
                initialized.current = true;
            }
        } catch (e: any) {
            setError(e?.message || 'Error');
        } finally { setLoading(false); }
    };

    useEffect(() => { if (id) load(); /* eslint-disable-next-line */ }, [id]);

    const onParamChange = (key: string, value: number) => {
        const next = { ...paramValues, [key]: value };
        setParamValues(next);
        load(next);
    };

    const reportParams: ReportParam[] = Array.isArray(data?.definition?.parameters) ? data!.definition.parameters : [];
    const now = new Date();
    const YEARS = Array.from(new Set([now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2, now.getFullYear() - 3])).sort((a, b) => b - a);

    return (
        <PageShell
            title={data?.definition?.title || 'Reporte'}
            subtitle="Reporte guardado · cámbialo de período y se vuelve a ejecutar"
            icon="📊"
            actions={
                <>
                    <button onClick={() => load(paramValues)} title="Volver a ejecutar"
                        className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors">
                        <RefreshCw size={16} />
                    </button>
                    <Link href={`/${locale}/dashboard/reportes`} className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-all">
                        <ArrowLeft size={14} /> Mis Reportes
                    </Link>
                </>
            }
        >
            {/* Controles de período (solo si el reporte tiene parámetros) */}
            {reportParams.length > 0 && (
                <div className="mb-4 flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-gray-500">
                        <SlidersHorizontal size={14} /> Período
                    </span>
                    {reportParams.map(p => (
                        <label key={p.key} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600">
                            {p.label}
                            {p.type === 'month' ? (
                                <select
                                    value={paramValues[p.key] ?? defaultValue(p)}
                                    onChange={e => onParamChange(p.key, Number(e.target.value))}
                                    disabled={loading}
                                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-800 font-bold outline-none focus:border-orange-300 cursor-pointer">
                                    {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                                </select>
                            ) : (
                                <select
                                    value={paramValues[p.key] ?? defaultValue(p)}
                                    onChange={e => onParamChange(p.key, Number(e.target.value))}
                                    disabled={loading}
                                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-800 font-bold outline-none focus:border-orange-300 cursor-pointer">
                                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            )}
                        </label>
                    ))}
                    {loading && <Loader2 size={16} className="animate-spin text-orange-500" />}
                </div>
            )}

            {loading && !data && (
                <div className="flex items-center justify-center gap-2 text-gray-400 font-medium py-20">
                    <Loader2 size={18} className="animate-spin" /> Ejecutando el reporte…
                </div>
            )}
            {error && !loading && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 font-medium">{error}</div>
            )}
            {!error && data && (
                <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                    <ReportViewer definition={data.definition} rows={data.rows} />
                </div>
            )}
        </PageShell>
    );
}
